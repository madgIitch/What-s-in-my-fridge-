import { create } from 'zustand';
import ParsedDraft from '../database/models/ParsedDraft';

/**
 * Draft Store - Manages OCR scan drafts state
 * Equivalent to ReviewDraftVm + DraftRepository from Android app
 */
interface DraftStore {
  drafts: ParsedDraft[];
  currentDraft: ParsedDraft | null;
  loading: boolean;
  error: string | null;

  // Actions
  setDrafts: (drafts: ParsedDraft[]) => void;
  setCurrentDraft: (draft: ParsedDraft | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useDraftStore = create<DraftStore>((set) => ({
  drafts: [],
  currentDraft: null,
  loading: false,
  error: null,

  setDrafts: (drafts) => set({ drafts }),

  setCurrentDraft: (draft) => set({ currentDraft: draft }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearError: () => set({ error: null }),
}));
