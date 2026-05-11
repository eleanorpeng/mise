import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeekPlan, PlannedMeal, GroceryItem } from '@/types';
import {
  plannerService,
  type PlannedMealUpdate,
  type GroceryItemCreate,
  type GroceryItemUpdate,
} from '@/services/planner';

const LAST_WEEK_KEY = 'plan:lastViewedWeek';

interface PlanStore {
  // viewWeekStart is what the planner page is currently focused on (Monday ISO).
  viewWeekStart: string;
  // Cache of weeks fetched, keyed by weekStart, so paging between weeks is instant.
  weeks: Record<string, WeekPlan>;
  loadingWeek: Record<string, boolean>;

  groceryByWeek: Record<string, GroceryItem[]>;
  loadingGrocery: Record<string, boolean>;

  hydrated: boolean;
  hydrate: () => Promise<void>;

  setViewWeek: (weekStart: string) => void;

  fetchWeek: (weekStart: string) => Promise<void>;
  addEntry: (entry: Omit<PlannedMeal, 'id' | 'recipe' | 'cookedAt'>) => Promise<PlannedMeal>;
  updateEntry: (id: string, patch: PlannedMealUpdate, fromWeek: string) => Promise<void>;
  removeEntry: (id: string, fromWeek: string) => Promise<void>;
  toggleCooked: (entry: PlannedMeal, fromWeek: string) => Promise<void>;

  fetchGroceryList: (weekStart: string) => Promise<void>;
  addGroceryItem: (data: GroceryItemCreate) => Promise<void>;
  updateGroceryItem: (id: string, weekStart: string, patch: GroceryItemUpdate) => Promise<void>;
  removeGroceryItem: (id: string, weekStart: string) => Promise<void>;
  toggleGroceryItem: (id: string, weekStart: string) => Promise<void>;
}

export function getMondayIso(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0 Sun..6 Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addWeeks(weekStartIso: string, n: number): string {
  const [y, m, d] = weekStartIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n * 7);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  viewWeekStart: getMondayIso(),
  weeks: {},
  loadingWeek: {},
  groceryByWeek: {},
  loadingGrocery: {},
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(LAST_WEEK_KEY);
      if (stored) {
        set({ viewWeekStart: stored });
      }
    } catch {}
    set({ hydrated: true });
  },

  setViewWeek: (weekStart) => {
    set({ viewWeekStart: weekStart });
    AsyncStorage.setItem(LAST_WEEK_KEY, weekStart).catch(() => {});
  },

  fetchWeek: async (weekStart) => {
    if (get().loadingWeek[weekStart]) return;
    set((s) => ({ loadingWeek: { ...s.loadingWeek, [weekStart]: true } }));
    try {
      const week = await plannerService.getWeek(weekStart);
      set((s) => ({ weeks: { ...s.weeks, [weekStart]: week } }));
    } catch {
      // ignore — keep prior cache
    } finally {
      set((s) => ({ loadingWeek: { ...s.loadingWeek, [weekStart]: false } }));
    }
  },

  addEntry: async (entry) => {
    const created = await plannerService.addEntry(entry);
    const weekStart = getMondayIso(parseIso(entry.plannedDate));
    set((s) => {
      const week = s.weeks[weekStart] ?? { weekStart, entries: [] };
      return {
        weeks: {
          ...s.weeks,
          [weekStart]: { ...week, entries: [...week.entries, created] },
        },
      };
    });
    // Re-fetch in background so the entry has its joined recipe metadata.
    get().fetchWeek(weekStart);
    return created;
  },

  updateEntry: async (id, patch, fromWeek) => {
    const prev = get().weeks[fromWeek];
    // Optimistic update
    set((s) => {
      const w = s.weeks[fromWeek];
      if (!w) return s;
      return {
        weeks: {
          ...s.weeks,
          [fromWeek]: {
            ...w,
            entries: w.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        },
      };
    });

    try {
      await plannerService.updateEntry(id, patch);
      // If date moved to a different week, refetch both
      if (patch.plannedDate) {
        const targetWeek = getMondayIso(parseIso(patch.plannedDate));
        if (targetWeek !== fromWeek) {
          get().fetchWeek(fromWeek);
          get().fetchWeek(targetWeek);
        }
      }
    } catch {
      // rollback
      if (prev) set((s) => ({ weeks: { ...s.weeks, [fromWeek]: prev } }));
    }
  },

  removeEntry: async (id, fromWeek) => {
    const prev = get().weeks[fromWeek];
    set((s) => {
      const w = s.weeks[fromWeek];
      if (!w) return s;
      return {
        weeks: {
          ...s.weeks,
          [fromWeek]: { ...w, entries: w.entries.filter((e) => e.id !== id) },
        },
      };
    });
    try {
      await plannerService.removeEntry(id);
    } catch {
      if (prev) set((s) => ({ weeks: { ...s.weeks, [fromWeek]: prev } }));
    }
  },

  toggleCooked: async (entry, fromWeek) => {
    const next = entry.cookedAt ? null : new Date().toISOString();
    await get().updateEntry(entry.id, { cookedAt: next }, fromWeek);
  },

  fetchGroceryList: async (weekStart) => {
    set((s) => ({ loadingGrocery: { ...s.loadingGrocery, [weekStart]: true } }));
    try {
      const items = await plannerService.getGroceryList(weekStart);
      set((s) => ({ groceryByWeek: { ...s.groceryByWeek, [weekStart]: items } }));
    } catch {
      // ignore
    } finally {
      set((s) => ({ loadingGrocery: { ...s.loadingGrocery, [weekStart]: false } }));
    }
  },

  addGroceryItem: async (data) => {
    const created = await plannerService.addGroceryItem(data);
    set((s) => ({
      groceryByWeek: {
        ...s.groceryByWeek,
        [data.weekStart]: [...(s.groceryByWeek[data.weekStart] ?? []), created],
      },
    }));
  },

  updateGroceryItem: async (id, weekStart, patch) => {
    const prev = get().groceryByWeek[weekStart];
    set((s) => ({
      groceryByWeek: {
        ...s.groceryByWeek,
        [weekStart]: (s.groceryByWeek[weekStart] ?? []).map((it) =>
          it.id === id ? { ...it, ...patch } : it
        ),
      },
    }));
    try {
      await plannerService.updateGroceryItem(id, patch);
    } catch {
      if (prev) set((s) => ({ groceryByWeek: { ...s.groceryByWeek, [weekStart]: prev } }));
    }
  },

  removeGroceryItem: async (id, weekStart) => {
    const prev = get().groceryByWeek[weekStart];
    set((s) => ({
      groceryByWeek: {
        ...s.groceryByWeek,
        [weekStart]: (s.groceryByWeek[weekStart] ?? []).filter((it) => it.id !== id),
      },
    }));
    try {
      await plannerService.removeGroceryItem(id);
    } catch {
      if (prev) set((s) => ({ groceryByWeek: { ...s.groceryByWeek, [weekStart]: prev } }));
    }
  },

  toggleGroceryItem: async (id, weekStart) => {
    const item = (get().groceryByWeek[weekStart] ?? []).find((it) => it.id === id);
    if (!item) return;
    await get().updateGroceryItem(id, weekStart, { checked: !item.checked });
  },
}));

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
