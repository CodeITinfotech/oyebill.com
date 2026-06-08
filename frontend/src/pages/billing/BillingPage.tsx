import { useState, useEffect, useMemo, useRef } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api';
import { PageHeader } from '../../components/layout';
import { Button, Select, Card, CardBody, Modal, Input, toast } from '../../components/ui';
import { Plus, Minus, Trash2, Printer, Receipt, Percent, Users, X, Check, Edit3, MoreHorizontal, Ticket, Tag, Key } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Product, Table, OrderItem } from '../../types';

interface CartItem extends OrderItem {
  isNew?: boolean;
  isOnlineOrder?: boolean;
}

export function BillingPage() {
  
  
  // State
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
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
  const [showWaiterDropdown, setShowWaiterDropdown] = useState(false);
  
  // Mobile state
  const [mobileView, setMobileView] = useState<'menu' | 'cart'>('menu');
  const [showMobileCart, setShowMobileCart] = useState(false);
  
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
  
  // Ref for quantity input focus
  const quantityInputRef = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState<{type: 'kot' | 'bill', content: any} | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Pending cleaning modal state
  const [showPendingCleaningModal, setShowPendingCleaningModal] = useState(false);
  const [pendingCleaningTable, setPendingCleaningTable] = useState<Table | null>(null);

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
  const addToCart = (product: Product) => {
    // Get the appropriate price - use section-specific price if available
    let unitPrice = product.sellingPrice;
    if (selectedSection && product.sectionPrices && product.sectionPrices.length > 0) {
      const sectionPrice = product.sectionPrices.find(sp => sp.sectionId === selectedSection);
      if (sectionPrice && parseFloat(sectionPrice.price) > 0) {
        unitPrice = parseFloat(sectionPrice.price);
      }
    }

    const existingIndex = cart.findIndex(item => item.productId === product.id && !item.isKot);
    
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].taxAmount = unitPrice * (product.taxRate / 100);
      updated[existingIndex].total = updated[existingIndex].quantity * (unitPrice + updated[existingIndex].taxAmount);
      updated[existingIndex].unitPrice = unitPrice;
      setCart(updated);
      setLastAddedItemId(updated[existingIndex].id);
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
      setCart([...cart, newItem]);
      setLastAddedItemId(newItem.id);
    }
    // No toast on successful add - only show toast on failure
  };

  // Focus on quantity input when item is added
  useEffect(() => {
    if (lastAddedItemId && quantityInputRef.current[lastAddedItemId]) {
      quantityInputRef.current[lastAddedItemId]?.focus();
      quantityInputRef.current[lastAddedItemId]?.select();
      setLastAddedItemId(null);
    }
  }, [lastAddedItemId]);

  // Update item quantity
  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty === 0) return null;
        return {
          ...item,
          quantity: newQty,
          total: newQty * (item.unitPrice + item.taxAmount),
        };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
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

    setSelectedTable(table);
    
    // Check if there's an existing order
    const response = await api.getOrderByTable(table.id);
    if (response.success && response.data) {
      const existingOrder = response.data;
      setCurrentOrderId(existingOrder.id);
      
      // Load existing items and new items
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
      setCurrentOrderId(null);
      setCart([]);
      setDiscountAmount('');
      setDiscountReason('');
    }
  };

  // Confirm pending cleaning modal
  const handleConfirmPendingCleaning = async () => {
    if (!pendingCleaningTable) return;

    try {
      // Update table status to available
      await api.put(`/tables/${pendingCleaningTable.id}`, { status: 'available' });
      toast('success', `Table ${pendingCleaningTable.number} marked as available`);
      
      // Close modal
      setShowPendingCleaningModal(false);
      
      // Select the table (will now proceed normally since status is 'available')
      setSelectedTable(pendingCleaningTable);
      
      // Check for existing order
      const response = await api.getOrderByTable(pendingCleaningTable.id);
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
        setCurrentOrderId(null);
        setCart([]);
        setDiscountAmount('');
        setDiscountReason('');
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
      orderId = `${dateStr}-${tableStr}-${randomNum}`;
      displayTable = selectedTable.number;
    }
    
    // Get selected waiter name
    const selectedWaiterObj = waiters.find(w => w.id === selectedWaiter);
    const waiterName = selectedWaiterObj ? selectedWaiterObj.name : 'Not Assigned';
    
    // Create content for preview
    const kotContent = {
      orderId: orderId,
      tableNumber: displayTable,
      items: cart.filter(i => i.isNew || i.isKot),
      waiterName: waiterName,
      dateTime: new Date().toLocaleString(),
      isOnlineOrder: isOnlineOrderMode,
      platform: onlineOrder?.platform,
    };

    // If preview is enabled, show preview modal
    if (showPreview) {
      setPreviewContent({ type: 'kot', content: kotContent });
      setPendingAction(async () => {
        await executeKOT();
      });
      setShowPreviewModal(true);
    } else {
      await executeKOT();
    }
  };

  // Execute KOT generation (called after preview confirm or if preview disabled)
  const executeKOT = async () => {
    // Mark new items as KOT
    const kotItems = cart.map(item => ({ ...item, isKot: true, isNew: false }));
    setCart(kotItems);

    const isOnlineOrderMode = onlineOrder !== null;

    if (currentOrderId) {
      await updateOrder(currentOrderId, kotItems);
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
      const response = await createOrder(selectedTable.id, kotItems, selectedWaiter || undefined, selectedCustomer?.id);
      if (response) {
        setCurrentOrderId(response);
      }
    }

    await generateKOT(currentOrderId || (isOnlineOrderMode ? 'ONLINE-KOT' : ''));
    toast('success', isOnlineOrderMode ? 'Online Order KOT Generated' : 'KOT Generated successfully');
    
    // Print KOT (simulated)
    setTimeout(() => {
      console.log('KOT Print triggered');
      toast('info', 'KOT sent to printer');
    }, 500);
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
      orderId = `${dateStr}-${tableStr}-${randomNum}`;
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
        await executeBill();
      });
      setShowPreviewModal(true);
    } else {
      await executeBill();
    }
  };

  // Execute Bill generation (called after preview confirm or if preview disabled)
  const executeBill = async () => {
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

    if (orderId) {
      // Apply any pending discount
      if (discountAmount && discountReason) {
        await applyDiscount(orderId, discountValue, discountReason);
      }
      await generateBill(orderId);
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
      } catch (error) {
        console.error('Error updating online order status:', error);
        toast('success', 'Bill Generated (Status update failed)');
      }
    } else {
      toast('success', 'Bill Generated successfully');
    }
    
    // Print Bill (simulated)
    setTimeout(() => {
      console.log('Bill Print triggered');
      toast('info', 'Bill sent to printer');
    }, 500);

    // Reset
    setSelectedTable(null);
    setCart([]);
    setCurrentOrderId(null);
    setDiscountAmount('');
    setDiscountReason('');
    setSelectedCustomer(null);
    fetchTables(selectedSection || undefined);
  };

  // Handle preview print action
  const handlePreviewPrint = async () => {
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

  // Apply Discount
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

  return (
    <div className="h-full flex flex-col">
      {/* Page Header - visible on mobile at top, hidden on desktop (handled by sidebar) */}
      <div className="lg:hidden px-4 py-3 border-b border-white/10 bg-background-card text-center">
        <h1 className="text-xl font-display font-bold text-text-primary">Billing</h1>
      </div>

      {/* Desktop: Full page header */}
      <div className="hidden lg:block mb-4">
        <h1 className="text-2xl font-display font-bold text-text-primary">Billing</h1>
      </div>

      {/* Desktop: Two column layout, Mobile: Single column with cart toggle */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[380px_1fr] gap-0 lg:gap-6 min-h-0">
        {/* Left: Order Panel - Desktop always visible, Mobile: Toggle */}
        <div className={`flex flex-col card order-panel ${showMobileCart ? 'mobile-cart-open' : ''}`}>
          {/* Mobile: View Toggle */}
          <div className="lg:hidden flex border-b border-white/10">
            <button
              onClick={() => setMobileView('menu')}
              className={`flex-1 py-3 text-sm font-medium transition-all ${
                mobileView === 'menu' 
                  ? 'bg-accent/10 text-accent border-b-2 border-accent' 
                  : 'text-text-secondary'
              }`}
            >
              Menu
            </button>
            <button
              onClick={() => setMobileView('cart')}
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
                </div>

                {/* Selected Table Badge */}
                {selectedTable && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20 mb-3">
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
                        onClick={() => setSelectedTable(null)}
                        className="text-xs text-accent hover:text-accent/80"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Waiter & Customer - Horizontal on mobile */}
            <div className="grid grid-cols-2 gap-2">
              {/* Waiter Selection with PIN */}
              <div className="relative">
                {waiterPinInput.length > 0 ? (
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
                {showWaiterDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background-card border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {waiters.length > 0 ? (
                      waiters.map((waiter) => (
                        <button
                          key={waiter.id}
                          onClick={() => {
                            setSelectedWaiter(waiter.id);
                            setShowWaiterDropdown(false);
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
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-accent hover:bg-accent/10 border-t border-white/10 flex items-center gap-2"
                    >
                      <Key className="w-3 h-3" /> Use PIN
                    </button>
                  </div>
                )}
              </div>
              {/* Searchable Customer Dropdown */}
              <div className="relative">
                <input
                  type="text"
                  value={selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}` : customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomer(null);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Customer"
                  className="w-full px-2 py-1.5 bg-background-secondary border border-white/10 rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                />
                {showCustomerDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background-card border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
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
                          <span>
                            <span className="text-text-primary">{c.name || 'Unknown'}</span>
                            {c.phone && <span className="text-text-muted ml-1">({c.phone})</span>}
                          </span>
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

            {/* Action Buttons - Mobile friendly */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleKOT}
                disabled={cart.filter(i => i.isNew).length === 0}
                className="flex items-center justify-center gap-1 text-xs"
              >
                <Printer className="w-3 lg:w-4 h-3 lg:h-4" />
                <span>KOT</span>
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleBill}
                disabled={cart.length === 0}
                className="flex items-center justify-center gap-1 text-xs"
              >
                <Receipt className="w-3 lg:w-4 h-3 lg:h-4" />
                <span>Bill</span>
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                  className="w-full flex items-center justify-center gap-1 text-xs"
                >
                  <MoreHorizontal className="w-3 lg:w-4 h-3 lg:h-4" />
                  <span className="hidden sm:inline">More</span>
                </Button>
                {/* Dropdown */}
                {showMoreDropdown && (
                  <div 
                    className="absolute bottom-full left-0 mb-1 z-20 more-dropdown"
                  >
                    <div 
                      className="bg-background-card border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px]"
                      onClick={(e) => e.stopPropagation()}
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

        {/* Right: Product Selection - Desktop only, hidden on mobile when cart view is active */}
        <div className={`flex flex-col ${mobileView === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Table Tiles */}
          {!selectedTable && (
            <div className="mb-3 lg:mb-4">
              <h3 className="text-xs lg:text-sm font-medium text-text-secondary mb-2">Select Table</h3>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1">
                {tables.map((table) => {
                  const isAvailable = table.status === 'available';
                  const isPendingCleaning = table.status === 'pending_cleaning';
                  const isOccupied = table.status === 'occupied' || (table.status !== 'available' && table.status !== 'pending_cleaning' && table.hasCurrentOrder);
                  const isPendingPrint = table.status === 'pending_printing' || table.status === 'billing';
                  
                  // Status colors
                  let statusColor = 'bg-success';
                  let statusBgClass = 'border-success/30 bg-success/5 hover:border-success';
                  
                  if (isPendingCleaning) {
                    statusColor = 'bg-red-900';
                    statusBgClass = 'border-red-900/50 bg-red-900/10 hover:border-red-900 cursor-pointer';
                  } else if (isPendingPrint) {
                    statusColor = 'bg-red-500';
                    statusBgClass = 'border-red-500/50 bg-red-500/10 hover:border-red-500';
                  } else if (isOccupied) {
                    statusColor = 'bg-orange-500';
                    statusBgClass = 'border-orange-500/50 bg-orange-500/10 hover:border-orange-500';
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
                <div className="flex items-center gap-1">
                  <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-success"></span>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-orange-500"></span>
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-red-500"></span>
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-red-900"></span>
                  <span>Cleaning</span>
                </div>
              </div>
            </div>
          )}

          {/* Search Input */}
          <div className="mb-2 lg:mb-4">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 lg:px-4 py-1.5 lg:py-2 bg-background-secondary border border-white/10 rounded-lg text-xs lg:text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
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

      {/* Mobile: Floating Cart Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setMobileView('cart')}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            cart.length > 0 
              ? 'bg-accent text-background-primary' 
              : 'bg-background-secondary text-text-muted'
          }`}
        >
          <Receipt className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-error text-white rounded-full text-xs flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

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

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowPendingCleaningModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={handleConfirmPendingCleaning}
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
              <div className="bg-white text-black p-4 rounded font-mono text-sm">
                {/* Header */}
                <div className="text-center border-b border-black pb-2 mb-3">
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
                          <span className="text-right max-w-[200px]">{settings.restaurant.address}</span>
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

                {/* Items */}
                <div className="text-xs border-b border-black pb-2 mb-2">
                  <div className="grid grid-cols-[1fr_40px_60px_70px] gap-1 font-semibold mb-1 border-b border-black pb-1">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Rate</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {previewContent.content.items.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-[1fr_40px_60px_70px] gap-1 py-0.5">
                      <span className="truncate">{item.productName}</span>
                      <span className="text-right">{item.quantity}</span>
                      <span className="text-right">₹{item.unitPrice.toFixed(2)}</span>
                      <span className="text-right">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

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
            <div className="flex flex-wrap gap-2 p-4 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={handlePreviewCancel}
              >
                Cancel
              </Button>
              {previewContent.type === 'bill' && previewContent.content.customerPhone && (
                <Button
                  variant="success"
                  onClick={() => {
                    // Generate WhatsApp link
                    const message = encodeURIComponent(`Your bill from ${settings?.restaurant?.name || 'Restaurant'}\n\nBill No: ${previewContent.content.orderId}\nTotal: ₹${previewContent.content.total.toFixed(2)}\n\nThank you!`);
                    window.open(`https://wa.me/${previewContent.content.customerPhone.replace(/\D/g, '')}?text=${message}`, '_blank');
                  }}
                >
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Send WhatsApp
                </Button>
              )}
              {previewContent.type === 'bill' && previewContent.content.customerEmail && (
                <Button
                  variant="info"
                  onClick={() => {
                    const subject = encodeURIComponent(`Bill from ${settings?.restaurant?.name || 'Restaurant'} - ${previewContent.content.orderId}`);
                    const body = encodeURIComponent(`Dear Customer,\n\nThank you for dining with us!\n\nBill Details:\nBill No: ${previewContent.content.orderId}\nTable: ${previewContent.content.tableNumber}\nDate: ${previewContent.content.dateTime}\n\nItems:\n${previewContent.content.items.map((i: any) => `${i.productName} x ${i.quantity} = ₹${(i.unitPrice * i.quantity).toFixed(2)}`).join('\n')}\n\nSubtotal: ₹${previewContent.content.subtotal.toFixed(2)}\nTax: ₹${previewContent.content.taxAmount.toFixed(2)}\n${previewContent.content.discount > 0 ? `Discount: -₹${previewContent.content.discount.toFixed(2)}\n` : ''}${previewContent.content.loyaltyDiscount > 0 ? `Loyalty Discount: -₹${previewContent.content.loyaltyDiscount.toFixed(2)}\n` : ''}\nTotal: ₹${previewContent.content.total.toFixed(2)}\n\nTotal in Words: ${previewContent.content.totalInWords}\n\nThank you for visiting!\n${settings?.restaurant?.name || 'Restaurant'}`);
                    window.open(`mailto:${previewContent.content.customerEmail}?subject=${subject}&body=${body}`, '_blank');
                  }}
                >
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Send Email
                </Button>
              )}
              <Button
                variant="accent"
                onClick={handlePreviewPrint}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}