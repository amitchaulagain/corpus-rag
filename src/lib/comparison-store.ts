import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface ComparisonResult {
  success: boolean;
  answer?: string;
  error?: string;
  metadata?: {
    processingTime: number;
    tokensUsed?: number;
    model: string;
    cost?: {
      usd: number;
      aud: number;
      npr: number;
    };
  };
}

export interface ComparisonState {
  question: string;
  isLoading: boolean;
  comparisonResults: Record<string, ComparisonResult> | null;
  startTime: number | null;
  abortController: AbortController | null;
}

const STORAGE_KEY = 'corpus-rag-comparison-state';

// Initialize state from localStorage if available
function initializeState(): ComparisonState {
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Don't restore loading state or abort controller
        return {
          ...parsed,
          isLoading: false,
          abortController: null
        };
      }
    } catch (e) {
      console.error('Failed to load comparison state from localStorage:', e);
    }
  }

  return {
    question: '',
    isLoading: false,
    comparisonResults: null,
    startTime: null,
    abortController: null
  };
}

function createComparisonStore() {
  const { subscribe, set, update } = writable<ComparisonState>(initializeState());

  // Auto-save to localStorage on state changes (excluding abortController)
  if (browser) {
    subscribe((state) => {
      try {
        const { abortController, ...saveableState } = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState));
      } catch (e) {
        console.error('Failed to save comparison state to localStorage:', e);
      }
    });
  }

  return {
    subscribe,

    startComparison: (question: string) => {
      update(state => ({
        ...state,
        question,
        isLoading: true,
        comparisonResults: {},
        startTime: Date.now(),
        abortController: new AbortController()
      }));
    },

    updateResult: (providerId: string, result: ComparisonResult) => {
      update(state => {
        if (!state.comparisonResults) {
          state.comparisonResults = {};
        }
        return {
          ...state,
          comparisonResults: {
            ...state.comparisonResults,
            [providerId]: result
          }
        };
      });
    },

    finishComparison: () => {
      update(state => ({
        ...state,
        isLoading: false,
        abortController: null
      }));
    },

    cancelComparison: () => {
      update(state => {
        state.abortController?.abort();
        return {
          ...state,
          isLoading: false,
          abortController: null
        };
      });
    },

    clearResults: () => {
      set({
        question: '',
        isLoading: false,
        comparisonResults: null,
        startTime: null,
        abortController: null
      });
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    getAbortSignal: (): AbortSignal | undefined => {
      const state = get({ subscribe });
      return state.abortController?.signal;
    }
  };
}

export const comparisonStore = createComparisonStore();
