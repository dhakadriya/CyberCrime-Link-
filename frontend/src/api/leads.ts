import { apiClient } from './client';

export interface Lead {
  id: string;
  title: string;
  lead_type: string;
  description: string;
  confidence: number;
  severity: string;
  subject_type?: string;
  subject_id?: string;
  subject_name?: string;
  case_id?: string;
  supporting_data?: Record<string, unknown>;
  status: string;
  assigned_to?: string;
  notes?: string;
  auto_generated: boolean;
  source_module?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadCreate {
  title: string;
  lead_type?: string;
  description: string;
  confidence?: number;
  severity?: string;
  subject_type?: string;
  subject_id?: string;
  subject_name?: string;
  case_id?: string;
  supporting_data?: Record<string, unknown>;
  notes?: string;
}

export const leadsApi = {
  list: async (params: {
    page?: number;
    size?: number;
    status?: string;
    lead_type?: string;
    severity?: string;
    case_id?: string;
  } = {}) => {
    const p = new URLSearchParams();
    if (params.page) p.set('page', String(params.page));
    if (params.size) p.set('size', String(params.size));
    if (params.status) p.set('status', params.status);
    if (params.lead_type) p.set('lead_type', params.lead_type);
    if (params.severity) p.set('severity', params.severity);
    if (params.case_id) p.set('case_id', params.case_id);
    const r = await apiClient.get(`/leads?${p}`);
    return r.data;
  },

  getStats: async () => {
    const r = await apiClient.get('/leads/stats');
    return r.data;
  },

  get: async (id: string): Promise<Lead> => {
    const r = await apiClient.get<Lead>(`/leads/${id}`);
    return r.data;
  },

  create: async (data: LeadCreate): Promise<Lead> => {
    const r = await apiClient.post<Lead>('/leads', data);
    return r.data;
  },

  update: async (id: string, data: { status?: string; notes?: string; assigned_to?: string }): Promise<Lead> => {
    const r = await apiClient.patch<Lead>(`/leads/${id}`, data);
    return r.data;
  },

  generateFromNetwork: async (caseId?: string) => {
    const params = caseId ? `?case_id=${caseId}` : '';
    const r = await apiClient.post(`/leads/generate-from-network${params}`);
    return r.data;
  },
};
