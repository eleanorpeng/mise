import { api } from './api';

export interface CollectionDTO {
  id: string;
  name: string;
  coverColor: string;
  spineColor: string;
  inkColor: string;
  recipeIds: string[];
}

export interface CollectionCreatePayload {
  name: string;
  coverColor?: string;
  spineColor?: string;
  inkColor?: string;
}

export interface CollectionUpdatePayload {
  name?: string;
  coverColor?: string;
  spineColor?: string;
  inkColor?: string;
}

export const collectionsService = {
  list: () => api.get<CollectionDTO[]>('/collections/'),
  create: (payload: CollectionCreatePayload) =>
    api.post<CollectionDTO>('/collections/', payload),
  update: (id: string, payload: CollectionUpdatePayload) =>
    api.patch<CollectionDTO>(`/collections/${id}`, payload),
  delete: (id: string) => api.delete<void>(`/collections/${id}`),
  addRecipe: (collectionId: string, recipeId: string) =>
    api.post<{ recipeId: string; collectionId: string }>(
      `/collections/${collectionId}/recipes/${recipeId}`,
      {},
    ),
  removeRecipe: (collectionId: string, recipeId: string) =>
    api.delete<void>(`/collections/${collectionId}/recipes/${recipeId}`),
};
