import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ShoppingCart, Plus, Minus, User, Clock, MapPin } from 'lucide-react';

interface MenuCatalogPageProps {
  restaurantId: string;
  onLogout?: () => void;
}

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  selling_price: number;
  mrp: number;
  tax_rate: number;
}

interface Category {
  id: string;
  name: string;
  description: string;
  products: MenuItem[];
}

export const MenuCatalogPage: React.FC<MenuCatalogPageProps> = ({ restaurantId, onLogout }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');

  useEffect(() => {
    loadMenuData();
    const savedEmail = localStorage.getItem('customerEmail');
    if (savedEmail) setCustomerEmail(savedEmail);
  }, [restaurantId]);

  const loadMenuData = async () => {
    setLoading(true);
    try {
      const [menuRes, settingsRes] = await Promise.all([
        api.getMenuCatalog(restaurantId),
        api.getOnlineOrderingSettings(restaurantId)
      ]);

      if (menuRes.success && menuRes.data) {
        setCategories(menuRes.data.categories || []);
        setRestaurant(menuRes.data.restaurant);
        if (menuRes.data.categories.length > 0 && !selectedCategory) {
          setSelectedCategory(menuRes.data.categories[0].id);
        }
      }

      if (settingsRes.success && settingsRes.data) {
        setSettings(settingsRes.data);
      }
    } catch (err) {
      setError('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: `temp-${Date.now()}`,
        product_id: product.id,
        name: product.name,
        price: product.selling_price,
        quantity: 1
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product_id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleLoginClick = () => {
    navigate(`/catalog/${restaurantId}/login`);
  };

  const handleCheckout = () => {
    navigate(`/catalog/${restaurantId}/checkout`, {
      state: {
        cart,
        restaurantId,
        restaurant,
        settings,
        customerEmail
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={loadMenuData} className="px-4 py-2 bg-primary text-white rounded-lg">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{restaurant?.name || 'Menu'}</h1>
              {restaurant?.address && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {restaurant.address}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {customerEmail ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{customerEmail}</span>
                </div>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="px-4 py-2 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5"
                >
                  Login
                </button>
              )}
              <button
                onClick={() => setShowCart(true)}
                className="relative p-2 bg-primary text-white rounded-lg"
              >
                <ShoppingCart className="w-5 h-5" />
                {getCartItemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {getCartItemCount()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Categories Sidebar */}
          <aside className="w-48 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-2 sticky top-24">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-primary text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {category.name}
                  <span className="text-xs ml-1 opacity-75">({category.products.length})</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            {selectedCategoryData && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {selectedCategoryData.name}
                </h2>
                {selectedCategoryData.description && (
                  <p className="text-sm text-gray-500 mb-4">{selectedCategoryData.description}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedCategoryData.products.map(product => {
                    const cartItem = cart.find(c => c.product_id === product.id);
                    return (
                      <div key={product.id} className="bg-white rounded-xl shadow-sm p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{product.name}</h3>
                          <span className="text-lg font-bold text-primary">
                            ₹{product.selling_price.toFixed(2)}
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-500 mb-3">{product.description}</p>
                        )}
                        {product.mrp > product.selling_price && (
                          <p className="text-xs text-gray-400 mb-2">
                            MRP: ₹{product.mrp.toFixed(2)}
                          </p>
                        )}
                        {cartItem ? (
                          <div className="flex items-center justify-between bg-primary/10 rounded-lg p-2">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="p-1 bg-white rounded-full"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-medium">{cartItem.quantity}</span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="p-1 bg-white rounded-full"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeFromCart(product.id)}
                              className="text-xs text-red-500 ml-2"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Your Cart</h2>
                <button onClick={() => setShowCart(false)} className="p-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.product_id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">₹{item.price} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.product_id, -1)} className="p-1 bg-white rounded">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-medium w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product_id, 1)} className="p-1 bg-white rounded">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {cart.length > 0 && (
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex justify-between text-lg font-bold mb-4">
                    <span>Total:</span>
                    <span>₹{getCartTotal().toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuCatalogPage;