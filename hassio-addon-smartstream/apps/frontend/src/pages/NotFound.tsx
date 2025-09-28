import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-error-400" />
          <h1 className="mt-4 text-4xl font-bold text-gray-900">404</h1>
          <h2 className="mt-2 text-xl font-semibold text-gray-700">Page not found</h2>
          <p className="mt-2 text-gray-600">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>
        
        <div className="mt-8 flex justify-center">
          <Link 
            to="/dashboard" 
            className="btn btn-primary btn-md inline-flex items-center"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
