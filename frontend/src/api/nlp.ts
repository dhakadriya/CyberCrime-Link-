import { apiClient } from './client';

export const nlpApi = {
  extract: async (text: string, sourceLabel?: string) => {
    const r = await apiClient.post('/nlp/extract', { text, source_label: sourceLabel });
    return r.data;
  },

  resolve: async (text: string) => {
    const r = await apiClient.post('/nlp/resolve', { text });
    return r.data;
  },
};
