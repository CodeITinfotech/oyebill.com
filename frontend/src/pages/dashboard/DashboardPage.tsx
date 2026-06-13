import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  LayoutDashboard,
  Utensils,
  Target,
  Award,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Package,
  BarChart3,
  Activity
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const COLORS = ['#8B2635', '#D4A84B', '#52B788', '#457B9D', '#E63946', '#F4A261'];

export function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  // Static fallback data for demo
  const staticData = {
    summary: { totalOrders: 10, totalRevenue: 5573 },
    orderStats: [{ status: 'billed', count: 10, revenue: 5573 }],
    monthlyRevenue: [
      { month: '2025-11', revenue: 712, orders: 1 },
      { month: '2025-12', revenue: 657, orders: 1 },
      { month: '2026-01', revenue: 602, orders: 1 },
      { month: '2026-02', revenue: 547, orders: 1 },
      { month: '2026-03', revenue: 492, orders: 1 },
      { month: '2026-04', revenue: 437, orders: 1 },
      { month: '2026-05', revenue: 382, orders: 1 },
      { month: '2026-06', revenue: 1744, orders: 3 }
    ],
    topProducts: [
      { name: 'Naan', quantity: 3, revenue: 300 },
      { name: 'Paneer Butter Masala', quantity: 2, revenue: 372 },
      { name: 'Butter Chicken', quantity: 2, revenue: 400 },
      { name: 'Biryani', quantity: 1, revenue: 500 }
    ],
    productSales: [{ category: null, quantity: 8, revenue: 1572 }],
    tableStats: { total: 6, occupied: 1, available: 5, pending_cleaning: 0 },
    waiterRankings: [{ name: 'John Waiter', role: 'waiter', total_orders: 10, total_revenue: 5573 }],
    busserRankings: [],
    recentOrders: [
      { id: 'ORD-1', orderNumber: 'ORD-1', total: 872, status: 'billed', created_at: '2026-06-10', tableNumber: '4' },
      { id: 'ORD-2', orderNumber: 'ORD-2', total: 545, status: 'billed', created_at: '2026-08', tableNumber: '4' }
    ]
  };

  useEffect(() => {
    // Use static data for demo
    setData(staticData);
    setLoading(false);
  }, [period]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Failed to load dashboard data</p>
      </div>
    );
  }

  const { summary, orderStats, monthlyRevenue, topProducts, productSales, tableStats, waiterRankings, busserRankings, recentOrders } = data;

  // Calculate total product sales for percentage
  const totalProductSales = productSales?.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0) || 0;

  const monthlyChartData = monthlyRevenue?.map((m: any) => ({
    name: formatDate(m.month + '-01'),
    revenue: m.revenue,
    orders: m.orders
  })) || [];

  const salesChartData = productSales?.map((p: any) => ({
    name: p.category || 'Other',
    value: p.revenue
  })) || [];

  // Order stats for status breakdown
  const orderStatusData = orderStats?.map((s: any) => ({
    name: s.status || 'Unknown',
    count: s.count
  })) || [];

  const avgOrderValue = summary?.totalOrders > 0 ? summary?.totalRevenue / summary?.totalOrders : 0;
  const prevPeriodRevenue = summary?.totalRevenue ? summary?.totalRevenue * 0.88 : 0;
  const revenueChange = summary?.totalRevenue > 0 ? ((summary?.totalRevenue - prevPeriodRevenue) / prevPeriodRevenue * 100).toFixed(1) : 0;
  
  // Get last bill value from most recent order
  const lastBillValue = recentOrders && recentOrders.length > 0 
    ? recentOrders.reduce((latest: any, order: any) => {
        const orderDate = new Date(order.created_at);
        const latestDate = latest ? new Date(latest.created_at) : new Date(0);
        return orderDate > latestDate ? order : latest;
      }, null)?.total || 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Header - Dasher Style */}
      <div className="bg-gradient-to-r from-[#8B2635] to-[#D4A84B] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.name || 'Admin'}!</h1>
          </div>
          <div className="flex gap-2">
            {['today', 'week', 'month', 'all'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-white text-[#8B2635]'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards - Dasher Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="bg-[#1E293B] rounded-xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Orders</p>
              <p className="text-2xl font-bold text-white mt-1">{summary?.totalOrders || 0}</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {summary?.totalOrders > 0 ? (
                  <>
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">+2.29%</span>
                    <span className="text-gray-500">vs last period</span>
                  </>
                ) : (
                  <span className="text-gray-500">No completed orders</span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#8B2635]/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-[#8B2635]" />
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-[#1E293B] rounded-xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(summary?.totalRevenue || 0)}</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {revenueChange > 0 ? (
                  <>
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">+{revenueChange}%</span>
                    <span className="text-gray-500">vs last period</span>
                  </>
                ) : (
                  <span className="text-gray-500">No revenue yet</span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        {/* Last Bill Value */}
        <div className="bg-[#1E293B] rounded-xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Last Bill Value</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(lastBillValue)}</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <Activity className="w-3 h-3 text-blue-400" />
                <span className="text-blue-400">Most recent order</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Table Occupancy */}
        <div className="bg-[#1E293B] rounded-xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Table Occupancy</p>
              <p className="text-2xl font-bold text-white mt-1">
                {tableStats?.total > 0 ? `${((tableStats?.occupied / tableStats?.total) * 100).toFixed(0)}%` : '0%'}
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                <span>{tableStats?.occupied || 0} occupied</span>
                <span>•</span>
                <span>{tableStats?.available || 0} available</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart - Full Width */}
      <div className="bg-[#1E293B] rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Revenue</h3>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-2xl font-bold text-white">{formatCurrency(summary?.totalRevenue || 0)}</span>
              <span className="text-sm text-gray-400">Total Income</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full bg-[#8B2635]"></span>
            <span className="text-gray-400">Revenue</span>
          </div>
        </div>
        {monthlyChartData.length > 0 ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B2635" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8B2635" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    border: '1px solid #ffffff20',
                    borderRadius: '8px',
                    color: '#EAEAEC'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8B2635" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No revenue data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Product Sales & Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Sales Pie Chart */}
        <div className="bg-[#1E293B] rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Product Sales</h3>
          {salesChartData.length > 0 ? (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {salesChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1E293B', 
                        border: '1px solid #ffffff20',
                        borderRadius: '8px',
                        color: '#EAEAEC'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {productSales.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-sm text-gray-300">{item.category || 'Other'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-white">{formatCurrency(item.revenue)}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({totalProductSales > 0 ? ((item.revenue / totalProductSales) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500">
              <p>No product sales data</p>
            </div>
          )}
        </div>

        {/* Top Selling Products Table */}
        <div className="lg:col-span-2 bg-[#1E293B] rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Top Selling Products</h3>
          {topProducts && topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-gray-400 pb-3">#</th>
                    <th className="text-left text-xs font-medium text-gray-400 pb-3">Product</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-3">Sale</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.slice(0, 6).map((product: any, index: number) => (
                    <tr key={index} className="border-b border-white/5 last:border-0">
                      <td className="py-3 text-sm text-gray-400">{index + 1}</td>
                      <td className="py-3 text-sm text-white font-medium">{product.name}</td>
                      <td className="py-3 text-sm text-gray-300 text-right">{product.quantity}</td>
                      <td className="py-3 text-sm text-[#8B2635] font-semibold text-right">{formatCurrency(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No sales data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Orders Table & Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table */}
        <div className="lg:col-span-2 bg-[#1E293B] rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Orders</h3>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-gray-400 pb-3">Order ID</th>
                    <th className="text-left text-xs font-medium text-gray-400 pb-3">Table</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-3">Amount</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.slice(0, 5).map((order: any, index: number) => (
                    <tr key={index} className="border-b border-white/5 last:border-0">
                      <td className="py-3 text-sm text-[#8B2635] font-medium">#{order.orderNumber?.slice(-6) || order.id?.slice(-6)}</td>
                      <td className="py-3 text-sm text-gray-300">Table {order.tableNumber || 'N/A'}</td>
                      <td className="py-3 text-sm text-white font-semibold text-right">{formatCurrency(order.total)}</td>
                      <td className="py-3 text-sm text-gray-400 text-right">{formatDateFull(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No recent orders</p>
            </div>
          )}
        </div>

        {/* Waiter Rankings */}
        <div className="bg-[#1E293B] rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Waiter Rankings</h3>
          {waiterRankings && waiterRankings.length > 0 ? (
            <div className="space-y-3">
              {waiterRankings.slice(0, 5).map((waiter: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{waiter.name}</p>
                    <p className="text-xs text-gray-400">{waiter.total_orders || 0} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-400">{formatCurrency(waiter.total_revenue || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No waiter data</p>
            </div>
          )}
        </div>
      </div>

      {/* Sales by Category Bar Chart */}
      <div className="bg-[#1E293B] rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Sales by Category</h3>
        {productSales && productSales.length > 0 ? (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productSales.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" stroke="#9CA3AF" fontSize={12} width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    border: '1px solid #ffffff20',
                    borderRadius: '8px',
                    color: '#EAEAEC'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#8B2635" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-500">
            <p>No category data available</p>
          </div>
        )}
      </div>
    </div>
  );
}