import { api } from './api';
import type { Recipe } from '@/types';

export const importService = {
  fromUrl: (url: string) =>
    api.post<Recipe>('/import/url', { url }),
  fromPhoto: (imageBase64: string) =>
    api.post<Recipe>('/import/photo', { image: imageBase64 }),
};
