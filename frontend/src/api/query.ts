import { apiClient } from './client';

export const queryApi = {
  execute: async (query: string, caseId?: string) => {
    const r = await apiClient.post('/query', { query, case_id: caseId });
    return r.data;
  },

  getSuggestions: async () => {
    const r = await apiClient.get('/query/suggestions');
    return r.data;
  },
};
