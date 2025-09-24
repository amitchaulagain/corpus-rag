// API Types for External Integration

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Authentication Types
export interface ApiKey {
  id: string;
  key: string;
  userId: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
}

export interface TokenInfo {
  userId: string;
  email: string;
  scopes: string[];
  expiresAt: number;
}

// File Management Types
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  userId: string;
  fileId: string; // Cloud storage URI
  fullPath: string;
  created: string;
  updated?: string;
}

export interface UploadRequest {
  userId: string;
  replaceExisting?: boolean;
}

export interface UploadResponse {
  file: FileInfo;
  ragImport?: {
    success: boolean;
    operationId?: string;
    error?: string;
  };
}

// Corpus Management Types
export interface CorpusInfo {
  corpusId: string;
  userId: string;
  displayName: string;
  exists: boolean;
  createTime: string;
  fileCount?: number;
}

export interface CorpusFile {
  id: string;
  name: string;
  state: 'ACTIVE' | 'PENDING' | 'ERROR';
  sizeBytes?: string;
  createTime: string;
  gcsSource?: string;
  problemMessage?: string;
}

// RAG Operations Types
export interface QueryRequest {
  userId: string;
  question: string;
  context?: string;
  maxResults?: number;
}

export interface QueryResponse {
  answer: string;
  sources?: string[];
  processingTime: number;
  corpusId: string;
}

export interface ImportRequest {
  userId: string;
  cloudStorageUris: string[];
  waitForCompletion?: boolean;
}

export interface ImportResponse {
  message: string;
  operationId: string;
  filesCount: number;
  corpusId: string;
}

export interface OperationStatus {
  operationId: string;
  done: boolean;
  progress?: number;
  error?: string;
  result?: any;
}

// System Types
export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptime: number;
  services: {
    storage: 'healthy' | 'degraded' | 'down';
    vertexAI: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
  };
}

export interface UsageStats {
  userId: string;
  filesUploaded: number;
  storageUsed: number; // bytes
  queriesCount: number;
  lastActivity: string;
  monthlyUsage: {
    uploads: number;
    queries: number;
    storageUsed: number;
  };
}

// API Scope Definitions
export const API_SCOPES = {
  'files:read': 'Read user files',
  'files:write': 'Upload and manage files',
  'files:delete': 'Delete files',
  'corpus:read': 'Read corpus information',
  'corpus:write': 'Manage corpus',
  'rag:query': 'Query the RAG system',
  'rag:import': 'Import files to RAG',
  'system:status': 'Read system status',
  'admin': 'Full administrative access'
} as const;

export type ApiScope = keyof typeof API_SCOPES;

// Rate Limiting Types
export interface RateLimit {
  limit: number;
  remaining: number;
  resetTime: number;
  window: number; // seconds
}

// Webhook Types
export interface WebhookEvent {
  id: string;
  type: 'file.uploaded' | 'rag.import.completed' | 'rag.import.failed' | 'corpus.created';
  userId: string;
  data: any;
  timestamp: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  userId: string;
}