import { api } from './api';
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

export const chefService = {
  chat: (messages: ChatMessage[], profile?: ProfileContext, signal?: AbortSignal) =>
    api.post<ChefChatResponse>('/chef/chat', { messages, profile }, { signal }),

  save: (recipe: RecipeExtraction) => api.post<Recipe>('/chef/save', recipe),
};
