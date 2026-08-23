import { apiClient } from './client';
import type {
  Case, PaginatedResponse, InvestigationEvent,
  CasePersonResponse, GraphData, CaseWizardPayload, CaseCompletion,
} from '../types';

interface CaseFilters {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  priority?: string;
  case_type?: string;
}

export const casesApi = {
  list: async (filters: CaseFilters = {}): Promise<PaginatedResponse<Case>> => {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.size) params.set('size', String(filters.size));
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.case_type) params.set('case_type', filters.case_type);
    const r = await apiClient.get<PaginatedResponse<Case>>(`/cases?${params}`);
    return r.data;
  },

  get: async (id: string): Promise<Case> => {
    const r = await apiClient.get<Case>(`/cases/${id}`);
    return r.data;
  },

  create: async (data: {
    title: string;
    case_type: string;
    description?: string;
    location?: string;
    incident_date?: string;
    priority?: string;
    status?: string;
  }): Promise<Case> => {
    const r = await apiClient.post<Case>('/cases', data);
    return r.data;
  },

  createWizard: async (data: CaseWizardPayload): Promise<Case> => {
    const r = await apiClient.post<Case>('/cases/wizard', data);
    return r.data;
  },

  update: async (id: string, data: Partial<{
    title: string;
    case_type: string;
    description: string;
    location: string;
    priority: string;
    status: string;
  }>): Promise<Case> => {
    const r = await apiClient.put<Case>(`/cases/${id}`, data);
    return r.data;
  },

  updateStatus: async (id: string, status: string, reason?: string): Promise<Case> => {
    const r = await apiClient.put<Case>(`/cases/${id}/status`, { status, reason });
    return r.data;
  },

  assign: async (id: string, userId: string, role?: string): Promise<void> => {
    await apiClient.post(`/cases/${id}/assign`, {
      user_id: userId,
      role: role || 'ASSIGNED_OFFICER',
    });
  },

  getPersons: async (caseId: string): Promise<CasePersonResponse[]> => {
    const r = await apiClient.get<CasePersonResponse[]>(`/cases/${caseId}/persons`);
    return r.data;
  },

  addPerson: async (caseId: string, personId: string, role: string, notes?: string): Promise<CasePersonResponse> => {
    const r = await apiClient.post<CasePersonResponse>(`/cases/${caseId}/persons`, {
      person_id: personId,
      role,
      notes,
    });
    return r.data;
  },

  getTimeline: async (caseId: string): Promise<{ events: InvestigationEvent[]; total: number }> => {
    const r = await apiClient.get(`/cases/${caseId}/timeline`);
    return r.data;
  },

  addEvent: async (caseId: string, data: {
    event_type: string;
    title: string;
    description?: string;
  }): Promise<InvestigationEvent> => {
    const r = await apiClient.post<InvestigationEvent>(`/cases/${caseId}/events`, data);
    return r.data;
  },

  getGraph: async (caseId: string): Promise<GraphData> => {
    const r = await apiClient.get<GraphData>(`/cases/${caseId}/relationships/graph`);
    return r.data;
  },

  prioritize: async (caseId: string) => {
    const r = await apiClient.post(`/cases/${caseId}/prioritize`);
    return r.data;
  },

  getScores: async (caseId: string) => {
    const r = await apiClient.get(`/cases/${caseId}/scores`);
    return r.data;
  },

  getCompletion: async (caseId: string): Promise<CaseCompletion> => {
    const r = await apiClient.get<CaseCompletion>(`/cases/${caseId}/completion`);
    return r.data;
  },

  generateReport: async (caseId: string) => {
    const r = await apiClient.post(`/reports/case/${caseId}`);
    return r.data;
  },
};
