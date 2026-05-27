import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, toast } from '../../components/ui';
import { Store, ArrowLeft, Mail } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailSent(true);
        toast('success', 'Password reset link sent to your email');
      } else {
        toast('error', data.error || 'Failed to send reset email');
      }
    } catch (error) {
      toast('error', 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
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
          <Link to="/login" className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary mb-4">
            <Store className="w-8 h-8 text-white" />
          </Link>
          <h1 className="font-display text-3xl font-bold gradient-text">Reset Password</h1>
          <p className="text-sm text-text-muted mt-1">Enter your email to receive reset instructions</p>
        </div>

        {emailSent ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                <Mail className="w-8 h-8 text-success" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Check Your Email</h3>
              <p className="text-sm text-text-muted">
                We've sent password reset instructions to <span className="text-accent">{email}</span>
              </p>
            </div>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
            >
              Send Reset Link
            </Button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-text-muted hover:text-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}