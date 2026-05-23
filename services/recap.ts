import { api } from './api';

export type RecapScope = 'year' | 'month' | 'week' | 'all';

export interface RecapPeriod {
  scope: RecapScope;
  key: string;
  label: string;
  year: number | null;
  coverImageUrl: string | null;
  stickerUrls: string[];
  count: number;
}

export interface RecapPhoto {
  id: string;
  cookedDate: string;
  imageUrl: string | null;
  stickerUrl: string | null;
  originalUrl: string | null;
  caption: string | null;
}

export interface RecapDetail {
  scope: RecapScope;
  key: string;
  label: string;
  coverImageUrl: string | null;
  stats: {
    recipesCooked: number;
    uniqueRecipes: number;
    cuisines: string[];
    techniques: string[];
  };
  photos: RecapPhoto[];
}

export const recapService = {
  listPeriods: (scope: RecapScope) =>
    api.get<RecapPeriod[]>(`/recap/periods?scope=${scope}`),
  getDetail: (scope: RecapScope, key: string) =>
    api.get<RecapDetail>(
      `/recap/detail?scope=${scope}&key=${encodeURIComponent(key)}`,
    ),
};
