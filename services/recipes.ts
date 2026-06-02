import { supabase } from '@/lib/supabase';
import { api, BASE_URL } from './api';
import type { Recipe } from '@/types';

export const recipesService = {
  list: () => api.get<Recipe[]>('/recipes/'),
  get: (id: string) => api.get<Recipe>(`/recipes/${id}`),
  save: (recipe: Partial<Recipe>) => api.post<Recipe>('/recipes/', recipe),
  delete: (id: string) => api.delete<void>(`/recipes/${id}`),

  uploadCover: async (
    id: string,
    asset: { uri: string; mimeType?: string | null; fileName?: string | null },
  ): Promise<Recipe> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const mime = asset.mimeType || 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpg';
    const form = new FormData();
    form.append('image', {
      uri: asset.uri,
      name: asset.fileName || `cover.${ext}`,
      type: mime,
    } as unknown as Blob);

    const res = await fetch(`${BASE_URL}/recipes/${id}/cover`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Cover upload failed (${res.status})`);
    }
    return res.json();
  },

  removeCover: (id: string) => api.delete<Recipe>(`/recipes/${id}/cover`),
};
