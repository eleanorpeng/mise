import { fetch as expoFetch } from 'expo/fetch';
import { api, BASE_URL } from './api';
import { supabase } from '@/lib/supabase';
import type { Recipe } from '@/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Mirrors the backend RecipeExtraction (snake_case). Passed straight back to
// /chef/save, so we keep it opaque rather than re-modelling it.
export interface RecipeExtraction {
  title: string;
  description?: string | null;
  cuisine?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  servings: number;
  duration_minutes?: number | null;
  ingredients: Array<{
    name: string;
    quantity?: number | null;
    unit?: string | null;
    notes?: string | null;
  }>;
  steps: Array<{
    instruction: string;
    duration_seconds?: number | null;
    technique?: {
      name: string;
      explanation: string;
      category?: string;
    } | null;
  }>;
  macros?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number | null;
  } | null;
}

export interface ProfileContext {
  display_name?: string | null;
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
  skill_level?: string | null;
}

export interface LearnedPreferences {
  dietary_restrictions: string[];
  cuisine_preferences: string[];
}

export interface ChefChatResponse {
  reply: string;
  needs_more_info: boolean;
  suggestions: string[];
  recipe: RecipeExtraction | null;
  learned: LearnedPreferences | null;
}

interface ChatStreamOpts {
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onDone: (final: ChefChatResponse) => void;
}

async function chatStream(
  messages: ChatMessage[],
  profile: ProfileContext | undefined,
  opts: ChatStreamOpts,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await expoFetch(`${BASE_URL}/chef/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, profile }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.body) {
    throw new Error('Stream not supported');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep = buffer.indexOf('\n\n');
    while (sep >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let eventType = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }

      if (dataLines.length > 0) {
        const data = dataLines.join('\n');
        try {
          const parsed = JSON.parse(data);
          if (eventType === 'delta') opts.onDelta(parsed.text || '');
          else if (eventType === 'done') opts.onDone(parsed as ChefChatResponse);
          else if (eventType === 'error') {
            throw new Error(parsed.message || 'Chef stream failed');
          }
        } catch (err) {
          if (err instanceof Error && err.message !== 'Chef stream failed') {
            // ignore partial JSON parse errors
          } else {
            throw err;
          }
        }
      }

      sep = buffer.indexOf('\n\n');
    }
  }
}

export interface ChefTurnPayload {
  role: 'user' | 'assistant';
  content: string;
  recipe?: RecipeExtraction | null;
  suggestions?: string[];
}

export interface ChefConversationSummary {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  snippet: string;
}

export interface ChefConversationDetail extends ChefConversationSummary {
  turns: ChefTurnPayload[];
}

export const chefService = {
  chat: (messages: ChatMessage[], profile?: ProfileContext, signal?: AbortSignal) =>
    api.post<ChefChatResponse>('/chef/chat', { messages, profile }, { signal }),

  chatStream,

  save: (recipe: RecipeExtraction) => api.post<Recipe>('/chef/save', recipe),

  listConversations: () =>
    api.get<ChefConversationSummary[]>('/chef/conversations'),

  getConversation: (id: string) =>
    api.get<ChefConversationDetail>(`/chef/conversations/${id}`),

  createConversation: () =>
    api.post<ChefConversationSummary>('/chef/conversations', {}),

  replaceMessages: (id: string, turns: ChefTurnPayload[]) =>
    api.put<ChefConversationSummary>(`/chef/conversations/${id}/messages`, { turns }),

  deleteConversation: (id: string) =>
    api.delete<void>(`/chef/conversations/${id}`),
};
