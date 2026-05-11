import { api } from './api';
import type { Recipe } from '@/types';

export const recipesService = {
  list: () => api.get<Recipe[]>('/recipes/'),
  get: (id: string) => api.get<Recipe>(`/recipes/${id}`),
  save: (recipe: Partial<Recipe>) => api.post<Recipe>('/recipes/', recipe),
  delete: (id: string) => api.delete<void>(`/recipes/${id}`),
};
