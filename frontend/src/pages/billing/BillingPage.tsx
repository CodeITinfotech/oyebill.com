import { useState, useEffect, useMemo, useRef } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api';
import { PageHeader } from '../../components/layout';
import { Button, Select, Card, CardBody, Modal, Input, toast } from '../../components/ui';
import { Plus, Minus, Trash2, Printer, Receipt, Percent, Users, X, Check, Edit3, MoreHorizontal, Ticket, Tag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Product, Table, OrderItem } from '../../types';

interface CartItem extends OrderItem {
  isNew?: boolean;
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
  
  
  
  // Ref for quantity input focus
  const quantityInputRef = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState<{type: 'kot' | 'bill', content: any} | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

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
  const { subtotal, taxAmount, discountValue, couponDiscountValue, total } = useMemo(() => {
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
    
    const totalAmount = sub + tax - discount - couponDisc;
    return { subtotal: sub, taxAmount: tax, discountValue: discount, couponDiscountValue: couponDisc, total: Math.max(0, totalAmount) };
  }, [cart, discountAmount, discountType, appliedCoupon, products]);

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
    toast('success', `Added ${product.name} to order`);
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
      // Show warning but allow selection
      const confirmed = window.confirm(
        `Table ${table.number} is pending cleaning.\n\nDo you want to proceed and mark it as available for new customers?\n\nClick OK to continue billing (table will be set to available).\nClick Cancel to go back.`
      );
      if (!confirmed) {
        return;
      }
      // Update table status to available before proceeding
      try {
        await api.put(`/tables/${table.id}`, { status: 'available' });
        toast('success', `Table ${table.number} marked as available`);
      } catch (error) {
        console.error('Failed to update table status:', error);
        toast('error', 'Failed to update table status');
        return;
      }
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

  // Generate KOT
  const handleKOT = async () => {
    if (!selectedTable || cart.filter(i => i.isNew).length === 0) {
      toast('warning', 'Add items to generate KOT');
      return;
    }

    const kotSetup = settings?.kot_setup;
    const showPreview = kotSetup?.showPreview !== false; // Default to true
    
    // Generate formatted order ID: DDMMYY-TB##-XXXXX
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateStr = `${day}${month}${year}`;
    const tableStr = selectedTable.number.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4).padEnd(4, '0');
    const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
    const orderId = `${dateStr}-${tableStr}-${randomNum}`;
    
    // Create content for preview
    const kotContent = {
      orderId: orderId,
      tableNumber: selectedTable.number,
      items: cart.filter(i => i.isNew || i.isKot),
      waiterName: 'Current User',
      dateTime: new Date().toLocaleString(),
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

    if (currentOrderId) {
      await updateOrder(currentOrderId, kotItems);
    } else {
      const response = await createOrder(selectedTable.id, kotItems);
      if (response) {
        setCurrentOrderId(response);
      }
    }

    await generateKOT(currentOrderId || '');
    toast('success', 'KOT Generated successfully');
    
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
    if (!selectedTable || cart.length === 0) {
      toast('warning', 'Add items to generate bill');
      return;
    }

    const billSetup = settings?.bill_setup;
    const showPreview = billSetup?.showPreview !== false; // Default to true
    
    // Generate formatted order ID: DDMMYY-TB##-XXXXX
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateStr = `${day}${month}${year}`;
    const tableStr = selectedTable.number.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4).padEnd(4, '0');
    const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
    const orderId = `${dateStr}-${tableStr}-${randomNum}`;
    
    // Create content for preview
    const billContent = {
      orderId: orderId,
      kotNumber: currentOrderId || 'N/A', // Reference to KOT
      tableNumber: selectedTable.number,
      items: cart,
      subtotal: subtotal,
      taxAmount: taxAmount,
      couponDiscount: couponDiscountValue,
      couponCode: appliedCoupon?.code || null,
      discount: discountValue,
      discountReason: discountReason,
      total: total,
      totalInWords: numberToWords(total),
      waiterName: user?.name || 'Staff',
      dateTime: new Date().toLocaleString(),
      payment: settings?.payment,
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
    if (currentOrderId) {
      // Apply any pending discount
      if (discountAmount && discountReason) {
        await applyDiscount(currentOrderId, discountValue, discountReason);
      }
      await generateBill(currentOrderId);
    }

    toast('success', 'Bill Generated successfully');
    
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

  // Filter products by category and selected section
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => p.isActive);
    
    // Filter by category if selected
    if (selectedCategory) {
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
  }, [products, selectedCategory, selectedSection]);

  // Get active categories
  const activeCategories = categories.filter(c => c.isActive);

  // Format currency
  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Billing" subtitle="Generate KOT and Bills" />

      <div className="flex-1 grid grid-cols-[350px_1fr] gap-6 min-h-0">
        {/* Left: Order Panel */}
        <div className="flex flex-col card">
          {/* Table Selection */}
          <div className="p-4 border-b border-white/10">
            <Select
              label="Section"
              options={[
                { value: '', label: 'All Sections' },
                ...sections.filter(s => s.isActive).map(s => ({ value: s.id, label: s.name }))
              ]}
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setSelectedTable(null);
              }}
            />
            
            {selectedTable && (
              <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
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
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items in order</p>
                <p className="text-sm">Select products from the menu</p>
              </div>
            ) : (
              cart.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-2.5 rounded-lg border ${
                    item.isKot 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-background-secondary border-accent/20'
                  }`}
                  onDoubleClick={() => {
                    if (item.isKot) {
                      // Enable edit mode for KOT items
                      setEditingKotId(item.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{item.productName}</p>
                      {item.isKot && (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning whitespace-nowrap">
                          KOT
                        </span>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="font-mono text-accent font-semibold text-sm">
                        {formatCurrency(item.total)}
                      </p>
                      {item.isKot ? (
                        // KOT item controls - show edit/delete when editing
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
                              className="w-12 text-center bg-transparent border border-white/20 rounded px-1 py-0.5 text-sm focus:border-accent focus:outline-none"
                            />
                            <button
                              onClick={() => setEditingKotId(null)}
                              className="p-1 rounded hover:bg-success/20 text-success"
                              title="Done"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 rounded hover:bg-error/20 text-error"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingKotId(item.id)}
                            className="p-1 rounded hover:bg-white/10 text-text-muted"
                            title="Edit KOT"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )
                      ) : (
                        // New item controls
                        <div className="flex items-center gap-1">
                          {item.quantity === 1 ? (
                            // Show delete icon when quantity is 1
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 rounded hover:bg-error/20 text-error"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            // Show minus button when quantity > 1
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 rounded hover:bg-white/10"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 rounded hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                    {item.taxRate > 0 && ` + ${item.taxRate}% GST`}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-4 border-t border-white/10 space-y-3">
            <div className="space-y-2 text-sm">
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
              {discountValue > 0 && (
                <div className="flex justify-between text-success">
                  <span>% Disc. ({discountReason})</span>
                  <span className="font-mono">-{formatCurrency(discountValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                <span>Total</span>
                <span className="font-mono text-accent">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleKOT}
                disabled={cart.filter(i => i.isNew).length === 0}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>KOT</span>
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleBill}
                disabled={cart.length === 0}
                className="flex items-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                <span>Bill</span>
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                  className="flex items-center gap-2"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span>More</span>
                </Button>
                {/* Dropdown */}
                {showMoreDropdown && (
                  <div 
                    className="absolute bottom-full left-0 mb-1 z-20 more-dropdown"
                  >
                    <div 
                      className="bg-background-card border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          if (appliedCoupon) {
                            toast('warning', 'Remove coupon first before applying discount');
                            return;
                          }
                          setShowDiscountModal(true);
                          setShowMoreDropdown(false);
                        }}
                        disabled={cart.length === 0 || !!appliedCoupon}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Percent className="w-4 h-4" />
                        <span>Disc.</span>
                      </button>
                      <button
                        onClick={() => {
                          if (discountValue > 0) {
                            toast('warning', 'Discount already applied. Remove it to use coupon.');
                            return;
                          }
                          setShowCouponModal(true);
                          setShowMoreDropdown(false);
                        }}
                        disabled={cart.length === 0 || discountValue > 0}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Ticket className="w-4 h-4" />
                        <span>Coupon</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Applied Coupon Display */}
            {appliedCoupon && (
              <div className="mt-2 p-2 bg-success/10 border border-success/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-success" />
                  <span className="text-sm text-success font-medium">{appliedCoupon.code}</span>
                  <span className="text-xs text-text-muted">({appliedCoupon.discountValue}% off)</span>
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

        {/* Right: Product Selection */}
        <div className="flex flex-col">
          {/* Table Tiles */}
          {!selectedTable && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-text-secondary mb-3">Select Table</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {tables.map((table) => {
                  const isAvailable = table.status === 'available';
                  const isPendingCleaning = table.status === 'pending_cleaning';
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table)}
                      className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all hover:scale-105 relative ${
                        isAvailable
                          ? 'border-success/30 bg-success/5 hover:border-success'
                          : isPendingCleaning
                          ? 'border-warning/50 bg-warning/10 hover:border-warning cursor-pointer'
                          : 'border-warning/30 bg-warning/5 hover:border-warning'
                      }`}
                    >
                      {isPendingCleaning && (
                        <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-warning text-warning-foreground text-[8px] rounded-full font-medium">
                          !
                        </div>
                      )}
                      <span className="text-2xl font-bold">{table.number}</span>
                      <span className="text-[10px] text-text-muted">Capacity: {table.capacity}</span>
                      {!isAvailable && !isPendingCleaning && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-warning" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Pills */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                !selectedCategory
                  ? 'bg-accent text-background-primary'
                  : 'bg-background-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              All Items
            </button>
            {activeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-accent text-background-primary'
                    : 'bg-background-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredProducts.map((product) => {
                // Get display price - section-specific if available
                const displayPrice = (selectedSection && product.sectionPrices?.length > 0)
                  ? (product.sectionPrices.find(sp => sp.sectionId === selectedSection)?.price || product.sellingPrice)
                  : product.sellingPrice;
                
                return (
                  <Card
                    key={product.id}
                    hover
                    onClick={() => addToCart(product)}
                    className="cursor-pointer"
                  >
                    <CardBody className="p-3 text-center">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 mx-auto mb-2 flex items-center justify-center">
                        <span className="text-xl">🍽️</span>
                      </div>
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-text-muted line-clamp-1">{product.categoryName}</p>
                      <p className="font-mono text-accent font-semibold mt-2">
                        {formatCurrency(parseFloat(displayPrice))}
                      </p>
                      {product.taxRate > 0 && (
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-info/20 text-info mt-1">
                          +{product.taxRate}% GST
                        </span>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
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
            <div className="flex gap-3 p-4 border-t border-white/10">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={handlePreviewCancel}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                className="flex-1"
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