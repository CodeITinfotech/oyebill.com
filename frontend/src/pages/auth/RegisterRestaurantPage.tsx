import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, toast } from '../../components/ui';
import { Store, ArrowLeft, CheckCircle } from 'lucide-react';

export function RegisterRestaurantPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  
  const [formData, setFormData] = useState({
    restaurantName: '',
    restaurantAddress: '',
    restaurantPhone: '',
    restaurantEmail: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.adminPassword.length < 5) {
      toast('error', 'Password must be at least 5 characters');
      return;
    }

    if (formData.adminPassword !== formData.confirmPassword) {
      toast('error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant: {
            name: formData.restaurantName,
            address: formData.restaurantAddress,
            phone: formData.restaurantPhone,
            email: formData.restaurantEmail,
          },
          admin: {
            name: formData.adminName,
            email: formData.adminEmail,
            password: formData.adminPassword,
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsRegistered(true);
        toast('success', 'Registration submitted! You will receive an email once your account is activated.');
      } else {
        toast('error', data.error || 'Registration failed');
      }
    } catch (error) {
      toast('error', 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary jali-pattern">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md p-8 card animate-scale-in text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
          </div>
          
          <h1 className="font-display text-3xl font-bold gradient-text mb-4">Registration Submitted!</h1>
          <p className="text-text-muted mb-6">
            Your restaurant registration has been submitted successfully. 
            You will receive an email notification once your account is activated by our team.
          </p>
          
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 text-accent hover:text-accent/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary jali-pattern py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl p-8 card animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary mb-4">
            <Store className="w-8 h-8 text-white" />
          </Link>
          <h1 className="font-display text-3xl font-bold gradient-text">Register Your Restaurant</h1>
          <p className="text-sm text-text-muted mt-1">Join Oyebill - Restaurant Billing System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Restaurant Details */}
          <div>
            <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">Restaurant Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Restaurant Name *"
                name="restaurantName"
                value={formData.restaurantName}
                onChange={handleChange}
                placeholder="Enter restaurant name"
                required
              />
              <Input
                label="Phone Number *"
                name="restaurantPhone"
                type="tel"
                value={formData.restaurantPhone}
                onChange={handleChange}
                placeholder="Enter phone number"
                required
              />
              <div className="md:col-span-2">
                <Input
                  label="Address *"
                  name="restaurantAddress"
                  value={formData.restaurantAddress}
                  onChange={handleChange}
                  placeholder="Enter complete address"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Restaurant Email"
                  name="restaurantEmail"
                  type="email"
                  value={formData.restaurantEmail}
                  onChange={handleChange}
                  placeholder="restaurant@example.com (optional)"
                />
              </div>
            </div>
          </div>

          {/* Admin Account Details */}
          <div>
            <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">Admin Account</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Admin Name *"
                name="adminName"
                value={formData.adminName}
                onChange={handleChange}
                placeholder="Enter admin name"
                required
              />
              <Input
                label="Admin Email *"
                name="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={handleChange}
                placeholder="admin@yourrestaurant.com"
                required
              />
              <Input
                label="Password *"
                name="adminPassword"
                type="password"
                value={formData.adminPassword}
                onChange={handleChange}
                placeholder="Min 5 characters"
                required
              />
              <Input
                label="Confirm Password *"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={isLoading}
            >
              Submit Registration
            </Button>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/10 text-text-muted hover:text-accent hover:border-accent/50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        <p className="text-xs text-text-muted text-center mt-6">
          By registering, you agree to our Terms of Service and Privacy Policy.
          Your account will be activated by our team within 24 hours.
        </p>
      </div>
    </div>
  );
}