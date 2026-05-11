import { create } from 'zustand';
import type { ProfileStats, UserProfile } from '@/types';
import { profileService, type ProfileUpdate } from '@/services/profile';

interface ProfileStore {
  profile: UserProfile | null;
  stats: ProfileStats;
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  fetchStats: () => Promise<void>;
  update: (data: ProfileUpdate) => Promise<UserProfile>;
  reset: () => void;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  stats: { totalRecipes: 0, cookedThisMonth: 0 },
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const profile = await profileService.get();
      set({ profile, loaded: true });
    } catch {
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await profileService.stats();
      set({ stats });
    } catch {}
  },

  update: async (data) => {
    const profile = await profileService.update(data);
    set({ profile });
    return profile;
  },

  reset: () =>
    set({
      profile: null,
      stats: { totalRecipes: 0, cookedThisMonth: 0 },
      loaded: false,
    }),
}));
