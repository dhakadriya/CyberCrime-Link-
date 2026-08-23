import { apiClient } from './client';

export const networkApi = {
  getOverview: async (caseId?: string) => {
    const params = caseId ? `?case_id=${caseId}` : '';
    const r = await apiClient.get(`/network${params}`);
    return r.data;
  },

  getInfluencers: async (caseId?: string, limit = 10) => {
    const params = new URLSearchParams();
    if (caseId) params.set('case_id', caseId);
    params.set('limit', String(limit));
    const r = await apiClient.get(`/network/influencers?${params}`);
    return r.data;
  },

  getCommunities: async (caseId?: string) => {
    const params = caseId ? `?case_id=${caseId}` : '';
    const r = await apiClient.get(`/network/communities${params}`);
    return r.data;
  },

  getAnomalies: async (caseId?: string) => {
    const params = caseId ? `?case_id=${caseId}` : '';
    const r = await apiClient.get(`/network/anomalies${params}`);
    return r.data;
  },

  getShortestPath: async (sourceId: string, targetId: string) => {
    const params = new URLSearchParams({ source_id: sourceId, target_id: targetId });
    const r = await apiClient.get(`/network/shortest-path?${params}`);
    return r.data;
  },

  getNeighbors: async (nodeId: string, k = 2) => {
    const r = await apiClient.get(`/network/neighbors/${nodeId}?k=${k}`);
    return r.data;
  },
};
