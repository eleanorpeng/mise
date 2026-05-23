import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'preferences:v2';

export type UnitSystem = 'metric' | 'imperial';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

export type VoiceProvider = 'openai' | 'elevenlabs';

export interface AssistantVoiceOption {
  provider: VoiceProvider;
  voice: string;
  label: string;
  description: string;
}

export const ASSISTANT_VOICES: AssistantVoiceOption[] = [
  // OpenAI gpt-4o-mini-tts
  { provider: 'openai', voice: 'nova', label: 'Nova', description: 'OpenAI · warm, friendly (default)' },
  { provider: 'openai', voice: 'shimmer', label: 'Shimmer', description: 'OpenAI · bright, upbeat' },
  { provider: 'openai', voice: 'coral', label: 'Coral', description: 'OpenAI · soft, encouraging' },
  { provider: 'openai', voice: 'sage', label: 'Sage', description: 'OpenAI · calm, measured' },
  { provider: 'openai', voice: 'verse', label: 'Verse', description: 'OpenAI · expressive, lively' },
  { provider: 'openai', voice: 'ballad', label: 'Ballad', description: 'OpenAI · smooth, narrative' },
  { provider: 'openai', voice: 'alloy', label: 'Alloy', description: 'OpenAI · neutral, even' },
  { provider: 'openai', voice: 'echo', label: 'Echo', description: 'OpenAI · crisp, focused' },
  { provider: 'openai', voice: 'ash', label: 'Ash', description: 'OpenAI · steady, grounded' },
  { provider: 'openai', voice: 'onyx', label: 'Onyx', description: 'OpenAI · deep, confident' },
  { provider: 'openai', voice: 'fable', label: 'Fable', description: 'OpenAI · storyteller cadence' },

  // ElevenLabs — Turbo v2.5
  { provider: 'elevenlabs', voice: 'custom2', label: 'Victoria', description: 'ElevenLabs · custom' },
  { provider: 'elevenlabs', voice: 'custom3', label: 'Alexandra', description: 'ElevenLabs · custom' },
  { provider: 'elevenlabs', voice: 'custom4', label: 'Frankie', description: 'ElevenLabs · custom' },
  { provider: 'elevenlabs', voice: 'custom', label: 'Lauren', description: 'ElevenLabs · custom' },
  { provider: 'elevenlabs', voice: 'rachel', label: 'Rachel', description: 'ElevenLabs · calm, conversational' },
  { provider: 'elevenlabs', voice: 'bella', label: 'Bella', description: 'ElevenLabs · soft, friendly' },
  { provider: 'elevenlabs', voice: 'elli', label: 'Elli', description: 'ElevenLabs · young, upbeat' },
  { provider: 'elevenlabs', voice: 'domi', label: 'Domi', description: 'ElevenLabs · confident, clear' },
  { provider: 'elevenlabs', voice: 'antoni', label: 'Antoni', description: 'ElevenLabs · warm, narrative' },
  { provider: 'elevenlabs', voice: 'josh', label: 'Josh', description: 'ElevenLabs · deep, casual' },
  { provider: 'elevenlabs', voice: 'adam', label: 'Adam', description: 'ElevenLabs · neutral, mid' },
  { provider: 'elevenlabs', voice: 'sam', label: 'Sam', description: 'ElevenLabs · raspy, grounded' },
];

export interface AssistantVoice {
  provider: VoiceProvider;
  voice: string;
}

export const DEFAULT_ASSISTANT_VOICE: AssistantVoice = {
  provider: 'elevenlabs',
  voice: 'custom2',
};

interface NotificationToggles {
  cookReminders: boolean;
  weeklyRecap: boolean;
  importComplete: boolean;
  groceryReminders: boolean;
}

interface PreferencesState {
  showMacros: boolean;
  unitSystem: UnitSystem;
  temperatureUnit: TemperatureUnit;
  notifications: NotificationToggles;
  assistantVoice: AssistantVoice;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setShowMacros: (value: boolean) => void;
  toggleShowMacros: () => void;
  setUnitSystem: (value: UnitSystem) => void;
  setTemperatureUnit: (value: TemperatureUnit) => void;
  setNotification: (key: keyof NotificationToggles, value: boolean) => void;
  setAssistantVoice: (value: AssistantVoice) => void;
}

const defaults = {
  showMacros: true,
  unitSystem: 'metric' as UnitSystem,
  temperatureUnit: 'celsius' as TemperatureUnit,
  notifications: {
    cookReminders: true,
    weeklyRecap: true,
    importComplete: true,
    groceryReminders: false,
  },
  assistantVoice: DEFAULT_ASSISTANT_VOICE,
};

async function persist(state: Omit<PreferencesState, 'hydrated' | 'hydrate' | 'setShowMacros' | 'toggleShowMacros' | 'setUnitSystem' | 'setTemperatureUnit' | 'setNotification' | 'setAssistantVoice'>) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showMacros: state.showMacros,
        unitSystem: state.unitSystem,
        temperatureUnit: state.temperatureUnit,
        notifications: state.notifications,
        assistantVoice: state.assistantVoice,
      }),
    );
  } catch {}
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...defaults,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof defaults>;
        set({
          showMacros: parsed.showMacros ?? defaults.showMacros,
          unitSystem: parsed.unitSystem ?? defaults.unitSystem,
          temperatureUnit: parsed.temperatureUnit ?? defaults.temperatureUnit,
          notifications: { ...defaults.notifications, ...(parsed.notifications ?? {}) },
          assistantVoice:
            parsed.assistantVoice && typeof parsed.assistantVoice === 'object'
              ? {
                  provider: (parsed.assistantVoice as AssistantVoice).provider ?? 'openai',
                  voice: (parsed.assistantVoice as AssistantVoice).voice ?? 'nova',
                }
              : defaults.assistantVoice,
          hydrated: true,
        });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },

  setShowMacros: (value) => {
    set({ showMacros: value });
    persist(get());
  },
  toggleShowMacros: () => {
    set({ showMacros: !get().showMacros });
    persist(get());
  },
  setUnitSystem: (value) => {
    set({ unitSystem: value });
    persist(get());
  },
  setTemperatureUnit: (value) => {
    set({ temperatureUnit: value });
    persist(get());
  },
  setNotification: (key, value) => {
    set({ notifications: { ...get().notifications, [key]: value } });
    persist(get());
  },
  setAssistantVoice: (value) => {
    set({ assistantVoice: value });
    persist(get());
  },
}));
