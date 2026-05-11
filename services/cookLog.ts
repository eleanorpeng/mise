import { supabase } from '@/lib/supabase';
import { api } from './api';
import type { CookLog } from '@/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface CreateCookLogInput {
  imageUri: string;
  cookedDate?: string;
  recipeId?: string | null;
  caption?: string | null;
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

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

export const cookLogService = {
  listMonth: (month: string) =>
    api.get<CookLog[]>(`/cook-log/?month=${encodeURIComponent(month)}`),

  list: () => api.get<CookLog[]>('/cook-log/'),

  create: async (input: CreateCookLogInput): Promise<CookLog> => {
    const token = await getAuthToken();
    const fileName = fileNameFromUri(input.imageUri);

    const form = new FormData();
    form.append('image', {
      uri: input.imageUri,
      name: fileName,
      type: mimeFromName(fileName),
    } as unknown as Blob);

    if (input.cookedDate) form.append('cookedDate', input.cookedDate);
    if (input.recipeId) form.append('recipeId', input.recipeId);
    if (input.caption) form.append('caption', input.caption);

    const res = await fetch(`${BASE_URL}/cook-log/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Upload failed (${res.status})`);
    }

    return (await res.json()) as CookLog;
  },

  remove: (id: string) => api.delete<void>(`/cook-log/${id}`),
};
