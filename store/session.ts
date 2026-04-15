import { create } from 'zustand';

interface SessionStore {
  userId: string | null;
  name: string | null;
  setUser: (userId: string, name: string) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  userId: null,
  name: null,
  setUser: (userId, name) => set({ userId, name }),
  clear: () => set({ userId: null, name: null }),
}));
