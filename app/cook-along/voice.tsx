import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system/legacy';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { colors, fonts, spacing, radius } from '@/constants';
import { voiceService } from '@/services/voice';
import {
  ASSISTANT_VOICES,
  usePreferencesStore,
  type AssistantVoiceOption,
} from '@/store/preferences';

const SAMPLE_TEXT =
  "Great. Step one. Preheat the oven to four hundred. While that heats, dice the onion finely.";

type VoiceKey = string;
const keyOf = (v: { provider: string; voice: string }): VoiceKey =>
  `${v.provider}:${v.voice}`;

export default function VoicePickerScreen() {
  const router = useRouter();
  const assistantVoice = usePreferencesStore((s) => s.assistantVoice);
  const setAssistantVoice = usePreferencesStore((s) => s.setAssistantVoice);

  const [loadingVoice, setLoadingVoice] = useState<VoiceKey | null>(null);
  const [playingVoice, setPlayingVoice] = useState<VoiceKey | null>(null);
  const selectedKey = keyOf(assistantVoice);
  const playerRef = useRef<AudioPlayer | null>(null);
  const turnRef = useRef(0);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    return () => {
      const p = playerRef.current;
      if (p) {
        try {
          p.pause();
          p.remove();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  const stopPlayer = () => {
    const p = playerRef.current;
    if (p) {
      try {
        p.pause();
        p.remove();
      } catch {}
      playerRef.current = null;
    }
    setPlayingVoice(null);
  };

  const previewVoice = async (option: AssistantVoiceOption) => {
    const key = keyOf(option);
    const turn = ++turnRef.current;
    stopPlayer();
    setLoadingVoice(key);
    try {
      const { audio_b64, mime } = await voiceService.tts(
        SAMPLE_TEXT,
        option.voice,
        option.provider,
      );
      if (turn !== turnRef.current) return;
      const ext = mime.includes('mpeg') ? 'mp3' : 'wav';
      const path = `${FileSystem.cacheDirectory}voice-sample-${option.provider}-${option.voice}-${Date.now()}.${ext}`;
      await FileSystem.writeAsStringAsync(path, audio_b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (turn !== turnRef.current) return;
      const player = createAudioPlayer({ uri: path });
      playerRef.current = player;
      setPlayingVoice(key);
      player.play();
      const interval = setInterval(() => {
        if (turn !== turnRef.current) {
          clearInterval(interval);
          return;
        }
        if (!player.playing && player.currentTime >= 0.1) {
          clearInterval(interval);
          if (playerRef.current === player) {
            setPlayingVoice(null);
          }
        }
      }, 300);
    } catch (err) {
      console.warn('[voice-picker] preview failed', err);
    } finally {
      if (turn === turnRef.current) setLoadingVoice(null);
    }
  };

  const handleSelect = (option: AssistantVoiceOption) => {
    setAssistantVoice({ provider: option.provider, voice: option.voice });
    previewVoice(option);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            stopPlayer();
            router.back();
          }}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons name="close" size={22} color={colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.title}>Assistant voice</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.subtitle}>
        Tap a voice to set it and hear a quick sample.
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {(['openai', 'elevenlabs'] as const).map((group) => {
          const items = ASSISTANT_VOICES.filter((v) => v.provider === group);
          if (items.length === 0) return null;
          const groupLabel =
            group === 'openai' ? 'OpenAI · gpt-4o-mini-tts' : 'ElevenLabs · Turbo v2.5';
          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupHeader}>{groupLabel}</Text>
              {items.map((v) => {
                const key = keyOf(v);
                const selected = key === selectedKey;
                const isLoading = loadingVoice === key;
                const isPlaying = playingVoice === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleSelect(v)}
                    activeOpacity={0.85}
                    style={[styles.row, selected && styles.rowSelected]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel}>{v.label}</Text>
                      <Text style={styles.rowDescription}>{v.description}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        previewVoice(v);
                      }}
                      hitSlop={10}
                      style={styles.previewBtn}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={colors.terra} />
                      ) : (
                        <MaterialCommunityIcons
                          name={isPlaying ? 'stop-circle' : 'play-circle'}
                          size={26}
                          color={colors.terra}
                        />
                      )}
                    </TouchableOpacity>

                    <View style={styles.checkWrap}>
                      {selected && (
                        <MaterialCommunityIcons
                          name="check"
                          size={20}
                          color={colors.terra}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
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
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupHeader: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowSelected: {
    borderColor: colors.terra,
    borderWidth: 1,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  rowDescription: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 2,
  },
  previewBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkWrap: {
    width: 20,
    alignItems: 'center',
  },
});
