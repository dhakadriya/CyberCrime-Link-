import { apiClient } from './client';

export const entitiesApi = {
  list: async (params: {
    page?: number;
    size?: number;
    entity_type?: string;
    search?: string;
  } = {}) => {
    const p = new URLSearchParams();
    if (params.page) p.set('page', String(params.page));
    if (params.size) p.set('size', String(params.size));
    if (params.entity_type) p.set('entity_type', params.entity_type);
    if (params.search) p.set('search', params.search);
    const r = await apiClient.get(`/entities?${p}`);
    return r.data;
  },

  getStats: async () => {
    const r = await apiClient.get('/entities/stats');
    return r.data;
  },
};
