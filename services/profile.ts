import { api } from './api';
import { supabase } from '@/lib/supabase';
import type { ProfileInsights, ProfileStats, UserProfile } from '@/types';

export interface ProfileUpdate {
  displayName?: string | null;
  avatarUrl?: string | null;
  intent?: UserProfile['intent'];
  cuisinePreferences?: string[];
  dietaryRestrictions?: string[];
  skillLevel?: UserProfile['skillLevel'];
  markOnboarded?: boolean;
}

export const profileService = {
  get: () => api.get<UserProfile>('/profile/'),
  update: (data: ProfileUpdate) => api.patch<UserProfile>('/profile/', data),
  stats: () => api.get<ProfileStats>('/profile/stats'),
  insights: () => api.get<ProfileInsights>('/profile/insights'),

  /**
   * Upload a cropped avatar image to Supabase Storage and return its public URL.
   * The image is stored at `avatars/{userId}/avatar.jpg` so the storage RLS
   * policy ((storage.foldername(name))[1] = auth.uid()::text) allows the write.
   */
  async uploadAvatar(userId: string, localUri: string): Promise<string> {
    const res = await fetch(localUri);
    const blob = await res.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const path = `${userId}/avatar.jpg`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // Cache-bust so the new image shows immediately.
    return `${data.publicUrl}?t=${Date.now()}`;
  },
};
