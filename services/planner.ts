import { api } from './api';
import type { WeekPlan, MealPlanEntry, GroceryItem } from '@/types';

export const plannerService = {
  getWeek: (weekStart: string) =>
    api.get<WeekPlan>(`/planner?weekStart=${weekStart}`),
  addEntry: (entry: Omit<MealPlanEntry, 'id' | 'recipe'>) =>
    api.post<MealPlanEntry>('/planner/entries', entry),
  removeEntry: (id: string) =>
    api.delete<void>(`/planner/entries/${id}`),
  getGroceryList: (weekStart: string) =>
    api.get<GroceryItem[]>(`/planner/grocery-list?weekStart=${weekStart}`),
};
