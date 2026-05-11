import { api } from './api';
import type { Recipe } from '@/types';

export const importService = {
  fromUrl: (url: string, options?: { fast?: boolean }) =>
    api.post<Recipe>('/import/url', { url, fast: options?.fast ?? false }),
  fromPhoto: (imageBase64: string) =>
    api.post<Recipe>('/import/photo', { image: imageBase64 }),
};
