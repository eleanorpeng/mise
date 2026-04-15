import { create } from 'zustand';
import type { WeekPlan, GroceryItem } from '@/types';
import { plannerService } from '@/services/planner';

interface PlanStore {
  weekPlan: WeekPlan | null;
  groceryList: GroceryItem[];
  loading: boolean;
  fetchWeek: (weekStart: string) => Promise<void>;
  fetchGroceryList: (weekStart: string) => Promise<void>;
  toggleGroceryItem: (ingredient: string) => void;
}

export const usePlanStore = create<PlanStore>((set) => ({
  weekPlan: null,
  groceryList: [],
  loading: false,
  fetchWeek: async (weekStart) => {
    set({ loading: true });
    try {
      const weekPlan = await plannerService.getWeek(weekStart);
      set({ weekPlan });
    } finally {
      set({ loading: false });
    }
  },
  fetchGroceryList: async (weekStart) => {
    const groceryList = await plannerService.getGroceryList(weekStart);
    set({ groceryList });
  },
  toggleGroceryItem: (ingredient) =>
    set((s) => ({
      groceryList: s.groceryList.map((item) =>
        item.ingredient === ingredient ? { ...item, checked: !item.checked } : item
      ),
    })),
}));
