import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'preferences:v2';

export type UnitSystem = 'metric' | 'imperial';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

export type VoiceProvider = 'openai' | 'voxtral';

export interface AssistantVoiceOption {
  provider: VoiceProvider;
  voice: string;
  label: string;
  description: string;
}

export const ASSISTANT_VOICES: AssistantVoiceOption[] = [
  // Mistral Voxtral Mini TTS (via OpenRouter)
  { provider: 'voxtral', voice: 'cheerful_female', label: 'Cheerful', description: 'Voxtral · bright, upbeat (default)' },
  { provider: 'voxtral', voice: 'casual_female', label: 'Casual', description: 'Voxtral · relaxed, friendly' },
  { provider: 'voxtral', voice: 'neutral_female', label: 'Neutral', description: 'Voxtral · even, clear' },
  { provider: 'voxtral', voice: 'casual_male', label: 'Casual (M)', description: 'Voxtral · relaxed, friendly' },
  { provider: 'voxtral', voice: 'neutral_male', label: 'Neutral (M)', description: 'Voxtral · even, grounded' },

  // OpenAI gpt-4o-mini-tts
  { provider: 'openai', voice: 'nova', label: 'Nova', description: 'OpenAI · warm, friendly' },
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
];

export interface AssistantVoice {
  provider: VoiceProvider;
  voice: string;
}

export const DEFAULT_ASSISTANT_VOICE: AssistantVoice = {
  provider: 'voxtral',
  voice: 'cheerful_female',
};

// Map a persisted value to a currently-supported voice, falling back to the
// default when it's missing or references a retired provider (e.g. elevenlabs).
function normalizeAssistantVoice(value: unknown): AssistantVoice {
  if (value && typeof value === 'object') {
    const candidate = value as AssistantVoice;
    if (ASSISTANT_VOICES.some((v) => v.provider === candidate.provider && v.voice === candidate.voice)) {
      return { provider: candidate.provider, voice: candidate.voice };
    }
  }
  return DEFAULT_ASSISTANT_VOICE;
}

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
          assistantVoice: normalizeAssistantVoice(parsed.assistantVoice),
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
