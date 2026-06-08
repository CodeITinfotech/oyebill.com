import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Select, Card, CardBody, CardHeader, toast, Toggle } from '../../components/ui';
import { User, Building, Users, Percent, Printer, Shield, Check, Plus, Trash2, Ticket, Calendar, Tag, UserPlus, LayoutGrid, QrCode, X } from 'lucide-react';
import { api } from '../../api';

type SettingsTab = 'restaurant' | 'profile' | 'users' | 'tax' | 'printer' | 'rights' | 'payment' | 'coupons' | 'tableStatus' | 'tableAllocations';
type PrinterTab = 'kot' | 'bill' | 'setup';

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const { user, restaurant, setRestaurant } = useAuthStore();
  const { settings, tables, fetchSettings, updateSettings, fetchTables } = useDataStore();
  
  const urlTab = searchParams.get('tab');
  const initialTab = urlTab && ['restaurant', 'profile', 'users', 'tax', 'printer', 'rights', 'coupons'].includes(urlTab) 
    ? urlTab as SettingsTab 
    : 'restaurant';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Table Allocations state
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
  const [editingMode, setEditingMode] = useState(false);

  // Restaurant form
  const [restaurantForm, setRestaurantForm] = useState({
    name: restaurant?.name || '',
    address: restaurant?.address || '',
    phone: restaurant?.phone || '',
    email: restaurant?.email || '',
    gstNumber: restaurant?.gstNumber || '',
    fssaiNumber: restaurant?.fssaiNumber || '',
  });

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Tax form
  const [taxForm, setTaxForm] = useState({
    taxName: 'GST',
    defaultTaxRate: '18',
    cgstRate: '9',
    sgstRate: '9',
    priceInclusiveTax: false,
    isActive: true,
  });

  // Printer form
  const [printerForm, setPrinterForm] = useState({
    kotPrinter: '',
    billPrinter: '',
    printCopies: '1',
    skipLinesBeforeCut: '3',
  });
  
  // Printer sub-tab
  const [printerTab, setPrinterTab] = useState<PrinterTab>('kot');
  
  // Printer detection state
  const [detectedPrinters, setDetectedPrinters] = useState<{name: string; type: string; address: string}[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>('');
  
  // KOT Setup form
  const [kotSetupForm, setKotSetupForm] = useState({
    showKotNumber: true,
    showDateTime: true,
    showTableNumber: true,
    showProductName: true,
    showQty: true,
    showRate: true,
    showWaiterName: true,
    strikeOldKotItems: true,
    showPreview: true,
  });
  
  // Bill Setup form
  const [billSetupForm, setBillSetupForm] = useState({
    showRestaurantName: true,
    showAddress: true,
    showPhone: true,
    showGstFssai: true,
    showProductName: true,
    showQty: true,
    showRate: true,
    showGst: true,
    showSubTotal: true,
    showDiscount: true,
    showGstVat: true,
    showGrandTotal: true,
    specialMessage: 'Thank you for visiting!',
    showPreview: true,
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    upiId: '',
    merchantName: restaurant?.name || '',
    showQrOnBill: true,
    showQrOnKot: false,
  });

  // Online Orders Integration form
  const [onlineOrdersForm, setOnlineOrdersForm] = useState({
    swiggyEnabled: false,
    swiggyApiKey: '',
    swiggySecret: '',
    zomatoEnabled: false,
    zomatoApiKey: '',
    zomatoClientSecret: '',
  });

  // User Rights state
  const [userRights, setUserRights] = useState({
    waiter: {
      canCreateKOT: true,
      canGenerateBills: true,
      canApplyDiscounts: false,
      canViewReports: false,
    },
    accountant: {
      canViewAllOrders: true,
      canGenerateReports: true,
      canProcessRefunds: false,
      canAccessSettings: false,
    },
    busser: {
      canManageTables: true,
      canMarkTableCleaned: true,
      canViewPendingCleaning: true,
    },
  });
  const [users, setUsers] = useState<any[]>([]);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'waiter' as 'waiter' | 'accountant' | 'busser',
    forceResetPassword: true,
  });
  
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  
  // Customer state
  const [customers, setCustomers] = useState<any[]>([]);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    place: '',
    foodPreference: 'both' as 'veg' | 'non-veg' | 'both',
    loyaltyDiscount: '',
  });

  // Table Status Colors form
  const [tableStatusForm, setTableStatusForm] = useState({
    available: { color: 'bg-success', label: 'Available' },
    occupied: { color: 'bg-red-500', label: 'Occupied' },
    active: { color: 'bg-accent', label: 'Active - KOT' },
    billed: { color: 'bg-blue-500', label: 'Billed' },
    pending_cleaning: { color: 'bg-gray-500', label: 'Cleaning' },
    pending_printing: { color: 'bg-orange-500', label: 'Pending' },
  });

  useEffect(() => {
    fetchSettings();
    if (user?.role === 'admin') {
      fetchUsers();
      fetchCustomers();
    }
  }, []);

  // Fetch table allocations when tab changes
  useEffect(() => {
    if (activeTab === 'tableAllocations' && restaurant?.id) {
      fetchAllocations();
      fetchTables();
    }
  }, [activeTab, restaurant?.id]);

  const fetchAllocations = async () => {
    setLoadingAllocations(true);
    try {
      const response = await api.getTableAllocations(restaurant?.id);
      if (response.success) {
        setAllocations(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
      toast('error', 'Failed to load table allocations');
    } finally {
      setLoadingAllocations(false);
    }
  };

  useEffect(() => {
    if (settings) {
      setTaxForm({
        taxName: settings.taxName || settings.tax_name || 'GST',
        cgstRate: String(settings.cgstRate || settings.cgst_rate || '9'),
        sgstRate: String(settings.sgstRate || settings.sgst_rate || '9'),
        defaultTaxRate: String(settings.defaultTaxRate || settings.default_tax_rate || '18'),
        priceInclusiveTax: Boolean(settings.priceInclusiveTax || settings.price_inclusive_tax),
        isActive: settings.isActive !== undefined ? Boolean(settings.isActive || settings.is_active) : true,
      });
      setPrinterForm({
        kotPrinter: settings.kotPrinter || settings.kot_printer || '',
        billPrinter: settings.billPrinter || settings.bill_printer || '',
        printCopies: String(settings.printCopies || settings.print_copies || '1'),
        skipLinesBeforeCut: String(settings.skipLinesBeforeCut || settings.skip_lines_before_cut || '3'),
      });
      
      // Load KOT Setup
      if (settings.kot_setup) {
        setKotSetupForm(settings.kot_setup);
      }
      
      // Load Bill Setup
      if (settings.bill_setup) {
        setBillSetupForm(settings.bill_setup);
      }
      
      // Load User Rights from settings (with safe defaults)
      if (settings.userRights) {
        setUserRights({
          waiter: {
            canCreateKOT: settings.userRights.waiter?.canCreateKOT ?? true,
            canGenerateBills: settings.userRights.waiter?.canGenerateBills ?? true,
            canApplyDiscounts: settings.userRights.waiter?.canApplyDiscounts ?? false,
            canViewReports: settings.userRights.waiter?.canViewReports ?? false,
          },
          accountant: {
            canViewAllOrders: settings.userRights.accountant?.canViewAllOrders ?? true,
            canGenerateReports: settings.userRights.accountant?.canGenerateReports ?? true,
            canProcessRefunds: settings.userRights.accountant?.canProcessRefunds ?? false,
            canAccessSettings: settings.userRights.accountant?.canAccessSettings ?? false,
          },
          busser: {
            canManageTables: settings.userRights.busser?.canManageTables ?? true,
            canMarkTableCleaned: settings.userRights.busser?.canMarkTableCleaned ?? true,
            canViewPendingCleaning: settings.userRights.busser?.canViewPendingCleaning ?? true,
          },
        });
      }
      
      // Load Table Status Colors
      if (settings.tableStatusColors) {
        setTableStatusForm(settings.tableStatusColors);
      }
      
      // Load Payment settings
      if (settings.payment) {
        setPaymentForm({
          upiId: settings.payment.upiId || '',
          merchantName: settings.payment.merchantName || restaurant?.name || '',
          showQrOnBill: settings.payment.showQrOnBill !== false,
          showQrOnKot: Boolean(settings.payment.showQrOnKot),
        });
      }
      
      // Load Online Orders settings
      if (settings.onlineOrders) {
        setOnlineOrdersForm({
          swiggyEnabled: settings.onlineOrders.swiggyEnabled || false,
          swiggyApiKey: settings.onlineOrders.swiggyApiKey || '',
          swiggySecret: settings.onlineOrders.swiggySecret || '',
          zomatoEnabled: settings.onlineOrders.zomatoEnabled || false,
          zomatoApiKey: settings.onlineOrders.zomatoApiKey || '',
          zomatoClientSecret: settings.onlineOrders.zomatoClientSecret || '',
        });
      }
    }
  }, [settings]);

  const fetchUsers = async () => {
    const response = await api.getUsers();
    if (response.success && Array.isArray(response.data)) {
      setUsers(response.data);
    }
  };

  const fetchCustomers = async () => {
    const response = await api.get('/customers');
    if (response.success && Array.isArray(response.data)) {
      setCustomers(response.data);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerForm.name) {
      toast('error', 'Customer name is required');
      return;
    }
    setIsSubmitting(true);
    const response = await api.post('/customers', {
      name: newCustomerForm.name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email,
      place: newCustomerForm.place,
      foodPreference: newCustomerForm.foodPreference,
      loyaltyDiscount: parseFloat(newCustomerForm.loyaltyDiscount) || 0,
    });
    setIsSubmitting(false);
    if (response.success) {
      toast('success', 'Customer created successfully');
      setShowNewCustomerForm(false);
      setNewCustomerForm({ name: '', phone: '', email: '', place: '', foodPreference: 'both', loyaltyDiscount: '' });
      fetchCustomers();
    } else {
      toast('error', response.error || 'Failed to create customer');
    }
  };

  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer);
    setNewCustomerForm({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      place: customer.place || '',
      foodPreference: customer.food_preference || 'both',
      loyaltyDiscount: String(customer.loyalty_discount || ''),
    });
    setShowNewCustomerForm(true);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    const response = await api.delete(`/customers/${customerId}`);
    if (response.success) {
      toast('success', 'Customer deleted successfully');
      fetchCustomers();
    } else {
      toast('error', 'Failed to delete customer');
    }
  };

  const handleSaveRestaurant = async () => {
    setIsSubmitting(true);
    const response = await api.updateRestaurant(restaurant?.id || '', restaurantForm);
    setIsSubmitting(false);

    if (response.success) {
      toast('success', 'Restaurant details updated');
      if (response.data) {
        setRestaurant(response.data);
      }
    } else {
      toast('error', 'Failed to update restaurant');
    }
  };

  const handleSaveProfile = async () => {
    // If any password field is filled, validate and change password
    if (profileForm.currentPassword || profileForm.newPassword || profileForm.confirmPassword) {
      if (!profileForm.currentPassword || !profileForm.newPassword || !profileForm.confirmPassword) {
        toast('error', 'Please fill all password fields');
        return;
      }
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        toast('error', 'Passwords do not match');
        return;
      }
      if (profileForm.newPassword.length < 6) {
        toast('error', 'Password must be at least 6 characters');
        return;
      }
      
      setIsSubmitting(true);
      const passwordResponse = await api.changePassword(profileForm.currentPassword, profileForm.newPassword);
      if (!passwordResponse.success) {
        setIsSubmitting(false);
        toast('error', passwordResponse.error || 'Failed to change password');
        return;
      }
    }
    
    // Update profile
    setIsSubmitting(true);
    const response = await api.updateUser(user?.id || '', {
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone,
    });
    setIsSubmitting(false);

    if (response.success) {
      toast('success', 'Profile updated');
      // Clear password fields after successful update
      setProfileForm({
        ...profileForm,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } else {
      toast('error', 'Failed to update profile');
    }
  };

  const handleSaveTax = async () => {
    if (!taxForm.taxName.trim()) {
      toast('error', 'Please enter a tax name');
      return;
    }
    
    setIsSubmitting(true);
    const success = await updateSettings({
      taxName: taxForm.taxName,
      cgstRate: parseFloat(taxForm.cgstRate),
      sgstRate: parseFloat(taxForm.sgstRate),
      defaultTaxRate: parseFloat(taxForm.defaultTaxRate),
      priceInclusiveTax: taxForm.priceInclusiveTax,
      isActive: taxForm.isActive,
    });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'Tax settings saved');
    } else {
      toast('error', 'Failed to save tax settings');
    }
  };

  const handleSavePrinter = async () => {
    setIsSubmitting(true);
    const success = await updateSettings({
      kotPrinter: printerForm.kotPrinter,
      billPrinter: printerForm.billPrinter,
      printCopies: parseInt(printerForm.printCopies),
      skipLinesBeforeCut: parseInt(printerForm.skipLinesBeforeCut),
      kot_setup: kotSetupForm,
      bill_setup: billSetupForm,
    });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'Printer settings saved');
    } else {
      toast('error', 'Failed to save printer settings');
    }
  };

  const handleSaveKotSetup = async () => {
    setIsSubmitting(true);
    const success = await updateSettings({ kot_setup: kotSetupForm });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'KOT Setup saved');
    } else {
      toast('error', 'Failed to save KOT Setup');
    }
  };

  const handleSaveBillSetup = async () => {
    setIsSubmitting(true);
    const success = await updateSettings({ bill_setup: billSetupForm });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'Bill Setup saved');
    } else {
      toast('error', 'Failed to save Bill Setup');
    }
  };

  // Detect connected printers (USB/Bluetooth)
  const detectPrinters = async () => {
    setIsDetecting(true);
    setDetectionStatus('Detecting printers...');
    setDetectedPrinters([]);
    
    try {
      // Check if Web Bluetooth API is available (for Bluetooth printers)
      const hasBluetooth = 'bluetooth' in navigator;
      
      // Check if navigator.usb is available (for USB printers)
      const hasUSB = 'usb' in navigator;
      
      const foundPrinters: {name: string; type: string; address: string}[] = [];
      
      // Method 1: Try Web Bluetooth API for Bluetooth printers
      if (hasBluetooth) {
        try {
          setDetectionStatus('Scanning for Bluetooth printers...');
          // Request Bluetooth device
          const device = await (navigator as any).bluetooth.requestDevice({
            filters: [{ services: ['00001101-0000-1000-8000-00805f9b34fb'] }] // Serial Port Profile
          });
          
          if (device.name) {
            foundPrinters.push({
              name: device.name,
              type: 'Bluetooth',
              address: device.id
            });
          }
        } catch (btError: any) {
          console.log('Bluetooth scan cancelled or failed:', btError.message);
        }
      }
      
      // Method 2: Try Web USB API for USB printers (mostly works on Chrome/Edge)
      if (hasUSB) {
        try {
          setDetectionStatus('Scanning for USB printers...');
          const device = await (navigator as any).usb.requestDevice({
            filters: [
              { vendorId: 0x04b8 }, // Epson
              { vendorId: 0x04f9 }, // Brother
              { vendorId: 0x0519 }, // Star Micronics
              { vendorId: 0x0dd4 }, // Custom Engineering
              { vendorId: 0x1504 }, // Posiflex
            ]
          });
          
          if (device.productName) {
            foundPrinters.push({
              name: device.productName,
              type: 'USB',
              address: `${device.vendorId}:${device.productId}`
            });
          }
        } catch (usbError: any) {
          console.log('USB scan cancelled or failed:', usbError.message);
        }
      }
      
      // Method 3: For Electron apps, check for serial/COM ports
      // This is a placeholder - actual implementation would use electron-serial
      // For now, we'll add some common thermal printer detection logic
      
      if (!foundPrinters || foundPrinters.length === 0) {
        setDetectionStatus('No printers detected. Make sure your printer is connected and powered on.');
      } else {
        setDetectionStatus(`Found ${foundPrinters?.length || 0} printer(s)`);
        setDetectedPrinters(foundPrinters);
      }
    } catch (error: any) {
      console.error('Printer detection error:', error);
      setDetectionStatus('Detection failed. Please try again or enter printer manually.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Select a detected printer
  const selectDetectedPrinter = (printer: {name: string; type: string; address: string}, isKot: boolean) => {
    if (isKot) {
      setPrinterForm({ ...printerForm, kotPrinter: printer.name });
    } else {
      setPrinterForm({ ...printerForm, billPrinter: printer.name });
    }
    toast('success', `${printer.name} (${printer.type}) selected`);
  };

  const handleSaveUserRights = async () => {
    setIsSubmitting(true);
    const success = await updateSettings({ userRights });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'User rights saved successfully');
    } else {
      toast('error', 'Failed to save user rights');
    }
  };

  const handleSavePayment = async () => {
    setIsSubmitting(true);
    const success = await updateSettings({
      payment: {
        upiId: paymentForm.upiId,
        merchantName: paymentForm.merchantName,
        showQrOnBill: paymentForm.showQrOnBill,
        showQrOnKot: paymentForm.showQrOnKot,
      },
    });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'Payment settings saved');
    } else {
      toast('error', 'Failed to save payment settings');
    }
  };

  const handleSaveOnlineOrders = async () => {
    setIsSubmitting(true);
    const success = await updateSettings({
      onlineOrders: {
        swiggyEnabled: onlineOrdersForm.swiggyEnabled,
        swiggyApiKey: onlineOrdersForm.swiggyApiKey,
        swiggySecret: onlineOrdersForm.swiggySecret,
        zomatoEnabled: onlineOrdersForm.zomatoEnabled,
        zomatoApiKey: onlineOrdersForm.zomatoApiKey,
        zomatoClientSecret: onlineOrdersForm.zomatoClientSecret,
      },
    });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'Online Orders settings saved');
    } else {
      toast('error', 'Failed to save Online Orders settings');
    }
  };

  const handleSaveTableStatus = async () => {
    setIsSubmitting(true);
    const success = await updateSettings({
      tableStatusColors: tableStatusForm,
    });
    setIsSubmitting(false);

    if (success) {
      toast('success', 'Table Status Colors saved');
    } else {
      toast('error', 'Failed to save Table Status Colors');
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.name || !newUserForm.email) {
      toast('error', 'Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    const response = await api.createUser({
      ...newUserForm,
      password: 'OyeBill2024',
    });
    setIsSubmitting(false);

    if (response.success) {
      toast('success', 'User created successfully');
      setShowNewUserForm(false);
      setNewUserForm({ name: '', email: '', role: 'waiter', forceResetPassword: true });
      fetchUsers();
    } else {
      toast('error', response.error || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    const response = await api.deleteUser(userId);
    if (response.success) {
      toast('success', 'User deleted');
      fetchUsers();
    } else {
      toast('error', 'Failed to delete user');
    }
  };

  const handleResetUserPassword = async (userId: string) => {
    const response = await api.updateUser(userId, { mustResetPassword: true });
    if (response.success) {
      toast('success', 'Password reset for user');
      fetchUsers();
    } else {
      toast('error', 'Failed to reset password');
    }
  };

  const tabs = [
    { id: 'restaurant', label: 'Restaurant', icon: Building },
    { id: 'profile', label: 'Profile', icon: User },
    ...(user?.role === 'admin' ? [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'tax', label: 'Tax Setup', icon: Percent },
      { id: 'printer', label: 'Printer', icon: Printer },
      { id: 'payment', label: 'Payment', icon: Percent },
      { id: 'rights', label: 'User Rights', icon: Shield },
      { id: 'tableStatus', label: 'Table Status', icon: Tag },
      { id: 'tableAllocations', label: 'Table-Waiter', icon: LayoutGrid },
    ] : []),
  ];

  return (
    <div>
      {/* Mobile Header with Tabs */}
      <div className="lg:hidden">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold text-center">Settings</h1>
        </div>
        {/* Mobile Tab Bar */}
        <div className="flex overflow-x-auto gap-1 p-2 border-b border-white/10 -mx-2 px-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-accent text-white'
                  : 'bg-background-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <PageHeader title="Settings" subtitle="Manage your restaurant settings" />
      </div>

      <div className="flex gap-6">
        {/* Tab Navigation */}
        <div className="w-56 shrink-0 hidden lg:block">
          <div className="card p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent/10 text-accent border-l-2 border-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {/* Restaurant Settings */}
          {activeTab === 'restaurant' && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Restaurant Details</h2>
                <p className="text-sm text-text-muted">Update your restaurant information</p>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label="Restaurant Name"
                  value={restaurantForm.name}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                />
                <Input
                  label="Address"
                  value={restaurantForm.address}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Phone"
                    value={restaurantForm.phone}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })}
                  />
                  <Input
                    label="Email"
                    value={restaurantForm.email}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="GST Number"
                    value={restaurantForm.gstNumber}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, gstNumber: e.target.value })}
                  />
                  <Input
                    label="FSSAI Number"
                    value={restaurantForm.fssaiNumber}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, fssaiNumber: e.target.value })}
                  />
                </div>
                <div className="pt-4">
                  <Button onClick={handleSaveRestaurant} loading={isSubmitting}>
                    Save Changes
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Update Profile & Password</h2>
                <p className="text-sm text-text-muted">Manage your personal information and password</p>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label="Full Name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
                
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h3 className="font-medium mb-3">Change Password (Optional)</h3>
                  <div className="space-y-3">
                    <Input
                      label="Current Password"
                      type="password"
                      value={profileForm.currentPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                    />
                    <Input
                      label="New Password"
                      type="password"
                      value={profileForm.newPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                      placeholder="Enter new password"
                    />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button onClick={handleSaveProfile} loading={isSubmitting}>
                    Update Profile
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Users Management */}
          {activeTab === 'users' && user?.role === 'admin' && (
            <Card>
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h2 className="font-semibold">User Management</h2>
                  <p className="text-sm text-text-muted">Manage waiter and accountant accounts</p>
                </div>
                <Button onClick={() => setShowNewUserForm(!showNewUserForm)} variant="accent">
                  {showNewUserForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add User</>}
                </Button>
              </CardHeader>
              <CardBody>
                {showNewUserForm && (
                  <div className="mb-6 p-4 rounded-lg bg-background-secondary border border-white/10 space-y-4">
                    <h3 className="font-medium">Create New User</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Full Name"
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      />
                    </div>
                    <Select
                      label="Role"
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as 'waiter' | 'accountant' | 'busser' })}
                      options={[
                        { value: 'waiter', label: 'Waiter' },
                        { value: 'accountant', label: 'Accountant' },
                        { value: 'busser', label: 'Busser' },
                      ]}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="forceReset"
                        checked={newUserForm.forceResetPassword}
                        onChange={(e) => setNewUserForm({ ...newUserForm, forceResetPassword: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                      />
                      <label htmlFor="forceReset" className="text-sm text-text-secondary">
                        Force password reset on first login
                      </label>
                    </div>
                    <p className="text-xs text-text-muted">Initial password: OyeBill2024</p>
                    <Button onClick={handleCreateUser} loading={isSubmitting}>
                      Create User
                    </Button>
                  </div>
                )}

                <div className="space-y-3">
                  {users.filter(u => u.id !== user?.id).map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-4 rounded-lg bg-background-secondary border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-sm text-text-muted">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`badge ${
                          u.role === 'waiter' ? 'badge-info' : 
                          u.role === 'busser' ? 'badge-warning' : 
                          'badge-success'
                        }`}>
                          {u.role}
                        </span>
                        {u.mustResetPassword && (
                          <span className="badge-warning badge">Reset Required</span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetUserPassword(u.id)}
                        >
                          Reset Password
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-error hover:bg-error/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!users || users.filter(u => u.id !== user?.id).length === 0 && (
                    <p className="text-center text-text-muted py-8">No other users found</p>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Tax Settings */}
          {activeTab === 'tax' && user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Tax Configuration</h2>
                <p className="text-sm text-text-muted">Set up tax rates and configuration for billing</p>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Tax Name"
                    value={taxForm.taxName}
                    onChange={(e) => setTaxForm({ ...taxForm, taxName: e.target.value })}
                    placeholder="e.g., GST, VAT"
                  />
                  <Input
                    label="Default Tax Rate for Products (%)"
                    type="number"
                    step="0.01"
                    value={taxForm.defaultTaxRate}
                    onChange={(e) => setTaxForm({ ...taxForm, defaultTaxRate: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="CGST Rate (%)"
                    type="number"
                    step="0.01"
                    value={taxForm.cgstRate}
                    onChange={(e) => setTaxForm({ ...taxForm, cgstRate: e.target.value })}
                  />
                  <Input
                    label="SGST Rate (%)"
                    type="number"
                    step="0.01"
                    value={taxForm.sgstRate}
                    onChange={(e) => setTaxForm({ ...taxForm, sgstRate: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary border border-white/10">
                  <div>
                    <span className="font-medium">Tax Active</span>
                    <p className="text-sm text-text-muted">Enable or disable tax calculation</p>
                  </div>
                  <Toggle
                    checked={taxForm.isActive}
                    onChange={(checked) => setTaxForm({ ...taxForm, isActive: checked })}
                  />
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-background-secondary border border-white/10">
                  <input
                    type="checkbox"
                    id="inclusiveTax"
                    checked={taxForm.priceInclusiveTax}
                    onChange={(e) => setTaxForm({ ...taxForm, priceInclusiveTax: e.target.checked })}
                    className="w-5 h-5 rounded border-white/20 bg-background-primary text-accent focus:ring-accent"
                  />
                  <label htmlFor="inclusiveTax" className="text-sm">
                    <span className="font-medium">Prices are inclusive of tax</span>
                    <p className="text-text-muted">Enable if product prices already include GST</p>
                  </label>
                </div>
                
                <div className="pt-4">
                  <Button onClick={handleSaveTax} loading={isSubmitting}>
                    Save Tax Settings
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Printer Settings */}
          {activeTab === 'printer' && user?.role === 'admin' && (
            <div className="space-y-6">
              {/* Sub-tabs */}
              <div className="flex gap-2 border-b border-white/10 pb-2">
                <button
                  onClick={() => setPrinterTab('kot')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    printerTab === 'kot'
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }`}
                >
                  KOT Setup
                </button>
                <button
                  onClick={() => setPrinterTab('bill')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    printerTab === 'bill'
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }`}
                >
                  Bill Setup
                </button>
                <button
                  onClick={() => setPrinterTab('setup')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    printerTab === 'setup'
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }`}
                >
                  Printer Setup
                </button>
              </div>

              {/* KOT Setup */}
              {printerTab === 'kot' && (
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">KOT Setup</h2>
                    <p className="text-sm text-text-muted">Configure what to show on Kitchen Order Tickets</p>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">Fields to Display</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={kotSetupForm.showKotNumber}
                            onChange={(e) => setKotSetupForm({...kotSetupForm, showKotNumber: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>KOT Number</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={kotSetupForm.showDateTime}
                            onChange={(e) => setKotSetupForm({...kotSetupForm, showDateTime: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Date & Time</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={kotSetupForm.showTableNumber}
                            onChange={(e) => setKotSetupForm({...kotSetupForm, showTableNumber: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Table Number</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={kotSetupForm.showProductName}
                            onChange={(e) => setKotSetupForm({...kotSetupForm, showProductName: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Product Name</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={kotSetupForm.showQty}
                            onChange={(e) => setKotSetupForm({...kotSetupForm, showQty: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Qty</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={kotSetupForm.showRate}
                            onChange={(e) => setKotSetupForm({...kotSetupForm, showRate: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Rate</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={kotSetupForm.showWaiterName}
                            onChange={(e) => setKotSetupForm({...kotSetupForm, showWaiterName: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Waiter Name</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">KOT Behavior</h3>
                      <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        <input 
                          type="checkbox" 
                          checked={kotSetupForm.strikeOldKotItems}
                          onChange={(e) => setKotSetupForm({...kotSetupForm, strikeOldKotItems: e.target.checked})}
                          className="w-5 h-5 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                        />
                        <div>
                          <span className="font-medium">Strike Old KOT Items</span>
                          <p className="text-sm text-text-muted">
                            When adding new items to an existing KOT, strike out the previous items 
                            (for when kitchen prepares items in sequence)
                          </p>
                        </div>
                      </label>
                      <p className="text-xs text-text-muted mt-2 px-1">
                        Uncheck this if your kitchen area is the same and all items are prepared together
                      </p>
                    </div>

                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">Preview & Print</h3>
                      <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        <input 
                          type="checkbox" 
                          checked={kotSetupForm.showPreview}
                          onChange={(e) => setKotSetupForm({...kotSetupForm, showPreview: e.target.checked})}
                          className="w-5 h-5 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                        />
                        <div>
                          <span className="font-medium">Show Preview Before Print</span>
                          <p className="text-sm text-text-muted">
                            When enabled, display a preview dialog with Print and Cancel buttons before sending to printer
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="pt-4">
                      <Button onClick={handleSaveKotSetup} loading={isSubmitting}>
                        Save KOT Setup
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Bill Setup */}
              {printerTab === 'bill' && (
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Bill Setup</h2>
                    <p className="text-sm text-text-muted">Configure what to show on customer bills</p>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">Restaurant Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showRestaurantName}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showRestaurantName: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Restaurant Name</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showAddress}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showAddress: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Address</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showPhone}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showPhone: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Phone</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showGstFssai}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showGstFssai: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>GST / FSSAI</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">Item Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showProductName}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showProductName: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Product Name</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showQty}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showQty: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Qty</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showRate}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showRate: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Rate</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showGst}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showGst: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>GST</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">Bill Summary</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showSubTotal}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showSubTotal: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Sub Total</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showDiscount}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showDiscount: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Discount</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showGstVat}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showGstVat: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>GST / VAT</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={billSetupForm.showGrandTotal}
                            onChange={(e) => setBillSetupForm({...billSetupForm, showGrandTotal: e.target.checked})}
                            className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                          />
                          <span>Grand Total</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">Special Message</h3>
                      <Input
                        label="Footer Message"
                        value={billSetupForm.specialMessage}
                        onChange={(e) => setBillSetupForm({...billSetupForm, specialMessage: e.target.value})}
                        placeholder="e.g., Thank you for visiting!"
                      />
                    </div>

                    <div className="p-4 rounded-lg border border-white/10">
                      <h3 className="font-medium mb-4">Preview & Print</h3>
                      <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        <input 
                          type="checkbox" 
                          checked={billSetupForm.showPreview}
                          onChange={(e) => setBillSetupForm({...billSetupForm, showPreview: e.target.checked})}
                          className="w-5 h-5 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                        />
                        <div>
                          <span className="font-medium">Show Preview Before Print</span>
                          <p className="text-sm text-text-muted">
                            When enabled, display a preview dialog with Print and Cancel buttons before sending to printer
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="pt-4">
                      <Button onClick={handleSaveBillSetup} loading={isSubmitting}>
                        Save Bill Setup
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Printer Setup */}
              {printerTab === 'setup' && (
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Printer Setup</h2>
                    <p className="text-sm text-text-muted">Configure printer connections via USB, Bluetooth, or Network</p>
                  </CardHeader>
                  <CardBody className="space-y-6">
                    {/* Detect Printers Section */}
                    <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium flex items-center gap-2">
                            <Printer className="w-5 h-5" />
                            Detect Connected Printers
                          </h3>
                          <p className="text-sm text-text-muted mt-1">
                            Scan for USB, Bluetooth, or network printers
                          </p>
                        </div>
                        <Button 
                          onClick={detectPrinters} 
                          loading={isDetecting}
                          variant="accent"
                        >
                          {isDetecting ? 'Scanning...' : '🔍 Scan Printers'}
                        </Button>
                      </div>
                      
                      {detectionStatus && (
                        <div className={`text-sm mb-3 ${detectedPrinters && detectedPrinters.length > 0 ? 'text-success' : 'text-text-muted'}`}>
                          {detectionStatus}
                        </div>
                      )}
                      
                      {detectedPrinters && detectedPrinters.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-text-secondary">Detected Printers:</p>
                          {detectedPrinters.map((printer, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-background-secondary border border-white/10">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  printer.type === 'Bluetooth' ? 'bg-blue-500/20 text-blue-400' :
                                  printer.type === 'USB' ? 'bg-green-500/20 text-green-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  <Printer className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-medium">{printer.name}</p>
                                  <p className="text-xs text-text-muted">
                                    {printer.type} • {printer.address}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => selectDetectedPrinter(printer, true)}
                                >
                                  Use for KOT
                                </Button>
                                <Button 
                                  variant="accent" 
                                  size="sm"
                                  onClick={() => selectDetectedPrinter(printer, false)}
                                >
                                  Use for Bill
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Manual Printer Configuration */}
                    <div className="p-4 rounded-lg border border-white/10 space-y-4">
                      <h3 className="font-medium">Manual Configuration</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="KOT Printer Name/IP"
                          value={printerForm.kotPrinter}
                          onChange={(e) => setPrinterForm({ ...printerForm, kotPrinter: e.target.value })}
                          placeholder="e.g., EPSON-KOT or 192.168.1.100"
                        />
                        <Input
                          label="Bill Printer Name/IP"
                          value={printerForm.billPrinter}
                          onChange={(e) => setPrinterForm({ ...printerForm, billPrinter: e.target.value })}
                          placeholder="e.g., EPSON-BILL or 192.168.1.101"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Number of Copies"
                          type="number"
                          min="1"
                          max="5"
                          value={printerForm.printCopies}
                          onChange={(e) => setPrinterForm({ ...printerForm, printCopies: e.target.value })}
                        />
                        <Input
                          label="Skip Lines Before Cut"
                          type="number"
                          min="0"
                          max="10"
                          value={printerForm.skipLinesBeforeCut}
                          onChange={(e) => setPrinterForm({ ...printerForm, skipLinesBeforeCut: e.target.value })}
                          placeholder="Lines to skip before cutting"
                        />
                      </div>
                    </div>

                    {/* Connection Type Info */}
                    <div className="p-4 rounded-lg bg-background-secondary/50 border border-white/10">
                      <h4 className="text-sm font-medium mb-3">Supported Connection Types</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                            <span className="text-sm">🔌</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">USB</p>
                            <p className="text-xs text-text-muted">Direct cable connection for thermal printers</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                            <span className="text-sm">📱</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">Bluetooth</p>
                            <p className="text-xs text-text-muted">Wireless for mobile devices</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                            <span className="text-sm">🌐</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">Network/IP</p>
                            <p className="text-xs text-text-muted">Ethernet or WiFi printer on same network</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button onClick={handleSavePrinter} loading={isSubmitting}>
                        Save Printer Settings
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {/* Payment Settings */}
          {activeTab === 'payment' && user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Payment Settings</h2>
                <p className="text-sm text-text-muted">Configure UPI payment and QR code settings</p>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="p-4 rounded-lg border border-white/10 space-y-4">
                  <h3 className="font-medium">UPI Payment Details</h3>
                  <Input
                    label="UPI ID / VPA"
                    value={paymentForm.upiId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, upiId: e.target.value })}
                    placeholder="e.g., merchantname@upi"
                  />
                  <Input
                    label="Merchant Name (for QR)"
                    value={paymentForm.merchantName}
                    onChange={(e) => setPaymentForm({ ...paymentForm, merchantName: e.target.value })}
                    placeholder="Name displayed on QR code"
                  />
                </div>

                <div className="p-4 rounded-lg border border-white/10 space-y-4">
                  <h3 className="font-medium">QR Code Display</h3>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={paymentForm.showQrOnBill}
                      onChange={(e) => setPaymentForm({ ...paymentForm, showQrOnBill: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                    />
                    <span>Show QR code on Bill (with dynamic amount)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={paymentForm.showQrOnKot}
                      onChange={(e) => setPaymentForm({ ...paymentForm, showQrOnKot: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                    />
                    <span>Show QR code on KOT</span>
                  </label>
                </div>

                {paymentForm.upiId && (
                  <div className="p-4 rounded-lg border border-white/10">
                    <h3 className="font-medium mb-3">Preview</h3>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-background-secondary">
                      <div className="w-16 h-16 bg-white rounded flex items-center justify-center">
                        <span className="text-text-muted text-xs">QR</span>
                      </div>
                      <div>
                        <p className="font-medium">Scan to Pay</p>
                        <p className="text-sm text-text-muted">{paymentForm.upiId}</p>
                        <p className="text-sm text-text-muted">{paymentForm.merchantName}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10">
                  <Button onClick={handleSavePayment} loading={isSubmitting}>
                    Save Payment Settings
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Online Orders Integration */}
          {activeTab === 'restaurant' && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Online Orders Integration</h2>
                <p className="text-sm text-text-muted">Connect Swiggy and Zomato for online orders</p>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* Swiggy Integration */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">S</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">Swiggy Integration</h3>
                      <label className="flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          checked={onlineOrdersForm.swiggyEnabled}
                          onChange={(e) => setOnlineOrdersForm({...onlineOrdersForm, swiggyEnabled: e.target.checked})}
                          className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text-secondary">Enable Swiggy</span>
                      </label>
                    </div>
                  </div>
                  {onlineOrdersForm.swiggyEnabled && (
                    <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">API Key</label>
                        <Input
                          value={onlineOrdersForm.swiggyApiKey}
                          onChange={(e) => setOnlineOrdersForm({...onlineOrdersForm, swiggyApiKey: e.target.value})}
                          placeholder="Enter Swiggy API Key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">Secret Key</label>
                        <Input
                          type="password"
                          value={onlineOrdersForm.swiggySecret}
                          onChange={(e) => setOnlineOrdersForm({...onlineOrdersForm, swiggySecret: e.target.value})}
                          placeholder="Enter Swiggy Secret"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Zomato Integration */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">Z</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">Zomato Integration</h3>
                      <label className="flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          checked={onlineOrdersForm.zomatoEnabled}
                          onChange={(e) => setOnlineOrdersForm({...onlineOrdersForm, zomatoEnabled: e.target.checked})}
                          className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text-secondary">Enable Zomato</span>
                      </label>
                    </div>
                  </div>
                  {onlineOrdersForm.zomatoEnabled && (
                    <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">API Key</label>
                        <Input
                          value={onlineOrdersForm.zomatoApiKey}
                          onChange={(e) => setOnlineOrdersForm({...onlineOrdersForm, zomatoApiKey: e.target.value})}
                          placeholder="Enter Zomato API Key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">Client Secret</label>
                        <Input
                          type="password"
                          value={onlineOrdersForm.zomatoClientSecret}
                          onChange={(e) => setOnlineOrdersForm({...onlineOrdersForm, zomatoClientSecret: e.target.value})}
                          placeholder="Enter Zomato Client Secret"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/10">
                  <Button onClick={handleSaveOnlineOrders} loading={isSubmitting}>
                    Save Online Orders Settings
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* User Rights */}
          {activeTab === 'rights' && user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">User Rights & Permissions</h2>
                <p className="text-sm text-text-muted">Configure access controls</p>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="p-4 rounded-lg border border-white/10">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-accent" />
                    Waiter Permissions
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.waiter?.canCreateKOT ?? true}
                        onChange={(e) => setUserRights({...userRights, waiter: {...userRights.waiter, canCreateKOT: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can create KOT</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.waiter?.canGenerateBills ?? true}
                        onChange={(e) => setUserRights({...userRights, waiter: {...userRights.waiter, canGenerateBills: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can generate bills</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.waiter?.canApplyDiscounts ?? false}
                        onChange={(e) => setUserRights({...userRights, waiter: {...userRights.waiter, canApplyDiscounts: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can apply discounts</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.waiter?.canViewReports ?? false}
                        onChange={(e) => setUserRights({...userRights, waiter: {...userRights.waiter, canViewReports: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can view reports</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-white/10">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent" />
                    Accountant Permissions
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.accountant?.canViewAllOrders ?? true}
                        onChange={(e) => setUserRights({...userRights, accountant: {...userRights.accountant, canViewAllOrders: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can view all orders</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.accountant?.canGenerateReports ?? true}
                        onChange={(e) => setUserRights({...userRights, accountant: {...userRights.accountant, canGenerateReports: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can generate reports</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.accountant?.canProcessRefunds ?? false}
                        onChange={(e) => setUserRights({...userRights, accountant: {...userRights.accountant, canProcessRefunds: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can process refunds</span>
                    </label>
                    <label className="flex items-center gap-3 opacity-50">
                      <input type="checkbox" disabled className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" />
                      <span>Can access settings (Admin only)</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-white/10">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent" />
                    Busser Permissions
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.busser?.canViewPendingCleaning ?? true}
                        onChange={(e) => setUserRights({...userRights, busser: {...userRights.busser, canViewPendingCleaning: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can view tables pending cleaning</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.busser?.canMarkTableCleaned ?? true}
                        onChange={(e) => setUserRights({...userRights, busser: {...userRights.busser, canMarkTableCleaned: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can mark table as cleaned</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={userRights?.busser?.canManageTables ?? true}
                        onChange={(e) => setUserRights({...userRights, busser: {...userRights.busser, canManageTables: e.target.checked}})}
                        className="w-4 h-4 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent" 
                      />
                      <span>Can manage tables</span>
                    </label>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <Button onClick={handleSaveUserRights} loading={isSubmitting}>
                    Save User Rights
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Table Status Colors */}
          {activeTab === 'tableStatus' && user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Table Status Colors</h2>
                <p className="text-sm text-text-muted">Customize table status colors and labels</p>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* Available */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full ${tableStatusForm.available.color}`} />
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Available</h3>
                      <div className="flex gap-4">
                        <select
                          value={tableStatusForm.available.color}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, available: {...tableStatusForm.available, color: e.target.value}})}
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        >
                          <option value="bg-success">Green</option>
                          <option value="bg-green-400">Light Green</option>
                          <option value="bg-emerald-500">Emerald</option>
                          <option value="bg-teal-500">Teal</option>
                          <option value="bg-blue-500">Blue</option>
                          <option value="bg-cyan-500">Cyan</option>
                          <option value="bg-yellow-500">Yellow</option>
                        </select>
                        <input
                          type="text"
                          value={tableStatusForm.available.label}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, available: {...tableStatusForm.available, label: e.target.value}})}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active - KOT */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full ${tableStatusForm.active.color}`} />
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Active - KOT</h3>
                      <div className="flex gap-4">
                        <select
                          value={tableStatusForm.active.color}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, active: {...tableStatusForm.active, color: e.target.value}})}
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        >
                          <option value="bg-accent">Accent (Default)</option>
                          <option value="bg-blue-500">Blue</option>
                          <option value="bg-indigo-500">Indigo</option>
                          <option value="bg-violet-500">Violet</option>
                          <option value="bg-purple-500">Purple</option>
                          <option value="bg-pink-500">Pink</option>
                        </select>
                        <input
                          type="text"
                          value={tableStatusForm.active.label}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, active: {...tableStatusForm.active, label: e.target.value}})}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Occupied - Billing */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full ${tableStatusForm.occupied.color}`} />
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Occupied - Billing</h3>
                      <div className="flex gap-4">
                        <select
                          value={tableStatusForm.occupied.color}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, occupied: {...tableStatusForm.occupied, color: e.target.value}})}
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        >
                          <option value="bg-red-500">Red (Default)</option>
                          <option value="bg-orange-500">Orange</option>
                          <option value="bg-amber-500">Amber</option>
                          <option value="bg-rose-500">Rose</option>
                          <option value="bg-red-600">Dark Red</option>
                          <option value="bg-yellow-500">Yellow</option>
                        </select>
                        <input
                          type="text"
                          value={tableStatusForm.occupied.label}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, occupied: {...tableStatusForm.occupied, label: e.target.value}})}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billed */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full ${tableStatusForm.billed.color}`} />
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Billed</h3>
                      <div className="flex gap-4">
                        <select
                          value={tableStatusForm.billed.color}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, billed: {...tableStatusForm.billed, color: e.target.value}})}
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        >
                          <option value="bg-blue-500">Blue (Default)</option>
                          <option value="bg-indigo-500">Indigo</option>
                          <option value="bg-violet-500">Violet</option>
                          <option value="bg-purple-500">Purple</option>
                          <option value="bg-cyan-500">Cyan</option>
                        </select>
                        <input
                          type="text"
                          value={tableStatusForm.billed.label}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, billed: {...tableStatusForm.billed, label: e.target.value}})}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cleaning - Pending */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full ${tableStatusForm.pending_cleaning.color}`} />
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Cleaning - Pending</h3>
                      <div className="flex gap-4">
                        <select
                          value={tableStatusForm.pending_cleaning.color}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, pending_cleaning: {...tableStatusForm.pending_cleaning, color: e.target.value}})}
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        >
                          <option value="bg-gray-500">Grey (Default)</option>
                          <option value="bg-slate-500">Slate</option>
                          <option value="bg-zinc-500">Zinc</option>
                          <option value="bg-neutral-500">Neutral</option>
                          <option value="bg-stone-500">Stone</option>
                        </select>
                        <input
                          type="text"
                          value={tableStatusForm.pending_cleaning.label}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, pending_cleaning: {...tableStatusForm.pending_cleaning, label: e.target.value}})}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pending Print */}
                <div className="p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full ${tableStatusForm.pending_printing.color}`} />
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Pending Print</h3>
                      <div className="flex gap-4">
                        <select
                          value={tableStatusForm.pending_printing.color}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, pending_printing: {...tableStatusForm.pending_printing, color: e.target.value}})}
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        >
                          <option value="bg-orange-500">Orange (Default)</option>
                          <option value="bg-amber-500">Amber</option>
                          <option value="bg-yellow-500">Yellow</option>
                          <option value="bg-lime-500">Lime</option>
                        </select>
                        <input
                          type="text"
                          value={tableStatusForm.pending_printing.label}
                          onChange={(e) => setTableStatusForm({...tableStatusForm, pending_printing: {...tableStatusForm.pending_printing, label: e.target.value}})}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <Button onClick={handleSaveTableStatus} loading={isSubmitting}>
                    Save Table Status Colors
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Table-Waiter Allocations */}
          {activeTab === 'tableAllocations' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Table-Waiter Allocations</h2>
                    <p className="text-sm text-text-muted">Assign tables to waiters for NFC/QR order notifications</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Generate QR:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open('/api/setup/generate-qr', '_blank')}
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      Generate All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* Add New Allocation */}
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h3 className="font-medium mb-3">Add New Allocation</h3>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm text-text-secondary mb-1">Table</label>
                      <Select
                        value={selectedTableId}
                        onChange={(e) => setSelectedTableId(e.target.value)}
                      >
                        <option value="">Select Table</option>
                        {(!tables ? [] : tables).map(table => (
                          <option key={table.id} value={table.id}>
                            Table {table.number}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm text-text-secondary mb-1">Waiter</label>
                      <Select
                        value={selectedWaiterId}
                        onChange={(e) => setSelectedWaiterId(e.target.value)}
                      >
                        <option value="">Select Waiter</option>
                        {(!users ? [] : users).filter(w => w.role === 'waiter' || w.role === 'busser').map(waiter => (
                          <option key={waiter.id} value={waiter.id}>
                            {waiter.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={async () => {
                          if (!selectedTableId || !selectedWaiterId) {
                            toast('error', 'Please select both table and waiter');
                            return;
                          }
                          
                          // Check if already allocated
                          const existing = (allocations || []).find(
                            a => a.table_id === selectedTableId && a.waiter_id === selectedWaiterId
                          );
                          if (existing) {
                            toast('info', 'This allocation already exists');
                            return;
                          }
                          
                          const response = await api.createAllocation(selectedTableId, selectedWaiterId);
                          if (response.success) {
                            toast('success', 'Allocation created');
                            setSelectedTableId('');
                            setSelectedWaiterId('');
                            fetchAllocations();
                          } else {
                            toast('error', response.error || 'Failed to create allocation');
                          }
                        }}
                        disabled={!selectedTableId || !selectedWaiterId}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Existing Allocations */}
                <div>
                  <h3 className="font-medium mb-3">Current Allocations</h3>
                  {loadingAllocations ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-text-muted text-sm">Loading...</p>
                    </div>
                  ) : !allocations || allocations.length === 0 ? (
                    <div className="text-center py-8 text-text-muted">
                      <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No allocations yet</p>
                      <p className="text-sm">Assign tables to waiters above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Group by waiter */}
                      {Array.from(new Set(allocations.map(a => a.waiter_id))).map(waiterId => {
                        const waiterAllocations = allocations.filter(a => a.waiter_id === waiterId);
                        const waiterName = waiterAllocations[0]?.waiter_name;
                        
                        return (
                          <div key={waiterId} className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-accent" />
                                <span className="font-medium">{waiterName}</span>
                              </div>
                              <span className="text-xs text-text-muted">
                                {(waiterAllocations || []).length} table{(waiterAllocations || []).length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(waiterAllocations || []).map(alloc => (
                                <div
                                  key={alloc.id}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm"
                                >
                                  <span>Table {alloc.table_number}</span>
                                  <button
                                    onClick={async () => {
                                      const response = await api.deleteAllocation(alloc.id);
                                      if (response.success) {
                                        fetchAllocations();
                                      }
                                    }}
                                    className="hover:text-red-400"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* QR Code Instructions */}
                <div className="p-4 rounded-lg border border-dashed border-white/20">
                  <div className="flex items-start gap-3">
                    <QrCode className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-1">QR Code Setup</h4>
                      <p className="text-sm text-text-muted mb-2">
                        Each table should have a QR code that customers can scan to place orders directly.
                      </p>
                      <p className="text-sm text-text-muted">
                        URL format: <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/order/[TABLE_NUMBER]</code>
                      </p>
                      <p className="text-sm text-text-muted mt-1">
                        Example: <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/order/101</code>
                      </p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}