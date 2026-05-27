import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Button, Input } from '../../components/ui';
import { Lock, CheckCircle } from 'lucide-react';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    const response = await api.resetPassword(password);
    setIsLoading(false);

    if (response.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate('/billing');
      }, 2000);
    } else {
      setError(response.error || 'Failed to reset password');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary jali-pattern">
        <div className="relative w-full max-w-md p-8 card animate-scale-in text-center">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Password Reset!</h2>
          <p className="text-text-muted">Redirecting you to the dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary jali-pattern">
      <div className="relative w-full max-w-md p-8 card animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold gradient-text">Set New Password</h1>
          <p className="text-sm text-text-muted mt-2">
            You must change your password before continuing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error && password !== confirmPassword ? error : undefined}
            placeholder="Confirm new password"
            required
          />

          {error && password === confirmPassword && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isLoading}
            disabled={password !== confirmPassword || password.length < 6}
          >
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  );
}