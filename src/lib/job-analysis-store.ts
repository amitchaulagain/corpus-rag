import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface JobAnalysisState {
  selectedJobFilename: string | null;
  analysisResult: any | null;
  isGenerating: boolean;
  abortController: AbortController | null;
}

const STORAGE_KEY = 'corpus-rag-job-analysis-state';

function initializeState(): JobAnalysisState {
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          isGenerating: false,
          abortController: null
        };
      }
    } catch (e) {
      console.error('Failed to load job analysis state from localStorage:', e);
    }
  }

  return {
    selectedJobFilename: null,
    analysisResult: null,
    isGenerating: false,
    abortController: null
  };
}

function createJobAnalysisStore() {
  const { subscribe, set, update } = writable<JobAnalysisState>(initializeState());

  if (browser) {
    subscribe((state) => {
      try {
        const { abortController, ...saveableState } = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState));
      } catch (e) {
        console.error('Failed to save job analysis state to localStorage:', e);
      }
    });
  }

  return {
    subscribe,

    startAnalysis: (jobFilename: string) => {
      update(state => ({
        ...state,
        selectedJobFilename: jobFilename,
        isGenerating: true,
        analysisResult: null,
        abortController: new AbortController()
      }));
    },

    setAnalysisResult: (result: any) => {
      update(state => ({
        ...state,
        analysisResult: result,
        isGenerating: false,
        abortController: null
      }));
    },

    cancelAnalysis: () => {
      update(state => {
        state.abortController?.abort();
        return {
          ...state,
          isGenerating: false,
          abortController: null
        };
      });
    },

    clearResults: () => {
      set({
        selectedJobFilename: null,
        analysisResult: null,
        isGenerating: false,
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

export const jobAnalysisStore = createJobAnalysisStore();
