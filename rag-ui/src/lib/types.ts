export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export interface ListFilesResponse {
  files: DriveFile[];
}

export interface IngestRequest {
  user_id: string;
  drive_file_ids: string[];
}

export interface QueryRequest {
  user_id: string;
  question: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IngestResponse {
  status: string;
  result?: any;
}

export interface QueryResponse {
  answer: string;
}