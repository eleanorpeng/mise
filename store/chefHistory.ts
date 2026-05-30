import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecipeExtraction } from '@/services/chef';

const STORAGE_KEY = 'chef:history:v1';
const MAX_CONVERSATIONS = 50;
const TITLE_MAX = 60;

export interface ChefTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: RecipeExtraction | null;
  suggestions?: string[];
}

export interface ChefConversation {
  id: string;
  title: string;
  turns: ChefTurn[];
  createdAt: number;
  updatedAt: number;
}

interface ChefHistoryState {
  conversations: ChefConversation[];
  currentId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  startNew: () => string;
  setCurrent: (id: string | null) => void;
  saveTurns: (turns: ChefTurn[]) => void;
  remove: (id: string) => void;
}

function nextId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function deriveTitle(turns: ChefTurn[]): string {
  const firstUser = turns.find((t) => t.role === 'user');
  const raw = firstUser?.content.trim();
  if (!raw) return 'New chat';
  const oneLine = raw.replace(/\s+/g, ' ');
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1).trimEnd()}…` : oneLine;
}

async function persist(state: { conversations: ChefConversation[]; currentId: string | null }) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        conversations: state.conversations,
        currentId: state.currentId,
      }),
    );
  } catch {
    // swallow — local persistence is best-effort
  }
}

export const useChefHistoryStore = create<ChefHistoryState>((set, get) => ({
  conversations: [],
  currentId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.conversations)) {
          set({
            conversations: parsed.conversations,
            currentId: typeof parsed.currentId === 'string' ? parsed.currentId : null,
            hydrated: true,
          });
          return;
        }
      }
    } catch {
      // fall through
    }
    set({ hydrated: true });
  },

  startNew: () => {
    const id = nextId();
    const now = Date.now();
    const convo: ChefConversation = {
      id,
      title: 'New chat',
      turns: [],
      createdAt: now,
      updatedAt: now,
    };
    set((s) => {
      const next = {
        conversations: [convo, ...s.conversations].slice(0, MAX_CONVERSATIONS),
        currentId: id,
      };
      persist(next);
      return next;
    });
    return id;
  },

  setCurrent: (id) => {
    set((s) => {
      const next = { conversations: s.conversations, currentId: id };
      persist(next);
      return next;
    });
  },

  saveTurns: (turns) => {
    set((s) => {
      if (!s.currentId) return s;
      const now = Date.now();
      let touched = false;
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.currentId) return c;
        touched = true;
        return {
          ...c,
          turns,
          title: c.title === 'New chat' ? deriveTitle(turns) : c.title,
          updatedAt: now,
        };
      });
      if (!touched) return s;
      // Move the active conversation to the top so the history list stays
      // ordered by recency without us needing to re-sort on read.
      const ordered = [
        ...conversations.filter((c) => c.id === s.currentId),
        ...conversations.filter((c) => c.id !== s.currentId),
      ];
      const next = { conversations: ordered, currentId: s.currentId };
      persist(next);
      return next;
    });
  },

  remove: (id) => {
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      const currentId = s.currentId === id ? null : s.currentId;
      const next = { conversations, currentId };
      persist(next);
      return next;
    });
  },
}));
