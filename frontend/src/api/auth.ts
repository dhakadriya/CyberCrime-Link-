import { apiClient } from './client';
import type { AuthTokenResponse, User } from '../types';

export const authApi = {
  login: async (username: string, password: string): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>('/auth/login', {
      username,
      password,
    });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};
