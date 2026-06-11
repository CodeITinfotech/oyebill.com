// Separate file to avoid circular dependencies
// This ensures zustand stores are fully initialized before use

import { create } from 'zustand';
import { api } from '../api';
import type { Category, Section, Table, Product, Order, Settings } from '../types';

// Simple cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL = 30000; // 30 seconds cache
const cache = new Map<string, CacheEntry<any>>();

const getCached = <T>(key: string, ttl: number = DEFAULT_TTL): T | null => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }
  return null;
};

const setCache = <T>(key: string, data: T): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

const invalidateCache = (prefix?: string): void => {
  if (prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};

export { invalidateCache };

interface DataState {
  // Categories
  categories: Category[];
  categoriesLoading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (data: Partial<Category>) => Promise<boolean>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;

  // Sections
  sections: Section[];
  sectionsLoading: boolean;
  fetchSections: () => Promise<void>;
  createSection: (data: Partial<Section>) => Promise<boolean>;
  updateSection: (id: string, data: Partial<Section>) => Promise<boolean>;
  deleteSection: (id: string) => Promise<boolean>;

  // Tables
  tables: Table[];
  tablesLoading: boolean;
  fetchTables: (sectionId?: string) => Promise<void>;
  createTable: (data: Partial<Table>) => Promise<boolean>;
  updateTable: (id: string, data: Partial<Table>) => Promise<boolean>;
  deleteTable: (id: string) => Promise<boolean>;

  // Products
  products: Product[];
  productsLoading: boolean;
  fetchProducts: (categoryId?: string) => Promise<void>;
  createProduct: (data: Partial<Product>) => Promise<boolean>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;

  // Settings
  settings: Settings | null;
  settingsLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<Settings>) => Promise<boolean>;

  // Current Order (Billing)
  currentOrder: Order | null;
  currentOrderLoading: boolean;
  fetchOrderByTable: (tableId: string) => Promise<void>;
  createOrder: (tableId: string, items: any[], waiterId?: string, customerId?: string) => Promise<boolean>;
  updateOrder: (orderId: string, items: any[]) => Promise<boolean>;
  generateKOT: (orderId: string) => Promise<boolean>;
  generateBill: (orderId: string) => Promise<boolean>;
  applyDiscount: (orderId: string, amount: number, reason: string) => Promise<boolean>;
  clearCurrentOrder: () => void;
}

const store = create<DataState>((set, get) => ({
  // Categories
  categories: [],
  categoriesLoading: false,
  
  fetchCategories: async () => {
    set({ categoriesLoading: true });
    const response = await api.getCategories();
    if (response.success && Array.isArray(response.data)) {
      const transformedCategories = response.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder || c.sort_order,
        isActive: c.isActive !== undefined ? c.isActive : Boolean(c.is_active),
        productCount: c.productCount || c.product_count || 0,
      }));
      set({ categories: transformedCategories, categoriesLoading: false });
    } else {
      set({ categoriesLoading: false });
    }
  },
  
  createCategory: async (data) => {
    const response = await api.createCategory(data);
    if (response.success) {
      await get().fetchCategories();
      // Return the created category from response
      return response.data?.data || response.data || true;
    }
    return false;
  },
  
  updateCategory: async (id, data) => {
    const currentCategories = get().categories;
    set({
      categories: currentCategories.map(c => 
        c.id === id ? { ...c, ...data } : c
      )
    });
    
    const response = await api.updateCategory(id, data);
    if (response.success) {
      await get().fetchCategories();
      return true;
    }
    set({ categories: currentCategories });
    return false;
  },
  
  deleteCategory: async (id) => {
    const response = await api.deleteCategory(id);
    if (response.success) {
      set({ categories: get().categories.filter(c => c.id !== id) });
      return true;
    }
    return false;
  },

  // Sections
  sections: [],
  sectionsLoading: false,
  
  fetchSections: async () => {
    set({ sectionsLoading: true });
    const response = await api.getSections();
    if (response.success && Array.isArray(response.data)) {
      const transformedSections = response.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        isActive: s.isActive !== undefined ? s.isActive : Boolean(s.is_active),
        restaurantId: s.restaurantId || s.restaurant_id || '',
      }));
      set({ sections: transformedSections, sectionsLoading: false });
    } else {
      set({ sectionsLoading: false });
    }
  },
  
  createSection: async (data) => {
    const response = await api.createSection(data);
    if (response.success) {
      await get().fetchSections();
      return true;
    }
    return false;
  },
  
  updateSection: async (id, data) => {
    const response = await api.updateSection(id, data);
    if (response.success) {
      await get().fetchSections();
      return true;
    }
    return false;
  },
  
  deleteSection: async (id) => {
    const response = await api.deleteSection(id);
    if (response.success) {
      set({ sections: get().sections.filter(s => s.id !== id) });
      return true;
    }
    return false;
  },

  // Tables
  tables: [],
  tablesLoading: false,
  
  fetchTables: async (sectionId?: string) => {
    // Tables need real-time updates, no caching
    set({ tablesLoading: true });
    const response = await api.getTables(sectionId);
    if (response.success && Array.isArray(response.data)) {
      const transformedTables = response.data.map((t: any) => ({
        id: t.id,
        number: t.number,
        sectionId: t.sectionId,
        sectionName: t.sectionName,
        capacity: t.capacity,
        status: t.status,
      }));
      set({ tables: transformedTables, tablesLoading: false });
    } else {
      set({ tablesLoading: false });
    }
  },
  
  createTable: async (data) => {
    const apiData = {
      number: data.number,
      sectionId: data.sectionId,
      capacity: data.capacity,
    };
    const response = await api.createTable(apiData);
    if (response.success) {
      invalidateCache('tables_');
      await get().fetchTables();
      return true;
    }
    return false;
  },
  
  updateTable: async (id, data) => {
    const apiData: Record<string, any> = {
      number: data.number,
      sectionId: data.sectionId,
      capacity: data.capacity,
    };
    if (data.status) {
      apiData.status = data.status;
    }
    const response = await api.updateTable(id, apiData);
    if (response.success) {
      invalidateCache('tables_');
      await get().fetchTables();
      return true;
    }
    return false;
  },
  
  deleteTable: async (id) => {
    try {
      const response = await api.deleteTable(id);
      if (response && response.success) {
        invalidateCache('tables_');
        // Refresh tables to get updated status
        const tables = await api.getTables();
        set({ tables });
        return true;
      }
      console.error('Delete table failed:', response);
      return false;
    } catch (error) {
      console.error('Delete table error:', error);
      return false;
    }
  },

  // Products
  products: [],
  productsLoading: false,
  
  fetchProducts: async (categoryId?: string) => {
    const cacheKey = `products_${categoryId || 'all'}`;
    const cached = getCached<Product[]>(cacheKey, 60000); // 60 second cache for products
    
    if (cached) {
      set({ products: cached, productsLoading: false });
      return;
    }
    
    set({ productsLoading: true });
    const response = await api.getProducts(categoryId);
    if (response.success && Array.isArray(response.data)) {
      const transformedProducts = response.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId || p.category_id,
        categoryName: p.categoryName || p.category_name,
        description: p.description || '',
        sellingPrice: p.sellingPrice !== undefined ? p.sellingPrice : (p.selling_price || 0),
        mrp: p.mrp !== undefined ? p.mrp : (p.mrp || 0),
        taxRate: p.taxRate !== undefined ? p.taxRate : (p.tax_rate || 0),
        isActive: p.isActive !== undefined ? p.isActive : Boolean(p.is_active),
        enableOnline: p.enableOnline !== undefined ? p.enableOnline : Boolean(p.enable_online),
        sectionPrices: p.sectionPrices || p.section_prices || [],
      }));
      setCache(cacheKey, transformedProducts);
      set({ products: transformedProducts, productsLoading: false });
    } else {
      set({ productsLoading: false });
    }
  },
  
  createProduct: async (data) => {
    const apiData = {
      name: data.name,
      categoryId: data.categoryId,
      description: data.description,
      sellingPrice: data.sellingPrice,
      mrp: data.mrp,
      taxRate: data.taxRate,
      isActive: data.isActive,
      enableOnline: data.enableOnline,
      sectionPrices: data.sectionPrices || [],
    };
    const response = await api.createProduct(apiData);
    if (response.success) {
      invalidateCache('products_');
      await get().fetchProducts();
      return true;
    }
    return false;
  },
  
  updateProduct: async (id, data) => {
    const apiData: any = {};
    if (data.name !== undefined) apiData.name = data.name;
    if (data.categoryId !== undefined) apiData.categoryId = data.categoryId;
    if (data.description !== undefined) apiData.description = data.description;
    if (data.sellingPrice !== undefined) apiData.sellingPrice = data.sellingPrice;
    if (data.mrp !== undefined) apiData.mrp = data.mrp;
    if (data.taxRate !== undefined) apiData.taxRate = data.taxRate;
    if (data.isActive !== undefined) apiData.isActive = data.isActive;
    if (data.enableOnline !== undefined) apiData.enableOnline = data.enableOnline;
    if (data.sectionPrices !== undefined) apiData.sectionPrices = data.sectionPrices;
    const response = await api.updateProduct(id, apiData);
    if (response.success) {
      invalidateCache('products_');
      await get().fetchProducts();
      return true;
    }
    return false;
  },
  
  deleteProduct: async (id) => {
    const response = await api.deleteProduct(id);
    if (response.success) {
      invalidateCache('products_');
      set({ products: get().products.filter(p => p.id !== id) });
      return true;
    }
    return false;
  },

  // Settings
  settings: null,
  settingsLoading: false,
  
  fetchSettings: async () => {
    set({ settingsLoading: true });
    const response = await api.getSettings();
    if (response.success && response.data) {
      set({ settings: response.data, settingsLoading: false });
    } else {
      set({ settingsLoading: false });
    }
  },
  
  updateSettings: async (data) => {
    const response = await api.updateSettings(data);
    if (response.success) {
      await get().fetchSettings();
      return true;
    }
    return false;
  },

  // Current Order
  currentOrder: null,
  currentOrderLoading: false,
  
  fetchOrderByTable: async (tableId: string) => {
    set({ currentOrderLoading: true });
    const response = await api.getOrderByTable(tableId);
    if (response.success && response.data) {
      set({ currentOrder: response.data, currentOrderLoading: false });
    } else {
      set({ currentOrder: null, currentOrderLoading: false });
    }
  },
  
  createOrder: async (tableId: string, items: any[], waiterId?: string, customerId?: string) => {
    const response = await api.createOrder({ tableId, items, waiterId, customerId });
    if (response.success && response.data) {
      set({ currentOrder: response.data });
      return true;
    }
    return false;
  },
  
  updateOrder: async (orderId: string, items: any[]) => {
    const response = await api.updateOrder(orderId, { items });
    if (response.success && response.data) {
      set({ currentOrder: response.data });
      return true;
    }
    return false;
  },
  
  generateKOT: async (orderId: string) => {
    const response = await api.generateKOT(orderId);
    if (response.success && response.data) {
      set({ currentOrder: response.data });
      return true;
    }
    return false;
  },
  
  generateBill: async (orderId: string) => {
    const response = await api.generateBill(orderId);
    if (response.success && response.data) {
      set({ currentOrder: null });
      await get().fetchTables();
      return true;
    }
    return false;
  },
  
  applyDiscount: async (orderId: string, amount: number, reason: string) => {
    const response = await api.applyDiscount(orderId, amount, reason);
    if (response.success && response.data) {
      set({ currentOrder: response.data });
      return true;
    }
    return false;
  },
  
  clearCurrentOrder: () => set({ currentOrder: null }),
}));

// Export the store directly without wrapping in a hook
// Using default export to avoid potential issues
export const dataStore = store;

// Re-export the hook for convenience
export const useDataStore = store;
