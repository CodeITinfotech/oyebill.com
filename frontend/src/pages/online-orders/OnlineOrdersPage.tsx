import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

interface OnlineOrder {
  id: string;
  external_order_id: string;
  platform: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  order_data: any;
  status: string;
  total_amount: number;
  items_count: number;
  estimated_time: number;
  linked_order_id: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-yellow-500',
  accepted: 'bg-blue-500',
  preparing: 'bg-orange-500',
  ready: 'bg-green-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500',
  declined: 'bg-red-700',
};

const statusLabels: Record<string, string> = {
  new: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
};

const platformColors: Record<string, string> = {
  swiggy: 'bg-orange-500',
  zomato: 'bg-red-600',
  ubereats: 'bg-black',
  direct: 'bg-blue-500',
};

export default function OnlineOrdersPage() {
  const navigate = useNavigate();
  const [ordersData, setOrdersData] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [counts, setCounts] = useState({ new: 0, accepted: 0, preparing: 0, ready: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      console.log('[OnlineOrders] Fetching orders...');
      setError(null);
      const params: Record<string, any> = { limit: 100 };
      if (filter !== 'all') {
        params.status = filter;
      }
      const response = await api.getOnlineOrders(params);
      console.log('[OnlineOrders] Response:', response);
      // The API returns { success: true, data: { success: true, data: [...] } }
      // So we need to access response.data.data for the actual orders
      const apiData = response.data?.data || response.data;
      if (response.success && apiData) {
        const data = Array.isArray(apiData) ? apiData : [];
        console.log('[OnlineOrders] Setting orders:', data.length);
        setOrdersData(data);
      } else if (response.error) {
        console.log('[OnlineOrders] API Error:', response.error);
        setError(response.error);
      } else {
        console.log('[OnlineOrders] No data or success false');
        setOrdersData([]);
      }
    } catch (error: any) {
      console.error('Error fetching online orders:', error);
      setError(error.message || 'Failed to fetch orders');
    }
  }, [filter]);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await api.getOnlineOrderCounts();
      // Handle nested data structure
      const apiData = response.data?.data || response.data;
      if (response.success && apiData) {
        setCounts(apiData);
      }
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  }, []);

  useEffect(() => {
    console.log('[OnlineOrders] useEffect triggered');
    const loadData = async () => {
      console.log('[OnlineOrders] Loading data...');
      setLoading(true);
      await Promise.all([fetchOrders(), fetchCounts()]);
      setLoading(false);
      console.log('[OnlineOrders] Data loaded');
    };
    loadData();
    const interval = setInterval(() => {
      console.log('[OnlineOrders] Interval refresh');
      fetchOrders();
      fetchCounts();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchCounts]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await api.updateOnlineOrderStatus(id, status);
      if (response.success) {
        fetchOrders();
        fetchCounts();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAcceptOrder = async (order: OnlineOrder) => {
    try {
      setAcceptingOrderId(order.id);
      
      // Update status to accepted
      const response = await api.updateOnlineOrderStatus(order.id, 'accepted');
      if (response.success) {
        // Navigate to billing page with online order data
        const orderData = {
          onlineOrderId: order.id,
          externalOrderId: order.external_order_id,
          platform: order.platform,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          deliveryAddress: order.delivery_address,
          items: order.order_data?.items || [],
          totalAmount: order.total_amount,
        };
        
        // Store in sessionStorage for the billing page to retrieve
        sessionStorage.setItem('onlineOrderData', JSON.stringify(orderData));
        
        // Navigate to billing page
        navigate('/billing', { state: { fromOnlineOrders: true } });
      }
    } catch (error) {
      console.error('Error accepting order:', error);
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  const tabs = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'new', label: 'New', count: counts.new, color: 'bg-yellow-500' },
    { key: 'accepted', label: 'Accepted', count: counts.accepted, color: 'bg-blue-500' },
    { key: 'preparing', label: 'Preparing', count: counts.preparing, color: 'bg-orange-500' },
    { key: 'ready', label: 'Ready', count: counts.ready, color: 'bg-green-500' },
  ];

  const filteredOrders = filter === 'all' 
    ? ordersData 
    : ordersData.filter(o => o.status === filter);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Online Orders</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-muted">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
        
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                filter === tab.key
                  ? (tab.color ? `${tab.color} text-white` : 'bg-accent text-white')
                  : 'bg-background-tertiary text-text-secondary hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${filter === tab.key ? 'bg-white/20' : 'bg-background-secondary'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-error">
            <p className="text-lg font-medium">Error: {error}</p>
            <button onClick={fetchOrders} className="mt-4 px-4 py-2 bg-accent text-white rounded-lg">
              Retry
            </button>
          </div>
        ) : (!filteredOrders || filteredOrders.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg font-medium">No orders found</p>
            <p className="text-sm">New orders from Swiggy/Zomato will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className={`bg-background-secondary rounded-lg border border-white/10 overflow-hidden ${
                  order.status === 'new' ? 'ring-1 ring-yellow-500/50' : ''
                }`}
              >
                {/* Order Header */}
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${platformColors[order.platform] || 'bg-gray-500'} flex items-center justify-center text-white font-bold text-sm`}>
                        {order.platform?.charAt(0).toUpperCase() || 'O'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{order.external_order_id || order.id.slice(0, 8)}</p>
                        <p className="text-xs text-text-muted">{order.customer_name || 'Guest'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{(order.total_amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-text-muted">{getTimeSince(order.created_at)}</p>
                    </div>
                  </div>

                  {/* Items preview */}
                  {order.order_data?.items && order.order_data.items.length > 0 && (
                    <div className="mb-2 text-xs text-text-secondary truncate">
                      {order.order_data.items.slice(0, 2).map((item: any, i: number) => (
                        <span key={i}>
                          {item.quantity}x {item.name}
                          {i < Math.min(order.order_data.items.length, 2) - 1 && ' • '}
                        </span>
                      ))}
                      {order.order_data.items.length > 2 && (
                        <span className="text-text-muted"> +{order.order_data.items.length - 2}</span>
                      )}
                    </div>
                  )}

                  {/* Status badge and actions */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${statusColors[order.status] || 'bg-gray-500'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                    <div className="flex gap-1">
                      {order.status === 'new' && (
                        <>
                          <button
                            onClick={() => handleAcceptOrder(order)}
                            disabled={acceptingOrderId === order.id}
                            className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {acceptingOrderId === order.id ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'declined')}
                            className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {order.status === 'accepted' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'preparing')}
                          className="px-2 py-1 bg-orange-600 text-white text-xs font-medium rounded hover:bg-orange-700"
                        >
                          Prepare
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'ready')}
                          className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
                        >
                          Ready
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
