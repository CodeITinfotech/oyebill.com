import { Link } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  code?: string;
  title?: string;
  description?: string;
}

export function ErrorPage({ 
  code = '404', 
  title = 'Page not found', 
  description = 'The page you are looking for does not exist or has been moved.' 
}: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <span className="text-2xl font-bold text-white">₹</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text">Oyebill</h1>
            <p className="text-xs text-text-muted tracking-wider">RESTAURANT BILLING</p>
          </div>
        </div>

        {/* Error Illustration */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-background-secondary rounded-2xl flex items-center justify-center border border-white/10">
            <span className="text-6xl font-bold gradient-text">{code}</span>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-warning/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-accent/20 rounded-full" />
        </div>

        {/* Error Content */}
        <h2 className="text-2xl font-bold mb-2 text-text-primary">{title}</h2>
        <p className="text-text-muted mb-8 leading-relaxed">{description}</p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/billing"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-accent to-primary text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-background-secondary border border-white/10 text-text-primary rounded-xl font-medium hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Footer Note */}
        <p className="mt-12 text-sm text-text-muted">
          If you think this is a mistake, please contact support.
        </p>
      </div>
    </div>
  );
}

// 404 Page component
export function NotFoundPage() {
  return <ErrorPage />;
}

// 500 Page component
export function ServerErrorPage() {
  return (
    <ErrorPage 
      code="500"
      title="Server Error"
      description="Something went wrong on our end. Please try again later."
    />
  );
}

// 403 Page component
export function ForbiddenPage() {
  return (
    <ErrorPage 
      code="403"
      title="Access Denied"
      description="You don't have permission to access this page."
    />
  );
}

// 401 Page component
export function UnauthorizedPage() {
  return (
    <ErrorPage 
      code="401"
      title="Session Expired"
      description="Your session has expired. Please log in again."
    />
  );
}

export default ErrorPage;