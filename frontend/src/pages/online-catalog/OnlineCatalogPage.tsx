import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CustomerLoginPage } from './CustomerLoginPage';
import { MenuCatalogPage } from './MenuCatalogPage';
import { CheckoutPage } from './CheckoutPage';
import { OrderTrackingPage } from './OrderTrackingPage';

type View = 'login' | 'menu' | 'checkout' | 'track';

export const OnlineCatalogPage: React.FC = () => {
  const { restaurantId, view, orderNumber } = useParams<{ 
    restaurantId: string; 
    view?: string;
    orderNumber?: string;
  }>();
  const navigate = useNavigate();
  
  const [currentView, setCurrentView] = useState<View>('menu');
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    // Determine view from URL
    if (view === 'login') {
      setCurrentView('login');
    } else if (view === 'checkout') {
      setCurrentView('checkout');
    } else if (view === 'track' && orderNumber) {
      setCurrentView('track');
    } else {
      setCurrentView('menu');
    }
  }, [view, orderNumber]);

  const handleLogin = (customerData: any) => {
    setCustomer(customerData);
  };

  const handleLogout = () => {
    setCustomer(null);
    localStorage.removeItem('customerEmail');
    localStorage.removeItem('customerData');
  };

  // If no restaurant ID, redirect
  if (!restaurantId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Invalid restaurant</p>
        </div>
      </div>
    );
  }

  // Render based on current view
  switch (currentView) {
    case 'login':
      return (
        <CustomerLoginPage 
          restaurantId={restaurantId} 
          onLogin={handleLogin} 
        />
      );
    
    case 'checkout':
      return (
        <CheckoutPage restaurantId={restaurantId} />
      );
    
    case 'track':
      return (
        <OrderTrackingPage restaurantId={restaurantId} />
      );
    
    case 'menu':
    default:
      return (
        <MenuCatalogPage 
          restaurantId={restaurantId} 
          onLogout={handleLogout}
        />
      );
  }
};

export default OnlineCatalogPage;