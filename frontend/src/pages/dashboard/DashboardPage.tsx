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
  ArrowUpRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#8B2635', '#D4A84B', '#52B788', '#457B9D', '#E63946', '#F4A261'];

export function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.getDashboardAnalytics(period);
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const monthlyChartData = monthlyRevenue?.map((m: any) => ({
    month: formatDate(m.month + '-01'),
    revenue: m.revenue,
    orders: m.orders
  })) || [];

  const salesChartData = productSales?.map((p: any) => ({
    name: p.category || 'Other',
    value: p.revenue
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Welcome back, {user?.name || 'Admin'}</p>
        </div>
        <div className="flex gap-2">
          {['today', 'week', 'month', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? 'bg-accent text-background-primary'
                  : 'bg-background-secondary text-text-secondary hover:bg-white/10'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Total Orders</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{summary?.totalOrders || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-accent" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <ArrowUpRight className="w-4 h-4 text-success" />
            <span className="text-success">Completed</span>
            <span className="text-text-muted">billing</span>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Total Revenue</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{formatCurrency(summary?.totalRevenue || 0)}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-success" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <ArrowUpRight className="w-4 h-4 text-success" />
            <span className="text-success">+12%</span>
            <span className="text-text-muted">vs last period</span>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Occupied Tables</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{tableStats?.occupied || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-warning" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm text-text-muted">
            <span>{tableStats?.available || 0} available</span>
            <span>•</span>
            <span>{tableStats?.total || 0} total</span>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Avg Order Value</p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {summary?.totalOrders > 0 ? formatCurrency(summary?.totalRevenue / summary?.totalOrders) : '₹0'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-info/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-info" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <span className="text-text-muted">Per completed order</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 card p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Revenue Overview</h3>
          {monthlyChartData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#16213E', 
                      border: '1px solid #ffffff1a',
                      borderRadius: '8px',
                      color: '#EAEAEC'
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#D4A84B" 
                    strokeWidth={3}
                    dot={{ fill: '#D4A84B', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-text-muted">
              No revenue data available
            </div>
          )}
        </div>

        {/* Revenue by Payment */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Sales by Category</h3>
          {salesChartData.length > 0 ? (
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
                    {salesChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#16213E', 
                      border: '1px solid #ffffff1a',
                      borderRadius: '8px',
                      color: '#EAEAEC'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-muted">
              No payment data
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {productSales?.slice(0, 5).map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs text-text-muted">{item.category || 'Other'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Top Selling Products</h3>
            <Target className="w-5 h-5 text-accent" />
          </div>
          {topProducts && topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.slice(0, 6).map((product: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{product.name}</p>
                    <p className="text-xs text-text-muted">{product.quantity} sold</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-accent">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted">
              <Utensils className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No sales data yet</p>
            </div>
          )}
        </div>

        {/* Waiter Rankings */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Waiter Rankings</h3>
            <Award className="w-5 h-5 text-success" />
          </div>
          {waiterRankings && waiterRankings.length > 0 ? (
            <div className="space-y-3">
              {waiterRankings.slice(0, 6).map((waiter: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-background-secondary'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{waiter.name}</p>
                    <p className="text-xs text-text-muted">{waiter.total_orders} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-success">{formatCurrency(waiter.total_revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No waiter data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Sales by Category */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Sales by Category</h3>
          {productSales && productSales.length > 0 ? (
            <div className="space-y-3">
              {productSales.slice(0, 5).map((item: any, index: number) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-primary">{item.category || 'Other'}</span>
                    <span className="text-sm font-semibold text-accent">{formatCurrency(item.revenue)}</span>
                  </div>
                  <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (item.revenue / (productSales[0]?.revenue || 1)) * 100)}%`,
                        backgroundColor: COLORS[index % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted">
              <p>No category data</p>
            </div>
          )}
        </div>

        {/* Busser Rankings */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Busser Performance</h3>
            <Clock className="w-5 h-5 text-warning" />
          </div>
          {busserRankings && busserRankings.length > 0 ? (
            <div className="space-y-3">
              {busserRankings.slice(0, 5).map((busser: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center text-warning font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{busser.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warning">{busser.tables_cleaned} tables</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted">
              <p>No busser data</p>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Recent Orders</h3>
            <Clock className="w-5 h-5 text-text-muted" />
          </div>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.slice(0, 5).map((order: any, index: number) => (
                <div key={index} className="flex items-center gap-3 pb-3 border-b border-white/10 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">#{order.orderNumber?.slice(-6)}</p>
                    <p className="text-xs text-text-muted">Table {order.tableNumber || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-accent">{formatCurrency(order.total)}</p>
                    <p className="text-xs text-text-muted">{formatDateTime(order.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted">
              <p>No recent orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}