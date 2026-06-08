import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api';
import { Button, Input } from '../../components/ui';
import { Store, ArrowRight, Key, Mail, User } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loginMode, setLoginMode] = useState<'pin' | 'password'>('password');
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  // Fetch restaurants for PIN login
  useEffect(() => {
    api.getRestaurants().then((response) => {
      const data = response.data?.data || response.data || [];
      if (Array.isArray(data)) {
        setRestaurants(data);
        if (data.length === 1) {
          setSelectedRestaurant(data[0].id);
        }
      }
    }).catch(() => {
      // Use demo restaurant
      setRestaurants([{ id: 'restaurant-1', name: 'Oyebill Goa' }]);
      setSelectedRestaurant('restaurant-1');
    });
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/billing');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant) {
      return;
    }

    try {
      const response = await api.post('/auth/pin-login', {
        pin,
        restaurantId: selectedRestaurant
      });

      if (response.success) {
        // Store auth data
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('restaurant', JSON.stringify(response.restaurant));
        navigate('/billing');
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || 'Invalid PIN';
      if (error?.response?.status === 423) {
        // Account locked
        setFailedAttempts(3);
      } else {
        setFailedAttempts(prev => prev + 1);
      }
      clearError();
    }
  };

  const handlePinChange = (value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary jali-pattern">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md p-8 card animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text">Oyebill</h1>
          <p className="text-sm text-text-muted mt-1">Restaurant Billing System</p>
        </div>

        {/* Login Mode Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-background-secondary rounded-lg">
          <button
            type="button"
            onClick={() => { setLoginMode('password'); clearError(); setPin(''); setFailedAttempts(0); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              loginMode === 'password' 
                ? 'bg-accent text-white' 
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            Password
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('pin'); clearError(); setEmail(''); setPassword(''); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              loginMode === 'pin' 
                ? 'bg-accent text-white' 
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            PIN Login
          </button>
        </div>

        {/* Password Login Form */}
        {loginMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              placeholder="admin@oyebill.com"
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              placeholder="Enter your password"
              required
            />

            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
            >
              Sign In
            </Button>
          </form>
        )}

        {/* PIN Login Form */}
        {loginMode === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-5">
            {/* Restaurant Selection */}
            {(restaurants && restaurants.length > 1) && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Select Restaurant
                </label>
                <select
                  value={selectedRestaurant}
                  onChange={(e) => setSelectedRestaurant(e.target.value)}
                  className="w-full px-4 py-3 bg-background-secondary border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Select Restaurant</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* PIN Input */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Enter 4-Digit PIN
              </label>
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[i] || ''}
                    onChange={(e) => {
                      const newPin = pin.split('');
                      newPin[i] = e.target.value;
                      handlePinChange(newPin.join(''));
                      
                      // Auto-focus next input
                      if (e.target.value && i < 3) {
                        const nextInput = document.querySelector(`input[data-pin-index="${i + 1}"]`) as HTMLInputElement;
                        nextInput?.focus();
                      }
                    }}
                    data-pin-index={i}
                    className="w-14 h-16 text-center text-2xl font-bold bg-background-secondary border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-accent"
                    disabled={failedAttempts >= 3}
                  />
                ))}
              </div>
              {failedAttempts > 0 && failedAttempts < 3 && (
                <p className="text-xs text-center text-warning mt-2">
                  Invalid PIN. {3 - failedAttempts} attempts remaining.
                </p>
              )}
              {failedAttempts >= 3 && (
                <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm text-center">
                  <p className="font-medium">Account Locked</p>
                  <p className="text-xs mt-1">Please login with password to unlock PIN.</p>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
              disabled={pin.length !== 4 || !selectedRestaurant || failedAttempts >= 3}
            >
              Login with PIN
            </Button>

            <p className="text-xs text-text-muted text-center">
              PIN login is available for Waiters and Bussers only.
            </p>
          </form>
        )}

        {/* Additional Links */}
        <div className="mt-6 space-y-3">
          {loginMode === 'password' && (
            <Link
              to="/forgot-password"
              className="block text-center text-sm text-accent hover:text-accent/80 transition-colors"
            >
              Forgot Password?
            </Link>
          )}
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-[#1e3a5f] hover:bg-[#152a45] border border-[#1e3a5f] hover:border-[#152a45] text-white hover:text-white transition-all duration-200"
          >
            <span className="text-sm font-medium">Register Your Restaurant</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}