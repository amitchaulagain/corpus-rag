import type { DriveFile, IngestRequest, QueryRequest, ApiResponse, IngestResponse, QueryResponse } from './types.js';

const API_BASE = 'http://localhost:8000';

async function apiRequest<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, data: result };
    } else {
      return { success: false, error: result.error || 'Request failed' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

export async function listDriveFiles(folderId: string): Promise<ApiResponse<DriveFile[]>> {
  const response = await apiRequest<{ files: DriveFile[] }>('/list-files', { folder_id: folderId });
  if (response.success && response.data) {
    return { success: true, data: response.data.files };
  }
  return { success: false, error: response.error };
}

export async function ingestFiles(request: IngestRequest): Promise<ApiResponse<IngestResponse>> {
  return apiRequest<IngestResponse>('/ingest', request);
}

export async function queryRag(request: QueryRequest): Promise<ApiResponse<QueryResponse>> {
  return apiRequest<QueryResponse>('/query', request);
}