import { Camera, Wifi, WifiOff } from 'lucide-react';
import { useHealthCheck } from '@/hooks/useHealthCheck';

export default function Header() {
  const { isHealthy, isLoading } = useHealthCheck();

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Smart Stream</h1>
              <p className="text-sm text-gray-500">Camera Management System</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <div className="loading-spinner" />
              ) : isHealthy ? (
                <Wifi className="h-5 w-5 text-success-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-error-600" />
              )}
              <span className={`text-sm font-medium ${
                isHealthy ? 'text-success-600' : 'text-error-600'
              }`}>
                {isLoading ? 'Checking...' : isHealthy ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="h-6 w-px bg-gray-300" />
            
            <div className="text-sm text-gray-500">
              Home Assistant Add-on
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
