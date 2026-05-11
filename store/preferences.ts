import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'preferences:v2';

export type UnitSystem = 'metric' | 'imperial';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

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
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setShowMacros: (value: boolean) => void;
  toggleShowMacros: () => void;
  setUnitSystem: (value: UnitSystem) => void;
  setTemperatureUnit: (value: TemperatureUnit) => void;
  setNotification: (key: keyof NotificationToggles, value: boolean) => void;
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
};

async function persist(state: Omit<PreferencesState, 'hydrated' | 'hydrate' | 'setShowMacros' | 'toggleShowMacros' | 'setUnitSystem' | 'setTemperatureUnit' | 'setNotification'>) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showMacros: state.showMacros,
        unitSystem: state.unitSystem,
        temperatureUnit: state.temperatureUnit,
        notifications: state.notifications,
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
}));
