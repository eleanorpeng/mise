import { supabase } from '@/lib/supabase';
import { api, BASE_URL } from './api';
import type { Recipe } from '@/types';

function fileNameFromUri(uri: string): string {
  const last = uri.split('/').pop() ?? 'photo.jpg';
  return last.includes('.') ? last : `${last}.jpg`;
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export const importService = {
  fromUrl: (url: string, options?: { fast?: boolean }) =>
    api.post<Recipe>('/import/url', { url, fast: options?.fast ?? false }),

  fromPhoto: async (
    imageUri: string,
    options?: { caption?: string },
  ): Promise<Recipe> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const fileName = fileNameFromUri(imageUri);

    const form = new FormData();
    form.append('image', {
      uri: imageUri,
      name: fileName,
      type: mimeFromName(fileName),
    } as unknown as Blob);

    const caption = options?.caption?.trim();
    if (caption) form.append('caption', caption);

    const res = await fetch(`${BASE_URL}/import/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Photo import failed (${res.status})`);
    }
    return res.json();
  },
};
