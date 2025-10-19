import { useState, useEffect, useRef } from 'react';
import { Video, RefreshCw, AlertCircle, Maximize2 } from 'lucide-react';
import { cameraService } from '@/services/api';

interface CameraPreviewProps {
  hostname: string;
  refreshInterval?: number; // milliseconds
  className?: string;
  showControls?: boolean;
}

export default function CameraPreview({ 
  hostname, 
  refreshInterval = 1000, 
  className = '',
  showControls = true 
}: CameraPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isPaused, setIsPaused] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const snapshotUrl = cameraService.getSnapshotUrl(hostname);

  const loadSnapshot = () => {
    if (isPaused) return;
    
    setLoading(true);
    setError(null);

    // Add timestamp to prevent caching
    const url = `${snapshotUrl}?t=${Date.now()}`;
    
    if (imgRef.current) {
      imgRef.current.src = url;
    }
  };

  const handleImageLoad = () => {
    setLoading(false);
    setError(null);
    setLastUpdate(new Date());
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Failed to load camera snapshot');
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleFullscreen = () => {
    if (imgRef.current) {
      if (imgRef.current.requestFullscreen) {
        imgRef.current.requestFullscreen();
      }
    }
  };

  useEffect(() => {
    // Load initial snapshot
    loadSnapshot();

    // Set up refresh interval
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(loadSnapshot, refreshInterval);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [hostname, refreshInterval, isPaused]);

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Video Container */}
      <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center justify-center p-4 text-gray-400">
            <AlertCircle className="h-12 w-12 mb-2" />
            <p className="text-sm text-center">{error}</p>
            <button
              onClick={loadSnapshot}
              className="mt-2 px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <img
              ref={imgRef}
              alt={`Camera ${hostname}`}
              className="w-full h-full object-contain"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                <div className="loading-spinner h-8 w-8" />
              </div>
            )}
          </>
        )}

        {/* Paused Overlay */}
        {isPaused && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70">
            <div className="text-white text-center">
              <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Paused</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center space-x-2">
              <span className="opacity-75">{hostname}</span>
              {!isPaused && !error && (
                <span className="flex items-center space-x-1">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="opacity-75">Live</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={togglePause}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
              
              <button
                onClick={handleFullscreen}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Update Time */}
      {!error && !isPaused && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

