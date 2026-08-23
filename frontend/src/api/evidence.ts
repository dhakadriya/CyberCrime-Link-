import { apiClient } from './client';
import type { Evidence, PaginatedResponse, CustodyRecord, IntegrityResult, BulkUploadResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const evidenceApi = {
  list: async (params: {
    page?: number;
    size?: number;
    case_id?: string;
    evidence_type?: string;
  } = {}): Promise<PaginatedResponse<Evidence>> => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.size) q.set('size', String(params.size));
    if (params.case_id) q.set('case_id', params.case_id);
    if (params.evidence_type) q.set('evidence_type', params.evidence_type);
    const r = await apiClient.get<PaginatedResponse<Evidence>>(`/evidence?${q}`);
    return r.data;
  },

  get: async (id: string): Promise<Evidence> => {
    const r = await apiClient.get<Evidence>(`/evidence/${id}`);
    return r.data;
  },

  upload: async (caseId: string, file: File, description?: string): Promise<Evidence> => {
    const formData = new FormData();
    formData.append('case_id', caseId);
    formData.append('file', file);
    if (description) formData.append('description', description);
    const r = await apiClient.post<Evidence>('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },

  bulkUpload: async (caseId: string, files: File[]): Promise<BulkUploadResponse> => {
    const formData = new FormData();
    formData.append('case_id', caseId);
    files.forEach(f => formData.append('files', f));
    const r = await apiClient.post<BulkUploadResponse>('/evidence/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },

  download: async (id: string, filename: string): Promise<void> => {
    const token = sessionStorage.getItem('crimelink_token');
    const response = await fetch(`${BASE_URL}/api/v1/evidence/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  verify: async (id: string): Promise<IntegrityResult> => {
    const r = await apiClient.post<IntegrityResult>(`/evidence/${id}/verify`);
    return r.data;
  },

  getCustodyChain: async (id: string): Promise<CustodyRecord[]> => {
    const r = await apiClient.get<CustodyRecord[]>(`/evidence/${id}/custody`);
    return r.data;
  },

  transfer: async (id: string, newCustodianId: string, remarks?: string): Promise<void> => {
    await apiClient.post(`/evidence/${id}/transfer`, {
      new_custodian_id: newCustodianId,
      remarks,
    });
  },
};
