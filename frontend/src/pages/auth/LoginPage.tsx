import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input } from '../../components/ui';
import { Store, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/billing');
    }
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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

        {/* Additional Links */}
        <div className="mt-6 space-y-3">
          <Link
            to="/forgot-password"
            className="block text-center text-sm text-accent hover:text-accent/80 transition-colors"
          >
            Forgot Password?
          </Link>
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