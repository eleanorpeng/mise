import { create } from 'zustand';
import type { Recipe } from '@/types';
import { recipesService } from '@/services/recipes';

interface RecipesStore {
  recipes: Recipe[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (recipe: Recipe) => void;
  replace: (recipe: Recipe) => void;
  remove: (id: string) => void;
  delete: (id: string) => Promise<void>;
}

export const useRecipesStore = create<RecipesStore>((set, get) => ({
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
  replace: (recipe) =>
    set((s) => ({
      recipes: s.recipes.map((r) => (r.id === recipe.id ? recipe : r)),
    })),
  remove: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),
  delete: async (id) => {
    // Optimistically remove, restore on failure so the UI stays truthful.
    const previous = get().recipes;
    set({ recipes: previous.filter((r) => r.id !== id) });
    try {
      await recipesService.delete(id);
    } catch (err) {
      set({ recipes: previous });
      throw err;
    }
  },
}));
