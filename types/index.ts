export interface Ingredient {
  name: string;
  quantity: string;
  unit?: string;
}

export interface TechniqueAnnotation {
  technique: string;
  explanation: string;
}

export interface RecipeStep {
  step: number;
  instruction: string;
  techniques: TechniqueAnnotation[];
  duration?: number; // seconds
}

export interface Macros {
  calories: number;
  protein: number; // grams
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceType: 'tiktok' | 'reels' | 'photo' | 'manual';
  cuisine?: string;
  totalTime?: number; // minutes
  servings: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  macros?: Macros;
  savedAt: string;
}

export interface MealPlanEntry {
  id: string;
  recipeId: string;
  recipe: Recipe;
  date: string; // ISO date YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
}

export interface WeekPlan {
  weekStart: string;
  entries: MealPlanEntry[];
}

export interface GroceryItem {
  ingredient: string;
  quantity: string;
  unit?: string;
  checked: boolean;
}

export type ImportSource = 'tiktok' | 'reels' | 'photo';
