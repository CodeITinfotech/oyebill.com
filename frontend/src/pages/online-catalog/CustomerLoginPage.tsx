import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

interface CustomerLoginPageProps {
  restaurantId: string;
  onLogin: (customer: any) => void;
}

export const CustomerLoginPage: React.FC<CustomerLoginPageProps> = ({ restaurantId, onLogin }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.sendCustomerOTP(email, name, phone);
      
      if (response.success && response.data) {
        setGeneratedOtp(response.data.otp);
        setStep('otp');
        // In production, remove this log - OTP is sent via email
        console.log('OTP sent to email:', response.data.otp);
      } else {
        setError(response.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.verifyCustomerOTP(email, otp);
      
      if (response.success && response.data) {
        // Store customer info in localStorage for session
        localStorage.setItem('customerEmail', email);
        localStorage.setItem('customerData', JSON.stringify(response.data.customer));
        onLogin(response.data.customer);
        navigate(`/catalog/${restaurantId}/menu`);
      } else {
        setError(response.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Online Ordering</h1>
          <p className="text-gray-600">Login with your email to place orders</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {step === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSendOTP}
              disabled={loading}
              className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Continue with Email'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                We've sent a 6-digit OTP to your email<br />
                <span className="font-medium text-gray-900">{email}</span>
              </p>
              
              {/* Development mode: show OTP */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-green-700">
                  Development Mode: Your OTP is <span className="font-bold">{generatedOtp}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-primary focus:border-transparent"
                maxLength={6}
              />
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              onClick={() => {
                setStep('email');
                setOtp('');
              }}
              className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Change email address
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(`/catalog/${restaurantId}/menu`)}
            className="text-sm text-gray-500 hover:text-primary"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerLoginPage;