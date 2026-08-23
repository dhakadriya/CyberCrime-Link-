import { apiClient } from './client';

export const geospatialApi = {
  getLocations: async (caseId?: string) => {
    const params = caseId ? `?case_id=${caseId}` : '';
    const r = await apiClient.get(`/geospatial/locations${params}`);
    return r.data;
  },

  getHeatmap: async () => {
    const r = await apiClient.get('/geospatial/heatmap');
    return r.data;
  },
};
