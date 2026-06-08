import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Minus, Plus, ShoppingCart, X, Check, AlertCircle } from 'lucide-react';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  selling_price: number;
  tax_rate: number;
  category_id: string;
  description?: string;
  is_active: number;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface TableInfo {
  id: string;
  number: string;
  section_name?: string;
  capacity: number;
  assignedWaiters: { id: string; name: string }[];
}

interface Restaurant {
  id: string;
  name: string;
  logo?: string;
}

export default function NFCOrdering() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const navigate = useNavigate();
  
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  // Customer info (optional)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  useEffect(() => {
    if (tableNumber) {
      fetchTableInfo();
    }
  }, [tableNumber]);
  
  const fetchTableInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get table info
      const tableResponse = await api.getTableByNumber(tableNumber);
      if (!tableResponse.success) {
        setError(tableResponse.error || 'Table not found');
        return;
      }
      
      setTableInfo(tableResponse.data);
      
      // Get restaurant info from localStorage or fetch
      const storedRestaurant = localStorage.getItem('restaurant');
      if (storedRestaurant) {
        setRestaurant(JSON.parse(storedRestaurant));
      }
      
      // Get products and categories
      const [productsRes, categoriesRes] = await Promise.all([
        api.getProducts(),
        api.getCategories()
      ]);
      
      if (productsRes.success) {
        // Filter only active products that are enabled for online ordering
        const activeProducts = productsRes.data.filter((p: Product) => 
          p.is_active === 1
        );
        setProducts(activeProducts);
      }
      
      if (categoriesRes.success) {
        const sortedCategories = categoriesRes.data.sort((a: Category, b: Category) => 
          (a.sort_order || 0) - (b.sort_order || 0)
        );
        setCategories(sortedCategories);
        if (sortedCategories.length > 0) {
          setSelectedCategory(sortedCategories[0].id);
        }
      }
    } catch (err) {
      setError('Failed to load menu. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const taxAmount = (product.selling_price * product.tax_rate) / 100;
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.selling_price,
        taxRate: product.tax_rate,
        taxAmount,
        total: product.selling_price + taxAmount
      };
      setCart([...cart, newItem]);
    }
  };
  
  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty === 0) return null;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };
  
  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };
  
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const taxAmount = cart.reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);
  const total = subtotal + taxAmount;
  
  const placeOrder = async () => {
    if (cart.length === 0 || !tableInfo) return;
    
    setSubmitting(true);
    try {
      const orderData = {
        tableId: tableInfo.id,
        tableNumber: tableInfo.number,
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate
        })),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        restaurantId: restaurant?.id,
        orderSource: 'qr'
      };
      
      const response = await api.createCustomerOrder(orderData);
      
      if (response.success) {
        setOrderId(response.data.id);
        setOrderPlaced(true);
        setCart([]);
      } else {
        alert(response.error || 'Failed to place order');
      }
    } catch (err) {
      alert('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading menu...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Table Not Found</h2>
            <p className="text-text-secondary mb-4">{error}</p>
            <p className="text-sm text-text-muted">
              Please scan a valid QR code or NFC tag on your table.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }
  
  if (orderPlaced && orderId) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Order Placed!</h2>
            <p className="text-text-secondary mb-4">
              Your order has been sent to the restaurant.
              <br />
              Table: {tableInfo?.number}
            </p>
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <p className="text-sm text-text-muted">Order ID</p>
              <p className="font-mono text-lg">{orderId.slice(0, 8).toUpperCase()}</p>
            </div>
            <p className="text-sm text-text-muted">
              A waiter will shortly attend to your table.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }
  
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category_id === selectedCategory)
    : products;
  
  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <div className="bg-background-card border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{restaurant?.name || 'Restaurant'}</h1>
              <p className="text-sm text-text-muted">Table {tableNumber}</p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Categories */}
      <div className="bg-background-card border-b border-white/10 sticky top-[60px] z-10">
        <div className="max-w-lg mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-accent text-white'
                  : 'bg-white/10 text-text-secondary hover:bg-white/20'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Products */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-24">
        <h2 className="text-sm font-medium text-text-muted mb-3">
          {categories.find(c => c.id === selectedCategory)?.name || 'All Items'}
        </h2>
        
        <div className="space-y-3">
          {filteredProducts.map(product => (
            <div 
              key={product.id}
              className="bg-background-card rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                <p className="text-xs text-text-muted">
                  ₹{product.selling_price.toFixed(2)}
                  {product.tax_rate > 0 && ` (+${product.tax_rate}% GST)`}
                </p>
              </div>
              <button
                onClick={() => addToCart(product)}
                className="ml-3 p-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <p>No items available in this category</p>
          </div>
        )}
      </div>
      
      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background-card border-t border-white/10">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-accent" />
                <span className="font-medium">{cart.length} items</span>
              </div>
              <span className="font-semibold text-lg">₹{total.toFixed(2)}</span>
            </div>
            
            <Button 
              onClick={placeOrder}
              loading={submitting}
              className="w-full"
            >
              Place Order
            </Button>
          </div>
        </div>
      )}
      
      {/* Cart Modal */}
      {cart.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-20" onClick={() => {}}>
          <div className="absolute bottom-0 left-0 right-0 bg-background-card rounded-t-2xl max-h-[70vh] overflow-auto">
            <div className="sticky top-0 bg-background-card p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold">Your Order</h3>
              <span className="font-semibold">₹{total.toFixed(2)}</span>
            </div>
            
            <div className="p-4 space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.productName}</p>
                    <p className="text-xs text-text-muted">₹{item.unitPrice.toFixed(2)} each</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}