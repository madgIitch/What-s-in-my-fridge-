import { create } from 'zustand';
import { parseRecipeFromUrl, ParseRecipeFromUrlResult } from '../services/firebase/functions';

interface UrlRecipeStore {
  urlInput: string;
  urlLoading: boolean;
  urlError: string | null;
  urlResult: ParseRecipeFromUrlResult | null;

  setUrlInput: (input: string) => void;
  parseUrlRecipe: (url: string) => Promise<void>;
  clearUrlState: () => void;
}

export const useUrlRecipeStore = create<UrlRecipeStore>((set) => ({
  urlInput: '',
  urlLoading: false,
  urlError: null,
  urlResult: null,

  setUrlInput: (input) => set({ urlInput: input }),

  parseUrlRecipe: async (url: string) => {
    set({ urlLoading: true, urlError: null, urlResult: null });
    try {
      const data = await parseRecipeFromUrl({ url });
      set({ urlResult: data });
    } catch (err: any) {
      set({ urlError: err.message || 'Error al procesar la receta. Intenta con otra URL.' });
    } finally {
      set({ urlLoading: false });
    }
  },

  clearUrlState: () => set({
    urlInput: '',
    urlLoading: false,
    urlError: null,
    urlResult: null,
  }),
}));
