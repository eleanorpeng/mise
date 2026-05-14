import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { Image as ExpoImage } from 'expo-image';
import { colors, radius, spacing } from '@/constants';
import { Sticker } from '@/components/ui/Sticker';

type StickerItem = { id: string; uri: string };

type Props = {
  items: StickerItem[];
  height?: number;
};

// Tuning constants — change these to feel the system, not the math.
const GRAVITY = 1800;       // px/s² when phone is fully tilted
const DAMPING = 0.985;      // air drag per frame (closer to 1 = floatier)
const WALL_RESTITUTION = 0.45;
const STICKER_RESTITUTION = 0.25;
const SHAKE_THRESHOLD = 1.55;
const SHAKE_IMPULSE = 900;
const MIN_FRAME_DT = 1 / 120;
const MAX_FRAME_DT = 1 / 20;

type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;          // collision radius
  size: number;       // visual size
  rotation: number;   // degrees, fixed (we only animate position to keep it cheap)
  active: boolean;    // true once dropped in
  dropAt: number;     // ms (perf.now) when this sticker should activate
};

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function StickerWall({ items, height = 300 }: Props) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  // Prefetch every sticker into expo-image's cache before the first render of stickers.
  // Drop-in animation only starts once images are warm ⇒ no empty boxes raining down.
  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setReady(true);
      return;
    }
    setReady(false);
    ExpoImage.prefetch(items.map((i) => i.uri), 'memory-disk').finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  // One Animated.ValueXY per item — drives transform; never animated, only setValue'd from rAF.
  const animsRef = useRef<Animated.ValueXY[]>([]);
  const bodiesRef = useRef<Body[]>([]);
  const gravityRef = useRef({ x: 0, y: 1 }); // screen-space unit vector (down=+y)
  const startTimeRef = useRef(0);

  // Build / rebuild bodies when items or layout change.
  useMemo(() => {
    const W = box.width;
    const H = box.height;
    if (W === 0 || H === 0) {
      bodiesRef.current = [];
      animsRef.current = [];
      return;
    }
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    startTimeRef.current = now;

    const next: Body[] = items.map((item, i) => {
      const rng = mulberry32(hashSeed(item.id));
      const size = 60 + rng() * 22; // 60–82
      const r = size * 0.42;        // tighter than visual size so they overlap a bit, like real stickers
      // Spawn above the jar, spread across width.
      const spawnX = 12 + rng() * (W - 24 - size);
      const spawnY = -size - rng() * 80;
      return {
        x: spawnX,
        y: spawnY,
        vx: (rng() - 0.5) * 60,
        vy: 80 + rng() * 60,
        r,
        size,
        rotation: (rng() - 0.5) * 30,
        active: false,
        dropAt: now + i * 90 + rng() * 40,
      };
    });

    bodiesRef.current = next;
    // Resize the Animated array to match.
    if (animsRef.current.length !== next.length) {
      animsRef.current = next.map(
        (b, i) => animsRef.current[i] ?? new Animated.ValueXY({ x: b.x, y: b.y }),
      );
    }
    // Snap each anim to its starting position.
    next.forEach((b, i) => animsRef.current[i].setValue({ x: b.x, y: b.y }));
  }, [items, box.width, box.height]);

  // When images finish prefetching, rebase the drop-in stagger so stickers actually rain
  // (rather than instantly activating because their `dropAt` already passed during prefetch).
  useEffect(() => {
    if (!ready) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    bodiesRef.current.forEach((b, i) => {
      b.dropAt = now + i * 90 + Math.random() * 40;
    });
  }, [ready]);

  // Accelerometer → gravity vector, in screen coords.
  // expo-sensors returns g-units; signs match the user's spatial expectation
  // when read directly (phone tilted right ⇒ contents slide right on screen).
  useEffect(() => {
    Accelerometer.setUpdateInterval(50);
    let lastShakeT = 0;
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      // iOS: phone upright ⇒ accel ≈ (0, -1, 0). Screen +y is down, so flip y.
      // Tilt right ⇒ accel.x positive ⇒ contents slide right ⇒ keep x as-is.
      gravityRef.current.x = x;
      gravityRef.current.y = -y;
      const mag = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (mag > SHAKE_THRESHOLD && now - lastShakeT > 400) {
        lastShakeT = now;
        // Kick every active sticker with a randomized impulse.
        for (const b of bodiesRef.current) {
          if (!b.active) continue;
          const ang = Math.random() * Math.PI * 2;
          b.vx += Math.cos(ang) * SHAKE_IMPULSE;
          b.vy += Math.sin(ang) * SHAKE_IMPULSE;
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Physics tick.
  useEffect(() => {
    if (box.width === 0 || box.height === 0 || !ready) return;
    let raf = 0;
    let last = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const step = () => {
      const W = box.width;
      const H = box.height;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      let dt = (now - last) / 1000;
      last = now;
      if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
      if (dt < MIN_FRAME_DT) dt = MIN_FRAME_DT;

      const gx = gravityRef.current.x * GRAVITY;
      const gy = gravityRef.current.y * GRAVITY;
      const bodies = bodiesRef.current;

      // 1. integrate
      for (const b of bodies) {
        if (!b.active) {
          if (now >= b.dropAt) b.active = true;
          else continue;
        }
        b.vx = (b.vx + gx * dt) * DAMPING;
        b.vy = (b.vy + gy * dt) * DAMPING;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }

      // 2. wall collisions — bound the full visual sticker, not just its collision circle,
      //    so nothing drifts off-screen.
      for (const b of bodies) {
        if (!b.active) continue;
        const maxX = W - b.size;
        const maxY = H - b.size;
        if (b.x < 0) {
          b.x = 0;
          if (b.vx < 0) b.vx = -b.vx * WALL_RESTITUTION;
        } else if (b.x > maxX) {
          b.x = maxX;
          if (b.vx > 0) b.vx = -b.vx * WALL_RESTITUTION;
        }
        if (b.y < 0) {
          b.y = 0;
          if (b.vy < 0) b.vy = -b.vy * WALL_RESTITUTION;
        } else if (b.y > maxY) {
          b.y = maxY;
          if (b.vy > 0) b.vy = -b.vy * WALL_RESTITUTION;
        }
      }

      // 3. sticker-on-sticker: positional separation + impulse exchange
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (!a.active) continue;
        const acx = a.x + a.size / 2;
        const acy = a.y + a.size / 2;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (!b.active) continue;
          const bcx = b.x + b.size / 2;
          const bcy = b.y + b.size / 2;
          let dx = bcx - acx;
          let dy = bcy - acy;
          let dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r;
          if (dist < minDist && dist > 0.0001) {
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
            // 1D elastic-ish along normal
            const va = a.vx * nx + a.vy * ny;
            const vb = b.vx * nx + b.vy * ny;
            const exchange = (va - vb) * (1 + STICKER_RESTITUTION) * 0.5;
            a.vx -= exchange * nx;
            a.vy -= exchange * ny;
            b.vx += exchange * nx;
            b.vy += exchange * ny;
          } else if (dist <= 0.0001) {
            // Coincident — nudge apart with tiny random kick
            a.vx += (Math.random() - 0.5) * 50;
            a.vy += (Math.random() - 0.5) * 50;
          }
        }
      }

      // 4. push positions to Animated values
      const anims = animsRef.current;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        anims[i] && anims[i].setValue({ x: b.x, y: b.y });
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [box.width, box.height, ready]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    if (width !== box.width || h !== box.height) setBox({ width, height: h });
  };

  return (
    <View style={[styles.jar, { height }]} onLayout={onLayout}>
      <View style={styles.lipHighlight} pointerEvents="none" />
      {items.map((item, i) => {
        const anim = animsRef.current[i];
        const body = bodiesRef.current[i];
        if (!anim || !body) return null;
        return (
          <Animated.View
            key={item.id}
            style={{
              position: 'absolute',
              width: body.size,
              height: body.size,
              transform: [
                { translateX: anim.x },
                { translateY: anim.y },
                { rotate: `${body.rotation}deg` },
              ],
            }}
          >
            <Sticker uri={item.uri} style={StyleSheet.absoluteFill} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  jar: {
    backgroundColor: colors.espresso,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  lipHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(250,232,218,0.18)',
  },
});
