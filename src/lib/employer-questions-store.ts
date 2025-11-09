import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface EmployerQuestionsState {
  selectedJobFilename: string | null;
  generatedAnswers: string;
  parsedAnswers: any[];
  comparisonResults: any | null;
  isGenerating: boolean;
  isComparing: boolean;
  abortController: AbortController | null;
}

const STORAGE_KEY = 'corpus-rag-employer-questions-state';

function initializeState(): EmployerQuestionsState {
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
      console.error('Failed to load employer questions state from localStorage:', e);
    }
  }

  return {
    selectedJobFilename: null,
    generatedAnswers: '',
    parsedAnswers: [],
    comparisonResults: null,
    isGenerating: false,
    isComparing: false,
    abortController: null
  };
}

function createEmployerQuestionsStore() {
  const { subscribe, set, update } = writable<EmployerQuestionsState>(initializeState());

  if (browser) {
    subscribe((state) => {
      try {
        const { abortController, ...saveableState } = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState));
      } catch (e) {
        console.error('Failed to save employer questions state to localStorage:', e);
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
        generatedAnswers: '',
        parsedAnswers: [],
        comparisonResults: null,
        abortController: new AbortController()
      }));
    },

    setGeneratedAnswers: (answers: string, parsed: any[]) => {
      update(state => ({
        ...state,
        generatedAnswers: answers,
        parsedAnswers: parsed,
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
        generatedAnswers: '',
        parsedAnswers: [],
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

export const employerQuestionsStore = createEmployerQuestionsStore();
