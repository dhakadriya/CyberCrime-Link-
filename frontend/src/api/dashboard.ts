import { apiClient } from './client';
import type { DashboardStats, ChartData } from '../types';

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },

  getCharts: async (): Promise<ChartData> => {
    const response = await apiClient.get<ChartData>('/dashboard/charts');
    return response.data;
  },
};
