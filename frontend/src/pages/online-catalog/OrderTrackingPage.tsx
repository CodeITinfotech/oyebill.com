import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Clock, MapPin, Phone, CheckCircle, ChefHat, Bike, Home, Package } from 'lucide-react';

interface OrderTrackingPageProps {
  restaurantId: string;
}

const STATUS_STEPS = [
  { key: 'new', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'preparing', label: 'Preparing', icon: Chef },
  { key: 'ready', label: 'Ready', icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: Home },
];

const STATUS_STEPS_PICKUP = [
  { key: 'new', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'preparing', label: 'Preparing', icon: Chef },
  { key: 'ready', label: 'Ready for Pickup', icon: Package },
  { key: 'completed', label: 'Picked Up', icon: Home },
];

export const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ restaurantId }) => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (orderNumber) {
      loadOrder();
      // Poll for updates every 30 seconds
      const interval = setInterval(loadOrder, 30000);
      return () => clearInterval(interval);
    }
  }, [orderNumber]);

  const loadOrder = async () => {
    if (!orderNumber) return;
    
    try {
      const response = await api.trackOrder(orderNumber);
      if (response.success && response.data) {
        setOrder(response.data);
        setLastUpdated(new Date());
      } else {
        setError(response.error || 'Order not found');
      }
    } catch (err) {
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status: string) => {
    const steps = order?.order_type === 'delivery' ? STATUS_STEPS : STATUS_STEPS_PICKUP;
    return steps.findIndex(s => s.key === status);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
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

  const steps = order.order_type === 'delivery' ? STATUS_STEPS : STATUS_STEPS_PICKUP;
  const currentStepIndex = getStatusIndex(order.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(`/catalog/${restaurantId}/menu`)} className="p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold">Order #{order.order_number}</h1>
              <p className="text-xs text-gray-500">Updated {lastUpdated.toLocaleTimeString()}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Status Progress */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold mb-6">Order Status</h2>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={step.key} className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-primary/30' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className={`text-xs mt-2 text-center ${isCompleted ? 'text-primary font-medium' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
          
          {order.estimated_ready_time && order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className="mt-6 p-4 bg-primary/10 rounded-lg text-center">
              <p className="text-sm text-gray-600">Estimated {order.order_type === 'delivery' ? 'Delivery' : 'Ready'}</p>
              <p className="text-xl font-bold text-primary">
                {formatTime(order.estimated_ready_time)}
              </p>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">Order Details</h2>
              <p className="text-sm text-gray-500">
                Placed on {new Date(order.created_at).toLocaleDateString()} at {formatTime(order.created_at)}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
              order.status === 'completed' ? 'bg-green-100 text-green-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {order.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="border-t pt-4 space-y-2">
            {order.items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span>{item.product_name} × {item.quantity}</span>
                <span>₹{item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₹{order.subtotal.toFixed(2)}</span>
            </div>
            {order.delivery_charge > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery</span>
                <span>₹{order.delivery_charge.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>₹{order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Customer & Restaurant Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-medium">{order.customer_name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-gray-500">{order.customer_phone}</p>
                <p className="text-sm text-gray-500">{order.customer_email}</p>
              </div>
            </div>

            {order.order_type === 'pickup' && (
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="font-medium text-primary mb-1">Pickup Instructions</p>
                <p className="text-sm text-gray-700">
                  Please arrive at the restaurant and show this order number: <strong>{order.order_number}</strong>
                </p>
              </div>
            )}

            {order.order_type === 'delivery' && order.delivery_address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-medium">Delivery Address</p>
                  <p className="text-sm text-gray-500">{order.delivery_address}</p>
                  {order.delivery_distance_km && (
                    <p className="text-xs text-gray-400 mt-1">Distance: {order.delivery_distance_km}km</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Restaurant Info */}
        {order.restaurant && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4">Restaurant</h2>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-gray-500">{order.restaurant.name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div>
                <p className="font-medium">{order.restaurant.name}</p>
                {order.restaurant.address && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {order.restaurant.address}
                  </p>
                )}
                {order.restaurant.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {order.restaurant.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {order.status === 'new' && (
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to cancel this order?')) {
                const response = await api.cancelCustomerOrder(order.id);
                if (response.success) {
                  loadOrder();
                }
              }
            }}
            className="w-full py-3 border border-red-500 text-red-500 rounded-lg hover:bg-red-50"
          >
            Cancel Order
          </button>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPage;