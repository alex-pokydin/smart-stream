import { useState, useEffect } from 'react';
import { healthService } from '@/services/api';

interface HealthCheckState {
  isHealthy: boolean;
  isLoading: boolean;
  lastCheck: Date | null;
  error: string | null;
}

export function useHealthCheck(interval = 30000) {
  const [state, setState] = useState<HealthCheckState>({
    isHealthy: false,
    isLoading: true,
    lastCheck: null,
    error: null,
  });

  const checkHealth = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const health = await healthService.getHealth();
      
      setState({
        isHealthy: health.status === 'healthy',
        isLoading: false,
        lastCheck: new Date(),
        error: null,
      });
    } catch (error) {
      setState({
        isHealthy: false,
        isLoading: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  };

  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkHealth, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return {
    ...state,
    refetch: checkHealth,
  };
}
