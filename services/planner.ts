import { api } from './api';
import type { WeekPlan, PlannedMeal, GroceryItem } from '@/types';

export interface PlannedMealUpdate {
  plannedDate?: string;
  mealType?: PlannedMeal['mealType'];
  servings?: number;
  cookedAt?: string | null;
}

export interface GroceryItemCreate {
  weekStart: string;
  ingredientName: string;
  totalQuantity?: number | null;
  unit?: string;
  category?: string;
}

export interface GroceryItemUpdate {
  ingredientName?: string;
  totalQuantity?: number | null;
  unit?: string;
  category?: string;
  checked?: boolean;
}

export const plannerService = {
  getWeek: (weekStart: string) =>
    api.get<WeekPlan>(`/planner/?weekStart=${weekStart}`),
  addEntry: (entry: Omit<PlannedMeal, 'id' | 'recipe' | 'cookedAt'>) =>
    api.post<PlannedMeal>('/planner/entries', entry),
  updateEntry: (id: string, patch: PlannedMealUpdate) =>
    api.patch<PlannedMeal>(`/planner/entries/${id}`, {
      ...patch,
      cookedAt: patch.cookedAt === null ? '' : patch.cookedAt,
    }),
  removeEntry: (id: string) =>
    api.delete<void>(`/planner/entries/${id}`),

  getGroceryList: (weekStart: string) =>
    api.get<GroceryItem[]>(`/planner/grocery-list?weekStart=${weekStart}`),
  addGroceryItem: (data: GroceryItemCreate) =>
    api.post<GroceryItem>('/planner/grocery-list', data),
  updateGroceryItem: (id: string, patch: GroceryItemUpdate) =>
    api.patch<GroceryItem>(`/planner/grocery-list/${id}`, patch),
  removeGroceryItem: (id: string) =>
    api.delete<void>(`/planner/grocery-list/${id}`),
};
