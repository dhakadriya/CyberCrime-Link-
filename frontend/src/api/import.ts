import { apiClient } from './client';
import type { ImportPreviewResponse, ImportConfirmResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const importApi = {
  previewImport: async (file: File): Promise<ImportPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ImportPreviewResponse>('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  confirmImport: async (filename: string, fileSize: number): Promise<ImportConfirmResponse> => {
    const params = new URLSearchParams({ filename, file_size: String(fileSize) });
    const response = await apiClient.post<ImportConfirmResponse>(`/import/confirm?${params}`);
    return response.data;
  },

  downloadXlsxTemplate: () => {
    const token = sessionStorage.getItem('crimelink_token');
    const url = `${BASE_URL}/api/v1/import/template/xlsx`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'CrimeLink_Case_Import_Template.xlsx');
    // Add auth header via fetch for download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const bUrl = URL.createObjectURL(blob);
        a.href = bUrl;
        a.click();
        URL.revokeObjectURL(bUrl);
      });
  },

  downloadCsvTemplate: () => {
    const token = sessionStorage.getItem('crimelink_token');
    const url = `${BASE_URL}/api/v1/import/template/csv`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const bUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = bUrl;
        a.download = 'CrimeLink_Cases_Template.csv';
        a.click();
        URL.revokeObjectURL(bUrl);
      });
  },
};
