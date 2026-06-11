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
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Not JSON response - likely HTML error page
        const text = await response.text();
        debug('Non-JSON response:', text.substring(0, 200));
        if (!response.ok) {
          return {
            success: false,
            error: `Server error: ${response.status}`,
          };
        }
      }
      
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

  async syncTableStatuses() {
    return this.request('/tables/sync-status', { method: 'POST' });
  }

  async migrateTableStatuses() {
    return this.request('/tables/migrate-status', { method: 'POST' });
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

  async deleteOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}`, { method: 'DELETE' });
  }

  async deleteOrderItem(orderId: string, itemId: string) {
    return this.request<any>(`/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
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

  // Customer endpoints
  async getCustomers() {
    return this.request<any[]>('/customers');
  }

  async createCustomer(data: any) {
    return this.request<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: any) {
    return this.request<any>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string) {
    return this.request(`/customers/${id}`, { method: 'DELETE' });
  }

  // Online Orders endpoints
  async getOnlineOrders(params?: { status?: string; platform?: string; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.platform) queryParams.append('platform', params.platform);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<any[]>(`/online-orders${query}`);
  }

  async getOnlineOrder(id: string) {
    return this.request<any>(`/online-orders/${id}`);
  }

  async acceptOnlineOrder(id: string) {
    return this.request<any>(`/online-orders/${id}/accept`, { method: 'POST' });
  }

  async declineOnlineOrder(id: string, reason?: string) {
    return this.request<any>(`/online-orders/${id}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async updateOnlineOrderStatus(id: string, status: string) {
    return this.request<any>(`/online-orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async linkOnlineOrderToBilling(id: string, orderId: string) {
    return this.request<any>(`/online-orders/${id}/link-order`, {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId }),
    });
  }

  async getOnlineOrderCounts() {
    return this.request<{ new: number; accepted: number; preparing: number; ready: number; total: number }>('/online-orders/stats/counts');
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

  // Generic GET method for custom endpoints
  async get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  // Generic PUT method for custom endpoints
  async put<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic POST method for custom endpoints
  async post<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic DELETE method for custom endpoints
  async delete<T>(endpoint: string) {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Table-Waiter Allocations
  async getTableAllocations(restaurantId?: string) {
    return this.request<any[]>(`/table-allocations${restaurantId ? `?restaurantId=${restaurantId}` : ''}`);
  }

  async getWaiterTables(waiterId: string) {
    return this.request<any[]>(`/table-allocations/waiter/${waiterId}`);
  }

  async getTableWaiters(tableId: string) {
    return this.request<any[]>(`/table-allocations/table/${tableId}`);
  }

  async createAllocation(tableId: string, waiterId: string) {
    return this.request<any>('/table-allocations', {
      method: 'POST',
      body: JSON.stringify({ tableId, waiterId }),
    });
  }

  async deleteAllocation(id: string) {
    return this.request(`/table-allocations/${id}`, { method: 'DELETE' });
  }

  async bulkAllocate(allocations: { tableId: string; waiterId: string }[]) {
    return this.request('/table-allocations/bulk', {
      method: 'POST',
      body: JSON.stringify({ allocations }),
    });
  }

  // Customer Orders (NFC/QR)
  async getTableByNumber(tableNumber: string) {
    return this.request<any>(`/customer-orders/table/${tableNumber}`);
  }

  async createCustomerOrder(orderData: {
    tableId: string;
    tableNumber: string;
    items: any[];
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    restaurantId?: string;
    orderSource?: string;
  }) {
    return this.request<any>('/customer-orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getWaiterPendingOrders(waiterId: string) {
    return this.request<any[]>(`/customer-orders/waiter/${waiterId}/pending`);
  }

  async acceptCustomerOrder(orderId: string, waiterId: string) {
    return this.request(`/customer-orders/${orderId}/accept`, {
      method: 'PUT',
      body: JSON.stringify({ waiterId }),
    });
  }

  async declineCustomerOrder(orderId: string, waiterId: string, reason?: string) {
    return this.request(`/customer-orders/${orderId}/decline`, {
      method: 'PUT',
      body: JSON.stringify({ waiterId, reason }),
    });
  }

  async getCustomerOrder(orderId: string) {
    return this.request<any>(`/customer-orders/${orderId}`);
  }

  async getAllCustomerOrders(restaurantId?: string, status?: string) {
    let url = '/customer-orders';
    const params = [];
    if (restaurantId) params.push(`restaurantId=${restaurantId}`);
    if (status) params.push(`status=${status}`);
    if (params.length) url += '?' + params.join('&');
    return this.request<any[]>(url);
  }

  // Notifications
  async getWaiterNotifications(waiterId: string, unreadOnly?: boolean) {
    return this.request<any[]>(`/notifications/waiter/${waiterId}${unreadOnly ? '?unreadOnly=true' : ''}`);
  }

  async getUnreadCount(waiterId: string) {
    return this.request<{ count: number }>(`/notifications/waiter/${waiterId}/unread-count`);
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllRead(waiterId: string) {
    return this.request(`/notifications/waiter/${waiterId}/read-all`, { method: 'PUT' });
  }

  // Customer Auth (Public - no token required)
  async sendCustomerOTP(email: string, name?: string, phone?: string) {
    return this.request<{ message: string; otp: string; expires_in: number }>('/customer-auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, name, phone }),
    });
  }

  async verifyCustomerOTP(email: string, otp: string) {
    return this.request<{ message: string; customer: any }>('/customer-auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async getCustomerProfile(email: string) {
    return this.request<any>(`/customer-auth/profile/${email}`);
  }

  async updateCustomerProfile(id: string, data: any) {
    return this.request<any>(`/customer-auth/profile/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Customer Catalog (Public)
  async getOnlineOrderingSettings(restaurantId: string) {
    return this.request<any>(`/catalog/settings/${restaurantId}`);
  }

  async getRestaurantInfo(restaurantId: string) {
    return this.request<any>(`/catalog/restaurant/${restaurantId}`);
  }

  async getMenuCatalog(restaurantId: string) {
    return this.request<any>(`/catalog/menu/${restaurantId}`);
  }

  async checkDeliveryRange(restaurantId: string, distanceKm: number) {
    return this.request<any>('/catalog/check-delivery-range', {
      method: 'POST',
      body: JSON.stringify({ restaurantId, distanceKm }),
    });
  }

  async calculateDelivery(restaurantId: string, distanceKm: number, orderType: string) {
    return this.request<any>('/catalog/calculate-delivery', {
      method: 'POST',
      body: JSON.stringify({ restaurantId, distanceKm, orderType }),
    });
  }

  // Customer Online Orders (Public)
  async placeCustomerOrder(orderData: {
    restaurant_id: string;
    customer_account_id?: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    delivery_address?: string;
    order_type: 'pickup' | 'delivery';
    delivery_distance_km?: number;
    items: { product_id: string; quantity: number; notes?: string }[];
    payment_method?: string;
    special_instructions?: string;
  }) {
    return this.request<any>('/customer-orders-public', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async trackOrder(orderNumber: string) {
    return this.request<any>(`/customer-orders-public/track/${orderNumber}`);
  }

  async getCustomerOrders(email: string, limit?: number, offset?: number) {
    return this.request<any[]>(`/customer-orders-public/by-email/${email}${limit ? `?limit=${limit}&offset=${offset || 0}` : ''}`);
  }

  async cancelCustomerOrder(orderId: string, reason?: string) {
    return this.request<any>(`/customer-orders-public/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async updatePaymentStatus(orderId: string, payment_status: string, payment_method?: string) {
    return this.request<any>(`/customer-orders-public/${orderId}/payment`, {
      method: 'POST',
      body: JSON.stringify({ payment_status, payment_method }),
    });
  }

  // Admin Online Ordering Settings
  async getOnlineOrderingSettingsAdmin() {
    return this.request<any>('/online-ordering-settings');
  }

  async updateOnlineOrderingSettings(data: any) {
    return this.request<any>('/online-ordering-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getCustomerOnlineOrders(status?: string, limit?: number, offset?: number) {
    let url = '/online-ordering-settings/orders';
    const params = [];
    if (status) params.push(`status=${status}`);
    if (limit) params.push(`limit=${limit}`);
    if (offset) params.push(`offset=${offset}`);
    if (params.length) url += '?' + params.join('&');
    return this.request<any[]>(url);
  }

  async getCustomerOnlineOrder(id: string) {
    return this.request<any>(`/online-ordering-settings/orders/${id}`);
  }

  async updateCustomerOnlineOrderStatus(id: string, status: string) {
    return this.request<any>(`/online-ordering-settings/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async linkCustomerOrderToBilling(id: string, billingOrderId: string) {
    return this.request<any>(`/online-ordering-settings/orders/${id}/link-to-billing`, {
      method: 'POST',
      body: JSON.stringify({ billing_order_id: billingOrderId }),
    });
  }

  async getOnlineOrderingStats() {
    return this.request<any>('/online-ordering-settings/stats');
  }

  // Payment Settings
  async getPaymentSettings() {
    return this.request<any>('/online-ordering-settings/payment-settings');
  }

  async updatePaymentSettings(data: any) {
    return this.request<any>('/online-ordering-settings/payment-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Printer Management
  async scanPrinters() {
    return this.request<any>('/printers/scan');
  }

  async testPrinter(printerName: string, printerType?: string, testText?: string) {
    return this.request<any>('/printers/test', {
      method: 'POST',
      body: JSON.stringify({ printerName, printerType, testText }),
    });
  }

  async getPrinterConfig() {
    return this.request<any>('/printers/config');
  }

  async savePrinters(printers: any[]) {
    return this.request<any>('/printers/save-printers', {
      method: 'POST',
      body: JSON.stringify({ printers }),
    });
  }

  async addPrinter(printer: any) {
    return this.request<any>('/printers/add-printer', {
      method: 'POST',
      body: JSON.stringify(printer),
    });
  }

  async removePrinter(address: string) {
    return this.request<any>('/printers/remove-printer', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  async clearTables() {
    return this.request<any>('/tables/clear-all', { method: 'POST' });
  }

  async clearTable(tableId: string) {
    return this.request<any>(`/tables/clear/${tableId}`, { method: 'POST' });
  }

  async deleteAllBookings() {
    return this.request<any>('/orders/bookings/all', { method: 'DELETE' });
  }

  async deleteBookingByBill(billNumber: string) {
    return this.request<any>(`/orders/bookings/bill/${billNumber}`, { method: 'DELETE' });
  }

  async deleteBookingsByDate(date: string) {
    return this.request<any>(`/orders/bookings/date/${date}`, { method: 'DELETE' });
  }

  async deleteAllKots() {
    return this.request<any>('/orders/kot/all', { method: 'DELETE' });
  }

  async deleteKotsByDate(date: string) {
    return this.request<any>(`/orders/kot/date/${date}`, { method: 'DELETE' });
  }

  async printKot(content: string, copies?: number, printer?: string) {
    return this.request<any>('/printers/print-kot', {
      method: 'POST',
      body: JSON.stringify({ content, copies, printer }),
    });
  }

  async printBill(content: string, copies?: number) {
    return this.request<any>('/printers/print-bill', {
      method: 'POST',
      body: JSON.stringify({ content, copies }),
    });
  }
}

export const api = new ApiClient();