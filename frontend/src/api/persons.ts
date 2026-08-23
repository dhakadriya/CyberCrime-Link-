import { apiClient } from './client';
import type { Person, PaginatedResponse } from '../types';

export const personsApi = {
  list: async (params: {
    page?: number;
    size?: number;
    search?: string;
    role?: string;
    case_id?: string;
  } = {}): Promise<PaginatedResponse<Person>> => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.size) q.set('size', String(params.size));
    if (params.search) q.set('search', params.search);
    if (params.role) q.set('role', params.role);
    if (params.case_id) q.set('case_id', params.case_id);
    const response = await apiClient.get<PaginatedResponse<Person>>(`/persons?${q}`);
    return response.data;
  },

  get: async (id: string): Promise<Person> => {
    const response = await apiClient.get<Person>(`/persons/${id}`);
    return response.data;
  },

  create: async (data: {
    first_name: string;
    last_name: string;
    alias?: string;
    date_of_birth?: string;
    gender?: string;
    nationality?: string;
    national_id?: string;
    address?: string;
    phone?: string;
    email?: string;
    occupation?: string;
    notes?: string;
  }): Promise<Person> => {
    const response = await apiClient.post<Person>('/persons', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    first_name: string;
    last_name: string;
    alias: string;
    address: string;
    phone: string;
    email: string;
    occupation: string;
    notes: string;
  }>): Promise<Person> => {
    const response = await apiClient.put<Person>(`/persons/${id}`, data);
    return response.data;
  },
};
