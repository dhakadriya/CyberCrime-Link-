import { apiClient } from './client';
import type { User, PaginatedResponse } from '../types';

export const usersApi = {
  list: async (params: { page?: number; size?: number; search?: string } = {}): Promise<PaginatedResponse<User>> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    const response = await apiClient.get<PaginatedResponse<User>>(`/users?${q}`);
    return response.data;
  },

  get: async (id: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    badge_number?: string;
    department?: string;
    role_names: string[];
  }): Promise<User> => {
    const response = await apiClient.post<User>('/users', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    email: string;
    full_name: string;
    badge_number: string;
    department: string;
    is_active: boolean;
  }>): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${id}`, data);
    return response.data;
  },

  assignRoles: async (id: string, roles: string[]): Promise<void> => {
    await apiClient.post(`/users/${id}/roles`, roles);
  },

  unlock: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/unlock`);
  },
};
