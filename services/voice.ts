import { supabase } from '@/lib/supabase';
import { BASE_URL } from './api';

export type VoiceIntent =
  | 'next'
  | 'back'
  | 'repeat'
  | 'goto'
  | 'timer'
  | 'answer'
  | 'unknown';

export interface VoiceResponse {
  intent: VoiceIntent;
  step_delta: number | null;
  target_step: number | null;
  timer_seconds: number | null;
  speech: string;
  transcript: string;
  speech_audio_b64: string | null;
  speech_audio_mime: string | null;
}

export const voiceService = {
  cookAlong: async (
    recipeId: string,
    currentStep: number,
    audioUri: string,
    voice?: string,
    provider?: string,
  ): Promise<VoiceResponse> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const form = new FormData();
    form.append('audio', {
      uri: audioUri,
      name: 'audio.m4a',
      type: 'audio/m4a',
    } as unknown as Blob);
    form.append('recipe_id', recipeId);
    form.append('current_step', String(currentStep));
    if (voice) form.append('voice', voice);
    if (provider) form.append('provider', provider);

    const res = await fetch(`${BASE_URL}/voice/cook-along`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Voice request failed (${res.status})`);
    }
    return res.json();
  },

  cookAlongText: async (
    recipeId: string,
    currentStep: number,
    transcript: string,
    voice?: string,
    provider?: string,
  ): Promise<VoiceResponse> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const res = await fetch(`${BASE_URL}/voice/cook-along/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        recipe_id: recipeId,
        current_step: currentStep,
        transcript,
        ...(voice ? { voice } : {}),
        ...(provider ? { provider } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Voice request failed (${res.status})`);
    }
    return res.json();
  },

  tts: async (
    text: string,
    voice?: string,
    provider?: string,
  ): Promise<{ audio_b64: string; mime: string }> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const res = await fetch(`${BASE_URL}/voice/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text,
        ...(voice ? { voice } : {}),
        ...(provider ? { provider } : {}),
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || `TTS failed (${res.status})`);
    }
    return res.json();
  },
};
