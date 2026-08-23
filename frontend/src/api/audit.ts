import { apiClient } from './client';
import type { AuditLog, SecurityEvent, PaginatedResponse } from '../types';

export const auditApi = {
  list: async (params: {
    page?: number;
    size?: number;
    action?: string;
    user_id?: string;
    resource_type?: string;
    result?: string;
  } = {}): Promise<PaginatedResponse<AuditLog>> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    const response = await apiClient.get<PaginatedResponse<AuditLog>>(`/audit?${q}`);
    return response.data;
  },

  getResourceAudit: async (resourceType: string, resourceId: string): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[]>(`/audit/${resourceType}/${resourceId}`);
    return response.data;
  },
};

export const securityApi = {
  listEvents: async (params: {
    page?: number;
    size?: number;
    severity?: string;
    event_type?: string;
    resolved?: boolean;
  } = {}): Promise<PaginatedResponse<SecurityEvent>> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) q.set(k, String(v));
    });
    const response = await apiClient.get<PaginatedResponse<SecurityEvent>>(`/security/events?${q}`);
    return response.data;
  },

  getDashboard: async () => {
    const response = await apiClient.get('/security/dashboard');
    return response.data;
  },

  resolveEvent: async (id: string) => {
    await apiClient.put(`/security/${id}/resolve`);
  },
};
