import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { MapPin, Clock, AlertCircle, CheckCircle, ChevronLeft } from 'lucide-react';

interface CheckoutPageProps {
  restaurantId: string;
}

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface LocationState {
  cart: CartItem[];
  restaurantId: string;
  restaurant: any;
  settings: any;
  customerEmail: string;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ restaurantId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDistance, setDeliveryDistance] = useState<number>(0);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_restaurant' | 'online'>('pay_at_restaurant');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deliveryValidation, setDeliveryValidation] = useState<any>(null);
  const [orderPlaced, setOrderPlaced] = useState<any>(null);

  useEffect(() => {
    if (state?.customerEmail) setCustomerEmail(state.customerEmail);
    if (state?.settings?.allowPickup && !state?.settings?.allowDelivery) {
      setOrderType('pickup');
    }
  }, [state]);

  const getCartTotal = () => {
    return state?.cart?.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0) || 0;
  };

  const getDeliveryCharge = () => {
    if (orderType === 'pickup') return 0;
    if (!deliveryValidation) return 0;
    return deliveryValidation.deliveryCharge || 0;
  };

  const getGrandTotal = () => {
    return getCartTotal() + getDeliveryCharge();
  };

  const validateDelivery = async () => {
    if (orderType !== 'delivery' || !deliveryDistance) return;

    try {
      const response = await api.checkDeliveryRange(restaurantId, deliveryDistance);
      if (response.success && response.data) {
        setDeliveryValidation(response.data);
        if (!response.data.inRange && !response.data.canPickup) {
          setError(`Delivery not available for your location. Maximum delivery distance is ${response.data.paidRadius}km.`);
        }
      }
    } catch (err) {
      console.error('Error validating delivery:', err);
    }
  };

  const handlePlaceOrder = async () => {
    if (!customerName || !customerEmail || !customerPhone) {
      setError('Please fill in all required fields');
      return;
    }

    if (orderType === 'delivery' && !deliveryAddress) {
      setError('Please enter your delivery address');
      return;
    }

    if (orderType === 'delivery' && deliveryValidation && !deliveryValidation.inRange) {
      setError('Delivery is not available for your location. Please select pickup instead.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderData = {
        restaurant_id: restaurantId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        delivery_address: orderType === 'delivery' ? deliveryAddress : undefined,
        order_type: orderType,
        delivery_distance_km: orderType === 'delivery' ? deliveryDistance : undefined,
        items: state?.cart?.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes
        })) || [],
        payment_method: paymentMethod,
        special_instructions: specialInstructions || undefined
      };

      const response = await api.placeCustomerOrder(orderData);

      if (response.success && response.data) {
        setOrderPlaced(response.data);
      } else {
        setError(response.error || 'Failed to place order');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!state?.cart || state.cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Your cart is empty</p>
          <button
            onClick={() => navigate(`/catalog/${restaurantId}/menu`)}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Go to Menu
          </button>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-600 mb-4">Your order has been confirmed</p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">Order Number</p>
            <p className="text-2xl font-bold text-primary">{orderPlaced.order_number}</p>
          </div>

          <div className="text-left bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Order Type</span>
              <span className="font-medium">{orderPlaced.order_type === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estimated Ready</span>
              <span className="font-medium">
                {orderPlaced.estimated_ready_time ? new Date(orderPlaced.estimated_ready_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '20 mins'}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span>₹{orderPlaced.total.toFixed(2)}</span>
            </div>
          </div>

          {orderPlaced.order_type === 'pickup' && (
            <div className="bg-primary/10 rounded-lg p-4 mb-6 text-left">
              <p className="font-medium text-primary mb-2">Pickup Instructions</p>
              <p className="text-sm text-gray-700">
                Please arrive at the restaurant and provide your order number: <strong>{orderPlaced.order_number}</strong>
              </p>
            </div>
          )}

          <button
            onClick={() => navigate(`/catalog/${restaurantId}/track/${orderPlaced.order_number}`)}
            className="w-full py-3 bg-primary text-white font-semibold rounded-lg"
          >
            Track Order
          </button>
          
          <button
            onClick={() => navigate(`/catalog/${restaurantId}/menu`)}
            className="w-full py-2 mt-2 text-gray-600 hover:text-primary"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Checkout</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Order Type Selection */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">Order Type</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOrderType('pickup')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                orderType === 'pickup'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Clock className={`w-6 h-6 mb-2 ${orderType === 'pickup' ? 'text-primary' : 'text-gray-400'}`} />
              <p className="font-medium">Pickup</p>
              <p className="text-xs text-gray-500">Ready in ~{state?.settings?.estimatedPrepTimeMinutes || 20} mins</p>
            </button>
            {state?.settings?.allowDelivery && (
              <button
                onClick={() => setOrderType('delivery')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  orderType === 'delivery'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <MapPin className={`w-6 h-6 mb-2 ${orderType === 'delivery' ? 'text-primary' : 'text-gray-400'}`} />
                <p className="font-medium">Delivery</p>
                <p className="text-xs text-gray-500">
                  {state?.settings?.freeDeliveryRadiusKm || 5}km free
                </p>
              </button>
            )}
          </div>

          {/* Delivery Info */}
          {orderType === 'delivery' && state?.settings && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="text-blue-800">
                <strong>Free delivery</strong> within {state.settings.freeDeliveryRadiusKm}km<br />
                <strong>₹{state.settings.deliveryCharge}</strong> delivery charge between {state.settings.freeDeliveryRadiusKm}-{state.settings.paidDeliveryRadiusKm}km<br />
                <strong>No delivery</strong> beyond {state.settings.paidDeliveryRadiusKm}km
              </p>
            </div>
          )}
        </div>

        {/* Delivery Distance (for delivery) */}
        {orderType === 'delivery' && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <h2 className="text-lg font-semibold mb-4">Your Location</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distance from restaurant (km)
              </label>
              <input
                type="number"
                value={deliveryDistance || ''}
                onChange={(e) => setDeliveryDistance(parseFloat(e.target.value) || 0)}
                onBlur={validateDelivery}
                placeholder="Enter distance in km"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                step="0.5"
                min="0"
              />
              {deliveryDistance > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Enter the distance from restaurant to your location
                </p>
              )}
            </div>

            {deliveryValidation && (
              <div className={`p-3 rounded-lg ${deliveryValidation.inRange ? 'bg-green-50' : 'bg-red-50'}`}>
                {deliveryValidation.inRange ? (
                  <p className="text-green-700 text-sm">
                    ✓ {deliveryValidation.message}
                    {deliveryValidation.deliveryCharge > 0 && (
                      <span className="font-medium"> - ₹{deliveryValidation.deliveryCharge} charge</span>
                    )}
                  </p>
                ) : (
                  <p className="text-red-700 text-sm">
                    ✗ {deliveryValidation.canPickup 
                      ? 'Please select Pickup instead as delivery is not available for your location.'
                      : 'Delivery not available for your location.'
                    }
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Address *
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter your complete delivery address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Contact Details */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">Contact Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">Special Instructions</h2>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="Any special requests? (e.g., no onions, extra spicy)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
          <div className="space-y-3">
            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              paymentMethod === 'pay_at_restaurant' ? 'border-primary bg-primary/5' : 'border-gray-200'
            }`}>
              <input
                type="radio"
                name="payment"
                value="pay_at_restaurant"
                checked={paymentMethod === 'pay_at_restaurant'}
                onChange={() => setPaymentMethod('pay_at_restaurant')}
                className="w-5 h-5 text-primary"
              />
              <div>
                <p className="font-medium">Pay at Restaurant</p>
                <p className="text-sm text-gray-500">Pay when you pick up or upon delivery</p>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              paymentMethod === 'online' ? 'border-primary bg-primary/5' : 'border-gray-200'
            }`}>
              <input
                type="radio"
                name="payment"
                value="online"
                checked={paymentMethod === 'online'}
                onChange={() => setPaymentMethod('online')}
                className="w-5 h-5 text-primary"
              />
              <div>
                <p className="font-medium">Pay Online Now</p>
                <p className="text-sm text-gray-500">Pay in advance with UPI/Card/Net Banking</p>
              </div>
            </label>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4">
            {state?.cart.map((item: CartItem) => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span>{item.name} × {item.quantity}</span>
                <span>₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₹{getCartTotal().toFixed(2)}</span>
            </div>
            {orderType === 'delivery' && getDeliveryCharge() > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery Charge</span>
                <span>₹{getDeliveryCharge().toFixed(2)}</span>
              </div>
            )}
            {orderType === 'delivery' && getDeliveryCharge() === 0 && deliveryDistance > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Free Delivery</span>
                <span>₹0.00</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span>₹{getGrandTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          onClick={handlePlaceOrder}
          disabled={loading || (orderType === 'delivery' && deliveryValidation && !deliveryValidation.inRange)}
          className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Placing Order...' : `Place Order - ₹${getGrandTotal().toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

export default CheckoutPage;