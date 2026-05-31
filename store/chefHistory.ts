import { create } from 'zustand';
import {
  chefService,
  type ChefConversationSummary,
  type RecipeExtraction,
} from '@/services/chef';

export interface ChefTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: RecipeExtraction | null;
  suggestions?: string[];
}

export type { ChefConversationSummary } from '@/services/chef';

interface ChefHistoryState {
  conversations: ChefConversationSummary[];
  currentId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  startNew: () => Promise<string | null>;
  setCurrent: (id: string | null) => void;
  saveTurns: (turns: ChefTurn[]) => Promise<void>;
  loadTurns: (id: string) => Promise<ChefTurn[] | null>;
  remove: (id: string) => Promise<void>;
}

function clientId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

let hydrating: Promise<void> | null = null;

export const useChefHistoryStore = create<ChefHistoryState>((set, get) => ({
  conversations: [],
  currentId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (hydrating) return hydrating;
    hydrating = (async () => {
      try {
        const list = await chefService.listConversations();
        set({ conversations: list, hydrated: true });
      } catch {
        // Mark hydrated even on failure so the UI doesn't sit on a spinner;
        // the user can retry by opening the sheet.
        set({ hydrated: true });
      } finally {
        hydrating = null;
      }
    })();
    return hydrating;
  },

  startNew: async () => {
    try {
      const created = await chefService.createConversation();
      set((s) => ({
        conversations: [
          created,
          ...s.conversations.filter((c) => c.id !== created.id),
        ].slice(0, 50),
        currentId: created.id,
      }));
      return created.id;
    } catch {
      return null;
    }
  },

  setCurrent: (id) => set({ currentId: id }),

  saveTurns: async (turns) => {
    const id = get().currentId;
    if (!id) return;
    try {
      const updated = await chefService.replaceMessages(
        id,
        turns.map((t) => ({
          role: t.role,
          content: t.content,
          recipe: t.recipe ?? null,
          suggestions: t.suggestions ?? [],
        })),
      );
      set((s) => {
        const others = s.conversations.filter((c) => c.id !== updated.id);
        return { conversations: [updated, ...others] };
      });
    } catch {
      // best-effort persistence
    }
  },

  loadTurns: async (id) => {
    try {
      const detail = await chefService.getConversation(id);
      return detail.turns.map((t) => ({
        id: clientId(),
        role: t.role,
        content: t.content,
        recipe: t.recipe ?? null,
        suggestions: t.suggestions ?? [],
      }));
    } catch {
      return null;
    }
  },

  remove: async (id) => {
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      currentId: s.currentId === id ? null : s.currentId,
    }));
    try {
      await chefService.deleteConversation(id);
    } catch {
      // best-effort
    }
  },
}));
