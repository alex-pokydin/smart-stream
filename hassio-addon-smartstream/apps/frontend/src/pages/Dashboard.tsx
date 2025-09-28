import { useState, useEffect } from 'react';
import { Camera, Activity, Wifi, AlertTriangle } from 'lucide-react';
import { cameraService, streamService } from '@/services/api';
import { CameraConfig, StreamStatus } from '@smart-stream/shared';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [cameras, setCameras] = useState<Record<string, CameraConfig>>({});
  const [streams, setStreams] = useState<Record<string, StreamStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [camerasData, streamsData] = await Promise.all([
        cameraService.getCameras(),
        streamService.getStreams(),
      ]);
      setCameras(camerasData);
      setStreams(streamsData);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const cameraCount = Object.keys(cameras).length;
  const activeStreams = Object.values(streams).filter(s => s.status === 'running').length;
  const autostartCameras = Object.values(cameras).filter(c => c.autostart).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-8 w-8" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your camera streaming system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Camera className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{cameraCount}</div>
                <div className="text-sm text-gray-600">Total Cameras</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{activeStreams}</div>
                <div className="text-sm text-gray-600">Active Streams</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Wifi className="h-8 w-8 text-warning-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{autostartCameras}</div>
                <div className="text-sm text-gray-600">Autostart Enabled</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-error-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {Object.values(streams).filter(s => s.status === 'error').length}
                </div>
                <div className="text-sm text-gray-600">Failed Streams</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cameras Overview */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cameras</h3>
            {cameraCount === 0 ? (
              <div className="text-center py-8">
                <Camera className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No cameras</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding your first camera.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.values(cameras).slice(0, 5).map((camera) => (
                  <div key={camera.hostname} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{camera.hostname}</div>
                      <div className="text-sm text-gray-500">{camera.username}@{camera.port}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {camera.autostart && (
                        <span className="badge badge-primary">Auto</span>
                      )}
                      <div className="status-indicator bg-gray-400" />
                    </div>
                  </div>
                ))}
                {cameraCount > 5 && (
                  <div className="text-sm text-gray-500 text-center pt-2">
                    And {cameraCount - 5} more cameras...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Streams Overview */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Streams</h3>
            {activeStreams === 0 ? (
              <div className="text-center py-8">
                <Activity className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No active streams</h3>
                <p className="mt-1 text-sm text-gray-500">Start streaming from your cameras.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.values(streams)
                  .filter(stream => stream.status === 'running')
                  .slice(0, 5)
                  .map((stream) => (
                    <div key={stream.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{stream.id}</div>
                        <div className="text-sm text-gray-500">
                          Started {stream.startTime ? new Date(stream.startTime).toLocaleTimeString() : 'Unknown'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="badge badge-success">Running</span>
                        <div className="status-running" />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
