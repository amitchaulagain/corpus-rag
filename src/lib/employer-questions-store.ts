import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { AnswerWithReferences, ParsedAnswer } from '$lib/types/answer-references';

export interface EmployerQuestionsState {
  selectedJobFilename: string | null;
  generatedAnswers: string;
  parsedAnswers: ParsedAnswer[];
  comparisonResults: any | null;
  isGenerating: boolean;
  isComparing: boolean;
  abortController: AbortController | null;
}

const STORAGE_KEY = 'corpus-rag-employer-questions-state';

/** Only these fields are persisted; comparisonResults is excluded to avoid huge localStorage and browser crashes. */
const PERSISTED_KEYS = ['selectedJobFilename', 'parsedAnswers'] as const;

const MAX_STORED_SIZE = 500 * 1024; // 500KB - avoid parsing huge legacy payloads that can crash the tab

function initializeState(): EmployerQuestionsState {
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.length <= MAX_STORED_SIZE) {
        const parsed = JSON.parse(stored) as Partial<EmployerQuestionsState>;
        const restored: Partial<EmployerQuestionsState> = {};
        for (const key of PERSISTED_KEYS) {
          if (parsed[key] !== undefined) restored[key] = parsed[key];
        }
        return {
          selectedJobFilename: null,
          generatedAnswers: '',
          parsedAnswers: [],
          comparisonResults: null,
          isGenerating: false,
          isComparing: false,
          abortController: null,
          ...restored
        };
      }
      if (stored && stored.length > MAX_STORED_SIZE) {
        localStorage.removeItem(STORAGE_KEY);
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
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingPayload: string | null = null;
    subscribe((state) => {
      try {
        // Only persist small fields; never persist comparisonResults (can be huge and cause crashes)
        const saveableState: Record<string, unknown> = {};
        for (const key of PERSISTED_KEYS) {
          saveableState[key] = state[key];
        }
        pendingPayload = JSON.stringify(saveableState);
        // Debounce writes so streaming updates don't hammer localStorage
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveTimeout = null;
          if (pendingPayload !== null) {
            try {
              localStorage.setItem(STORAGE_KEY, pendingPayload);
            } catch (e) {
              console.error('Failed to save employer questions state to localStorage:', e);
            }
            pendingPayload = null;
          }
        }, 300);
      } catch (e) {
        console.error('Failed to prepare employer questions state for localStorage:', e);
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

    setGeneratedAnswers: (answers: string, parsed: ParsedAnswer[]) => {
      update(state => ({
        ...state,
        generatedAnswers: answers,
        parsedAnswers: parsed,
        isGenerating: false,
        abortController: null
      }));
    },

    setParsedAnswers: (parsed: ParsedAnswer[]) => {
      update(state => ({
        ...state,
        parsedAnswers: parsed
      }));
    },

    startComparison: (jobFilename: string) => {
      update(state => ({
        ...state,
        selectedJobFilename: jobFilename,
        isComparing: true,
        comparisonResults: {},
        parsedAnswers: [], // Clear parsed answers when starting new comparison
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

    /** Switch context to another job: set current job and clear answers so KB reflects the new job. */
    switchJob: (jobFilename: string) => {
      update(state => ({
        ...state,
        selectedJobFilename: jobFilename,
        generatedAnswers: '',
        parsedAnswers: [],
        comparisonResults: null
      }));
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
