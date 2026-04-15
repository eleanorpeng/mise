import { api } from './api';

interface VoiceResponse {
  answer: string;
  nextStep: number | null;
}

export const voiceService = {
  ask: (recipeId: string, currentStep: number, question: string) =>
    api.post<VoiceResponse>('/voice/ask', { recipeId, currentStep, question }),
};
