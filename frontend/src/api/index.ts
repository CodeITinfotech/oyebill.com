import type { ApiResponse } from '../types';

const API_BASE = '/api';

// Add console logging for debugging
const debug = (...args: any[]) => {
  console.log('[API]', ...args);
};

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    debug('setToken', token ? '(token set)' : '(token cleared)');
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    debug(`Request: ${options.method || 'GET'} ${endpoint}`);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      debug(`Response: ${response.status} ${endpoint}`);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'An error occurred',
        };
      }

      return {
        success: true,
        data,
        message: data.message,
      };
    } catch (error) {
      debug('Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ user: any; token: string; restaurant: any }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request<{ user: any; restaurant: any }>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async resetPassword(newPassword: string) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  // Restaurant endpoints
  async getRestaurants() {
    return this.request<any[]>('/restaurants');
  }

  async createRestaurant(data: any) {
    return this.request<any>('/restaurants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRestaurant(id: string, data: any) {
    return this.request<any>(`/restaurants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRestaurant(id: string) {
    return this.request(`/restaurants/${id}`, { method: 'DELETE' });
  }

  async setActiveRestaurant(id: string) {
    return this.request(`/restaurants/${id}/active`, { method: 'POST' });
  }

  // Category endpoints
  async getCategories() {
    return this.request<any[]>('/categories');
  }

  async createCategory(data: any) {
    return this.request<any>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: any) {
    return this.request<any>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string) {
    return this.request(`/categories/${id}`, { method: 'DELETE' });
  }

  // Section endpoints
  async getSections() {
    return this.request<any[]>('/sections');
  }

  async createSection(data: any) {
    return this.request<any>('/sections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSection(id: string, data: any) {
    return this.request<any>(`/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSection(id: string) {
    return this.request(`/sections/${id}`, { method: 'DELETE' });
  }

  // Table endpoints
  async getTables(sectionId?: string) {
    const url = sectionId ? `/tables?sectionId=${sectionId}` : '/tables';
    return this.request<any[]>(url);
  }

  async createTable(data: any) {
    return this.request<any>('/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTable(id: string, data: any) {
    return this.request<any>(`/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTable(id: string) {
    return this.request(`/tables/${id}`, { method: 'DELETE' });
  }

  // Product endpoints
  async getProducts(categoryId?: string) {
    const url = categoryId ? `/products?categoryId=${categoryId}` : '/products';
    return this.request<any[]>(url);
  }

  async createProduct(data: any) {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, { method: 'DELETE' });
  }

  // Order/Billing endpoints
  async getOrderByTable(tableId: string) {
    return this.request<any>(`/orders/table/${tableId}`);
  }

  async createOrder(data: any) {
    return this.request<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: any) {
    return this.request<any>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async generateKOT(orderId: string) {
    return this.request<any>(`/orders/${orderId}/kot`, { method: 'POST' });
  }

  async generateBill(orderId: string) {
    return this.request<any>(`/orders/${orderId}/bill`, { method: 'POST' });
  }

  async applyDiscount(orderId: string, amount: number, reason: string) {
    return this.request<any>(`/orders/${orderId}/discount`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  }

  async getOrderHistory() {
    return this.request<any[]>('/orders');
  }

  // Settings endpoints
  async getSettings() {
    return this.request<any>('/settings');
  }

  async updateSettings(data: any) {
    // Convert camelCase to snake_case
    const apiData: any = {};
    for (const key in data) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      apiData[snakeKey] = data[key];
    }
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(apiData),
    });
  }

  // User endpoints
  async getUsers() {
    return this.request<any[]>('/users');
  }

  async createUser(data: any) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // Setup endpoints
  async checkSetup() {
    return this.request<{ needsSetup: boolean; restaurant?: any }>('/setup/status');
  }

  async setupInitial(data: { restaurant: any; admin: any }) {
    return this.request('/setup/initial', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();