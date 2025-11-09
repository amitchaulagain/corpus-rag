import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface CoverLetterState {
  selectedJobFilename: string | null;
  generatedCoverLetter: string;
  comparisonResults: any | null;
  isGenerating: boolean;
  isComparing: boolean;
  abortController: AbortController | null;
}

const STORAGE_KEY = 'corpus-rag-cover-letter-state';

function initializeState(): CoverLetterState {
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          isGenerating: false,
          isComparing: false,
          abortController: null
        };
      }
    } catch (e) {
      console.error('Failed to load cover letter state from localStorage:', e);
    }
  }

  return {
    selectedJobFilename: null,
    generatedCoverLetter: '',
    comparisonResults: null,
    isGenerating: false,
    isComparing: false,
    abortController: null
  };
}

function createCoverLetterStore() {
  const { subscribe, set, update } = writable<CoverLetterState>(initializeState());

  if (browser) {
    subscribe((state) => {
      try {
        const { abortController, ...saveableState } = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState));
      } catch (e) {
        console.error('Failed to save cover letter state to localStorage:', e);
      }
    });
  }

  return {
    subscribe,

    startGeneration: (jobFilename: string) => {
      update(state => ({
        ...state,
        selectedJobFilename: jobFilename,
        isGenerating: true,
        generatedCoverLetter: '',
        comparisonResults: null,
        abortController: new AbortController()
      }));
    },

    setGeneratedLetter: (letter: string) => {
      update(state => ({
        ...state,
        generatedCoverLetter: letter,
        isGenerating: false,
        abortController: null
      }));
    },

    startComparison: (jobFilename: string) => {
      update(state => ({
        ...state,
        selectedJobFilename: jobFilename,
        isComparing: true,
        comparisonResults: {},
        abortController: new AbortController()
      }));
    },

    updateComparisonResult: (providerId: string, result: any) => {
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
        isComparing: false,
        abortController: null
      }));
    },

    cancelGeneration: () => {
      update(state => {
        state.abortController?.abort();
        return {
          ...state,
          isGenerating: false,
          isComparing: false,
          abortController: null
        };
      });
    },

    clearResults: () => {
      set({
        selectedJobFilename: null,
        generatedCoverLetter: '',
        comparisonResults: null,
        isGenerating: false,
        isComparing: false,
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

export const coverLetterStore = createCoverLetterStore();
