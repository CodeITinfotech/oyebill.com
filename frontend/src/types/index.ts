export type UserRole = 'admin' | 'waiter' | 'accountant';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'active' | 'active_kot' | 'billing' | 'pending_billing' | 'pending_cleaning' | 'pending_printing';
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

export interface BillSetup {
  showRestaurantName?: boolean;
  showAddress?: boolean;
  showPhone?: boolean;
  showGstFssai?: boolean;
  showProductName?: boolean;
  showQty?: boolean;
  showRate?: boolean;
  showGst?: boolean;
  showSubTotal?: boolean;
  showDiscount?: boolean;
  showGstVat?: boolean;
  showGrandTotal?: boolean;
  specialMessage?: string;
  greetingMessage?: string;
  showPreview?: boolean;
  [key: string]: any;
}

export interface PaymentSettings {
  upiId: string;
  merchantName: string;
  showQrOnBill: boolean;
  showQrOnKot: boolean;
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  maxDiscount: number;
  isActive: boolean;
  expiryDate?: string;
  stock?: number;
  description?: string;
  discountValue?: number;
}

export interface KotSetup {
  showOrderNumber?: boolean;
  showKotNumber?: boolean;
  showDateTime?: boolean;
  showTableNumber?: boolean;
  showCustomerName?: boolean;
  showSectionName?: boolean;
  showProductName?: boolean;
  autoPrint?: boolean;
  soundEnabled?: boolean;
  showPreview?: boolean;
  showWaiterName?: boolean;
  [key: string]: any;
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
  restaurant?: Restaurant;
  bill_setup?: BillSetup;
  payment?: PaymentSettings;
  kot_setup?: KotSetup;
  coupons?: Coupon[];
  tableStatusColors?: {
    [statusKey: string]: { bg: string; border: string; label: string };
  };
  // Additional properties from backend
  taxName?: string;
  tax_name?: string;
  cgst_rate?: number;
  sgst_rate?: number;
  default_tax_rate?: number;
  price_inclusive_tax?: boolean;
  isActive?: boolean;
  is_active?: boolean;
  kotPrinters?: string[];
  kot_printers?: string[];
  defaultKotPrinter?: string;
  default_kot_printer?: string;
  bill_printer?: string;
  print_copies?: number;
  skipLinesBeforeCut?: number;
  skip_lines_before_cut?: number;
  userRights?: any;
  onlineOrders?: any;
  printers?: any[];
  config?: any;
  clearedTables?: any;
  tableNumber?: any;
  deleted?: number;
  output?: any;
  [key: string]: any; // Allow any additional properties
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

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  token?: string;
  user?: User;
  restaurant?: Restaurant;
  tables?: any[];
  columns?: any[];
}

// Icon picker emojis for products
export const PRODUCT_ICONS = ['🍽️', '🍕', '🍔', '🍟', '🌮', '🌯', '🥗', '🍜', '🍝', '🍣', '🍱', '🍰', '☕', '🍺', '🍷', '🥤', '🧃', '🍎', '🥩', '🍳', '🥐', '🍩', '🍪', '🧁', '🍌', '🥑', '🌶️', '🧅', '🍄', '🥜', '🫘', '🥔', '🍠', '🥚', '🧀', '🥛', '🧈', '🍯', '🧂', '🥣', '🥄', '🍴', '🥢', '🫕', '🥘', '🍲', '🥧', '🍦', '🍨', '🥡', '🥠', '🥮'];