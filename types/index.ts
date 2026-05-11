export interface Ingredient {
  id?: string;
  name: string;
  quantity: number | null;
  unit?: string;
  notes?: string;
  orderIndex?: number;
}

export interface Technique {
  id: string;
  name: string;
  explanation: string;
  category?: 'heat' | 'knife' | 'sauce' | 'baking' | 'timing' | 'general';
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface RecipeStep {
  id?: string;
  orderIndex: number;
  instruction: string;
  durationSeconds?: number;
  technique?: Technique | null;
}

export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  sourceUrl?: string;
  sourceType: 'video' | 'photo' | 'manual';
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings: number;
  durationMinutes?: number;
  status: 'processing' | 'ready' | 'failed';
  isPublic?: boolean;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  macros?: Macros | null;
  importedAt?: string;
  createdAt: string;
}

export interface PlannedMeal {
  id: string;
  recipeId: string;
  recipe?: Recipe;
  plannedDate: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  cookedAt?: string | null;
}

export interface WeekPlan {
  weekStart: string;
  entries: PlannedMeal[];
}

export interface GroceryItem {
  id: string;
  ingredientName: string;
  totalQuantity: number | null;
  unit?: string;
  category: string;
  checked: boolean;
}

export type ImportSource = 'video' | 'photo';

export type CookingIntent =
  | 'cook_more'
  | 'eat_healthier'
  | 'learn_techniques'
  | 'save_money'
  | 'meal_prep';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface UserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  intent: CookingIntent | null;
  cuisinePreferences: string[];
  dietaryRestrictions: string[];
  skillLevel: SkillLevel | null;
  onboardedAt: string | null;
}

export interface ProfileStats {
  totalRecipes: number;
  cookedThisMonth: number;
}

export interface ProfileInsights {
  totalRecipes: number;
  totalCooked: number;
  cookedThisMonth: number;
  cookedThisYear: number;
  currentStreakDays: number;
  techniquesLearned: number;
  topCuisines: { cuisine: string; count: number }[];
  monthlyActivity: { month: string; count: number }[];
}

export interface CookLog {
  id: string;
  recipeId: string | null;
  cookedDate: string;
  caption: string | null;
  originalUrl: string;
  stickerUrl: string;
  dominantColor: string | null;
  createdAt: string;
}
