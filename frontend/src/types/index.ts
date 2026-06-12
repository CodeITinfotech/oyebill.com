export type UserRole = 'admin' | 'waiter' | 'accountant';
export type TableStatus = 'available' | 'occupied' | 'reserved';
export type OrderStatus = 'pending' | 'kot' | 'billed';

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  fssaiNumber: string;
  logo: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  restaurantId: string;
  mustResetPassword: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  restaurantId: string;
  productCount?: number;
  icon?: string; // Category icon (emoji or icon identifier)
}

export interface Section {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  restaurantId: string;
  tableCount?: number;
}

export interface Table {
  id: string;
  number: string;
  sectionId: string;
  sectionName?: string;
  capacity: number;
  status: TableStatus;
  restaurantId: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  description: string;
  sellingPrice: number;
  mrp: number;
  taxRate: number;
  isActive: boolean;
  enableOnline: boolean;
  restaurantId: string;
  icon?: string; // Product icon (emoji)
  // Section-wise pricing
  sectionPrices?: { sectionId: string; sectionName?: string; price: number }[];
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  isKot: boolean;
}

export interface Order {
  id: string;
  tableId: string;
  tableNumber?: string;
  userId: string;
  userName?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountReason: string;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  restaurantId: string;
  cgstRate: number;
  sgstRate: number;
  defaultTaxRate: number;
  priceInclusiveTax: boolean;
  kotPrinter: string;
  billPrinter: string;
  printCopies: number;
  tableStatusColors?: {
    [statusKey: string]: { bg: string; border: string; label: string };
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  restaurant: Restaurant;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Icon picker emojis for products
export const PRODUCT_ICONS = ['🍽️', '🍕', '🍔', '🍟', '🌮', '🌯', '🥗', '🍜', '🍝', '🍣', '🍱', '🍰', '☕', '🍺', '🍷', '🥤', '🧃', '🍎', '🥩', '🍳', '🥐', '🍩', '🍪', '🧁', '🍌', '🥑', '🌶️', '🧅', '🍄', '🥜', '🫘', '🥔', '🍠', '🥚', '🧀', '🥛', '🧈', '🍯', '🧂', '🥣', '🥄', '🍴', '🥢', '🫕', '🥘', '🍲', '🥧', '🍦', '🍨', '🥡', '🥠', '🥮'];