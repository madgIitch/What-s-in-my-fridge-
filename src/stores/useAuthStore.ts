import { create } from 'zustand';

/**
 * User interface - Firebase Auth user
 */
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Auth Store - Manages authentication state
 * Equivalent to LoginVm from Android app
 */
interface AuthStore {
  user: User | null;
  loading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  error: null,

  setUser: (user) => set({ user, loading: false, error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  signOut: () => set({ user: null, error: null }),

  clearError: () => set({ error: null }),
}));
