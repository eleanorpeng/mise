import { create } from 'zustand';
import type { CookLog } from '@/types';
import { cookLogService } from '@/services/cookLog';

interface CookLogStore {
  logsByMonth: Record<string, CookLog[]>;
  loadingMonth: string | null;
  fetchMonth: (month: string) => Promise<void>;
  add: (log: CookLog) => void;
  remove: (id: string) => Promise<void>;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export const useCookLogStore = create<CookLogStore>((set, get) => ({
  logsByMonth: {},
  loadingMonth: null,

  fetchMonth: async (month) => {
    set({ loadingMonth: month });
    try {
      const logs = await cookLogService.listMonth(month);
      set((s) => ({ logsByMonth: { ...s.logsByMonth, [month]: logs } }));
    } catch {
      // keep current state on failure
    } finally {
      if (get().loadingMonth === month) set({ loadingMonth: null });
    }
  },

  add: (log) => {
    const month = monthKey(log.cookedDate);
    set((s) => {
      const existing = s.logsByMonth[month] ?? [];
      const next = [log, ...existing.filter((l) => l.id !== log.id)].sort(
        (a, b) => (a.cookedDate < b.cookedDate ? 1 : -1),
      );
      return { logsByMonth: { ...s.logsByMonth, [month]: next } };
    });
  },

  remove: async (id) => {
    const previous = get().logsByMonth;
    set({
      logsByMonth: Object.fromEntries(
        Object.entries(previous).map(([key, logs]) => [
          key,
          logs.filter((l) => l.id !== id),
        ]),
      ),
    });
    try {
      await cookLogService.remove(id);
    } catch (err) {
      set({ logsByMonth: previous });
      throw err;
    }
  },
}));
