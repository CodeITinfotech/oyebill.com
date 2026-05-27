import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input } from '../../components/ui';
import { Store, User, CheckCircle } from 'lucide-react';

export function SetupPage() {
  const navigate = useNavigate();
  const { setupInitial, isLoading, error, clearError } = useAuthStore();

  const [step, setStep] = useState(1);
  const [restaurant, setRestaurant] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
  });
  const [admin, setAdmin] = useState({
    name: '',
    email: '',
    password: 'OyeBill2024',
    confirmPassword: 'OyeBill2024',
  });

  const handleRestaurantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (admin.password !== admin.confirmPassword) {
      return;
    }

    const success = await setupInitial(restaurant, {
      name: admin.name,
      email: admin.email,
      password: admin.password,
    });

    if (success) {
      navigate('/billing');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary jali-pattern p-4">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg p-8 card animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text">Oyebill</h1>
          <p className="text-sm text-text-muted mt-1">Let's set up your restaurant</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-accent' : 'text-text-muted'}`}>
            {step > 1 ? <CheckCircle className="w-5 h-5" /> : <Store className="w-5 h-5" />}
            <span className="text-sm font-medium">Restaurant</span>
          </div>
          <div className="w-12 h-0.5 bg-white/10" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-accent' : 'text-text-muted'}`}>
            <User className="w-5 h-5" />
            <span className="text-sm font-medium">Admin</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleRestaurantSubmit} className="space-y-5">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Restaurant Details</h2>
              <p className="text-sm text-text-muted">Tell us about your restaurant</p>
            </div>

            <Input
              label="Restaurant Name"
              value={restaurant.name}
              onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })}
              placeholder="The Great Indian Kitchen"
              required
            />

            <Input
              label="Address"
              value={restaurant.address}
              onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })}
              placeholder="123 Main Street, City, State"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone"
                type="tel"
                value={restaurant.phone}
                onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })}
                placeholder="+91 98765 43210"
                required
              />

              <Input
                label="Email"
                type="email"
                value={restaurant.email}
                onChange={(e) => setRestaurant({ ...restaurant, email: e.target.value })}
                placeholder="info@restaurant.com"
              />
            </div>

            <Input
              label="GST Number"
              value={restaurant.gstNumber}
              onChange={(e) => setRestaurant({ ...restaurant, gstNumber: e.target.value })}
              placeholder="27AABCU9603R1ZM"
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
            >
              Continue to Admin Setup
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleAdminSubmit} className="space-y-5">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Admin Account</h2>
              <p className="text-sm text-text-muted">Create your admin login</p>
            </div>

            <Input
              label="Admin Name"
              value={admin.name}
              onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
              placeholder="John Doe"
              required
            />

            <Input
              label="Admin Email"
              type="email"
              value={admin.email}
              onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
              placeholder="admin@yourrestaurant.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={admin.password}
              onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={admin.confirmPassword}
              onChange={(e) => setAdmin({ ...admin, confirmPassword: e.target.value })}
              error={admin.password !== admin.confirmPassword ? 'Passwords do not match' : undefined}
              required
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                loading={isLoading}
                disabled={admin.password !== admin.confirmPassword}
              >
                Complete Setup
              </Button>
            </div>
          </form>
        )}

        <p className="text-xs text-text-muted text-center mt-6">
          Your default password for new users will be: OyeBill2024
        </p>
      </div>
    </div>
  );
}