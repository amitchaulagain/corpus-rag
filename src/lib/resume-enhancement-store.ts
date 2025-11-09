import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface ResumeEnhancementState {
  selectedJobFilename: string | null;
  enhancedResume: string | null;
  analysisResult: any | null;
  fitScore: number;
  enhancedFitScore: number;
  isGenerating: boolean;
  abortController: AbortController | null;
}

const STORAGE_KEY = 'corpus-rag-resume-enhancement-state';

function initializeState(): ResumeEnhancementState {
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
      console.error('Failed to load resume enhancement state from localStorage:', e);
    }
  }

  return {
    selectedJobFilename: null,
    enhancedResume: null,
    analysisResult: null,
    fitScore: 0,
    enhancedFitScore: 0,
    isGenerating: false,
    abortController: null
  };
}

function createResumeEnhancementStore() {
  const { subscribe, set, update } = writable<ResumeEnhancementState>(initializeState());

  if (browser) {
    subscribe((state) => {
      try {
        const { abortController, ...saveableState } = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState));
      } catch (e) {
        console.error('Failed to save resume enhancement state to localStorage:', e);
      }
    });
  }

  return {
    subscribe,

    startEnhancement: (jobFilename: string) => {
      update(state => ({
        ...state,
        selectedJobFilename: jobFilename,
        isGenerating: true,
        enhancedResume: null,
        analysisResult: null,
        abortController: new AbortController()
      }));
    },

    setEnhancementResult: (enhanced: string, analysis: any, originalFit: number, enhancedFit: number) => {
      update(state => ({
        ...state,
        enhancedResume: enhanced,
        analysisResult: analysis,
        fitScore: originalFit,
        enhancedFitScore: enhancedFit,
        isGenerating: false,
        abortController: null
      }));
    },

    cancelEnhancement: () => {
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
        enhancedResume: null,
        analysisResult: null,
        fitScore: 0,
        enhancedFitScore: 0,
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

export const resumeEnhancementStore = createResumeEnhancementStore();
