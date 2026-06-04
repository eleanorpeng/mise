"""
Integration-ish tests for keyframe extraction (backend/app/services/media.py).

media.py is dependency-light (logging/subprocess/pathlib only) so we import it
directly. Requires ffmpeg; tests are skipped if it's unavailable. We synthesise
videos with ffmpeg lavfi so no fixtures are needed.

Run: python3 .pipeline/tests/test_keyframes.py
"""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import media  # noqa: E402

HAS_FFMPEG = shutil.which("ffmpeg") is not None


def _make_multi_scene_video(path: Path) -> None:
    """Six hard high-contrast cuts (black/white alternating), ~1.5s each — these
    reliably exceed the scene-change threshold so the scene path is exercised."""
    colors = ["black", "white", "black", "white", "black", "white"]
    inputs = []
    for c in colors:
        inputs += ["-f", "lavfi", "-t", "1.5", "-i", f"color=c={c}:s=320x240:r=10"]
    filt = "".join(f"[{i}:v]" for i in range(len(colors))) + f"concat=n={len(colors)}:v=1:a=0[v]"
    subprocess.run(
        ["ffmpeg", *inputs, "-filter_complex", filt, "-map", "[v]", str(path), "-y"],
        capture_output=True, check=True, timeout=60,
    )


def _make_static_video(path: Path) -> None:
    """A single solid color for 8s — no scene changes."""
    subprocess.run(
        ["ffmpeg", "-f", "lavfi", "-t", "8", "-i", "color=c=teal:s=320x240:r=10",
         str(path), "-y"],
        capture_output=True, check=True, timeout=60,
    )


@unittest.skipUnless(HAS_FFMPEG, "ffmpeg not available")
class KeyframeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="kf_test_"))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_multi_scene_uses_scene_frames(self):
        video = self.tmp / "scenes.mp4"
        _make_multi_scene_video(video)
        frames = media.extract_keyframes(video, self.tmp)

        self.assertGreaterEqual(len(frames), media.MIN_SCENE_FRAMES)
        self.assertLessEqual(len(frames), media.MAX_KEYFRAMES)
        # Scene path writes scene_*.jpg; fallback writes frame_*.jpg.
        self.assertTrue(all(f.name.startswith("scene_") for f in frames),
                        msg=f"expected scene_* frames, got {[f.name for f in frames]}")
        self.assertTrue(all(f.exists() and f.stat().st_size > 0 for f in frames))

    def test_static_video_falls_back_to_even_sampling(self):
        video = self.tmp / "static.mp4"
        _make_static_video(video)
        frames = media.extract_keyframes(video, self.tmp)

        self.assertGreater(len(frames), 0)
        self.assertLessEqual(len(frames), media.MAX_KEYFRAMES)
        self.assertTrue(all(f.name.startswith("frame_") for f in frames),
                        msg=f"expected even-sampled frame_* frames, got {[f.name for f in frames]}")


class SubsampleTest(unittest.TestCase):
    def test_returns_all_when_fewer_than_k(self):
        self.assertEqual(media._evenly_subsample([1, 2, 3], 8), [1, 2, 3])

    def test_caps_at_k_with_endpoints(self):
        out = media._evenly_subsample(list(range(100)), 5)
        self.assertEqual(len(out), 5)
        self.assertEqual(out[0], 0)
        self.assertEqual(out[-1], 99)

    def test_spread_is_even(self):
        out = media._evenly_subsample(list(range(9)), 5)
        self.assertEqual(out, [0, 2, 4, 6, 8])


if __name__ == "__main__":
    unittest.main(verbosity=2)
