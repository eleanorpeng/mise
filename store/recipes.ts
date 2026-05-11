import { create } from 'zustand';
import type { Recipe } from '@/types';
import { recipesService } from '@/services/recipes';

interface RecipesStore {
  recipes: Recipe[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (recipe: Recipe) => void;
  remove: (id: string) => void;
}

export const useRecipesStore = create<RecipesStore>((set) => ({
  recipes: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const recipes = await recipesService.list();
      set({ recipes });
    } catch {
      // keep current state when backend is unavailable
    } finally {
      set({ loading: false });
    }
  },
  add: (recipe) => set((s) => ({ recipes: [recipe, ...s.recipes] })),
  remove: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),
}));
