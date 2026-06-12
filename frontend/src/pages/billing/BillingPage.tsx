import { useState, useEffect, useMemo, useRef } from 'react';
import { useDataStore, invalidateCache } from '../../stores/dataStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api';
import { PageHeader } from '../../components/layout';
import { Button, Select, Card, CardBody, Modal, Input, toast } from '../../components/ui';
import { Plus, Minus, Trash2, Printer, Receipt, Percent, Users, X, Check, Edit3, MoreHorizontal, Ticket, Tag, Key, Bell, CheckCircle, XCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import { initQZTray, formatBillForPrinter, formatKOTForPrinter, printText } from '../../utils/printService';
import type { Product, Table, OrderItem } from '../../types';

// Category Icons - Maps category names to icons
const CATEGORY_ICONS: Record<string, string> = {
  'beverages': '🥤',
  'starters': '🍢',
  'main course': '🍛',
  'desserts': '🍰',
  'specials': '⭐',
  'default': '🍽️',
};

const getCategoryIcon = (categoryName: string): string => {
  const name = categoryName.toLowerCase().trim();
  return CATEGORY_ICONS[name] || CATEGORY_ICONS[name.split(' ')[0]] || CATEGORY_ICONS['default'];
};

interface CartItem extends OrderItem {
  isNew?: boolean;
  isOnlineOrder?: boolean;
  alreadyKot?: boolean; // Items that were already KOT'd in previous rounds
}

export function BillingPage() {
  
  
  // State
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // NOTE: Cart state is now managed via server API only - no per-table localStorage
  // When switching tables, cart is fetched from server based on existing orders
  
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showSwitchTableModal, setShowSwitchTableModal] = useState(false);
  const [selectedSwitchTable, setSelectedSwitchTable] = useState<Table | null>(null);
  const [switchTableSectionFilter, setSwitchTableSectionFilter] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountReason, setDiscountReason] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const [editingKotId, setEditingKotId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWaiter, setSelectedWaiter] = useState<string>('');
  const [waiters, setWaiters] = useState<{id: string; name: string; role: string; pin?: string}[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [waiterPinInput, setWaiterPinInput] = useState('');
  const [waiterSearch, setWaiterSearch] = useState('');
  const [showWaiterDropdown, setShowWaiterDropdown] = useState(false);
  
  // Mobile state
  const [mobileView, setMobileView] = useState<'menu' | 'cart'>('menu');
  const [showMobileCart, setShowMobileCart] = useState(false);
  
  // Mobile: Show all tables modal
  const [showAllTablesModal, setShowAllTablesModal] = useState(false);
  const [allTablesSectionFilter, setAllTablesSectionFilter] = useState<string | null>(null);
  
  // Quick add customer modal
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  
  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Filter customers by search (name or phone)
  const filteredCustomers = customers.filter(c => {
    const search = customerSearch.toLowerCase();
    return (
      !search || 
      (c.name && c.name.toLowerCase().includes(search)) ||
      (c.phone && c.phone.includes(search))
    );
  });
  
  // Customer Orders (NFC/QR) notifications
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOrdersPanel, setShowOrdersPanel] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineOrderId, setDeclineOrderId] = useState<string | null>(null);
  
  // Ref for quantity input focus
  const quantityInputRef = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState<{type: 'kot' | 'bill', content: any} | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'pdf' | 'html'>('txt');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Pending cleaning modal state
  const [showPendingCleaningModal, setShowPendingCleaningModal] = useState(false);
  const [pendingCleaningTable, setPendingCleaningTable] = useState<Table | null>(null);
  const [selectedBusser, setSelectedBusser] = useState<string>(''); // Empty = all bussers

  // Bill generated state for COLLECT/PUSH buttons
  const [billGenerated, setBillGenerated] = useState(false);
  const [billOrderId, setBillOrderId] = useState<string | null>(null);
  const [lastBillAmount, setLastBillAmount] = useState<number>(0);

  // Collect payment modal state
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'gpay' | 'card'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [gpayAmount, setGpayAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [customerGpayNumber, setCustomerGpayNumber] = useState('');

  // PUSH payment modal state
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushMethod, setPushMethod] = useState<'gpay' | 'pos'>('gpay');
  const [pushGpayNumber, setPushGpayNumber] = useState('');

  // Online order state
  const [onlineOrder, setOnlineOrder] = useState<{
    onlineOrderId: string;
    externalOrderId: string;
    platform: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    items: any[];
    totalAmount: number;
  } | null>(null);

  // Stores
  const { user } = useAuthStore();
  const store = useDataStore();
  const { sections, tables, categories, products, settings } = store;

  // Fetch all data on mount - only once on mount
  useEffect(() => {
    store.fetchSections();
    store.fetchCategories();
    store.fetchProducts();
    store.fetchSettings();
    // Fetch waiters
    api.getUsers().then((response) => {
      if (response.success && Array.isArray(response.data)) {
        setWaiters(response.data.filter((u: any) => u.role === 'waiter' || u.role === 'busser'));
      }
    });
    // Fetch customers
    api.getCustomers().then((response) => {
      if (response.success && response.data?.data && Array.isArray(response.data.data)) {
        setCustomers(response.data.data);
      } else if (response.success && Array.isArray(response.data)) {
        setCustomers(response.data);
      }
    });

    // Check for online order data in sessionStorage
    const onlineOrderData = sessionStorage.getItem('onlineOrderData');
    if (onlineOrderData) {
      try {
        const parsedData = JSON.parse(onlineOrderData);
        setOnlineOrder(parsedData);
        
        // Add online order items to cart
        if (parsedData.items && parsedData.items.length > 0) {
          const cartItems: CartItem[] = parsedData.items.map((item: any) => ({
            id: uuidv4(),
            productId: item.productId || item.id,
            productName: item.name || item.productName,
            quantity: item.quantity || 1,
            unitPrice: item.price || item.unitPrice || 0,
            taxRate: item.taxRate || 0,
            taxAmount: (item.price || 0) * ((item.taxRate || 0) / 100),
            total: (item.price || 0) * (item.quantity || 1),
            isKot: false,
            isNew: true,
            isOnlineOrder: true,
          }));
          setCart(cartItems);
        }
        
        // Clear sessionStorage
        sessionStorage.removeItem('onlineOrderData');
      } catch (e) {
        console.error('Error parsing online order data:', e);
      }
    }
  }, []);

  // Fetch tables when section changes
  useEffect(() => {
    store.fetchTables(selectedSection || undefined);
  }, [selectedSection]);

  // Fetch customer orders and notifications for waiters/admins
  useEffect(() => {
    const fetchOrdersAndNotifications = async () => {
      if (!user) return;
      
      // For waiters and admins, fetch pending orders
      if (user.role === 'waiter' || user.role === 'admin') {
        try {
          // Fetch pending orders for this waiter
          const ordersRes = await api.getWaiterPendingOrders(user.id);
          if (ordersRes.success && Array.isArray(ordersRes.data)) {
            setPendingOrders(ordersRes.data);
          }
          
          // Fetch notifications
          const notifRes = await api.getWaiterNotifications(user.id, false);
          if (notifRes.success && Array.isArray(notifRes.data)) {
            setNotifications(notifRes.data);
          }
          
          // Get unread count
          const countRes = await api.getUnreadCount(user.id);
          if (countRes.success && countRes.data) {
            setUnreadCount(countRes.data.count);
          }
        } catch (error) {
          console.error('Error fetching orders/notifications:', error);
        }
      }
    };
    
    fetchOrdersAndNotifications();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchOrdersAndNotifications, 10000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role]);

  // NOTE: Cart state is now managed via server API only - no localStorage
  // Cart data is fetched from server when table is selected

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMoreDropdown && !(e.target as Element).closest('.more-dropdown')) {
        setShowMoreDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMoreDropdown]);

  // Calculate totals
  const { subtotal, taxAmount, discountValue, couponDiscountValue, loyaltyDiscountValue, total } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const tax = cart.reduce((sum, item) => sum + item.taxAmount * item.quantity, 0);
    const discount = cart.length > 0 && discountAmount 
      ? discountType === 'percentage' 
        ? (sub + tax) * (parseFloat(discountAmount) / 100)
        : parseFloat(discountAmount)
      : 0;
    
    // Calculate coupon discount inline to avoid circular dependency
    let couponDisc = 0;
    if (appliedCoupon) {
      let discount = 0;
      if (appliedCoupon.applicableTo === 'all') {
        discount = sub * (appliedCoupon.discountValue / 100);
      } else if (appliedCoupon.applicableTo === 'category' && appliedCoupon.categoryId) {
        const applicableItems = cart.filter(item => {
          const product = products.find(p => p.id === item.productId);
          return product?.categoryId === appliedCoupon.categoryId;
        });
        const applicableSubtotal = applicableItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        discount = applicableSubtotal * (appliedCoupon.discountValue / 100);
      } else if (appliedCoupon.applicableTo === 'product' && appliedCoupon.productId) {
        const applicableItems = cart.filter(item => item.productId === appliedCoupon.productId);
        const applicableSubtotal = applicableItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        discount = applicableSubtotal * (appliedCoupon.discountValue / 100);
      }
      if (appliedCoupon.maxDiscount && discount > appliedCoupon.maxDiscount) {
        discount = appliedCoupon.maxDiscount;
      }
      couponDisc = discount;
    }
    
    // Calculate loyalty discount
    const loyaltyDisc = selectedCustomer?.loyalty_discount 
      ? (sub + tax) * (selectedCustomer.loyalty_discount / 100) 
      : 0;
    
    const totalAmount = sub + tax - discount - couponDisc - loyaltyDisc;
    return { subtotal: sub, taxAmount: tax, discountValue: discount, couponDiscountValue: couponDisc, loyaltyDiscountValue: loyaltyDisc, total: Math.max(0, totalAmount) };
  }, [cart, discountAmount, discountType, appliedCoupon, products, selectedCustomer]);

  // Add product to cart
  const addToCart = async (product: Product) => {
    // Get the appropriate price - use section-specific price if available
    let unitPrice = product.sellingPrice;
    if (selectedSection && product.sectionPrices && product.sectionPrices.length > 0) {
      const sectionPrice = product.sectionPrices.find(sp => sp.sectionId === selectedSection);
      if (sectionPrice && parseFloat(sectionPrice.price) > 0) {
        unitPrice = parseFloat(sectionPrice.price);
      }
    }

    const existingIndex = cart.findIndex(item => item.productId === product.id && !item.isKot);
    let newCart = [...cart];
    
    if (existingIndex >= 0) {
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].taxAmount = unitPrice * (product.taxRate / 100);
      newCart[existingIndex].total = newCart[existingIndex].quantity * (unitPrice + newCart[existingIndex].taxAmount);
      newCart[existingIndex].unitPrice = unitPrice;
      setLastAddedItemId(newCart[existingIndex].id);
    } else {
      const taxPerUnit = unitPrice * (product.taxRate / 100);
      const newItem: CartItem = {
        id: uuidv4(),
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: unitPrice,
        taxRate: product.taxRate,
        taxAmount: taxPerUnit,
        total: unitPrice + taxPerUnit,
        isKot: false,
        isNew: true,
      };
      newCart.push(newItem);
      setLastAddedItemId(newItem.id);
    }
    
    setCart(newCart);
    
    // Update table status when items are added
    // - If table is available, change to active_kot
    // - If table has pending_billing and new items are added (not KOT'd), change to active_kot
    if (selectedTable) {
      const hasNewItems = newCart.some(item => !item.isKot);
      const shouldUpdateStatus = 
        (selectedTable.status === 'available') || 
        (selectedTable.status === 'pending_billing' && hasNewItems);
      
      if (shouldUpdateStatus) {
        try {
          await api.put(`/tables/${selectedTable.id}`, { status: 'active_kot' });
          setSelectedTable({ ...selectedTable, status: 'active_kot' });
          // Refresh tables to update UI
          store.fetchTables(selectedSection || undefined);
        } catch (error) {
          console.error('Failed to update table status:', error);
        }
      }
    }
  };

  // Focus on quantity input when item is added
  useEffect(() => {
    if (lastAddedItemId && quantityInputRef.current[lastAddedItemId]) {
      quantityInputRef.current[lastAddedItemId]?.focus();
      quantityInputRef.current[lastAddedItemId]?.select();
      setLastAddedItemId(null);
    }
  }, [lastAddedItemId]);

  // Real-time refresh tables every 5 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (selectedSection) {
        store.fetchTables(selectedSection);
      }
    }, 2000); // Refresh every 2 seconds for real-time

    return () => clearInterval(refreshInterval);
  }, [selectedSection]);

  // Sync table statuses on initial load to fix any stale data
  useEffect(() => {
    const syncOnLoad = async () => {
      try {
        // First migrate any old status values to new ones
        await api.migrateTableStatuses();
        // Then refresh tables
        if (selectedSection) {
          await store.fetchTables(selectedSection);
        }
      } catch (error) {
        console.error('Failed to sync table statuses on load:', error);
      }
    };
    
    syncOnLoad();
  }, []);

  // Sync table status with cart - ensure active_kot tables show orange when they have items
  useEffect(() => {
    const syncTableStatusWithCart = async () => {
      if (!selectedTable || !selectedSection) return;
      
      // If table is available but has cart items, update status to active_kot
      if (selectedTable.status === 'available' && cart.length > 0) {
        try {
          const result = await api.put(`/tables/${selectedTable.id}`, { status: 'active_kot' });
          if (result.success) {
            setSelectedTable({ ...selectedTable, status: 'active_kot' });
            store.fetchTables(selectedSection || undefined);
          }
        } catch (error) {
          console.error('Failed to sync table status:', error);
        }
      }
    };
    
    syncTableStatusWithCart();
  }, [cart.length, selectedTable?.id]);

  // Update table status when cart becomes empty (set to available if no active order/KOT)
  useEffect(() => {
    const updateTableStatusOnEmptyCart = async () => {
      if (!selectedTable) return;
      
      // If cart is empty and table is active_kot, check if there's an active order with KOT
      if (cart.length === 0 && (selectedTable.status === 'active_kot' || selectedTable.status === 'pending_billing')) {
        try {
          const response = await api.getOrderByTable(selectedTable.id);
          // If no active order (404 or success with no data), mark table as available
          if (response.success && !response.data) {
            const result = await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
            if (result.success) {
              setSelectedTable({ ...selectedTable, status: 'available' });
              store.fetchTables(selectedSection || undefined);
            }
          }
          // If there IS an active order with KOT items, keep pending_billing status
          else if (response.success && response.data) {
            const order = response.data;
            const hasKotItems = order.items && order.items.some((item: any) => item.isKot);
            // If has KOT items, status should be pending_billing
            if (hasKotItems && selectedTable.status !== 'pending_billing') {
              const result = await api.put(`/tables/${selectedTable.id}`, { status: 'pending_billing' });
              if (result.success) {
                setSelectedTable({ ...selectedTable, status: 'pending_billing' });
                store.fetchTables(selectedSection || undefined);
              }
            }
          }
          // If request failed (e.g., no active order), mark available
          else if (!response.success && response.error?.includes('No active order')) {
            const result = await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
            if (result.success) {
              setSelectedTable({ ...selectedTable, status: 'available' });
              store.fetchTables(selectedSection || undefined);
            }
          }
        } catch (error) {
          console.error('Failed to check order status:', error);
        }
      }
    };
    
    updateTableStatusOnEmptyCart();
  }, [cart.length]);

  // Sync table status with backend when selecting table
  useEffect(() => {
    const syncTableStatusWithBackend = async () => {
      if (!selectedTable) return;
      
      try {
        const response = await api.getOrderByTable(selectedTable.id);
        
        // If no active order, don't change status
        if (!response.success || !response.data) {
          return;
        }
        
        const order = response.data;
        const hasKotItems = order.items && order.items.some((item: any) => item.isKot);
        const hasItems = order.items && order.items.length > 0;
        
        // If table is pending_cleaning or available, don't change it via this sync
        if (selectedTable.status === 'pending_cleaning' || selectedTable.status === 'available') {
          return;
        }
        
        // If order has KOT items, table should be 'pending_billing'
        if (hasKotItems && selectedTable.status !== 'pending_billing') {
          const result = await api.put(`/tables/${selectedTable.id}`, { status: 'pending_billing' });
          if (result.success) {
            setSelectedTable({ ...selectedTable, status: 'pending_billing' });
          }
        }
        // If order exists but no KOT items yet, table should be 'active_kot'
        else if (hasItems && !hasKotItems && selectedTable.status === 'active_kot') {
          const result = await api.put(`/tables/${selectedTable.id}`, { status: 'active_kot' });
          if (result.success) {
            setSelectedTable({ ...selectedTable, status: 'active_kot' });
          }
        }
      } catch (error) {
        console.error('Failed to sync table status:', error);
      }
    };
    
    syncTableStatusWithBackend();
  }, [selectedTable?.id]);
  
  // Force sync table status when table is selected and has order items
  useEffect(() => {
    const forceSyncTableStatus = async () => {
      if (!selectedTable) return;
      
      // If table is available but we have items in cart, force update status
      if (selectedTable.status === 'available' && cart.length > 0) {
        try {
          const result = await api.put(`/tables/${selectedTable.id}`, { status: 'active_kot' });
          if (result.success) {
            setSelectedTable({ ...selectedTable, status: 'active_kot' });
            store.fetchTables(selectedSection || undefined);
          }
        } catch (error) {
          console.error('Force sync failed:', error);
        }
      }
    };
    
    forceSyncTableStatus();
  }, [selectedTable?.id, cart.length > 0]);

  // Update item quantity
  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty === 0) return null;
        // For KOT items, mark as new when quantity increased (for additional KOT)
        const isQuantityIncrease = delta > 0 && item.isKot;
        return {
          ...item,
          quantity: newQty,
          total: newQty * (item.unitPrice + item.taxAmount),
          isNew: isQuantityIncrease ? true : item.isNew,
        };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  // Remove item from cart
  const removeFromCart = async (itemId: string) => {
    const itemToRemove = cart.find(item => item.id === itemId);
    const newCart = cart.filter(item => item.id !== itemId);
    
    // If this is a new item (not from backend), just remove from cart
    if (itemToRemove?.isNew && !currentOrderId) {
      setCart(newCart);
      return;
    }
    
    // If item is from backend order, delete from backend
    if (currentOrderId && itemToRemove && !itemToRemove.isNew) {
      try {
        await api.deleteOrderItem(currentOrderId, itemId);
      } catch (error) {
        console.error('Failed to delete order item:', error);
      }
    }
    
    // Update local cart
    setCart(newCart);
    
    // If cart becomes empty, delete the entire order and mark table as available
    if (newCart.length === 0 && currentOrderId && selectedTable) {
      try {
        await api.deleteOrder(currentOrderId);
        setCurrentOrderId(null);
        
        // Cart cleared
        
        // Update table status to available
        await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
        if (selectedSection) {
          store.fetchTables(selectedSection);
        }
      } catch (error) {
        console.error('Failed to delete order:', error);
      }
    }
  };

  // Accept customer order
  const handleAcceptOrder = async (order: any) => {
    if (!user) return;
    
    try {
      const response = await api.acceptCustomerOrder(order.id, user.id);
      if (response.success) {
        toast('success', `Order from Table ${order.table_number} accepted`);
        
        // Add items to current cart for KOT generation
        if (order.items && order.items.length > 0) {
          const newCartItems: CartItem[] = order.items.map((item: any) => ({
            id: uuidv4(),
            productId: item.product_id,
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            taxRate: item.tax_rate,
            taxAmount: item.tax_amount,
            total: item.total,
            isKot: false,
            isNew: true
          }));
          
          // If a table is selected, add to cart; otherwise prompt to select table
          if (selectedTable) {
            setCart(prev => [...prev, ...newCartItems]);
          } else {
            // Find the table from pending orders
            const tableInfo = tables.find(t => t.number === order.table_number);
            if (tableInfo) {
              handleTableSelect(tableInfo);
              setTimeout(() => {
                setCart(newCartItems);
              }, 500);
            }
          }
        }
        
        // Refresh orders
        const ordersRes = await api.getWaiterPendingOrders(user.id);
        if (ordersRes.success) {
          setPendingOrders(ordersRes.data);
        }
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      toast('error', 'Failed to accept order');
    }
  };

  // Show decline modal
  const handleDeclineOrder = (orderId: string) => {
    setDeclineOrderId(orderId);
    setShowDeclineModal(true);
  };

  // Confirm decline order
  const handleConfirmDecline = async () => {
    if (!user || !declineOrderId) return;
    
    try {
      const response = await api.declineCustomerOrder(declineOrderId, user.id, 'Busy with other tables');
      if (response.success) {
        toast('info', 'Order declined');
        
        // Refresh orders
        const ordersRes = await api.getWaiterPendingOrders(user.id);
        if (ordersRes.success) {
          setPendingOrders(ordersRes.data);
        }
      }
    } catch (error) {
      console.error('Error declining order:', error);
      toast('error', 'Failed to decline order');
    } finally {
      setShowDeclineModal(false);
      setDeclineOrderId(null);
    }
  };

  // Handle Collect Payment
  const handleCollectPayment = async () => {
    if (!selectedTable || !billOrderId) {
      toast('error', 'No table or order selected');
      return;
    }

    // Validate amount based on payment mode
    let amount = 0;
    if (paymentMode === 'cash' && !cashAmount) {
      toast('error', 'Please enter cash amount');
      return;
    }
    if (paymentMode === 'gpay' && (!customerGpayNumber || !gpayAmount)) {
      toast('error', 'Please enter GPay number and amount');
      return;
    }
    if (paymentMode === 'card' && !cardAmount) {
      toast('error', 'Please enter card amount');
      return;
    }

    if (paymentMode === 'cash') {
      amount = parseFloat(cashAmount) || total;
    } else if (paymentMode === 'gpay') {
      amount = parseFloat(gpayAmount) || total;
    } else if (paymentMode === 'card') {
      amount = parseFloat(cardAmount) || total;
    }

    try {
      // Update order status to paid
      await api.updateOrder(billOrderId, { 
        status: 'paid',
        paymentMode: paymentMode,
        paymentAmount: amount,
        paidAt: new Date().toISOString()
      });

      // Send busser notification for cleaning
      await api.post('/busser/notify', {
        tableId: selectedTable.id,
        tableNumber: selectedTable.number,
        message: `Table ${selectedTable.number} needs cleaning - Payment collected (${paymentMode.toUpperCase()})`
      });

      // Update table status to pending_cleaning
      await api.put(`/tables/${selectedTable.id}`, { status: 'pending_cleaning' });

      toast('success', `Payment collected via ${paymentMode.toUpperCase()}`);
      
      // Close modal and reset
      setShowCollectModal(false);
      setBillGenerated(false);
      setBillOrderId(null);
      
      // Reset table and cart
      setSelectedTable(null);
      setCart([]);
      setCurrentOrderId(null);
      setDiscountAmount('');
      setDiscountReason('');
      setSelectedCustomer(null);
      setCashAmount('');
      setGpayAmount('');
      setCardAmount('');
      setCustomerGpayNumber('');
      
      // Refresh tables
      store.fetchTables(selectedSection || undefined);
    } catch (error) {
      console.error('Error collecting payment:', error);
      toast('error', 'Failed to process payment');
    }
  };

  // Handle Push Payment
  const handlePushPayment = async () => {
    if (!selectedTable || !billOrderId) {
      toast('error', 'No table or order selected');
      return;
    }

    if (pushMethod === 'gpay' && !pushGpayNumber) {
      toast('error', 'Please enter GPay number or UPI ID');
      return;
    }

    try {
      // Update order status to paid (pending_push for GPay)
      await api.updateOrder(billOrderId, { 
        status: 'paid',
        paymentMode: pushMethod === 'gpay' ? 'gpay_push' : 'pos_push',
        paymentAmount: total,
        paidAt: new Date().toISOString(),
        pushMethod: pushMethod,
        pushTarget: pushMethod === 'gpay' ? pushGpayNumber : 'POS Machine'
      });

      // Send busser notification for cleaning
      await api.post('/busser/notify', {
        tableId: selectedTable.id,
        tableNumber: selectedTable.number,
        message: `Table ${selectedTable.number} needs cleaning - Payment pushed (${pushMethod.toUpperCase()})`
      });

      // Update table status to pending_cleaning
      await api.put(`/tables/${selectedTable.id}`, { status: 'pending_cleaning' });

      if (pushMethod === 'gpay') {
        toast('success', `Payment of ₹${total.toFixed(2)} pushed to ${pushGpayNumber}`);
      } else {
        toast('success', `Payment pushed to POS Machine`);
      }
      
      // Close modal and reset
      setShowPushModal(false);
      setBillGenerated(false);
      setBillOrderId(null);
      
      // Reset table and cart
      setSelectedTable(null);
      setCart([]);
      setCurrentOrderId(null);
      setDiscountAmount('');
      setDiscountReason('');
      setSelectedCustomer(null);
      setPushGpayNumber('');
      
      // Refresh tables
      store.fetchTables(selectedSection || undefined);
    } catch (error) {
      console.error('Error pushing payment:', error);
      toast('error', 'Failed to push payment');
    }
  };

  // Select table
  const handleTableSelect = async (table: Table) => {
    // Check if table is pending cleaning
    if (table.status === 'pending_cleaning') {
      // Show app-based modal instead of browser confirm
      setPendingCleaningTable(table);
      setShowPendingCleaningModal(true);
      return;
    }

    // Save current cart to server before switching tables
    if (selectedTable && cart.length > 0 && currentOrderId) {
      // Update existing order with current cart items
      try {
        const newItems = cart.filter(i => i.isNew);
        if (newItems.length > 0) {
          // Add new items to order
          for (const item of newItems) {
            await api.post(`/orders/${currentOrderId}/items`, {
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              isKot: false
            });
          }
        }
        
        // Update order totals
        await api.put(`/orders/${currentOrderId}`, {
          subtotal,
          taxAmount,
          discountAmount: parseFloat(discountAmount) || 0,
          discountReason,
          total
        });
      } catch (error) {
        console.error('Failed to save cart before switching:', error);
      }
    }

    // Refresh tables to get latest status before selecting
    // Invalidate cache first to ensure fresh data
    invalidateCache('tables_');
    await store.fetchTables(selectedSection || undefined);
    
    // Force update store tables to trigger re-render
    const updatedTables = [...store.tables];
    
    // Find the latest table data from store (in case status was updated)
    const latestTable = store.tables.find(t => t.id === table.id) || table;
    setSelectedTable(latestTable);
    
    // Check if there's an existing order
    const response = await api.getOrderByTable(latestTable.id);
    
    // Only restore saved cart if table has an active order on server
    // This prevents stale localStorage data from showing on available tables
    const hasServerOrder = response.success && response.data;
    
    if (hasServerOrder) {
      // Load from server - has active order
      const existingOrder = response.data;
      setCurrentOrderId(existingOrder.id);
      
      // Load existing items (already KOT'd in previous rounds)
      // These items should be marked as alreadyKot so they can be struck through
      const existingItems: CartItem[] = existingOrder.items
        .filter((item: any) => item.isKot)
        .map((item: any) => ({ ...item, isKot: true, isNew: false, alreadyKot: true }));
      
      const newItems: CartItem[] = existingOrder.items
        .filter((item: any) => !item.isKot)
        .map((item: any) => ({ ...item, isNew: false, alreadyKot: false }));
      
      setCart([...existingItems, ...newItems]);
      
      if (existingOrder.discountAmount > 0) {
        setDiscountAmount(String(existingOrder.discountAmount));
        setDiscountReason(existingOrder.discountReason);
      }
    } else {
      // New table, no saved cart, no existing order
      setCurrentOrderId(null);
      setCart([]);
      setDiscountAmount('');
      setDiscountReason('');
      setAppliedCoupon(null);
      setSelectedWaiter('');
      setSelectedCustomer(null);
    }
    
    // Final refresh to ensure UI shows latest status
    await store.fetchTables(selectedSection || undefined);
    
    // Force re-render by updating state with fresh data
    const finalTable = store.tables.find(t => t.id === table.id);
    if (finalTable) {
      // If table has items (cart or order), update status to match
      const hasItems = (cart.length > 0 || (response.success && response.data && response.data.items?.length > 0));
      if (hasItems && finalTable.status === 'available') {
        const updateResult = await api.put(`/tables/${finalTable.id}`, { status: 'occupied' });
        if (updateResult.success) {
          setSelectedTable({ ...finalTable, status: 'occupied' });
        } else {
          setSelectedTable({ ...finalTable });
        }
      } else {
        setSelectedTable({ ...finalTable });
      }
    }
  };

  // Confirm pending cleaning modal
  const handleConfirmPendingCleaning = async () => {
    if (!pendingCleaningTable) return;

    try {
      // Cart saved to server

      // Update table status to available
      await api.put(`/tables/${pendingCleaningTable.id}`, { status: 'available' });
      toast('success', `Table ${pendingCleaningTable.number} marked as available`);
      
      // Close modal
      setShowPendingCleaningModal(false);
      
      // Fetch cart data ONLY from server API - no localStorage
      const response = await api.getOrderByTable(pendingCleaningTable.id);
      
      setSelectedTable(pendingCleaningTable);
      
      if (response.success && response.data) {
        const existingOrder = response.data;
        setCurrentOrderId(existingOrder.id);
        
        const existingItems: CartItem[] = existingOrder.items
          .filter((item: any) => item.isKot)
          .map((item: any) => ({ ...item, isKot: true, isNew: false }));
        
        const newItems: CartItem[] = existingOrder.items
          .filter((item: any) => !item.isKot)
          .map((item: any) => ({ ...item, isNew: false }));
        
        setCart([...existingItems, ...newItems]);
        
        if (existingOrder.discountAmount > 0) {
          setDiscountAmount(String(existingOrder.discountAmount));
          setDiscountReason(existingOrder.discountReason);
        }
      } else {
        // No existing order - clear everything
        setCurrentOrderId(null);
        setCart([]);
        setDiscountAmount('');
        setDiscountReason('');
        setAppliedCoupon(null);
        setSelectedWaiter('');
        setSelectedCustomer(null);
      }
    } catch (error) {
      console.error('Failed to update table status:', error);
      toast('error', 'Failed to update table status');
    }
  };

  // Generate KOT
  const handleKOT = async () => {
    // Check for items
    if (cart.filter(i => i.isNew).length === 0) {
      toast('warning', 'Add items to generate KOT');
      return;
    }

    // Check if online order (no table needed)
    const isOnlineOrderMode = onlineOrder !== null;
    
    if (!isOnlineOrderMode && !selectedTable) {
      toast('warning', 'Please select a table first');
      return;
    }

    const kotSetup = settings?.kot_setup;
    const showPreview = kotSetup?.showPreview !== false; // Default to true
    
    // Generate KOT number with format DD-MM-XXXX (4-digit sequential)
    let kotNumber: string;
    let displayTable: string;
    
    if (isOnlineOrderMode) {
      // Online order KOT format: DD-MM-XXXX with online prefix
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const randomNum = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
      kotNumber = `${day}${month}-${randomNum.slice(-3)}`;
      displayTable = onlineOrder.externalOrderId || onlineOrder.platform;
    } else {
      // Regular KOT format: DD-MM-XXXX (4-digit sequential starting from 0001)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const randomNum = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
      kotNumber = `${day}${month}-${randomNum.slice(-3)}`;
      displayTable = selectedTable.number;
    }
    
    // Get selected waiter name
    const selectedWaiterObj = waiters.find(w => w.id === selectedWaiter);
    const waiterName = selectedWaiterObj ? selectedWaiterObj.name : 'Not Assigned';
    
    // Create content for preview
    const kotContent = {
      orderId: kotNumber,
      tableNumber: displayTable,
      items: cart.filter(i => i.isNew || i.isKot),
      waiterName: waiterName,
      dateTime: new Date().toLocaleString(),
      isOnlineOrder: isOnlineOrderMode,
      platform: onlineOrder?.platform,
    };

    // If preview is enabled, show preview modal (DO NOT print automatically)
    if (showPreview) {
      setPreviewContent({ type: 'kot', content: kotContent });
      // Save current isKot state for executeKOT to use
      const preKotState = cart.map(item => ({ id: item.id, isKot: item.isKot, alreadyKot: item.alreadyKot }));
      setPendingAction(async () => {
        await executeKOT(preKotState, true); // fromPreview = true
      });
      setShowPreviewModal(true);
    } else {
      // If preview disabled, directly execute KOT without printing
      const preKotState = cart.map(item => ({ id: item.id, isKot: item.isKot, alreadyKot: item.alreadyKot }));
      await executeKOT(preKotState);
    }
  };

  // Execute KOT generation (called after preview confirm or if preview disabled)
  const executeKOT = async (preKotState: any[], fromPreview: boolean = false) => {
    // Mark items as KOT and track which ones were already KOT'd
    const kotItems = cart.map(item => {
      // Check if this item was already KOT'd before this round
      const prevState = preKotState.find(p => p.id === item.id);
      const wasAlreadyKot = prevState?.alreadyKot === true || prevState?.isKot === true;
      
      return { 
        ...item, 
        isKot: true, 
        isNew: false, 
        alreadyKot: wasAlreadyKot
      };
    });
    setCart(kotItems);

    const isOnlineOrderMode = onlineOrder !== null;

    if (currentOrderId) {
      await api.updateOrder(currentOrderId, { items: kotItems });
      // Update order status to KOT and table status to pending_billing
      await api.generateKOT(currentOrderId);
      // Refresh table status
      store.fetchTables(selectedSection || undefined);
      toast('success', 'KOT Generated successfully');
    } else if (isOnlineOrderMode) {
      // For online orders, create a special order (no table)
      // Store the online order ID for later use when generating bill
      // We'll create an order entry in the backend or use session
      try {
        // Save order data for online orders - could call API to create order
        const orderData = {
          onlineOrderId: onlineOrder.onlineOrderId,
          externalOrderId: onlineOrder.externalOrderId,
          platform: onlineOrder.platform,
          items: kotItems,
          status: 'kot_generated',
        };
        
        // Store in session for later use
        sessionStorage.setItem('onlineKotData', JSON.stringify(orderData));
        
        // Update online order status to preparing
        await api.updateOnlineOrderStatus(onlineOrder.onlineOrderId, 'preparing');
      } catch (error) {
        console.error('Error saving online order KOT:', error);
      }
    } else {
      console.log('[KOT] Creating order for table:', selectedTable.id, selectedTable.number);
      const response = await api.createOrder({
        tableId: selectedTable.id,
        items: kotItems,
        waiterId: selectedWaiter || undefined,
        customerId: selectedCustomer?.id
      });
      console.log('[KOT] Order created response:', JSON.stringify(response));
      if (response.success && response.data && response.data.id) {
        setCurrentOrderId(response.data.id);
        console.log('[KOT] Generating KOT for order:', response.data.id);
        // Generate KOT with the new order ID - backend will update table status to pending_billing
        const kotResponse = await api.generateKOT(response.data.id);
        console.log('[KOT] KOT response:', JSON.stringify(kotResponse));
        // Refresh table status
        store.fetchTables(selectedSection || undefined);
        toast('success', 'KOT Generated successfully');
      } else {
        console.error('[KOT] Failed to create order:', response.error);
      }
    }
    
    // Print KOT (simulated) - Only if not from preview
    if (!fromPreview) {
    setTimeout(() => {
      console.log('KOT Print triggered');
      toast('info', 'KOT sent to printer');
    }, 500);
    }
  };

  // Number to words conversion
  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero Rupees';
    
    const convertChunk = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertChunk(n % 100) : '');
    };
    
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    
    let result = convertChunk(rupees) + ' Rupees';
    if (paise > 0) {
      result += ' and ' + convertChunk(paise) + ' Paise';
    }
    return result;
  };

  // Generate PDF Bill
  const generatePDFBill = (billData: any): string => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Restaurant Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.restaurant?.name || 'Restaurant', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Restaurant details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (settings?.restaurant?.address) {
      doc.text(settings.restaurant.address, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    if (settings?.restaurant?.phone) {
      doc.text(`Phone: ${settings.restaurant.phone}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    y += 5;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Bill Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Bill details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill No: ${billData.orderId}`, margin, y);
    y += 6;
    doc.text(`Table: ${billData.tableNumber}`, margin, y);
    y += 6;
    doc.text(`Date: ${billData.dateTime}`, margin, y);
    y += 6;
    doc.text(`Waiter: ${billData.waiterName}`, margin, y);
    y += 10;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Items Header
    doc.setFont('helvetica', 'bold');
    doc.text('Item', margin, y);
    doc.text('Qty', pageWidth - 60, y);
    doc.text('Price', pageWidth - 40, y);
    doc.text('Total', pageWidth - margin, y, { align: 'right' });
    y += 5;

    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Items
    doc.setFont('helvetica', 'normal');
    billData.items.forEach((item: any) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const itemTotal = (item.unitPrice * item.quantity).toFixed(2);
      doc.text(item.productName.substring(0, 30), margin, y);
      doc.text(String(item.quantity), pageWidth - 60, y);
      doc.text(`₹${item.unitPrice.toFixed(2)}`, pageWidth - 40, y);
      doc.text(`₹${itemTotal}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    });

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Totals
    doc.text('Subtotal:', margin, y);
    doc.text(`₹${billData.subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    doc.text('Tax:', margin, y);
    doc.text(`₹${billData.taxAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    if (billData.discount > 0) {
      doc.text('Discount:', margin, y);
      doc.text(`-₹${billData.discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }

    if (billData.loyaltyDiscount > 0) {
      doc.text('Loyalty Discount:', margin, y);
      doc.text(`-₹${billData.loyaltyDiscount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', margin, y);
    doc.text(`₹${billData.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 8;

    // Total in words
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Amount in Words: ${billData.totalInWords}`, margin, y);
    y += 15;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Footer
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('Please visit again!', pageWidth / 2, y, { align: 'center' });

    // Return as data URL for sharing
    return doc.output('dataurlstring');
  };

  // Share bill via WhatsApp - uses shareable link instead of local PDF
  const shareViaWhatsApp = async (billData: any) => {
    try {
      // Get the current base URL
      const baseUrl = window.location.origin;
      const billLink = `${baseUrl}/bill/${billData.orderId}`;
      
      // Open WhatsApp with the bill link
      const message = encodeURIComponent(
        `Your bill from ${settings?.restaurant?.name || 'Restaurant'}\n\n` +
        `Bill No: ${billData.orderId}\n` +
        `Total: ₹${billData.total.toFixed(2)}\n\n` +
        `View and download your bill here:\n${billLink}`
      );
      
      const phoneNumber = billData.customerPhone?.replace(/\D/g, '') || '';
      window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
      
      toast('success', 'WhatsApp opened with bill link');
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      toast('error', 'Failed to share bill');
    }
  };

  // Share PDF via Email
  const sharePDFViaEmail = (billData: any) => {
    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Restaurant Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.restaurant?.name || 'Restaurant', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Restaurant details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (settings?.restaurant?.address) {
      doc.text(settings.restaurant.address, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    if (settings?.restaurant?.phone) {
      doc.text(`Phone: ${settings.restaurant.phone}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    y += 5;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Bill Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Bill details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill No: ${billData.orderId}`, margin, y);
    y += 6;
    doc.text(`Table: ${billData.tableNumber}`, margin, y);
    y += 6;
    doc.text(`Date: ${billData.dateTime}`, margin, y);
    y += 6;
    doc.text(`Waiter: ${billData.waiterName}`, margin, y);
    y += 10;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Items Header
    doc.setFont('helvetica', 'bold');
    doc.text('Item', margin, y);
    doc.text('Qty', pageWidth - 60, y);
    doc.text('Price', pageWidth - 40, y);
    doc.text('Total', pageWidth - margin, y, { align: 'right' });
    y += 5;

    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Items
    doc.setFont('helvetica', 'normal');
    billData.items.forEach((item: any) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const itemTotal = (item.unitPrice * item.quantity).toFixed(2);
      doc.text(item.productName.substring(0, 30), margin, y);
      doc.text(String(item.quantity), pageWidth - 60, y);
      doc.text(`₹${item.unitPrice.toFixed(2)}`, pageWidth - 40, y);
      doc.text(`₹${itemTotal}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    });

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Totals
    doc.text('Subtotal:', margin, y);
    doc.text(`₹${billData.subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    doc.text('Tax:', margin, y);
    doc.text(`₹${billData.taxAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    if (billData.discount > 0) {
      doc.text('Discount:', margin, y);
      doc.text(`-₹${billData.discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }

    if (billData.loyaltyDiscount > 0) {
      doc.text('Loyalty Discount:', margin, y);
      doc.text(`-₹${billData.loyaltyDiscount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', margin, y);
    doc.text(`₹${billData.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 8;

    // Total in words
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Amount in Words: ${billData.totalInWords}`, margin, y);
    y += 15;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Footer
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('Please visit again!', pageWidth / 2, y, { align: 'center' });

    // Save PDF
    doc.save(`Bill_${billData.orderId}.pdf`);
    
    // Open email
    const subject = encodeURIComponent(`Bill from ${settings?.restaurant?.name || 'Restaurant'} - ${billData.orderId}`);
    const body = encodeURIComponent(
      `Dear Customer,\n\n` +
      `Thank you for dining with us!\n\n` +
      `Bill No: ${billData.orderId}\n` +
      `Total: ₹${billData.total.toFixed(2)}\n\n` +
      `PDF bill has been downloaded. Please check.\n\n` +
      `Thank you for visiting!\n` +
      `${settings?.restaurant?.name || 'Restaurant'}`
    );
    window.open(`mailto:${billData.customerEmail}?subject=${subject}&body=${body}`, '_blank');
    
    toast('info', 'PDF downloaded and Email opened');
  };

  // Generate Bill
  const handleBill = async () => {
    // Check for items
    if (cart.length === 0) {
      toast('warning', 'Add items to generate bill');
      return;
    }

    const isOnlineOrderMode = onlineOrder !== null;
    
    if (!isOnlineOrderMode && !selectedTable) {
      toast('warning', 'Please select a table first');
      return;
    }

    const billSetup = settings?.bill_setup;
    const showPreview = billSetup?.showPreview !== false; // Default to true
    
    // Generate order ID based on mode
    let orderId: string;
    let displayTable: string;
    
    if (isOnlineOrderMode) {
      // Online order ID format: Online-SGY-XXXXX, Online-ZMTO-XXXXX, Online-OTHS-XXXXX
      const platformCode = onlineOrder.platform?.toUpperCase().slice(0, 4) || 'OTHS';
      const prefix = platformCode === 'SWIG' ? 'SGY' : 
                     platformCode === 'ZOMA' ? 'ZMTO' : 'OTHS';
      const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
      orderId = `Online-${prefix}-${randomNum}`;
      displayTable = onlineOrder.externalOrderId || onlineOrder.platform;
    } else {
      // Regular order ID format: DDMMYY-TB##-XXXXX
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const dateStr = `${day}${month}${year}`;
      const tableStr = selectedTable.number.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4).padEnd(4, '0');
      const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
      orderId = `${dateStr}-${randomNum.slice(-4)}`;
      displayTable = selectedTable.number;
    }
    
    // Get KotData from session for online orders
    const kotDataStr = sessionStorage.getItem('onlineKotData');
    const kotData = kotDataStr ? JSON.parse(kotDataStr) : null;
    
    // Create content for preview
    const billContent = {
      orderId: orderId,
      kotNumber: currentOrderId || kotData?.onlineOrderId || 'N/A', // Reference to KOT
      tableNumber: displayTable,
      items: cart,
      subtotal: subtotal,
      taxAmount: taxAmount,
      couponDiscount: couponDiscountValue,
      couponCode: appliedCoupon?.code || null,
      loyaltyDiscount: loyaltyDiscountValue,
      loyaltyCustomerName: selectedCustomer?.name || null,
      discount: discountValue,
      discountReason: discountReason,
      total: total,
      totalInWords: numberToWords(total),
      waiterName: user?.name || 'Staff',
      customerPhone: selectedCustomer?.phone || onlineOrder?.customerPhone || null,
      customerEmail: selectedCustomer?.email || null,
      dateTime: new Date().toLocaleString(),
      payment: settings?.payment,
      isOnlineOrder: isOnlineOrderMode,
      platform: onlineOrder?.platform,
      deliveryAddress: onlineOrder?.deliveryAddress,
    };

    // If preview is enabled, show preview modal
    if (showPreview) {
      setPreviewContent({ type: 'bill', content: billContent });
      setPendingAction(async () => {
        await executeBill(true); // fromPreview = true
      });
      setShowPreviewModal(true);
    } else {
      await executeBill(false); // fromPreview = false
    }
  };

  // Execute Bill generation (called after preview confirm or if preview disabled)
  const executeBill = async (fromPreview: boolean = false) => {
    const isOnlineOrderMode = onlineOrder !== null;

    let orderId = currentOrderId;

    // If no order exists but we have items in cart, create an order first
    if (!orderId && !isOnlineOrderMode && selectedTable && cart.length > 0) {
      try {
        // Create order via API directly to get the order ID
        const orderResponse = await api.createOrder({
          tableId: selectedTable.id,
          items: cart,
          waiterId: selectedWaiter || undefined,
          customerId: selectedCustomer?.id
        });
        if (orderResponse.success && orderResponse.data?.id) {
          orderId = orderResponse.data.id;
        }
      } catch (error) {
        console.error('Error creating order for bill:', error);
      }
    }

    // Only proceed if we have a valid orderId
    if (orderId) {
      // Apply any pending discount
      if (discountAmount && discountReason) {
        await applyDiscount(orderId, discountValue, discountReason);
      }
      // Generate bill data and trigger download
      const billData = {
        orderId: orderId,
        tableNumber: selectedTable?.number || 'N/A',
        dateTime: new Date().toLocaleString(),
        waiterName: waiters.find(w => w.id === selectedWaiter)?.name || 'Staff',
        customerPhone: selectedCustomer?.phone || null,
        customerEmail: selectedCustomer?.email || null,
        items: cart,
        subtotal: subtotal,
        taxAmount: taxAmount,
        discount: discountValue,
        loyaltyDiscount: loyaltyDiscountValue,
        total: total,
        totalInWords: numberToWords(total),
      };
      
      // Generate and download PDF
      generatePDFBill(billData);
      
      // Show success
      toast('success', 'Bill generated successfully');
      
      // Update table status to 'pending_cleaning' when bill is generated
      if (!isOnlineOrderMode && selectedTable) {
        try {
          // Delete any remaining pending orders for this table
          const pendingOrder = await api.getOrderByTable(selectedTable.id);
          if (pendingOrder.success && pendingOrder.data) {
            await api.deleteOrder(pendingOrder.data.id);
          }
          
          await api.put(`/tables/${selectedTable.id}`, { status: 'pending_cleaning' });
          setSelectedTable({ ...selectedTable, status: 'pending_cleaning' });
          store.fetchTables(selectedSection || undefined);
          
          // Clear cart items after billing
          setCart([]);
          
          // Table cart cleared automatically
        } catch (error) {
          console.error('Failed to update table status:', error);
        }
      }

      // Store the order ID for Collect/PUSH
      setBillOrderId(orderId);
      
      // Store the bill amount for Collect modal
      setLastBillAmount(total);

      // Set billGenerated to true to show COLLECT/PUSH buttons
      setBillGenerated(true);

      // Show single success toast
      toast('success', 'Bill generated successfully');
    } else {
      // No orderId - this shouldn't happen but handle gracefully
      console.error('No orderId available for bill generation');
      toast('error', 'Failed to generate bill - no order found');
      return;
    }

    // For online orders, update status to ready
    if (isOnlineOrderMode && onlineOrder) {
      try {
        await api.updateOnlineOrderStatus(onlineOrder.onlineOrderId, 'ready');
        toast('success', 'Online Order Bill Generated - Order Ready for Pickup');
        
        // Clear session data
        sessionStorage.removeItem('onlineKotData');
        
        // Reset online order state
        setOnlineOrder(null);
        setBillGenerated(false);
        setBillOrderId(null);
      } catch (error) {
        console.error('Error updating online order status:', error);

      }
    }
    
    // Print Bill (simulated) - Only if not from preview
    if (!fromPreview) {
    setTimeout(() => {
      console.log('Bill Print triggered');
      toast('info', 'Bill sent to printer');
    }, 500);
    }
  };

  // Handle preview print action
  const handlePreviewPrint = async () => {
    // Try QZ Tray for silent printing first
    await initQZTray();
    
    if (previewContent?.content) {
      try {
        let printContent = '';
        if (previewContent.type === 'bill') {
          printContent = formatBillForPrinter({
            ...previewContent.content,
            restaurantName: settings?.restaurant?.name || 'Restaurant',
            address: settings?.restaurant?.address || '',
            phone: settings?.restaurant?.phone || '',
          });
        } else {
          printContent = formatKOTForPrinter(previewContent.content);
        }
        const success = await printText(printContent, { width: 80 });
        if (success) {
          toast('success', 'Print sent to thermal printer');
        } else {
          // Fallback to window.print
          window.print();
        }
      } catch (err) {
        console.error('Print error:', err);
        window.print();
      }
    }
    
    setShowPreviewModal(false);
    if (pendingAction) {
      await pendingAction();
    }
    setPendingAction(null);
    setPreviewContent(null);
  };

  // Handle preview cancel
  const handlePreviewCancel = () => {
    setShowPreviewModal(false);
    setPendingAction(null);
    setPreviewContent(null);
  };

  // Apply Discount function
  const applyDiscount = async (orderId: string, amount: number, reason: string) => {
    try {
      const response = await api.put(`/orders/${orderId}/discount`, {
        discountAmount: amount,
        discountReason: reason
      });
      if (response.success) {
        toast('success', 'Discount applied successfully');
      }
    } catch (error) {
      console.error('Failed to apply discount:', error);
      toast('error', 'Failed to apply discount');
    }
  };

  // Apply Discount handler
  const handleApplyDiscount = () => {
    if (!discountAmount || parseFloat(discountAmount) <= 0) {
      toast('error', 'Please enter valid discount');
      return;
    }
    
    const reasons = ['Birthday', 'Corporate', 'Festival', 'Other'];
    if (!reasons.includes(discountReason)) {
      toast('error', 'Please select a discount reason');
      return;
    }

    if (currentOrderId) {
      applyDiscount(currentOrderId, discountValue, discountReason);
    }
    
    // Remove any applied coupon when discount is applied
    setAppliedCoupon(null);
    setShowDiscountModal(false);
    toast('success', 'Discount applied');
  };

  // Apply Coupon
  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      toast('error', 'Please enter a coupon code');
      return;
    }

    // Find coupon from settings
    const coupons = settings?.coupons || [];
    const coupon = coupons.find((c: any) => c.code.toUpperCase() === couponCode.toUpperCase());
    
    if (!coupon) {
      toast('error', 'Invalid coupon code');
      return;
    }

    // Check expiry
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      toast('error', 'Coupon has expired');
      return;
    }

    // Check stock
    if (coupon.stock !== undefined && coupon.stock <= 0) {
      toast('error', 'Coupon out of stock');
      return;
    }

    // Apply coupon
    setAppliedCoupon(coupon);
    setShowCouponModal(false);
    setCouponCode('');
    toast('success', `Coupon "${coupon.code}" applied`);
  };

  // Remove Coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast('info', 'Coupon removed');
  };

  // Filter products by category, search, and selected section
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => p.isActive);
    
    // Filter by search query (product name or category name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => {
        // Check if product name matches
        if (p.name.toLowerCase().includes(query)) return true;
        // Check if category name matches - if match, include all products in that category
        if (p.categoryName && p.categoryName.toLowerCase().includes(query)) return true;
        return false;
      });
    }
    
    // Filter by category if selected (and no search query)
    if (selectedCategory && !searchQuery.trim()) {
      filtered = filtered.filter(p => p.categoryId === selectedCategory);
    }
    
    // Filter by section if selected - only show products with prices for this section
    if (selectedSection) {
      filtered = filtered.filter(p => {
        if (p.sectionPrices && p.sectionPrices.length > 0) {
          const sectionPrice = p.sectionPrices.find(sp => sp.sectionId === selectedSection);
          return sectionPrice && parseFloat(sectionPrice.price) > 0;
        }
        // If no section-specific price, show the product with default price
        return true;
      });
    }
    
    return filtered;
  }, [products, selectedCategory, selectedSection, searchQuery]);

  // Get active categories
  const activeCategories = categories.filter(c => c.isActive);

  // Format currency
  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

  // Generate bill text for download
  const generateBillText = (content: any) => {
    let text = '';
    text += '================== BILL ==================\n\n';
    text += `${settings?.restaurant?.name || 'Oyebill'}\n`;
    text += 'TAX INVOICE\n\n';
    text += `Bill No: ${content.orderId || 'N/A'}\n`;
    text += `Table: ${content.tableNumber || 'N/A'}\n`;
    text += `Date: ${content.dateTime || new Date().toLocaleString()}\n`;
    text += `Billed By: ${content.waiterName || 'N/A'}\n\n`;
    text += '------------------------------------------\n';
    text += 'ITEMS:\n';
    text += '------------------------------------------\n';
    content.items.forEach((item: any) => {
      text += `${item.productName}\n`;
      text += `  Qty: ${item.quantity} x ₹${item.unitPrice.toFixed(2)}\n`;
      text += `  Tax: ₹${(item.unitPrice * item.quantity * 0.05).toFixed(2)}\n`;
      text += `  Amount: ₹${(item.unitPrice * item.quantity * 1.05).toFixed(2)}\n\n`;
    });
    text += '------------------------------------------\n';
    text += `Subtotal: ₹${content.subtotal?.toFixed(2) || '0.00'}\n`;
    if (content.couponDiscount > 0) {
      text += `Coupon Discount: -₹${content.couponDiscount.toFixed(2)}\n`;
    }
    if (content.loyaltyDiscount > 0) {
      text += `Loyalty Discount: -₹${content.loyaltyDiscount.toFixed(2)}\n`;
    }
    if (content.discount > 0) {
      text += `Discount: -₹${content.discount.toFixed(2)}\n`;
    }
    text += `CGST: ₹${(content.taxAmount / 2).toFixed(2)}\n`;
    text += `SGST: ₹${(content.taxAmount / 2).toFixed(2)}\n`;
    text += '------------------------------------------\n';
    text += `GRAND TOTAL: ₹${content.total?.toFixed(2) || '0.00'}\n`;
    text += '------------------------------------------\n\n';
    text += `${content.totalInWords || 'Rupees Only'}\n\n`;
    if (content.payment?.showQrOnBill && content.payment?.upiId) {
      text += 'Scan QR code to pay\n';
      text += `UPI: ${content.payment.upiId}\n`;
    }
    if (settings?.bill_setup?.specialMessage) {
      text += `\n${settings.bill_setup.specialMessage}\n`;
    }
    text += '\n========== Thank You! ==========\n';
    return text;
  };

  const generateBillHTML = (content: any) => {
    const itemsHTML = content.items.map((item: any) => `
      <tr><td>${item.productName}</td><td style="text-align:right">${item.quantity}</td><td style="text-align:right">Rs.${item.unitPrice.toFixed(2)}</td><td style="text-align:right">Rs.${(item.unitPrice * item.quantity * 1.05).toFixed(2)}</td></tr>
    `).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill ${content.orderId}</title><style>body{font-family:monospace;width:280px;margin:0 auto;padding:10px}.center{text-align:center}.bold{font-weight:bold}.border{border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:2px 0}.total{font-weight:bold;font-size:14px}@media print{body{width:80mm}}</style></head><body><div class="center bold border">${settings?.restaurant?.name || 'Restaurant'}</div><div class="center border">TAX INVOICE</div><div class="border"><div>Bill No: ${content.orderId}</div><div>Table: ${content.tableNumber}</div><div>Date: ${content.dateTime}</div><div>Billed By: ${content.waiterName}</div></div><table><thead><tr style="border-bottom:1px solid #000"><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead><tbody>${itemsHTML}</tbody></table><div class="border"><div>Subtotal: Rs.${content.subtotal?.toFixed(2)}</div>${content.discount > 0 ? `<div>Discount: -Rs.${content.discount.toFixed(2)}</div>` : ''}<div>CGST: Rs.${(content.taxAmount / 2).toFixed(2)}</div><div>SGST: Rs.${(content.taxAmount / 2).toFixed(2)}</div></div><div class="total">GRAND TOTAL: Rs.${content.total?.toFixed(2)}</div><div class="center" style="font-size:10px">${content.totalInWords || 'Rupees Only'}</div>${content.payment?.showQrOnBill && content.payment?.upiId ? `<div class="center"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=upi://pay?pa=${content.payment.upiId}&am=${content.total.toFixed(2)}" /></div>` : ''}<div class="center border">Thank You!</div></body></html>`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header - Centered Billing title on mobile, with Bell on desktop */}
      <div className="lg:hidden flex items-center justify-between px-4 mb-4">
        <h1 className="text-xl font-display font-bold text-text-primary">Billing</h1>
        
        {/* Notification Bell for Mobile - Always visible */}
        {(user?.role === 'waiter' || user?.role === 'admin') && (
          <button
            onClick={() => setShowOrdersPanel(true)}
            className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Bell className="w-5 h-5 text-text-primary" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Desktop: Full page header with Bell */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold text-text-primary">Billing</h1>
        
        {/* Notification Bell for Waiters/Admins */}
        {(user?.role === 'waiter' || user?.role === 'admin') && (
          <button
            onClick={() => setShowOrdersPanel(true)}
            className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Desktop: Two column layout, Mobile: Single column with cart toggle */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[380px_1fr] gap-0 lg:gap-6 min-h-0">
        {/* Left: Order Panel - Desktop always visible, Mobile: Toggle */}
        <div className={`flex flex-col card order-panel ${showMobileCart ? 'mobile-cart-open' : ''}`}>
          {/* Mobile: View Toggle */}
          <div className="lg:hidden flex border-b border-white/10">
            <button
              onClick={() => { setMobileView('menu'); setShowMobileCart(false); }}
              className={`flex-1 py-3 text-sm font-medium transition-all ${
                mobileView === 'menu' 
                  ? 'bg-accent/10 text-accent border-b-2 border-accent' 
                  : 'text-text-secondary'
              }`}
            >
              Menu
            </button>
            <button
              onClick={() => { setMobileView('cart'); setShowMobileCart(true); }}
              className={`flex-1 py-3 text-sm font-medium transition-all relative ${
                mobileView === 'cart' 
                  ? 'bg-accent/10 text-accent border-b-2 border-accent' 
                  : 'text-text-secondary'
              }`}
            >
              Cart
              {cart.length > 0 && (
                <span className="absolute top-2 right-4 w-5 h-5 bg-accent text-background-primary rounded-full text-xs flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          {/* Table Selection */}
          <div className="p-3 lg:p-4 border-b border-white/10">
            {/* Online Order Banner */}
            {onlineOrder && (
              <div className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-400">Online Order</p>
                    <p className="text-sm text-text-secondary">
                      {onlineOrder.externalOrderId || onlineOrder.platform}
                    </p>
                    {onlineOrder.customerName && (
                      <p className="text-xs text-text-muted">{onlineOrder.customerName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setOnlineOrder(null);
                      setCart([]);
                      sessionStorage.removeItem('onlineKotData');
                    }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Section Filter - only show when not in online order mode */}
            {!onlineOrder && (
              <>
                <div className="mb-3">
                  {/* Mobile: Read-only text in cart view */}
                  {mobileView === 'cart' && selectedSection ? (
                    <div className="px-3 py-2 bg-background-secondary/50 rounded-lg text-sm text-text-primary">
                      {sections.find(s => s.id === selectedSection)?.name || 'All Sections'}
                    </div>
                  ) : (
                    <select
                      value={selectedSection}
                      onChange={(e) => {
                        setSelectedSection(e.target.value);
                        setSelectedTable(null);
                      }}
                      className="w-full px-3 py-2 bg-background-secondary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="">All Sections</option>
                      {sections.filter(s => s.isActive).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Selected Table - Desktop always show, Mobile compact with button */}
                {!onlineOrder && selectedTable ? (
                  <div className="hidden lg:flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20 mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-accent" />
                      <div>
                        <p className="font-medium">Table {selectedTable.number}</p>
                        <p className="text-xs text-text-muted">Capacity: {selectedTable.capacity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-dot ${selectedTable.status === 'available' ? 'status-available' : 'status-occupied'}`} />
                      <button
                        onClick={() => setShowSwitchTableModal(true)}
                        disabled={!currentOrderId}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                          currentOrderId
                            ? 'bg-accent hover:bg-accent/80 text-white'
                            : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                        }`}
                        title={currentOrderId ? 'Switch Table' : 'Generate KOT first to switch table'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Switch Table
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Mobile: Selected Table Compact with Switch Table Button */}
                {!onlineOrder && selectedTable ? (
                  <div className="lg:hidden flex items-center gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20 mb-2">
                    <div className="flex-1 flex items-center gap-2">
                      <span className={`status-dot ${selectedTable.status === 'available' ? 'status-available' : 'status-occupied'}`} />
                      <div>
                        <span className="font-medium text-sm">Table {selectedTable.number}</span>
                        <span className="text-xs text-text-muted ml-1">({selectedTable.capacity} seats)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSwitchTableModal(true)}
                      disabled={!currentOrderId}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium ${
                        currentOrderId
                          ? 'bg-accent hover:bg-accent/80 text-white'
                          : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                      }`}
                      title={currentOrderId ? 'Switch Table' : 'Generate KOT first to switch table'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Switch Table
                    </button>
                  </div>
                ) : (
                  /* Mobile: No table selected - show button */
                  <div className="lg:hidden mb-2">
                    <button
                      onClick={() => setShowAllTablesModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent/20 hover:bg-accent/30 rounded-lg text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      Select Table
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Waiter & Customer - Horizontal on mobile */}
            <div className="grid grid-cols-2 gap-2">
              {/* Waiter Selection with PIN - Read-only in mobile cart view */}
              <div className="relative">
                {/* Mobile: Read-only text in cart view */}
                {mobileView === 'cart' && selectedWaiter ? (
                  <div className="px-2 py-1.5 bg-accent/20 border border-accent/50 rounded-lg">
                    <span className="text-xs text-accent font-medium">
                      {waiters.find(w => w.id === selectedWaiter)?.name || 'Waiter'}
                    </span>
                  </div>
                ) : waiterPinInput.length > 0 ? (
                  // PIN input mode
                  <div className="flex items-center gap-1">
                    <input
                      type="password"
                      maxLength={4}
                      value={waiterPinInput.trim()}
                      onChange={(e) => {
                        const pin = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setWaiterPinInput(pin || ' '); // Keep at least a space to show input
                        
                        // Auto-filter when 4 digits entered
                        if (pin.length === 4) {
                          const matchedWaiter = waiters.find(w => w.pin === pin);
                          if (matchedWaiter) {
                            setSelectedWaiter(matchedWaiter.id);
                            setWaiterPinInput('');
                          } else {
                            setTimeout(() => setWaiterPinInput(''), 500);
                          }
                        }
                      }}
                      onBlur={() => {
                        // Clear if left empty
                        if (waiterPinInput.trim() === '') {
                          setWaiterPinInput('');
                        }
                      }}
                      placeholder="PIN"
                      className="w-full px-2 py-1.5 bg-accent/20 border border-accent/50 rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent"
                      autoFocus
                    />
                    <button
                      onClick={() => { setWaiterPinInput(''); setShowWaiterDropdown(false); }}
                      className="p-1.5 text-text-muted hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : selectedWaiter ? (
                  // Show selected waiter with clear option
                  <div className="flex items-center justify-between px-2 py-1.5 bg-accent/20 border border-accent/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-accent font-medium">
                        {waiters.find(w => w.id === selectedWaiter)?.name || 'Waiter'}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedWaiter('')}
                      className="text-text-muted hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // Show waiter dropdown
                  <div
                    onClick={() => setShowWaiterDropdown(!showWaiterDropdown)}
                    className="px-2 py-1.5 bg-background-secondary border border-white/10 rounded-lg text-xs text-text-muted flex items-center justify-between cursor-pointer hover:border-accent/50"
                  >
                    <span>Select Waiter</span>
                    <Key className="w-4 h-4" />
                  </div>
                )}

                {/* Waiter Dropdown */}
                {mobileView !== 'cart' && showWaiterDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background-card border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {/* Waiter Search Input */}
                    <div className="p-2 border-b border-white/10">
                      <input
                        type="text"
                        placeholder="Search waiter..."
                        value={waiterSearch}
                        onChange={(e) => setWaiterSearch(e.target.value)}
                        className="w-full px-2 py-1.5 bg-background-secondary border border-white/10 rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                        autoFocus
                      />
                    </div>
                    {waiters.filter(w => 
                      w.name.toLowerCase().includes(waiterSearch.toLowerCase())
                    ).length > 0 ? (
                      waiters
                        .filter(w => w.name.toLowerCase().includes(waiterSearch.toLowerCase()))
                        .map((waiter) => (
                          <button
                            key={waiter.id}
                            onClick={() => {
                              setSelectedWaiter(waiter.id);
                              setShowWaiterDropdown(false);
                              setWaiterSearch('');
                            }}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-accent/10 flex items-center justify-between"
                          >
                            <span className="text-text-primary">{waiter.name}</span>
                            {waiter.pin && <span className="text-text-muted text-[10px]">****</span>}
                          </button>
                        ))
                    ) : (
                      <div className="p-3 text-xs text-text-muted text-center">No waiters found</div>
                    )}
                    <button
                      onClick={() => {
                        setShowWaiterDropdown(false);
                        setWaiterPinInput(' '); // Start with space to trigger PIN input
                        setWaiterSearch('');
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-accent hover:bg-accent/10 border-t border-white/10 flex items-center gap-2"
                    >
                      <Key className="w-3 h-3" /> Use PIN
                    </button>
                  </div>
                )}
              </div>
              {/* Searchable Customer Dropdown - Read-only in mobile cart view */}
              <div className="relative">
                {/* Mobile: Read-only text in cart view */}
                {mobileView === 'cart' && selectedCustomer ? (
                  <div className="flex items-center px-2 py-1.5 bg-accent/20 border border-accent/50 rounded-lg">
                    <Users className="w-3 h-3 text-accent" />
                    <span className="text-xs text-accent font-medium truncate max-w-[100px]">
                      {selectedCustomer.name}
                    </span>
                  </div>
                ) : selectedCustomer ? (
                  // Show selected customer with clear option
                  <div className="flex items-center justify-between px-2 py-1.5 bg-accent/20 border border-accent/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-accent" />
                      <span className="text-xs text-accent font-medium truncate max-w-[100px]">
                        {selectedCustomer.name}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch('');
                      }}
                      className="text-text-muted hover:text-white flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomer(null);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Customer"
                    className="w-full px-2 py-1.5 bg-background-secondary border border-white/10 rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                )}
                {mobileView !== 'cart' && showCustomerDropdown && !selectedCustomer && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background-card border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {(filteredCustomers && filteredCustomers.length > 0) ? (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch('');
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-accent/10 flex items-center justify-between"
                        >
                          <span className="text-text-primary">{c.name || 'Unknown'}</span>
                          {c.loyalty_discount > 0 && <span className="text-accent">🎁</span>}
                        </button>
                      ))
                    ) : customerSearch.length > 0 ? (
                      <div className="p-3 text-xs text-text-muted text-center">
                        No customers found
                      </div>
                    ) : null}
                    <button
                      onClick={() => {
                        setShowCustomerDropdown(false);
                        setShowQuickAddCustomer(true);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-accent hover:bg-accent/10 border-t border-white/10 flex items-center gap-2"
                    >
                      <span className="text-base">+</span> Add New Customer
                    </button>
                  </div>
                )}
              </div>
            </div>
            {selectedCustomer && selectedCustomer.loyalty_discount > 0 && (
              <div className="mt-1 text-xs text-accent">
                {selectedCustomer.loyalty_discount}% Loyalty Discount applied
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto p-2 lg:p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-6 text-text-muted">
                <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No items in order</p>
                <p className="text-xs">Select from menu</p>
              </div>
            ) : (
              cart.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-2 lg:p-2.5 rounded-lg border ${
                    item.isKot 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-background-secondary border-accent/20'
                  }`}
                  onDoubleClick={() => {
                    if (item.isKot) {
                      setEditingKotId(item.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <p className="font-medium text-xs lg:text-sm truncate">{item.productName}</p>
                      {item.isKot && (
                        <span className="inline-flex items-center text-[9px] lg:text-[10px] px-1 py-0.5 rounded bg-warning/20 text-warning whitespace-nowrap">
                          KOT
                        </span>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-1 lg:gap-2">
                      <p className="font-mono text-accent font-semibold text-xs lg:text-sm">
                        {formatCurrency(item.total)}
                      </p>
                      {item.isKot ? (
                        editingKotId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={(el) => { quantityInputRef.current[item.id] = el; }}
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1;
                                setCart(prev => prev.map(cartItem => {
                                  if (cartItem.id === item.id) {
                                    return {
                                      ...cartItem,
                                      quantity: Math.max(1, newQty),
                                      total: Math.max(1, newQty) * (cartItem.unitPrice + cartItem.taxAmount),
                                      // Mark as new when quantity increased on KOT items (for additional KOT)
                                      isNew: newQty > item.quantity ? true : cartItem.isNew,
                                    };
                                  }
                                  return cartItem;
                                }));
                              }}
                              className="w-10 lg:w-12 text-center bg-transparent border border-white/20 rounded px-1 py-0.5 text-xs lg:text-sm focus:border-accent focus:outline-none"
                            />
                            <button
                              onClick={() => setEditingKotId(null)}
                              className="p-1 rounded hover:bg-success/20 text-success"
                            >
                              <Check className="w-3 lg:w-4 h-3 lg:h-4" />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 rounded hover:bg-error/20 text-error"
                            >
                              <Trash2 className="w-3 lg:w-4 h-3 lg:h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingKotId(item.id)}
                            className="p-1 rounded hover:bg-white/10 text-text-muted"
                          >
                            <Edit3 className="w-3 lg:w-4 h-3 lg:h-4" />
                          </button>
                        )
                      ) : (
                        <div className="flex items-center gap-0.5 lg:gap-1">
                          {item.quantity === 1 ? (
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 rounded hover:bg-error/20 text-error"
                            >
                              <Trash2 className="w-3 lg:w-4 h-3 lg:h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 rounded hover:bg-white/10"
                            >
                              <Minus className="w-3 lg:w-4 h-3 lg:h-4" />
                            </button>
                          )}
                          <span className="w-4 lg:w-6 text-center text-xs lg:text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 rounded hover:bg-white/10"
                          >
                            <Plus className="w-3 lg:w-4 h-3 lg:h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] lg:text-xs text-text-muted mt-0.5">
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                    {item.taxRate > 0 && ` + ${item.taxRate}%`}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-3 lg:p-4 border-t border-white/10 space-y-3">
            {/* Mobile: Compact total display */}
            <div className="lg:hidden flex items-center justify-between">
              <span className="text-text-secondary text-sm">Total</span>
              <span className="text-xl font-bold text-accent">{formatCurrency(total)}</span>
            </div>

            {/* Mobile: Action Buttons - shown only in Cart view */}
            <div className="lg:hidden grid grid-cols-3 gap-2" style={{ display: showMobileCart ? 'grid' : 'none' }}>
              {billGenerated ? (
                <>
                  <Button
                    variant="success"
                    size="md"
                    onClick={() => setShowCollectModal(true)}
                    className="flex items-center justify-center gap-1 h-10 text-xs font-medium"
                  >
                    <span>COLLECT</span>
                  </Button>
                  <Button
                    variant="warning"
                    size="md"
                    onClick={() => setShowPushModal(true)}
                    className="flex items-center justify-center gap-1 h-10 text-xs font-medium"
                  >
                    <span>PUSH</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleKOT}
                    disabled={cart.filter(i => i.isNew).length === 0}
                    className="flex items-center justify-center gap-1 h-10 text-xs font-medium"
                  >
                    <Printer className="w-3 h-3" />
                    <span>KOT</span>
                  </Button>
                  <Button
                    variant="accent"
                    size="md"
                    onClick={handleBill}
                    disabled={cart.length === 0}
                    className="flex items-center justify-center gap-1 h-10 text-xs font-medium"
                  >
                    <Receipt className="w-3 h-3" />
                    <span>Bill</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      if (appliedCoupon) {
                        toast('warning', 'Remove coupon first');
                        return;
                      }
                      setShowDiscountModal(true);
                    }}
                    disabled={cart.length === 0 || !!appliedCoupon}
                    className="flex items-center justify-center gap-1 h-10 text-xs font-medium"
                  >
                    <Percent className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      if (discountValue > 0) {
                        toast('warning', 'Discount applied');
                        return;
                      }
                      setShowCouponModal(true);
                    }}
                    disabled={cart.length === 0 || discountValue > 0}
                    className="flex items-center justify-center gap-1 h-10 text-xs font-medium"
                  >
                    <Ticket className="w-3 h-3" />
                  </Button>
                  {cart.some(item => item.isKot) && (
                    <Button
                      variant="outline"
                      size="md"
                      onClick={async () => {
                        if (!confirm('Are you sure you want to cancel KOT?')) {
                          return;
                        }
                        try {
                          if (currentOrderId) {
                            await api.deleteOrder(currentOrderId);
                          }
                          if (selectedTable) {
                            // Cart state managed on server
                            await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
                            if (selectedSection) {
                              store.fetchTables(selectedSection);
                            }
                          }
                          setCart([]);
                          setCurrentOrderId(null);
                          setDiscountAmount('');
                          setDiscountReason('');
                          setAppliedCoupon(null);
                          toast('success', 'KOT cancelled, table is now available');
                        } catch (error) {
                          toast('error', 'Failed to cancel KOT');
                        }
                      }}
                      className="flex items-center justify-center gap-1 h-10 text-xs font-medium text-orange-400"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Desktop: Full breakdown */}
            <div className="hidden lg:block space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">GST/VAT</span>
                <span className="font-mono text-info">{formatCurrency(taxAmount)}</span>
              </div>
              {couponDiscountValue > 0 && (
                <div className="flex justify-between text-success">
                  <span>Coupon ({appliedCoupon?.code})</span>
                  <span className="font-mono">-{formatCurrency(couponDiscountValue)}</span>
                </div>
              )}
              {loyaltyDiscountValue > 0 && (
                <div className="flex justify-between text-accent">
                  <span>Loyalty ({selectedCustomer?.name})</span>
                  <span className="font-mono">-{formatCurrency(loyaltyDiscountValue)}</span>
                </div>
              )}
              {discountValue > 0 && (
                <div className="flex justify-between text-success">
                  <span>Disc. ({discountReason})</span>
                  <span className="font-mono">-{formatCurrency(discountValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                <span>Total</span>
                <span className="font-mono text-accent">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Action Buttons - Mobile friendly, hidden on mobile, show in cart area */}
            <div className="hidden lg:grid lg:grid-cols-3 gap-2">
              {billGenerated ? (
                <>
                  <Button
                    variant="success"
                    size="md"
                    onClick={() => setShowCollectModal(true)}
                    className="flex items-center justify-center gap-2 h-12 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>COLLECT</span>
                  </Button>
                  <Button
                    variant="warning"
                    size="md"
                    onClick={() => setShowPushModal(true)}
                    className="flex items-center justify-center gap-2 h-12 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <span>PUSH</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleKOT}
                    disabled={cart.filter(i => i.isNew).length === 0}
                    className="flex items-center justify-center gap-2 h-12 text-sm font-medium"
                  >
                    <Printer className="w-4 h-4" />
                    <span>KOT</span>
                  </Button>
                  <Button
                    variant="accent"
                    size="md"
                    onClick={handleBill}
                    disabled={cart.length === 0}
                    className="flex items-center justify-center gap-2 h-12 text-sm font-medium"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Bill</span>
                  </Button>
                </>
              )}
              
              {/* Mobile Action Buttons */}
              <div className="flex lg:hidden gap-2 w-full">
                <button
                  onClick={() => setShowDiscountModal(true)}
                  disabled={cart.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <Percent className="w-4 h-4 text-accent" />
                  <span>Discount</span>
                </button>
                <button
                  onClick={() => setShowCouponModal(true)}
                  disabled={cart.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <Ticket className="w-4 h-4 text-green-400" />
                  <span>Coupon</span>
                </button>
                <button
                  onClick={() => {
                    if (!confirm('Clear cart?')) return;
                    if (currentOrderId) api.deleteOrder(currentOrderId);
                    setCart([]); setCurrentOrderId(null);
                    toast('success', 'Cart cleared');
                  }}
                  disabled={cart.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 text-sm text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              </div>

              {/* Desktop Action Buttons */}
              <div className="hidden lg:flex gap-2 w-full">
                {/* Apply Discount */}
                <button
                  onClick={() => {
                    if (appliedCoupon) {
                      toast('warning', 'Remove coupon first');
                      return;
                    }
                    setShowDiscountModal(true);
                  }}
                  disabled={cart.length === 0 || !!appliedCoupon}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Percent className="w-4 h-4 text-accent" />
                  <span>Discount</span>
                </button>
                
                {/* Apply Coupon */}
                <button
                  onClick={() => {
                    if (discountValue > 0) {
                      toast('warning', 'Discount applied');
                      return;
                    }
                    setShowCouponModal(true);
                  }}
                  disabled={cart.length === 0 || discountValue > 0}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Ticket className="w-4 h-4 text-green-400" />
                  <span>Coupon</span>
                </button>
                
                {/* Clear KOT / Clear Cart */}
                <button
                  onClick={async () => {
                    const hasKot = cart.some(item => item.isKot);
                    const action = hasKot ? 'cancel KOT' : 'clear cart';
                    if (!confirm(`Are you sure you want to ${action}? This will free the table.`)) {
                      return;
                    }
                    
                    try {
                      if (currentOrderId) {
                        await api.deleteOrder(currentOrderId);
                      }
                      
                      if (selectedTable) {
                        // Cart state managed on server
                        
                        await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
                        if (selectedSection) {
                          store.fetchTables(selectedSection);
                        }
                      }
                      
                      setCart([]);
                      setCurrentOrderId(null);
                      setDiscountAmount('');
                      setDiscountReason('');
                      setAppliedCoupon(null);
                      
                      toast('success', `KOT cancelled, table is now free`);
                    } catch (error) {
                      console.error('Error clearing:', error);
                      toast('error', `Failed to ${action}`);
                    }
                  }}
                  disabled={cart.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{cart.some(item => item.isKot) ? 'Clear KOT' : 'Clear Cart'}</span>
                </button>
              </div>
              
              {/* Mobile More Dropdown */}
              <div className="lg:hidden relative z-10">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                  className="w-full flex items-center justify-center gap-2 h-12 text-sm font-medium"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">More</span>
                </Button>
                {/* Dropdown - opens upwards */}
                {showMoreDropdown && (
                  <div 
                    className="absolute bottom-full left-0 mb-1 z-50 more-dropdown"
                  >
                    <div 
                      className="bg-background-card border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]"
                    >
                      <button
                        onClick={() => {
                          if (appliedCoupon) {
                            toast('warning', 'Remove coupon first');
                            return;
                          }
                          setShowDiscountModal(true);
                          setShowMoreDropdown(false);
                        }}
                        disabled={cart.length === 0 || !!appliedCoupon}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <Percent className="w-3 h-3" />
                        <span>Discount</span>
                      </button>
                      <button
                        onClick={() => {
                          if (discountValue > 0) {
                            toast('warning', 'Discount applied');
                            return;
                          }
                          setShowCouponModal(true);
                          setShowMoreDropdown(false);
                        }}
                        disabled={cart.length === 0 || discountValue > 0}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <Ticket className="w-3 h-3" />
                        <span>Coupon</span>
                      </button>
                      {/* Cancel KOT - only show when KOT items exist */}
                      {cart.some(item => item.isKot) && (
                        <button
                          onClick={async () => {
                            if (!confirm('Are you sure you want to cancel KOT? This will clear all items and free the table.')) {
                              setShowMoreDropdown(false);
                              return;
                            }
                            
                            try {
                              // Delete the current order if exists
                              if (currentOrderId) {
                                await api.deleteOrder(currentOrderId);
                              }
                              
                              // Clear saved cart and update table status
                              if (selectedTable) {
                                // Cart state managed on server
                                
                                await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
                                if (selectedSection) {
                                  store.fetchTables(selectedSection);
                                }
                              }
                              
                              // Clear all cart items
                              setCart([]);
                              setCurrentOrderId(null);
                              setDiscountAmount('');
                              setDiscountReason('');
                              setAppliedCoupon(null);
                              
                              setShowMoreDropdown(false);
                              toast('success', 'KOT cancelled, table is now free');
                            } catch (error) {
                              console.error('Error cancelling KOT:', error);
                              toast('error', 'Failed to cancel KOT');
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors text-orange-400"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel KOT</span>
                        </button>
                      )}
                      {/* Clear Cart - only show when no KOT items */}
                      {!cart.some(item => item.isKot) && (
                        <button
                          onClick={async () => {
                            try {
                              // Delete order from backend if exists
                              if (currentOrderId) {
                                await api.deleteOrder(currentOrderId);
                              }
                              
                              // Clear saved cart
                              if (selectedTable) {
                                // Cart state managed on server
                                
                                // Update table status to available
                                await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
                                if (selectedSection) {
                                  store.fetchTables(selectedSection);
                                }
                              }
                              
                              setCart([]);
                              setCurrentOrderId(null);
                              setDiscountAmount('');
                              setDiscountReason('');
                              setAppliedCoupon(null);
                              setShowMoreDropdown(false);
                              toast('success', 'Cart cleared, table is now available');
                            } catch (error) {
                              console.error('Error clearing cart:', error);
                              toast('error', 'Failed to clear cart');
                            }
                          }}
                          disabled={cart.length === 0}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors disabled:opacity-50 text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear Cart</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Applied Coupon Display - Mobile friendly */}
            {appliedCoupon && (
              <div className="p-2 bg-success/10 border border-success/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-success" />
                  <span className="text-xs text-success font-medium">{appliedCoupon.code}</span>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="text-error hover:text-error/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Product Selection - Desktop only */}
        <div className="hidden lg:flex flex-col">
          {/* Table Tiles - Always show all tables */}
          <div className="mb-3 lg:mb-4">
            <h3 className="text-xs lg:text-sm font-medium text-text-secondary mb-2">Tables</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1">
              {tables.map((table) => {
                // Determine status based on actual table status (including legacy values)
                const isAvailable = table.status === 'available';
                const isActiveKot = table.status === 'active_kot' || table.status === 'occupied' || table.status === 'active';
                const isPendingBilling = table.status === 'pending_billing' || table.status === 'billing' || table.status === 'pending_printing';
                const isPendingCleaning = table.status === 'pending_cleaning';
                
                // Get custom colors from settings or use defaults
                const customColors = store.settings?.tableStatusColors || {};
                
                // Default colors mapping - follows the flow: Available → KOT - In Progress → Pending Billing → Pending Cleaning → Available
                const colorMap: Record<string, { dot: string; bg: string; label: string }> = {
                  available: { dot: customColors.available?.bg || 'bg-success', bg: 'border-success/30 bg-success/5 hover:border-success', label: customColors.available?.label || 'Available' },
                  active_kot: { dot: customColors.active_kot?.bg || 'bg-orange-500', bg: 'border-orange-500/50 bg-orange-500/20 hover:border-orange-500', label: customColors.active_kot?.label || 'KOT - In Progress' },
                  pending_billing: { dot: customColors.pending_billing?.bg || 'bg-red-500', bg: 'border-red-500/50 bg-red-500/20 hover:border-red-500', label: customColors.pending_billing?.label || 'Pending Billing' },
                  pending_cleaning: { dot: customColors.pending_cleaning?.bg || 'bg-gray-500', bg: 'border-gray-500/50 bg-gray-500/20 hover:border-gray-500 cursor-pointer', label: customColors.pending_cleaning?.label || 'Pending Cleaning' },
                };
                
                let statusColor = colorMap.available.dot;
                let statusBgClass = colorMap.available.bg;
                let statusLabel = colorMap.available.label;
                
                if (isPendingCleaning) {
                  statusColor = colorMap.pending_cleaning.dot;
                  statusBgClass = colorMap.pending_cleaning.bg;
                  statusLabel = colorMap.pending_cleaning.label;
                } else if (isPendingBilling) {
                  statusColor = colorMap.pending_billing.dot;
                  statusBgClass = colorMap.pending_billing.bg;
                  statusLabel = colorMap.pending_billing.label;
                } else if (isActiveKot) {
                  statusColor = colorMap.active_kot.dot;
                  statusBgClass = colorMap.active_kot.bg;
                  statusLabel = colorMap.active_kot.label;
                }
                
                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableSelect(table)}
                    className={`h-12 lg:h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-all hover:scale-105 relative px-1 ${statusBgClass}`}
                  >
                    <span className="text-sm lg:text-lg font-bold leading-tight">{table.number}</span>
                    <span className="text-[6px] lg:text-[7px] text-text-muted">{table.capacity}</span>
                    <span className={`absolute bottom-0.5 w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full ${statusColor}`} />
                  </button>
                );
              })}
            </div>
            {/* Legend - Desktop only */}
            <div className="hidden lg:flex flex-wrap gap-3 lg:gap-4 mt-2 lg:mt-3 text-[10px] lg:text-xs text-text-muted">
              {(() => {
                const customColors = store.settings?.tableStatusColors || {};
                return (
                  <>
                    {customColors.available?.label ? (
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full ${customColors.available.bg || 'bg-success'}`}></span>
                        <span>{customColors.available.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-success"></span>
                        <span>Available</span>
                      </div>
                    )}
                    {customColors.active?.label ? (
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full ${customColors.active_kot.bg || 'bg-accent'}`}></span>
                        <span>{customColors.active.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-accent"></span>
                        <span>KOT - In Progress</span>
                      </div>
                    )}
                    {customColors.occupied?.label ? (
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full ${customColors.pending_billing.bg || 'bg-red-500'}`}></span>
                        <span>{customColors.occupied.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-red-500"></span>
                        <span>Occupied - Billing</span>
                      </div>
                    )}
                    {customColors.pending_cleaning?.label ? (
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full ${customColors.pending_cleaning.bg || 'bg-gray-500'}`}></span>
                        <span>{customColors.pending_cleaning.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-gray-500"></span>
                        <span>Cleaning - Pending</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Search Input - Sticky on mobile to stay above keyboard */}
          <div className="mb-2 lg:mb-4 sticky top-0 z-20 bg-background-primary lg:static lg:z-auto lg:bg-transparent px-0 lg:p-0 py-2 lg:py-0">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 lg:px-4 py-1.5 lg:py-2 bg-background-secondary lg:bg-background-tertiary border border-white/10 rounded-lg text-xs lg:text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            {searchQuery.trim() && (
              <div className="mt-1 text-[10px] lg:text-xs text-text-muted">
                {filteredProducts.length} item{filteredProducts.length !== 1 ? 's' : ''} found
              </div>
            )}
          </div>

          {/* Category Pills - Scrollable */}
          <div className="flex gap-1.5 lg:gap-2 mb-2 lg:mb-4 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => { setSelectedCategory(''); setSearchQuery(''); }}
              className={`px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-full text-[10px] lg:text-sm font-medium whitespace-nowrap transition-all ${
                !selectedCategory && !searchQuery.trim()
                  ? 'bg-accent text-background-primary'
                  : 'bg-background-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            {activeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSearchQuery(''); }}
                className={`px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-full text-[10px] lg:text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id && !searchQuery.trim()
                    ? 'bg-accent text-background-primary'
                    : 'bg-background-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid - Mobile friendly grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 lg:gap-2">
              {filteredProducts.map((product) => {
                const displayPrice = (selectedSection && product.sectionPrices?.length > 0)
                  ? (product.sectionPrices.find(sp => sp.sectionId === selectedSection)?.price || product.sellingPrice)
                  : product.sellingPrice;
                
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-2 lg:p-3 rounded-lg bg-background-secondary border border-white/10 hover:border-accent/50 hover:bg-accent/5 transition-all text-center"
                  >
                    <div className="w-8 lg:w-10 h-8 lg:h-10 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 mx-auto mb-1 lg:mb-2 flex items-center justify-center">
                      <span className="text-sm lg:text-base">🍽️</span>
                    </div>
                    <p className="font-medium text-[10px] lg:text-xs truncate px-1">{product.name}</p>
                    <p className="font-mono text-accent font-semibold text-[10px] lg:text-xs mt-0.5 lg:mt-1">
                      {formatCurrency(parseFloat(displayPrice))}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Floating Cart Button (when in menu view) */}
      <div className="lg:hidden fixed bottom-4 right-4 z-30">
        <button
          onClick={() => { setMobileView('cart'); setShowMobileCart(true); }}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            cart.length > 0 
              ? 'bg-accent text-background-primary' 
              : 'bg-background-secondary text-text-muted'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-error text-white rounded-full text-xs flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile: Cart Action Buttons - shown in cart area below totals */}
      {/* This is a placeholder - buttons are now in the cart panel when mobileView='cart' */}

      {/* Discount Modal */}
      <Modal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        title="Apply Discount"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setDiscountType('percentage')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                discountType === 'percentage'
                  ? 'bg-accent text-background-primary'
                  : 'bg-background-secondary text-text-secondary'
              }`}
            >
              Percentage
            </button>
            <button
              onClick={() => setDiscountType('fixed')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                discountType === 'fixed'
                  ? 'bg-accent text-background-primary'
                  : 'bg-background-secondary text-text-secondary'
              }`}
            >
              Fixed Amount
            </button>
          </div>

          <Input
            label={discountType === 'percentage' ? 'Discount %' : 'Discount Amount (₹)'}
            type="number"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            placeholder={discountType === 'percentage' ? '10' : '100'}
          />

          <Select
            label="Reason"
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            options={[
              { value: 'Birthday', label: 'Birthday' },
              { value: 'Corporate', label: 'Corporate' },
              { value: 'Festival', label: 'Festival' },
              { value: 'Other', label: 'Other' },
            ]}
            placeholder="Select reason"
          />

          {discountAmount && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
              <p className="text-sm text-text-secondary">Discount Amount:</p>
              <p className="text-xl font-mono font-bold text-accent">
                {formatCurrency(discountValue)}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowDiscountModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={handleApplyDiscount}
            >
              Apply Discount
            </Button>
          </div>
        </div>
      </Modal>

      {/* Coupon Modal */}
      <Modal
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        title="Apply Coupon"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Coupon Code"
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code (e.g., SAVE10)"
          />

          {couponCode && (
            (() => {
              const coupons = settings?.coupons || [];
              const coupon = coupons.find((c: any) => c.code.toUpperCase() === couponCode.toUpperCase());
              if (!coupon) {
                return (
                  <div className="p-3 rounded-lg bg-error/10 border border-error/20">
                    <p className="text-sm text-error">Invalid coupon code</p>
                  </div>
                );
              }
              const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
              const isOutOfStock = coupon.stock !== undefined && coupon.stock <= 0;
              return (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="font-medium text-success">{coupon.description || coupon.code}</p>
                  <p className="text-sm text-text-secondary mt-1">{coupon.discountValue}% off</p>
                  {coupon.expiryDate && (
                    <p className="text-xs text-text-muted mt-1">
                      Expires: {new Date(coupon.expiryDate).toLocaleDateString()}
                    </p>
                  )}
                  {coupon.stock !== undefined && (
                    <p className="text-xs text-text-muted">
                      Stock: {coupon.stock} remaining
                    </p>
                  )}
                  {isExpired && (
                    <p className="text-sm text-error mt-2">⚠️ Coupon has expired</p>
                  )}
                  {isOutOfStock && (
                    <p className="text-sm text-error mt-2">⚠️ Coupon out of stock</p>
                  )}
                </div>
              );
            })()
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setShowCouponModal(false);
                setCouponCode('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={handleApplyCoupon}
            >
              Apply Coupon
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pending Cleaning Confirmation Modal */}
      <Modal
        isOpen={showPendingCleaningModal}
        onClose={() => setShowPendingCleaningModal(false)}
        title="Pending Cleaning"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-orange-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-text-primary font-medium mb-2">
              Table {pendingCleaningTable?.number} is pending cleaning.
            </p>
            <p className="text-sm text-text-muted">
              Do you want to still start billing? The table will be marked as available.
            </p>
          </div>

          {/* Busser Selection */}
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Notify Busser (optional)
            </label>
            <select
              value={selectedBusser}
              onChange={(e) => setSelectedBusser(e.target.value)}
              className="w-full px-3 py-2 bg-background-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">All Bussers</option>
              {waiters
                .filter((w: any) => w.role === 'busser')
                .map((busser: any) => (
                  <option key={busser.id} value={busser.id}>
                    {busser.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                // Send notification to bussers
                if (pendingCleaningTable) {
                  api.post('/busser/notify', {
                    tableId: pendingCleaningTable.id,
                    tableNumber: pendingCleaningTable.number,
                    message: `Table ${pendingCleaningTable.number} needs cleaning immediately!`,
                    busserId: selectedBusser || undefined // undefined = all bussers
                  }).then(() => {
                    const target = selectedBusser 
                      ? `Busser ${waiters.find((w: any) => w.id === selectedBusser)?.name}` 
                      : 'all bussers';
                    toast('info', `Notification sent to ${target} for Table ${pendingCleaningTable.number}`);
                  }).catch(() => {
                    toast('error', 'Failed to send notification');
                  });
                }
                setShowPendingCleaningModal(false);
              }}
            >
              Notify
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={() => {
                setSelectedBusser(''); // Reset selection
                handleConfirmPendingCleaning();
              }}
            >
              OK
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Add Customer Modal */}
      <Modal
        isOpen={showQuickAddCustomer}
        onClose={() => {
          setShowQuickAddCustomer(false);
          setQuickCustomerName('');
          setQuickCustomerPhone('');
        }}
        title="Add New Customer"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Customer Name *</label>
            <input
              type="text"
              value={quickCustomerName}
              onChange={(e) => setQuickCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-3 py-2 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Phone Number</label>
            <input
              type="tel"
              value={quickCustomerPhone}
              onChange={(e) => setQuickCustomerPhone(e.target.value)}
              placeholder="Enter phone number"
              className="w-full px-3 py-2 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={async () => {
                if (!quickCustomerName.trim()) {
                  toast('error', 'Customer name is required');
                  return;
                }
                setIsAddingCustomer(true);
                const response = await api.createCustomer({
                  name: quickCustomerName.trim(),
                  phone: quickCustomerPhone.trim() || undefined,
                });
                setIsAddingCustomer(false);
                
                if (response.success) {
                  const newCustomer = response.data?.data || response.data;
                  if (newCustomer) {
                    setCustomers([...customers, newCustomer]);
                    setSelectedCustomer(newCustomer);
                  }
                  toast('success', 'Customer added successfully');
                  setShowQuickAddCustomer(false);
                  setQuickCustomerName('');
                  setQuickCustomerPhone('');
                } else {
                  toast('error', 'Failed to add customer');
                }
              }}
              loading={isAddingCustomer}
              disabled={!quickCustomerName.trim()}
            >
              Add Customer
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowQuickAddCustomer(false);
                setQuickCustomerName('');
                setQuickCustomerPhone('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Switch Table Modal */}
      <Modal
        isOpen={showSwitchTableModal}
        onClose={() => { setShowSwitchTableModal(false); setSelectedSwitchTable(null); }}
        title="Switch Table"
        size="md"
      >
        <div>
          {/* Section Filter Chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSwitchTableSectionFilter(null); setSelectedSwitchTable(null); }}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                switchTableSectionFilter === null
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white/5 text-text-secondary border-white/20 hover:border-accent/50'
              }`}
            >
              All
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => { setSwitchTableSectionFilter(section.id); setSelectedSwitchTable(null); }}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  switchTableSectionFilter === section.id
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white/5 text-text-secondary border-white/20 hover:border-accent/50'
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>

          {/* Table Selection Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-48 sm:max-h-64 overflow-y-auto">
            {tables
              .filter(table => table.id !== selectedTable?.id)
              .filter(table => !switchTableSectionFilter || table.sectionId === switchTableSectionFilter)
              .filter(table => table.status === 'available')
              .map((table) => {
                const isSelected = selectedSwitchTable?.id === table.id;
                return (
                  <button
                    key={table.id}
                    onClick={() => setSelectedSwitchTable(isSelected ? null : table)}
                    className={`p-2 sm:p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10 ring-2 ring-accent'
                        : 'border-success/30 bg-success/5 hover:border-success hover:bg-success/10'
                    }`}
                  >
                    <span className="text-sm font-bold">{table.number}</span>
                    <span className="text-[10px] text-text-muted">{table.capacity} pax</span>
                  </button>
                );
              })}
          </div>

          {tables.filter(t => t.id !== selectedTable?.id && t.status === 'available' && (!switchTableSectionFilter || t.sectionId === switchTableSectionFilter)).length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">
              No available tables to switch to.
            </p>
          )}

          {/* Selected Table Info */}
          <div className="text-sm text-text-secondary text-center">
            {selectedSwitchTable ? (
              <>Selected: <span className="text-accent font-medium">Table {selectedSwitchTable.number}</span></>
            ) : (
              <>Tap a table to select, then tap OK</>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => { setShowSwitchTableModal(false); setSelectedSwitchTable(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!selectedSwitchTable}
              onClick={async () => {
                if (!selectedSwitchTable || !selectedTable) return;
                try {
                  if (currentOrderId) {
                    const updateResponse = await api.put(`/orders/${currentOrderId}/table`, { tableId: selectedSwitchTable.id });
                    if (!updateResponse.success) {
                      toast('error', updateResponse.error || 'Failed to move items');
                      return;
                    }
                  } else if (cart.length > 0) {
                    const cleanItems = cart.map(item => ({
                      productId: item.productId, productName: item.productName, quantity: item.quantity,
                      unitPrice: item.unitPrice, taxRate: item.taxRate, taxAmount: item.taxAmount,
                      total: item.total, isKot: item.isKot || false
                    }));
                    const createResponse = await api.createOrder({
                      tableId: selectedSwitchTable.id, items: cleanItems,
                      waiterId: selectedWaiter || undefined, customerId: selectedCustomer?.id
                    });
                    if (!createResponse.success) {
                      toast('error', createResponse.error || 'Failed to move items');
                      return;
                    }
                    setCurrentOrderId(createResponse.data?.id);
                  }
                  await api.put(`/tables/${selectedTable.id}`, { status: 'available' });
                  store.fetchTables(selectedSection || undefined);
                  setSelectedTable({ ...selectedSwitchTable, status: 'occupied' as const });
                  setSelectedSwitchTable(null);
                  setShowSwitchTableModal(false);
                  toast('success', `Moved to Table ${selectedSwitchTable.number}`);
                } catch (error) {
                  console.error('Error switching table:', error);
                  toast('error', 'Failed to switch table');
                }
              }}
            >
              OK
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mobile: All Tables Modal */}
      <Modal
        isOpen={showAllTablesModal}
        onClose={() => setShowAllTablesModal(false)}
        title="Select Table"
        size="md"
      >
        <div>
          <p className="text-sm text-text-secondary mb-3">
            {selectedTable ? `Currently at Table ${selectedTable.number}` : 'No table selected'}
          </p>
          
          {/* Section Filter Chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAllTablesSectionFilter(null)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                allTablesSectionFilter === null
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white/5 text-text-secondary border-white/20 hover:border-accent/50'
              }`}
            >
              All
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setAllTablesSectionFilter(section.id)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  allTablesSectionFilter === section.id
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white/5 text-text-secondary border-white/20 hover:border-accent/50'
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-80 overflow-y-auto">
            {tables
              .filter(table => !allTablesSectionFilter || table.sectionId === allTablesSectionFilter)
              .map((table) => {
              // Determine status based on actual table status (including legacy values)
              const isAvailable = table.status === 'available';
              const isActiveKot = table.status === 'active_kot' || table.status === 'occupied' || table.status === 'active';
              const isPendingBilling = table.status === 'pending_billing' || table.status === 'billing' || table.status === 'pending_printing';
              const isPendingCleaning = table.status === 'pending_cleaning';
              
              // Get custom colors from settings or use defaults
              const customColors = store.settings?.tableStatusColors || {};
              
              // Default colors mapping - follows the flow: Available → KOT - In Progress → Pending Billing → Pending Cleaning → Available
              const colorMap: Record<string, { dot: string; label: string; bg: string }> = {
                available: { dot: customColors.available?.bg || 'text-success', label: customColors.available?.label || 'Available', bg: 'bg-success/5' },
                active_kot: { dot: customColors.active_kot?.bg || 'text-orange-500', label: customColors.active_kot?.label || 'KOT', bg: 'bg-orange-500/10' },
                pending_billing: { dot: customColors.pending_billing?.bg || 'text-red-500', label: customColors.pending_billing?.label || 'Billing', bg: 'bg-red-500/10' },
                pending_cleaning: { dot: customColors.pending_cleaning?.bg || 'text-gray-400', label: customColors.pending_cleaning?.label || 'Cleaning', bg: 'bg-gray-500/10' },
              };
              
              let statusDot = colorMap.available.dot;
              let statusLabel = colorMap.available.label;
              let statusBg = colorMap.available.bg;
              
              if (isPendingCleaning) {
                statusDot = colorMap.pending_cleaning.dot;
                statusLabel = colorMap.pending_cleaning.label;
                statusBg = colorMap.pending_cleaning.bg;
              } else if (isPendingBilling) {
                statusDot = colorMap.pending_billing.dot;
                statusLabel = colorMap.pending_billing.label;
                statusBg = colorMap.pending_billing.bg;
              } else if (isActiveKot) {
                statusDot = colorMap.active_kot.dot;
                statusLabel = colorMap.active_kot.label;
                statusBg = colorMap.active_kot.bg;
              }
              
              return (
                <button
                  key={table.id}
                  disabled={isPendingCleaning}
                  onClick={async () => {
                    // If same table, just close
                    if (selectedTable?.id === table.id) {
                      setShowAllTablesModal(false);
                      return;
                    }
                    
                    try {
                      // Handle cart items when switching tables
                      if (selectedTable && cart.length > 0) {
                        // Save current cart before switching
                        const currentTableId = selectedTable.id;
                        
                        // Check if target table has an existing order
                        const existingOrder = await api.getOrderByTable(table.id);
                        
                        if (existingOrder.success && existingOrder.data) {
                          // Target table has an order - merge or confirm
                          const existingItems = existingOrder.data.items || [];
                          if (existingItems.length > 0) {
                            // Merge items into existing order
                            const mergedItems = [...existingItems, ...cart];
                            await api.put(`/orders/${existingOrder.data.id}`, { items: mergedItems });
                            toast('success', `Items merged with Table ${table.number}`);
                          } else {
                            // Empty order, just update table
                            await api.put(`/orders/${existingOrder.data.id}`, { tableId: table.id });
                            toast('success', `Moved to Table ${table.number}`);
                          }
                        } else {
                          // No existing order - create new order for target table
                          const cleanItems = cart.map(item => ({
                            productId: item.productId,
                            productName: item.productName,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            taxRate: item.taxRate,
                            taxAmount: item.taxAmount,
                            total: item.total,
                            isKot: item.isKot || false
                          }));
                          const orderData = {
                            tableId: table.id,
                            items: cleanItems,
                            waiterId: selectedWaiter || undefined,
                            customerId: selectedCustomer?.id
                          };
                          const createResponse = await api.createOrder(orderData);
                          if (!createResponse.success) {
                            toast('error', createResponse.error || 'Failed to switch table');
                            return;
                          }
                          setCurrentOrderId(createResponse.data?.id);
                          toast('success', `Moved to Table ${table.number}`);
                        }
                        
                        // Cart state managed on server
                        
                        // Update old table status
                        await api.put(`/tables/${currentTableId}`, { status: 'available' });
                      }
                      
                      // Update table status for new table
                      const newStatus = table.status === 'available' ? 'active_kot' : table.status;
                      await api.put(`/tables/${table.id}`, { status: newStatus });
                      
                      // Refresh tables list
                      store.fetchTables(selectedSection || undefined);
                      
                      // Update local state
                      setSelectedTable({ ...table, status: newStatus as any });
                      setShowAllTablesModal(false);
                      
                      // Clear cart if this was an available table
                      if (table.status === 'available') {
                        setCart([]);
                        setCurrentOrderId(null);
                      } else {
                        // Fetch existing order for this table
                        const orderResponse = await api.getOrderByTable(table.id);
                        if (orderResponse.success && orderResponse.data) {
                          const existingOrder = orderResponse.data;
                          setCurrentOrderId(existingOrder.id);
                          // Load existing items into cart
                          const newCartItems: CartItem[] = existingOrder.items.map((item: any) => ({
                            ...item,
                            id: item.id || uuidv4(),
                          }));
                          setCart(newCartItems);
                        }
                      }
                    } catch (error) {
                      console.error('Error selecting table:', error);
                      toast('error', 'Failed to select table');
                    }
                  }}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                    selectedTable?.id === table.id
                      ? 'border-accent bg-accent/20'
                      : isAvailable 
                        ? 'border-success/30 bg-success/5 hover:border-success hover:bg-success/10 cursor-pointer' 
                        : isPendingCleaning
                          ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                          : 'border-orange-500/30 bg-orange-500/10 cursor-pointer'
                  }`}
                >
                  <span className="text-sm font-bold">{table.number}</span>
                  <span className="text-[10px] text-text-muted">{table.capacity} pax</span>
                  <span className={`text-[10px] ${statusDot}`}>{statusLabel}</span>
                </button>
              );
            })}
          </div>
          
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowAllTablesModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      {showPreviewModal && previewContent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-background-primary rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">
                {previewContent.type === 'kot' ? 'KOT Preview' : 'Bill Preview'}
              </h2>
              <button 
                onClick={handlePreviewCancel}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* KOT Preview - Thermal printer size 80mm (280px) */}
              <div className="bg-white text-black p-3 rounded font-mono text-xs mx-auto" style={{ width: '280px', maxWidth: '280px' }}>
                {/* Header */}
                <div className="text-center border-b border-black pb-2 mb-2">
                  {previewContent.type === 'bill' && settings?.bill_setup?.showRestaurantName && (
                    <p className="font-bold text-base">{settings.restaurant?.name || 'Oyebill'}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {previewContent.type === 'kot' ? 'KITCHEN ORDER TICKET' : 'TAX INVOICE'}
                  </p>
                </div>

                {/* Order Info - KOT */}
                <div className="text-xs border-b border-black pb-2 mb-2">
                  {previewContent.type === 'kot' ? (
                    <>
                      <div className="flex justify-between">
                        <span>KOT No:</span>
                        <span className="font-bold">{previewContent.content.orderId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Table:</span>
                        <span>{previewContent.content.tableNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{previewContent.content.dateTime}</span>
                      </div>
                      {settings?.kot_setup?.showWaiterName && (
                        <div className="flex justify-between">
                          <span>Waiter:</span>
                          <span>{previewContent.content.waiterName}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Bill specific info */}
                      <div className="flex justify-between">
                        <span>Bill No:</span>
                        <span className="font-bold">{previewContent.content.orderId}</span>
                      </div>
                      {previewContent.content.kotNumber && (
                        <div className="flex justify-between">
                          <span>Token/KOT No:</span>
                          <span>{previewContent.content.kotNumber}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Table:</span>
                        <span>{previewContent.content.tableNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{previewContent.content.dateTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Billed By:</span>
                        <span>{previewContent.content.waiterName}</span>
                      </div>
                      {settings?.restaurant?.address && (
                        <div className="flex justify-between">
                          <span>Address:</span>
                          <span className="text-right max-w-[180px]">{settings.restaurant.address}</span>
                        </div>
                      )}
                      {settings?.restaurant?.gstNumber && (
                        <div className="flex justify-between">
                          <span>GST No:</span>
                          <span>{settings.restaurant.gstNumber}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Items - KOT (all lines same width) */}
                {previewContent.type === 'kot' ? (
                  <div className="space-y-1">
                    {previewContent.content.items && previewContent.content.items.length > 0 ? (
                      previewContent.content.items.map((item: any, idx: number) => (
                        <div key={idx} className="border-b border-dashed border-gray-300 pb-1 mb-1">
                          <div className="flex justify-between items-center">
                            <span className="truncate flex-1">{item.quantity}x {item.productName}</span>
                            {item.isKot && <span className="text-gray-400 text-[10px] ml-2">Sent</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 text-center">No items</p>
                    )}
                  </div>
                ) : (
                  /* Bill items table */
                  <div>
                    <div className="grid grid-cols-[1fr_25px_45px_40px_55px] gap-1 font-semibold mb-1 border-b border-black pb-1">
                      <span>Item</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Rate</span>
                      <span className="text-right">Tax</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {previewContent.content.items.map((item: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[1fr_25px_45px_40px_55px] gap-1 py-0.5">
                        <span className="truncate">{item.productName}</span>
                        <span className="text-right">{item.quantity}</span>
                        <span className="text-right">₹{item.unitPrice.toFixed(2)}</span>
                        <span className="text-right">₹{(item.unitPrice * item.quantity * 0.05).toFixed(2)}</span>
                        <span className="text-right">₹{(item.unitPrice * item.quantity * 1.05).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals (Bill only) */}
                {previewContent.type === 'bill' && (
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{previewContent.content.subtotal.toFixed(2)}</span>
                    </div>
                    {previewContent.content.couponDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Coupon ({previewContent.content.couponCode}):</span>
                        <span>-₹{previewContent.content.couponDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {previewContent.content.loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Loyalty ({previewContent.content.loyaltyCustomerName}):</span>
                        <span>-₹{previewContent.content.loyaltyDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {previewContent.content.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({previewContent.content.discountReason || 'Manual'}):</span>
                        <span>-₹{previewContent.content.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span>₹{(previewContent.content.taxAmount / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span>₹{(previewContent.content.taxAmount / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-black pt-1 mt-1 text-base">
                      <span>GRAND TOTAL:</span>
                      <span>₹{previewContent.content.total.toFixed(2)}</span>
                    </div>
                    <div className="text-right text-xs text-gray-600 mt-1">
                      ({previewContent.content.totalInWords || 'Rupees Only'})
                    </div>
                  </div>
                )}

                {/* Payment QR Code */}
                {previewContent.type === 'bill' && 
                 previewContent.content.payment?.showQrOnBill && 
                 previewContent.content.payment?.upiId && (
                  <div className="mt-4 pt-3 border-t border-black">
                    <div className="flex items-center gap-4">
                      {/* Generate QR Code URL */}
                      <div className="bg-white p-2 rounded">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=${previewContent.content.payment.upiId}&pn=${encodeURIComponent(previewContent.content.payment.merchantName || 'Merchant')}&am=${previewContent.content.total.toFixed(2)}&cu=INR`}
                          alt="Payment QR"
                          className="w-20 h-20"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Scan to Pay</p>
                        <p className="text-xs text-gray-600">UPI ID: {previewContent.content.payment.upiId}</p>
                        <p className="text-xs font-medium">Amount: ₹{previewContent.content.total.toFixed(2)}</p>
                        {previewContent.content.payment.merchantName && (
                          <p className="text-xs text-gray-600">{previewContent.content.payment.merchantName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                {previewContent.type === 'bill' && settings?.bill_setup?.specialMessage && (
                  <div className="text-center text-xs text-gray-500 mt-3 pt-2 border-t border-black">
                    {settings.bill_setup.specialMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 p-4 border-t border-white/10">
              {previewContent.type === 'bill' && previewContent.content.customerPhone && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => {
                    if (previewContent.content.customerPhone) {
                      shareViaWhatsApp(previewContent.content);
                    } else {
                      const message = encodeURIComponent(`Bill Details:\nOrder: ${previewContent.content.orderId}\nTotal: ₹${previewContent.content.total.toFixed(2)}`);
                      window.open(`https://wa.me/?text=${message}`, '_blank');
                    }
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <span className="ml-1">Whatsapp</span>
                </Button>
              )}
              {previewContent.type === 'bill' && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      let content, type, filename;
                      if (downloadFormat === 'txt') {
                        content = generateBillText(previewContent.content);
                        type = 'text/plain';
                        filename = `Bill_${previewContent.content.orderId || 'unknown'}.txt`;
                      } else if (downloadFormat === 'html') {
                        content = generateBillHTML(previewContent.content);
                        type = 'text/html';
                        filename = `Bill_${previewContent.content.orderId || 'unknown'}.html`;
                      } else {
                        generatePDFBill(previewContent.content);
                        return;
                      }
                      const blob = new Blob([content], { type });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  </Button>
                  <select
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value as 'txt' | 'pdf' | 'html')}
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white cursor-pointer"
                    style={{ color: 'white' }}
                  >
                    <option value="txt" style={{ backgroundColor: '#1f2937', color: 'white' }}>TXT</option>
                    <option value="pdf" style={{ backgroundColor: '#1f2937', color: 'white' }}>PDF</option>
                    <option value="html" style={{ backgroundColor: '#1f2937', color: 'white' }}>HTML</option>
                  </select>
                </div>
              )}
              {previewContent.type === 'bill' && previewContent.content.customerEmail && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sharePDFViaEmail(previewContent.content)}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span className="ml-1">Email</span>
                </Button>
              )}
              <Button
                variant="accent"
                size="sm"
                onClick={handlePreviewPrint}
              >
                <Printer className="w-4 h-4" />
                <span className="ml-1">Print</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Orders Panel - NFC/QR Orders */}
      <Modal
        isOpen={showOrdersPanel}
        onClose={() => setShowOrdersPanel(false)}
        title="Customer Orders"
        size="lg"
      >
        {/* Pending Orders */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {(!pendingOrders || pendingOrders.length === 0) ? (
            <div className="text-center py-8 text-text-muted">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No pending customer orders</p>
              <p className="text-sm">Orders from NFC/QR scans will appear here</p>
            </div>
          ) : (
            pendingOrders.map(order => (
              <div key={order.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded">
                        Table {order.table_number}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        order.order_source === 'nfc' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {order.order_source === 'nfc' ? 'NFC' : 'QR'}
                      </span>
                    </div>
                    {order.customer_name && (
                      <p className="text-sm text-text-muted mt-1">
                        Customer: {order.customer_name}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-lg">₹{order.total?.toFixed(2) || '0.00'}</span>
                </div>
                
                {/* Order Items */}
                <div className="space-y-2 mb-4">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-white/5 rounded p-2">
                      <span>{item.product_name}</span>
                      <span className="text-text-muted">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleAcceptOrder(order)}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeclineOrder(order.id)}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Mark all read button */}
        {(notifications && notifications.length > 0) && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (user) {
                  await api.markAllRead(user.id);
                  setUnreadCount(0);
                }
              }}
              className="w-full"
            >
              Mark All as Read
            </Button>
          </div>
        )}
      </Modal>

      {/* Decline Confirmation Modal */}
      <Modal
        isOpen={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        title="Decline Order"
        size="sm"
      >
        <p className="text-text-secondary mb-4">
          Are you sure you want to decline this order? The order will be marked as declined and an admin will be notified.
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setShowDeclineModal(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDecline}
            className="flex-1"
          >
            Decline
          </Button>
        </div>
      </Modal>

      {/* Collect Payment Modal */}
      <Modal
        isOpen={showCollectModal}
        onClose={() => setShowCollectModal(false)}
        title="Collect Payment"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4">
            <div className="text-sm text-text-secondary mb-1">Total Amount</div>
            <div className="text-2xl font-bold text-accent">{formatCurrency(lastBillAmount)}</div>
          </div>

          {/* Payment Mode Selection */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMode('cash')}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  paymentMode === 'cash' 
                    ? 'border-accent bg-accent/20 text-accent' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-xs">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMode('gpay')}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  paymentMode === 'gpay' 
                    ? 'border-accent bg-accent/20 text-accent' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <svg className="w-6 h-6 mx-auto mb-1 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.14 10.5c0 .57-.04 1.12-.11 1.67l-1.72 11.83c-.12.82-.84 1.4-1.66 1.4H5.22c-.82 0-1.54-.58-1.66-1.4L1.8 11.67c-.14-.55-.11-1.1-.11-1.67 0-.57.04-1.12.11-1.67l1.72-11.83c.12-.82.84-1.4 1.66-1.4h10.35c.82 0 1.54.58 1.66 1.4l1.72 11.83c.07.55.11 1.1.11 1.67z"/>
                </svg>
                <span className="text-xs">GPay</span>
              </button>
              <button
                onClick={() => setPaymentMode('card')}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  paymentMode === 'card' 
                    ? 'border-accent bg-accent/20 text-accent' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span className="text-xs">Card</span>
              </button>
            </div>
          </div>

          {/* Amount Fields */}
          {paymentMode === 'cash' && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Cash Amount</label>
              <Input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder={`Enter amount (Total: ₹${lastBillAmount.toFixed(2)})`}
              />
            </div>
          )}
          {paymentMode === 'gpay' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">GPay Number (UPI ID)</label>
                <Input
                  type="text"
                  value={customerGpayNumber}
                  onChange={(e) => setCustomerGpayNumber(e.target.value)}
                  placeholder="Enter GPay number or UPI ID"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Amount</label>
                <Input
                  type="number"
                  value={gpayAmount}
                  onChange={(e) => setGpayAmount(e.target.value)}
                  placeholder={`₹${lastBillAmount.toFixed(2)}`}
                />
              </div>
            </div>
          )}
          {paymentMode === 'card' && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Card Amount</label>
              <Input
                type="number"
                value={cardAmount}
                onChange={(e) => setCardAmount(e.target.value)}
                placeholder={`Enter amount (Total: ₹${lastBillAmount.toFixed(2)})`}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowCollectModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleCollectPayment}
              className="flex-1"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm Collect
            </Button>
          </div>
        </div>
      </Modal>

      {/* PUSH Payment Modal */}
      <Modal
        isOpen={showPushModal}
        onClose={() => setShowPushModal(false)}
        title="Push Payment"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4">
            <div className="text-sm text-text-secondary mb-1">Total Amount to Push</div>
            <div className="text-2xl font-bold text-accent">{formatCurrency(total)}</div>
          </div>

          {/* Push Method Selection */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Push To</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPushMethod('gpay')}
                className={`p-4 rounded-lg border text-center transition-colors ${
                  pushMethod === 'gpay' 
                    ? 'border-accent bg-accent/20 text-accent' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.14 10.5c0 .57-.04 1.12-.11 1.67l-1.72 11.83c-.12.82-.84 1.4-1.66 1.4H5.22c-.82 0-1.54-.58-1.66-1.4L1.8 11.67c-.14-.55-.11-1.1-.11-1.67 0-.57.04-1.12.11-1.67l1.72-11.83c.12-.82.84-1.4 1.66-1.4h10.35c.82 0 1.54.58 1.66 1.4l1.72 11.83c.07.55.11 1.1.11 1.67z"/>
                </svg>
                <span className="text-sm font-medium">Customer GPay</span>
                <p className="text-xs text-text-muted mt-1">Send payment link to customer</p>
              </button>
              <button
                onClick={() => setPushMethod('pos')}
                className={`p-4 rounded-lg border text-center transition-colors ${
                  pushMethod === 'pos' 
                    ? 'border-accent bg-accent/20 text-accent' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span className="text-sm font-medium">POS Machine</span>
                <p className="text-xs text-text-muted mt-1">Push to configured POS device</p>
              </button>
            </div>
          </div>

          {/* GPay Number Input */}
          {pushMethod === 'gpay' && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Customer GPay Number / UPI ID</label>
              <Input
                type="text"
                value={pushGpayNumber}
                onChange={(e) => setPushGpayNumber(e.target.value)}
                placeholder="Enter GPay number or UPI ID"
              />
              <p className="text-xs text-text-muted mt-1">
                Amount ₹{total.toFixed(2)} will be pushed to this number
              </p>
            </div>
          )}

          {pushMethod === 'pos' && (
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">POS Machine</p>
                  <p className="text-xs text-text-muted">Push ₹{total.toFixed(2)} to configured POS</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowPushModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={handlePushPayment}
              className="flex-1"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Push Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}