import { create } from 'zustand';

interface CropStore {
  croppedUri: string | null;
  setCroppedUri: (uri: string) => void;
  clearCroppedUri: () => void;
}

export const useCropStore = create<CropStore>((set) => ({
  croppedUri: null,
  setCroppedUri: (uri) => set({ croppedUri: uri }),
  clearCroppedUri: () => set({ croppedUri: null }),
}));
