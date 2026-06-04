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

interface ImportJobStart {
  jobId: string;
  status: string;
}
interface ImportJobStatus {
  status: string;
  recipeId: string | null;
  errorMessage: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const importService = {
  // The import runs in the background on the server (the full pipeline used to
  // exceed the gateway timeout). Start the job, then poll until the recipe is
  // ready and fetch it.
  fromUrl: async (url: string): Promise<Recipe> => {
    const { jobId } = await api.post<ImportJobStart>('/import/url', { url });

    const POLL_MS = 2000;
    const MAX_ATTEMPTS = 90; // ~3 minutes
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_MS);
      const job = await api.get<ImportJobStatus>(`/import/jobs/${jobId}`);
      if (job.status === 'done' && job.recipeId) {
        return api.get<Recipe>(`/recipes/${job.recipeId}`);
      }
      if (job.status === 'failed') {
        throw new Error(job.errorMessage || 'Import failed');
      }
    }
    throw new Error('Import is taking longer than expected. Please try again.');
  },

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
