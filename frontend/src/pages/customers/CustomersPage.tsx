import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button, Input, Select, toast } from '../../components/ui';
import { User, Plus } from 'lucide-react';
import { api } from '../../api';
import { useAuthStore } from '../../stores/authStore';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  place?: string;
  food_preference?: string;
  loyalty_discount?: number;
}

export function CustomersPage() {
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    place: '',
    foodPreference: 'both' as 'veg' | 'non-veg' | 'both',
    loyaltyDiscount: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const response = await api.getCustomers();
    // The API returns { success: true, data: { success: true, data: customers } }
    // So we need response.data?.data to get the actual customers array
    if (response.success && response.data?.data && Array.isArray(response.data.data)) {
      setCustomers(response.data.data);
    } else if (response.success && Array.isArray(response.data)) {
      // Fallback for different response format
      setCustomers(response.data);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerForm.name) {
      toast('error', 'Customer name is required');
      return;
    }
    setIsSubmitting(true);
    const response = await api.createCustomer({
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
      setNewCustomerForm({ name: '', phone: '', email: '', place: '', foodPreference: 'both', loyaltyDiscount: '' });
      setShowNewCustomerForm(false);
      fetchCustomers();
    } else {
      toast('error', 'Failed to create customer');
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setNewCustomerForm({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      place: customer.place || '',
      foodPreference: (customer.food_preference as 'veg' | 'non-veg' | 'both') || 'both',
      loyaltyDiscount: String(customer.loyalty_discount || ''),
    });
    setShowNewCustomerForm(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer || !newCustomerForm.name) {
      toast('error', 'Customer name is required');
      return;
    }
    setIsSubmitting(true);
    const response = await api.updateCustomer(editingCustomer.id, {
      name: newCustomerForm.name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email,
      place: newCustomerForm.place,
      foodPreference: newCustomerForm.foodPreference,
      loyaltyDiscount: parseFloat(newCustomerForm.loyaltyDiscount) || 0,
    });
    setIsSubmitting(false);
    if (response.success) {
      toast('success', 'Customer updated successfully');
      setEditingCustomer(null);
      setNewCustomerForm({ name: '', phone: '', email: '', place: '', foodPreference: 'both', loyaltyDiscount: '' });
      setShowNewCustomerForm(false);
      fetchCustomers();
    } else {
      toast('error', 'Failed to update customer');
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) {
      return;
    }
    const response = await api.deleteCustomer(customerId);
    if (response.success) {
      toast('success', 'Customer deleted successfully');
      fetchCustomers();
    } else {
      toast('error', 'Failed to delete customer');
    }
  };

  const cancelForm = () => {
    setShowNewCustomerForm(false);
    setEditingCustomer(null);
    setNewCustomerForm({ name: '', phone: '', email: '', place: '', foodPreference: 'both', loyaltyDiscount: '' });
  };

  return (
    <div>
      <PageHeader
        title="Customer Master"
        subtitle="Manage regular customers with loyalty discounts"
        actions={
          user?.role === 'admin' && (
            <Button onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}>
              {showNewCustomerForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Customer</>}
            </Button>
          )
        }
      />

      <div className="space-y-6">
        {/* New Customer Form */}
        {showNewCustomerForm && user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">{editingCustomer ? 'Edit Customer' : 'Create New Customer'}</h2>
            </CardHeader>
            <CardBody>
              <div className="mb-6 p-4 rounded-lg bg-background-secondary border border-white/10 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Customer Name *"
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    placeholder="Enter customer name"
                  />
                  <Input
                    label="Phone Number"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                  <Input
                    label="Place / Address"
                    value={newCustomerForm.place}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, place: e.target.value })}
                    placeholder="Enter place or address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Food Preference"
                    value={newCustomerForm.foodPreference}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, foodPreference: e.target.value as 'veg' | 'non-veg' | 'both' })}
                    options={[
                      { value: 'both', label: 'Both' },
                      { value: 'veg', label: 'Vegetarian' },
                      { value: 'non-veg', label: 'Non-Vegetarian' },
                    ]}
                  />
                  <Input
                    label="Loyalty Discount (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={newCustomerForm.loyaltyDiscount}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, loyaltyDiscount: e.target.value })}
                    placeholder="e.g., 5 for 5% discount"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={editingCustomer ? handleUpdateCustomer : handleCreateCustomer} loading={isSubmitting}>
                    {editingCustomer ? 'Update Customer' : 'Create Customer'}
                  </Button>
                  <Button variant="ghost" onClick={cancelForm}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Customer List */}
        <Card>
          <CardBody>
            <div className="space-y-3">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-background-secondary border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-text-muted">
                        {c.phone && `📱 ${c.phone}`}
                        {c.phone && c.email && ' • '}
                        {c.email && `✉️ ${c.email}`}
                        {((c.phone || c.email) && c.place) && ' • '}
                        {c.place && `📍 ${c.place}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          c.food_preference === 'veg' ? 'bg-green-500/20 text-green-400' :
                          c.food_preference === 'non-veg' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {c.food_preference === 'veg' ? '🥬 Veg' : c.food_preference === 'non-veg' ? '🍖 Non-Veg' : '🍽️ Both'}
                        </span>
                        {c.loyalty_discount && c.loyalty_discount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent">
                            🎁 {c.loyalty_discount}% Loyalty
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCustomer(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCustomer(c.id)}
                        className="text-error hover:bg-error/10"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {customers.length === 0 && (
                <p className="text-center text-text-muted py-8">No customers found. Add your first customer!</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}