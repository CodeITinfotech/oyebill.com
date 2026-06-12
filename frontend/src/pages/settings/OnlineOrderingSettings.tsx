import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Card, CardBody, CardHeader, Button, Input, toast } from '../../components/ui';
import { Globe, Clock, Truck, ExternalLink, Check, ShoppingBag, MapPin, CreditCard, DollarSign, Smartphone } from 'lucide-react';

interface OnlineOrderingSettingsProps {
  restaurantId: string;
}

export const OnlineOrderingSettings: React.FC<OnlineOrderingSettingsProps> = ({ restaurantId }) => {
  const [settings, setSettings] = useState({
    isEnabled: true,
    freeDeliveryRadiusKm: 5,
    paidDeliveryRadiusKm: 10,
    deliveryCharge: 0,
    minOrderAmount: 0,
    allowPickup: true,
    allowDelivery: true,
    estimatedPrepTimeMinutes: 20,
    deliveryInstructions: '',
  });
  
  const [paymentSettings, setPaymentSettings] = useState({
    pickupMinOrderAmount: 0,
    pickupAcceptCash: true,
    pickupAcceptUpi: true,
    pickupAcceptCard: true,
    pickupAcceptPaypal: false,
    deliveryMinOrderAmount: 0,
    deliveryAcceptCash: true,
    deliveryAcceptUpi: true,
    deliveryAcceptCard: true,
    deliveryAcceptPaypal: false,
    upiId: '',
    upiMerchantName: '',
    phonepeMerchantId: '',
    phonepeMerchantKey: '',
    phonepeEnvironment: 'sandbox',
    phonepeIsEnabled: false,
    stripeApiKey: '',
    stripeWebhookSecret: '',
    stripeEnvironment: 'test',
    stripeIsEnabled: false,
    paypalClientId: '',
    paypalClientSecret: '',
    paypalEnvironment: 'sandbox',
    paypalIsEnabled: false,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'config' | 'payment'>('config');

  useEffect(() => {
    loadSettings();
    loadPaymentSettings();
    loadStats();
  }, [restaurantId]);

  const loadSettings = async () => {
    try {
      const response = await api.getOnlineOrderingSettingsAdmin();
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentSettings = async () => {
    try {
      const response = await api.getPaymentSettings();
      if (response.success && response.data) {
        setPaymentSettings(response.data);
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
    }
  };

  const loadStats = async () => {
    try {
      const statsResponse = await api.getOnlineOrderingStats();
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      const ordersResponse = await api.getCustomerOnlineOrders();
      if (ordersResponse.success && ordersResponse.data) {
        setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setOrders([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.updateOnlineOrderingSettings(settings);
      if (response.success) {
        toast('success', 'Online ordering settings saved');
      } else {
        toast('error', response.error || 'Failed to save settings');
      }
    } catch (error) {
      toast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    setSavingPayment(true);
    try {
      const response = await api.updatePaymentSettings(paymentSettings);
      if (response.success) {
        toast('success', 'Payment settings saved');
      } else {
        toast('error', response.error || 'Failed to save payment settings');
      }
    } catch (error) {
      toast('error', 'Failed to save payment settings');
    } finally {
      setSavingPayment(false);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      const response = await api.updateCustomerOnlineOrderStatus(orderId, status);
      if (response.success) {
        toast('success', `Order status updated to ${status}`);
        loadStats();
      } else {
        toast('error', response.error || 'Failed to update status');
      }
    } catch (error) {
      toast('error', 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-text-muted text-sm">Today's Orders</p>
          <p className="text-2xl font-bold">{stats?.todayOrders || 0}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-text-muted text-sm">Today's Revenue</p>
          <p className="text-2xl font-bold">₹{(stats?.todayRevenue || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-text-muted text-sm">Pending Orders</p>
          <p className="text-2xl font-bold">{stats?.new || 0}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-text-muted text-sm">Total Orders</p>
          <p className="text-2xl font-bold">{stats?.total || 0}</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveSection('config')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeSection === 'config'
              ? 'bg-accent text-white'
              : 'bg-white/10 text-text-secondary hover:text-white'
          }`}
        >
          📋 Configuration
        </button>
        <button
          onClick={() => setActiveSection('payment')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'payment'
              ? 'bg-accent text-white'
              : 'bg-white/10 text-text-secondary hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Settings
        </button>
      </div>

      {/* Configuration Section */}
      {activeSection === 'config' && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Online Ordering Configuration</h2>
            <p className="text-sm text-text-muted">Configure how customers can order from your menu online</p>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <p className="font-medium">Enable Online Ordering</p>
                <p className="text-sm text-text-muted">Allow customers to place orders through your online menu</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.isEnabled}
                  onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            {/* Order Types */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Pickup</p>
                  <label className="relative inline-flex items-center cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={settings.allowPickup}
                      onChange={(e) => setSettings({ ...settings, allowPickup: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Delivery</p>
                  <label className="relative inline-flex items-center cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={settings.allowDelivery}
                      onChange={(e) => setSettings({ ...settings, allowDelivery: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Delivery Radius */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Zones
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Free Delivery Radius (km)"
                  type="number"
                  value={settings.freeDeliveryRadiusKm}
                  onChange={(e) => setSettings({ ...settings, freeDeliveryRadiusKm: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.5}
                />
                <Input
                  label="Maximum Delivery Radius (km)"
                  type="number"
                  value={settings.paidDeliveryRadiusKm}
                  onChange={(e) => setSettings({ ...settings, paidDeliveryRadiusKm: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.5}
                />
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Free delivery</strong> for customers within {settings.freeDeliveryRadiusKm}km<br />
                  <strong>Paid delivery</strong> (₹{settings.deliveryCharge.toFixed(2)}) for {settings.freeDeliveryRadiusKm}-{settings.paidDeliveryRadiusKm}km<br />
                  <strong>No delivery</strong> beyond {settings.paidDeliveryRadiusKm}km
                </p>
              </div>
            </div>

            {/* Delivery Charge */}
            <Input
              label="Delivery Charge (₹)"
              type="number"
              value={settings.deliveryCharge}
              onChange={(e) => setSettings({ ...settings, deliveryCharge: parseFloat(e.target.value) || 0 })}
              min={0}
            />

            {/* Minimum Order */}
            <Input
              label="Minimum Order Amount (₹)"
              type="number"
              value={settings.minOrderAmount}
              onChange={(e) => setSettings({ ...settings, minOrderAmount: parseFloat(e.target.value) || 0 })}
              min={0}
            />

            {/* Prep Time */}
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-text-muted" />
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Estimated Prep Time (minutes)</label>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={settings.estimatedPrepTimeMinutes}
                  onChange={(e) => setSettings({ ...settings, estimatedPrepTimeMinutes: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-sm text-text-muted mt-1">Current: {settings.estimatedPrepTimeMinutes} minutes</p>
              </div>
            </div>

            {/* Delivery Instructions */}
            <div>
              <label className="block text-sm font-medium mb-1">Delivery Instructions (for customers)</label>
              <textarea
                value={settings.deliveryInstructions || ''}
                onChange={(e) => setSettings({ ...settings, deliveryInstructions: e.target.value })}
                placeholder="E.g., Please ensure someone is available to receive the delivery"
                className="w-full px-4 py-3 bg-background-secondary border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-accent"
                rows={3}
              />
            </div>

            {/* Catalog URL */}
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="font-medium mb-2">Online Menu Link</h4>
              <p className="text-sm text-text-muted mb-3">Share this link with customers to access your online menu</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-background-secondary rounded text-sm">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/catalog/{restaurantId}/menu
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/catalog/${restaurantId}/menu`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Payment Settings Section */}
      {activeSection === 'payment' && (
        <div className="space-y-6">
          {/* Pickup Payment Settings */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Pickup Payment Options
              </h2>
              <p className="text-sm text-text-muted">Configure payment methods for pickup orders</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Minimum Order Amount for Pickup (₹)"
                type="number"
                value={paymentSettings.pickupMinOrderAmount}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, pickupMinOrderAmount: parseFloat(e.target.value) || 0 })}
                min={0}
              />
              <div>
                <p className="text-sm font-medium mb-3">Accepted Payment Methods for Pickup</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.pickupAcceptCash}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, pickupAcceptCash: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>Cash</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.pickupAcceptUpi}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, pickupAcceptUpi: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Smartphone className="w-4 h-4 text-blue-500" />
                    <span>UPI</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.pickupAcceptCard}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, pickupAcceptCard: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    <span>Card</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.pickupAcceptPaypal}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, pickupAcceptPaypal: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-blue-500 font-bold text-sm">PayPal</span>
                  </label>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Delivery Payment Settings */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Delivery Payment Options
              </h2>
              <p className="text-sm text-text-muted">Configure payment methods for delivery orders</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Minimum Order Amount for Delivery (₹)"
                type="number"
                value={paymentSettings.deliveryMinOrderAmount}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, deliveryMinOrderAmount: parseFloat(e.target.value) || 0 })}
                min={0}
              />
              <div>
                <p className="text-sm font-medium mb-3">Accepted Payment Methods for Delivery</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.deliveryAcceptCash}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, deliveryAcceptCash: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>Cash</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.deliveryAcceptUpi}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, deliveryAcceptUpi: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Smartphone className="w-4 h-4 text-blue-500" />
                    <span>UPI</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.deliveryAcceptCard}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, deliveryAcceptCard: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    <span>Card</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={paymentSettings.deliveryAcceptPaypal}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, deliveryAcceptPaypal: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-blue-500 font-bold text-sm">PayPal</span>
                  </label>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* UPI Settings */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                UPI QR Code Settings
              </h2>
              <p className="text-sm text-text-muted">Configure UPI payment for generating QR codes on orders</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="UPI ID (e.g., yourname@upi)"
                type="text"
                value={paymentSettings.upiId || ''}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                placeholder="yourname@upi"
              />
              <Input
                label="Merchant Name (shown on QR)"
                type="text"
                value={paymentSettings.upiMerchantName || ''}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, upiMerchantName: e.target.value })}
                placeholder="Restaurant Name"
              />
            </CardBody>
          </Card>

          {/* Payment Gateway Configurations */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Payment Gateway Configuration
              </h2>
              <p className="text-sm text-text-muted">Configure online payment gateways (PhonePe, Stripe, PayPal)</p>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* PhonePe */}
              <div className="p-4 bg-white/5 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📱</span>
                    <h3 className="font-medium">PhonePe</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentSettings.phonepeIsEnabled}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, phonepeIsEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
                {paymentSettings.phonepeIsEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Merchant ID"
                      type="text"
                      value={paymentSettings.phonepeMerchantId || ''}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, phonepeMerchantId: e.target.value })}
                    />
                    <Input
                      label="Merchant Key"
                      type="password"
                      value={paymentSettings.phonepeMerchantKey || ''}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, phonepeMerchantKey: e.target.value })}
                    />
                    <div>
                      <label className="block text-sm font-medium mb-1">Environment</label>
                      <select
                        value={paymentSettings.phonepeEnvironment}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, phonepeEnvironment: e.target.value })}
                        className="w-full px-4 py-2 bg-background-secondary border border-white/10 rounded-lg text-text-primary"
                      >
                        <option value="sandbox">Sandbox (Testing)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Stripe */}
              <div className="p-4 bg-white/5 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💳</span>
                    <h3 className="font-medium">Stripe</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentSettings.stripeIsEnabled}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeIsEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
                {paymentSettings.stripeIsEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="API Key"
                      type="password"
                      value={paymentSettings.stripeApiKey || ''}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeApiKey: e.target.value })}
                    />
                    <Input
                      label="Webhook Secret"
                      type="password"
                      value={paymentSettings.stripeWebhookSecret || ''}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeWebhookSecret: e.target.value })}
                    />
                    <div>
                      <label className="block text-sm font-medium mb-1">Environment</label>
                      <select
                        value={paymentSettings.stripeEnvironment}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeEnvironment: e.target.value })}
                        className="w-full px-4 py-2 bg-background-secondary border border-white/10 rounded-lg text-text-primary"
                      >
                        <option value="test">Test Mode</option>
                        <option value="live">Live Mode</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* PayPal */}
              <div className="p-4 bg-white/5 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🅿️</span>
                    <h3 className="font-medium">PayPal</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentSettings.paypalIsEnabled}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, paypalIsEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
                {paymentSettings.paypalIsEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Client ID"
                      type="text"
                      value={paymentSettings.paypalClientId || ''}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, paypalClientId: e.target.value })}
                    />
                    <Input
                      label="Client Secret"
                      type="password"
                      value={paymentSettings.paypalClientSecret || ''}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, paypalClientSecret: e.target.value })}
                    />
                    <div>
                      <label className="block text-sm font-medium mb-1">Environment</label>
                      <select
                        value={paymentSettings.paypalEnvironment}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, paypalEnvironment: e.target.value })}
                        className="w-full px-4 py-2 bg-background-secondary border border-white/10 rounded-lg text-text-primary"
                      >
                        <option value="sandbox">Sandbox (Testing)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-white/10">
                <Button onClick={handleSavePayment} disabled={savingPayment}>
                  {savingPayment ? 'Saving...' : 'Save Payment Settings'}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OnlineOrderingSettings;