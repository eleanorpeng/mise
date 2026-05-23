import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from 'expo-audio';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { recipesService } from '@/services/recipes';
import { voiceService, type VoiceResponse } from '@/services/voice';
import { usePreferencesStore } from '@/store/preferences';
import type { Recipe } from '@/types';

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CookAlongScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTurn, setLastTurn] = useState<VoiceResponse | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  const autoStartedRef = useRef(false);
  const assistantVoice = usePreferencesStore((s) => s.assistantVoice);
  const playerRef = useRef<AudioPlayer | null>(null);
  const ttsCounterRef = useRef(0);

  // expo-audio recorder (works in Expo Go — no custom native module).
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.LOW_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(audioRecorder, 100);

  // Mic halo + voice activity detection (auto-stop on silence)
  const pulse = useRef(new Animated.Value(0)).current;
  const levelRef = useRef(0);
  const hasSpokenRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const recordStartedAtRef = useRef(0);
  const autoStoppingRef = useRef(false);

  // VAD tunables (metering dB, roughly -160..0; we map -50..0 -> 0..1).
  const SPEECH_THRESHOLD = 0.16; // ~-42 dB — conversational speech
  const SILENCE_MS = 1100; // hang-up after this much trailing silence
  const NO_SPEECH_TIMEOUT_MS = 10000; // bail out if user never speaks
  const MAX_RECORD_MS = 30000; // hard cap

  const stopSpeech = () => {
    const p = playerRef.current;
    if (p) {
      try {
        p.pause();
        p.remove();
      } catch {}
      playerRef.current = null;
    }
  };

  const playAudioB64 = async (b64: string, mime: string = 'audio/mpeg') => {
    const turn = ++ttsCounterRef.current;
    const ext = mime.includes('mpeg') ? 'mp3' : 'wav';
    const path = `${FileSystem.cacheDirectory}tts-${Date.now()}.${ext}`;
    await FileSystem.writeAsStringAsync(path, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (turn !== ttsCounterRef.current) return;
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
      () => {},
    );
    stopSpeech();
    const player = createAudioPlayer({ uri: path });
    playerRef.current = player;
    player.play();
  };

  const speakText = async (text: string) => {
    if (!text) return;
    const turn = ++ttsCounterRef.current;
    stopSpeech();
    try {
      const { audio_b64, mime } = await voiceService.tts(
        text,
        assistantVoice.voice,
        assistantVoice.provider,
      );
      if (turn !== ttsCounterRef.current) return;
      await playAudioB64(audio_b64, mime);
    } catch (err) {
      console.warn('[cook-along] tts failed', err);
    }
  };

  // Halo + VAD react to live input level from the recorder's meter.
  useEffect(() => {
    if (!isRecording) {
      Animated.timing(pulse, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      levelRef.current = 0;
      return;
    }
    const now = Date.now();
    const m = recorderState.metering;
    let target = 0;
    if (typeof m === 'number' && Number.isFinite(m)) {
      target = clamp((m + 50) / 50, 0, 1);
    }
    const prev = levelRef.current;
    const smoothed =
      target > prev ? prev + (target - prev) * 0.7 : prev + (target - prev) * 0.25;
    levelRef.current = smoothed;
    Animated.timing(pulse, {
      toValue: smoothed,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    if (target >= SPEECH_THRESHOLD) {
      hasSpokenRef.current = true;
      lastSpeechAtRef.current = now;
    }

    if (autoStoppingRef.current) return;
    const elapsed = now - recordStartedAtRef.current;
    const sinceSpeech = now - lastSpeechAtRef.current;
    const shouldStop =
      (hasSpokenRef.current && sinceSpeech >= SILENCE_MS) ||
      (!hasSpokenRef.current && elapsed >= NO_SPEECH_TIMEOUT_MS) ||
      elapsed >= MAX_RECORD_MS;
    if (shouldStop) {
      autoStoppingRef.current = true;
      stopAndSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, recorderState.metering, pulse]);

  // Fetch recipe
  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    recipesService
      .get(id)
      .then((r) => {
        if (!cancelled) setRecipe(r);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load recipe');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Auto-read step 1 once recipe loads
  useEffect(() => {
    if (!recipe || autoStartedRef.current) return;
    if (recipe.steps.length === 0) return;
    autoStartedRef.current = true;
    const intro = `Let's cook ${recipe.title}. Step 1. ${recipe.steps[0].instruction}`;
    speakText(intro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe]);

  // Pre-warm the audio session + recorder so the first tap is instant.
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await AudioModule.requestRecordingPermissionsAsync();
        await audioRecorder.prepareToRecordAsync();
      } catch {}
    })();
    return () => {
      stopSpeech();
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRecorder]);

  // Timer countdown
  useEffect(() => {
    if (timerSeconds == null || timerSeconds <= 0) return;
    const tid = setInterval(() => {
      setTimerSeconds((s) => {
        if (s == null) return null;
        if (s <= 1) {
          speakText('Timer done.');
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerSeconds]);

  const speakStep = (index: number) => {
    if (!recipe) return;
    const step = recipe.steps[index];
    if (!step) return;
    speakText(`Step ${index + 1}. ${step.instruction}`);
  };

  const goToStep = (index: number) => {
    if (!recipe) return;
    const next = clamp(index, 0, recipe.steps.length - 1);
    setCurrentStep(next);
    speakStep(next);
  };

  const startRecording = async () => {
    setVoiceError(null);
    hasSpokenRef.current = false;
    autoStoppingRef.current = false;
    setLastTurn(null);
    setIsRecording(true);
    stopSpeech();
    try {
      audioRecorder.record();
    } catch (err: any) {
      try {
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      } catch (err2: any) {
        setIsRecording(false);
        setVoiceError(err2?.message || err?.message || 'Could not start recording.');
        return;
      }
    }
    const now = Date.now();
    recordStartedAtRef.current = now;
    lastSpeechAtRef.current = now;
  };

  const stopAndSend = async () => {
    if (!recipe) return;
    setIsRecording(false);
    setIsProcessing(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No audio recorded');

      const result = await voiceService.cookAlong(
        recipe.id,
        currentStep,
        uri,
        assistantVoice.voice,
        assistantVoice.provider,
      );
      setLastTurn(result);
      // Re-prepare after the upload so the recorder doesn't truncate the file.
      audioRecorder.prepareToRecordAsync().catch(() => {});

      if (result.speech_audio_b64) {
        await playAudioB64(
          result.speech_audio_b64,
          result.speech_audio_mime || 'audio/mpeg',
        );
      } else if (result.speech) {
        speakText(result.speech);
      }

      if (result.intent === 'next' || result.intent === 'back') {
        const delta = result.step_delta ?? (result.intent === 'next' ? 1 : -1);
        setCurrentStep((s) => clamp(s + delta, 0, recipe.steps.length - 1));
      } else if (result.intent === 'goto' && result.target_step != null) {
        setCurrentStep(clamp(result.target_step, 0, recipe.steps.length - 1));
      } else if (result.intent === 'timer' && result.timer_seconds != null) {
        setTimerSeconds(result.timer_seconds);
      }
    } catch (err: any) {
      console.error('[cook-along]', err);
      setVoiceError(err?.message || 'Voice request failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicTap = () => {
    if (isProcessing) return;
    if (isRecording) {
      autoStoppingRef.current = true;
      stopAndSend();
    } else {
      startRecording();
    }
  };

  const handleClose = () => {
    stopSpeech();
    if (isRecording) {
      audioRecorder.stop().catch(() => {});
    }
    router.back();
  };

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.terra} />
        </View>
      </SafeAreaView>
    );
  }

  const step = recipe.steps[currentStep];
  const totalSteps = recipe.steps.length;
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.55],
    extrapolate: 'clamp',
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.05, 1],
    outputRange: [0, 0.18, 0.55],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.iconBtn}>
          <MaterialCommunityIcons name="close" size={22} color={colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.stepLabel}>
          Step {currentStep + 1} of {totalSteps}
        </Text>
        <TouchableOpacity
          onPress={() => {
            stopSpeech();
            router.push('/cook-along/voice');
          }}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={colors.espresso}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.progressRow}>
        {recipe.steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i === currentStep && styles.progressDotActive,
              i < currentStep && styles.progressDotDone,
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <Text style={styles.stepNumber}>
          {String(currentStep + 1).padStart(2, '0')}
        </Text>
        <Text style={styles.stepText}>{step?.instruction ?? ''}</Text>

        {step?.technique && (
          <View style={styles.techniqueCard}>
            <Text style={styles.techniqueLabel}>Technique</Text>
            <Text style={styles.techniqueName}>{step.technique.name}</Text>
            <Text style={styles.techniqueExplanation}>
              {step.technique.explanation}
            </Text>
          </View>
        )}

        {timerSeconds != null && (
          <View style={styles.timerCard}>
            <MaterialCommunityIcons
              name="timer-sand"
              size={20}
              color={colors.terra}
            />
            <Text style={styles.timerText}>{formatMmSs(timerSeconds)}</Text>
            <TouchableOpacity onPress={() => setTimerSeconds(null)} hitSlop={8}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={colors.umber}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {isRecording ? (
          <Text style={styles.hint}>Listening…</Text>
        ) : isProcessing ? (
          <Text style={styles.hint}>Thinking…</Text>
        ) : lastTurn?.transcript ? (
          <Text style={styles.transcript} numberOfLines={2}>
            “{lastTurn.transcript}”
          </Text>
        ) : (
          <Text style={styles.hint}>
            Tap the mic and say “next”, “back”, or ask a question.
          </Text>
        )}
        {voiceError && <Text style={styles.errorInline}>{voiceError}</Text>}

        <View style={styles.micWrap}>
          {isRecording && (
            <Animated.View
              style={[
                styles.micPulse,
                {
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                },
              ]}
            />
          )}
          <TouchableOpacity
            style={[
              styles.micBtn,
              isRecording && styles.micBtnActive,
              isProcessing && styles.micBtnDisabled,
            ]}
            onPress={handleMicTap}
            activeOpacity={0.85}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <MaterialCommunityIcons
                name={isRecording ? 'stop' : 'microphone'}
                size={32}
                color={colors.textOnDark}
              />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.micCaption}>
          {isProcessing ? 'Thinking…' : isRecording ? '' : 'Tap to speak'}
        </Text>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
            onPress={() => goToStep(currentStep - 1)}
            disabled={isFirst}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={20}
              color={isFirst ? colors.umber : colors.espresso}
            />
            <Text
              style={[
                styles.navBtnText,
                isFirst && { color: colors.umber },
              ]}
            >
              Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, isLast && styles.navBtnDisabled]}
            onPress={() => goToStep(currentStep + 1)}
            disabled={isLast}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.navBtnText,
                isLast && { color: colors.umber },
              ]}
            >
              Next
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={isLast ? colors.umber : colors.espresso}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.rust,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
    letterSpacing: 0.5,
  },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sand,
  },
  progressDotActive: {
    width: 22,
    backgroundColor: colors.terra,
  },
  progressDotDone: {
    backgroundColor: colors.umber,
    opacity: 0.45,
  },

  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  stepNumber: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.terra,
    lineHeight: 52,
  },
  stepText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 22,
    lineHeight: 32,
    color: colors.espresso,
  },
  techniqueCard: {
    backgroundColor: colors.blush,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 4,
  },
  techniqueLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.brick,
  },
  techniqueName: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.espresso,
  },
  techniqueExplanation: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.umber,
  },
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  timerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: colors.espresso,
    minWidth: 56,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    textAlign: 'center',
  },
  transcript: {
    fontFamily: fonts.bodyRegular,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.umber,
    textAlign: 'center',
  },
  errorInline: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.rust,
    textAlign: 'center',
  },

  micWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  micPulse: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.terra,
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: colors.brick,
  },
  micBtnDisabled: {
    opacity: 0.6,
  },
  micCaption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.md,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
});
