import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', 'test-project');
vi.stubEnv('GOOGLE_CLOUD_BUCKET_NAME', 'test-bucket');

// Mock window.localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

// Mock file reading for tests
global.FileReader = class {
  readAsDataURL = vi.fn();
  readAsText = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  result = '';
  error = null;
  readyState = 0;
  onload = null;
  onerror = null;
  onloadend = null;
  abort = vi.fn();
} as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Setup cleanup
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});