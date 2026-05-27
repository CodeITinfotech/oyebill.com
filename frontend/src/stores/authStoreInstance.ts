import { create } from 'zustand';
import { api } from '../api';
import type { User, Restaurant } from '../types';

interface AuthState {
  user: User | null;
  restaurant: Restaurant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkSetup: () => Promise<void>;
  setupInitial: (restaurant: any, admin: any) => Promise<boolean>;
  clearError: () => void;
  setRestaurant: (restaurant: Restaurant) => void;
}

const store = create<AuthState>((set, get) => ({
  user: null,
  restaurant: null,
  isAuthenticated: false,
  isLoading: true,
  needsSetup: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    
    const response = await api.login(email, password);
    
    if (response.success && response.data) {
      api.setToken(response.data.token);
      set({
        user: response.data.user,
        restaurant: response.data.restaurant,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } else {
      set({
        error: response.error || 'Login failed',
        isLoading: false,
      });
      return false;
    }
  },

  logout: async () => {
    await api.logout();
    api.setToken(null);
    set({
      user: null,
      restaurant: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    
    const token = api.getToken();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    const response = await api.getMe();
    
    if (response.success && response.data) {
      set({
        user: response.data.user,
        restaurant: response.data.restaurant,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      api.setToken(null);
      set({
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  checkSetup: async () => {
    const response = await api.checkSetup();
    
    if (response.success && response.data) {
      set({
        needsSetup: response.data.needsSetup,
        restaurant: response.data.restaurant,
      });
    }
  },

  setupInitial: async (restaurant: any, admin: any) => {
    set({ isLoading: true, error: null });
    
    const response = await api.setupInitial({ restaurant, admin });
    
    if (response.success) {
      return get().login(admin.email, admin.password);
    } else {
      set({
        error: response.error || 'Setup failed',
        isLoading: false,
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  setRestaurant: (restaurant: Restaurant) => set({ restaurant }),
}));

// Export the store directly without wrapping in a hook
export const authStore = store;

// Re-export the hook for convenience
export const useAuthStore = store;
