import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Card, CardBody, CardHeader, Button, toast } from '../../components/ui';
import { ClipboardList, Check, Clock, Truck, X, Phone, MapPin, User } from 'lucide-react';

interface CustomerOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  status: string;
  total_amount: number;
  order_type: string;
  created_at: string;
  items: any[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  accepted: 'bg-blue-500',
  preparing: 'bg-orange-500',
  ready: 'bg-green-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const orderTypeLabels: Record<string, string> = {
  delivery: 'Delivery',
  pickup: 'Pickup',
  dine_in: 'Dine In',
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await api.getCustomerOnlineOrders();
      if (response.success && response.data) {
        setOrders(Array.isArray(response.data) ? response.data : []);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast('error', 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await api.updateCustomerOnlineOrderStatus(orderId, newStatus);
      if (response.success) {
        toast('success', `Order ${newStatus === 'completed' ? 'completed' : 'cancelled'}`);
        loadOrders();
      } else {
        toast('error', response.error || 'Failed to update order');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast('error', 'Failed to update order');
    }
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.status === filter);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-accent/20">
            <ClipboardList className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Customer Orders</h1>
            <p className="text-sm text-text-secondary">Online ordering customer orders</p>
          </div>
        </div>
        <Button onClick={loadOrders} variant="secondary" size="sm">
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-accent text-white'
                : 'bg-background-secondary hover:bg-white/10 text-text-secondary'
            }`}
          >
            {status === 'all' ? 'All Orders' : statusLabels[status] || status}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">No orders found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map(order => (
            <Card key={order.id}>
              <CardBody>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Order Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${statusColors[order.status] || 'bg-gray-500'}`} />
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-text-secondary">
                        {orderTypeLabels[order.order_type] || order.order_type}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      {order.customer_name && (
                        <span className="flex items-center gap-2 text-text-secondary">
                          <User className="w-4 h-4" />
                          {order.customer_name}
                        </span>
                      )}
                      {order.customer_phone && (
                        <span className="flex items-center gap-2 text-text-secondary">
                          <Phone className="w-4 h-4" />
                          {order.customer_phone}
                        </span>
                      )}
                    </div>

                    {order.delivery_address && (
                      <div className="flex items-start gap-2 text-sm text-text-secondary">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{order.delivery_address}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <span>{formatDate(order.created_at)}</span>
                      <span>{formatTime(order.created_at)}</span>
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div className="lg:w-48 space-y-2">
                    <div className="text-2xl font-bold text-accent">
                      {formatCurrency(order.total_amount)}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {order.items?.length || 0} items
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <>
                        <Button
                          onClick={() => updateStatus(order.id, 'accepted')}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => updateStatus(order.id, 'cancelled')}
                          variant="danger"
                          size="sm"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <Button
                        onClick={() => updateStatus(order.id, 'preparing')}
                        size="sm"
                      >
                        <Clock className="w-4 h-4 mr-1" />
                        Start Preparing
                      </Button>
                    )}
                    {order.status === 'preparing' && (
                      <Button
                        onClick={() => updateStatus(order.id, 'ready')}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Mark Ready
                      </Button>
                    )}
                    {order.status === 'ready' && (
                      <>
                        <Button
                          onClick={() => updateStatus(order.id, 'completed')}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Truck className="w-4 h-4 mr-1" />
                          {order.order_type === 'pickup' ? 'Picked Up' : 'Delivered'}
                        </Button>
                        <Button
                          onClick={() => updateStatus(order.id, 'cancelled')}
                          variant="danger"
                          size="sm"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="grid gap-2">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-text-secondary">
                            {item.quantity}x {item.name || item.product_name}
                          </span>
                          <span className="text-text-muted">
                            {formatCurrency(item.total_price || item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}