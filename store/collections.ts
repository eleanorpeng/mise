import { create } from 'zustand';
import {
  collectionsService,
  type CollectionCreatePayload,
} from '@/services/collections';

export interface Collection {
  id: string;
  name: string;
  coverColor: string;
  spineColor: string;
  inkColor: string;
  recipeIds: string[];
}

interface CollectionsStore {
  collections: Collection[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (payload: CollectionCreatePayload) => Promise<Collection>;
  remove: (id: string) => Promise<void>;
  addRecipe: (collectionId: string, recipeId: string) => Promise<void>;
  removeRecipe: (collectionId: string, recipeId: string) => Promise<void>;
}

export const useCollectionsStore = create<CollectionsStore>((set, get) => ({
  collections: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const collections = await collectionsService.list();
      set({ collections });
    } catch {
      // keep current state on failure
    } finally {
      set({ loading: false });
    }
  },

  create: async (payload) => {
    const created = await collectionsService.create(payload);
    set((s) => ({ collections: [created, ...s.collections] }));
    return created;
  },

  remove: async (id) => {
    await collectionsService.delete(id);
    set((s) => ({ collections: s.collections.filter((c) => c.id !== id) }));
  },

  addRecipe: async (collectionId, recipeId) => {
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId && !c.recipeIds.includes(recipeId)
          ? { ...c, recipeIds: [...c.recipeIds, recipeId] }
          : c,
      ),
    }));
    try {
      await collectionsService.addRecipe(collectionId, recipeId);
    } catch (err) {
      // rollback on failure
      set((s) => ({
        collections: s.collections.map((c) =>
          c.id === collectionId
            ? { ...c, recipeIds: c.recipeIds.filter((id) => id !== recipeId) }
            : c,
        ),
      }));
      throw err;
    }
  },

  removeRecipe: async (collectionId, recipeId) => {
    const previous = get().collections;
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? { ...c, recipeIds: c.recipeIds.filter((id) => id !== recipeId) }
          : c,
      ),
    }));
    try {
      await collectionsService.removeRecipe(collectionId, recipeId);
    } catch (err) {
      set({ collections: previous });
      throw err;
    }
  },
}));
