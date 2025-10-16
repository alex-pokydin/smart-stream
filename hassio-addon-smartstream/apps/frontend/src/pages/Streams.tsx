import React, { useState, useEffect } from 'react';
import { 
  Square, 
  RotateCcw, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Wifi, 
  WifiOff,
  Eye,
  EyeOff,
  RefreshCw,
  BarChart3,
  Bug,
  Trash2,
  Terminal,
  Cpu,
  HardDrive
} from 'lucide-react';
import { streamService, cameraService } from '../services/api';
import { StreamStatus } from '@smart-stream/shared';

interface StreamWithCamera extends StreamStatus {
  config?: {
    inputUrl?: string;
    outputUrl?: string;
    quality?: string;
    fps?: number;
    resolution?: string;
    bitrate?: string;
    platform?: {
      type: 'youtube' | 'twitch' | 'custom';
      streamKey?: string;
      serverUrl?: string;
    };
    youtubeStreamKey?: string;
  };
  cameraHostname?: string;
  cameraName?: string;
}

const Streams: React.FC = () => {
  const [streams, setStreams] = useState<Record<string, StreamWithCamera>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<Record<string, boolean>>({});
  const [diagnostics, setDiagnostics] = useState<Record<string, any>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    trackedStreams: { id: string; pid: number | undefined; status: string }[];
    allFFmpegProcesses: { 
      pid: number; 
      cmd: string; 
      tracked: boolean;
      cpu?: number;
      memory?: number;
      runtime?: string;
    }[];
    orphanedCount: number;
    resourceUsage: {
      totalCpu: number;
      totalMemory: number;
      ffmpegCpu: number;
      ffmpegMemory: number;
      processCount: number;
    };
  } | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Load streams and cameras
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [streamsData, camerasData] = await Promise.all([
        streamService.getStreams(),
        cameraService.getCameras()
      ]);

      // Enrich streams with camera information
      const enrichedStreams: Record<string, StreamWithCamera> = {};
      Object.entries(streamsData).forEach(([streamId, stream]) => {
        const streamWithConfig = stream as StreamWithCamera;
        enrichedStreams[streamId] = {
          ...stream,
          cameraHostname: streamWithConfig.config?.inputUrl?.match(/rtsp:\/\/(?:[^:]+:[^@]+@)?([^:]+)/)?.[1],
          cameraName: Object.values(camerasData).find(cam => 
            streamWithConfig.config?.inputUrl?.includes(cam.hostname)
          )?.hostname
        };
      });

      setStreams(enrichedStreams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load streams');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh streams every 5 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle stream actions
  const handleStreamAction = async (streamId: string, action: 'stop' | 'restart') => {
    try {
      setActionLoading(prev => ({ ...prev, [streamId]: action }));
      
      if (action === 'stop') {
        await streamService.stopStream(streamId);
      } else if (action === 'restart') {
        await streamService.restartStream(streamId);
      }
      
      // Reload data after action
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} stream`);
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[streamId];
        return newState;
      });
    }
  };

  // Toggle diagnostics view
  const toggleDiagnostics = async (streamId: string) => {
    const isShowing = showDiagnostics[streamId];
    setShowDiagnostics(prev => ({ ...prev, [streamId]: !isShowing }));
    
    if (!isShowing && !diagnostics[streamId]) {
      try {
        const diag = await streamService.getStreamDiagnostics(streamId);
        setDiagnostics(prev => ({ ...prev, [streamId]: diag }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
      }
    }
  };

  // Load debug info
  const loadDebugInfo = async () => {
    try {
      setDebugLoading(true);
      const info = await streamService.getProcessDebugInfo();
      setDebugInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debug info');
    } finally {
      setDebugLoading(false);
    }
  };

  // Toggle debug panel
  const toggleDebugPanel = async () => {
    const newState = !showDebugPanel;
    setShowDebugPanel(newState);
    
    if (newState) {
      await loadDebugInfo();
    }
  };

  // Cleanup orphaned processes
  const handleCleanup = async () => {
    try {
      setCleanupLoading(true);
      const result = await streamService.cleanupOrphanedProcesses();
      
      // Refresh debug info after cleanup
      await loadDebugInfo();
      
      // Show success message
      if (result.killed > 0) {
        alert(`Successfully cleaned up ${result.killed} orphaned FFmpeg process(es)`);
      } else {
        alert('No orphaned processes found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup orphaned processes');
    } finally {
      setCleanupLoading(false);
    }
  };

  // Auto-refresh debug info when panel is open
  useEffect(() => {
    if (showDebugPanel) {
      const interval = setInterval(loadDebugInfo, 5000);
      return () => clearInterval(interval);
    }
  }, [showDebugPanel]);

  // Get status icon and color
  const getStatusDisplay = (status: StreamStatus['status']) => {
    switch (status) {
      case 'running':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Running' };
      case 'starting':
        return { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Starting' };
      case 'stopping':
        return { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Stopping' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Error' };
      case 'idle':
        return { icon: Square, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Idle' };
      default:
        return { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50', label: status };
    }
  };

  // Format duration
  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(startTime).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  if (loading && Object.keys(streams).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-5 w-5 animate-spin text-primary-600" />
          <span className="text-gray-600">Loading streams...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800 font-medium">Error</span>
        </div>
        <p className="text-red-700 mt-1">{error}</p>
        <button
          onClick={loadData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const streamEntries = Object.entries(streams);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Streams</h1>
          <p className="text-gray-600 mt-1">
            Manage and monitor your active streams
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleDebugPanel}
            className={`flex items-center space-x-2 px-4 py-2 border rounded-md transition-colors ${
              showDebugPanel 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Bug className="h-4 w-4" />
            <span>Debug</span>
            {debugInfo && debugInfo.orphanedCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {debugInfo.orphanedCount}
              </span>
            )}
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className="text-2xl font-bold text-gray-900">
                {streamEntries.filter(([_, stream]) => stream.status === 'running').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Starting</p>
              <p className="text-2xl font-bold text-gray-900">
                {streamEntries.filter(([_, stream]) => stream.status === 'starting').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-gray-900">
                {streamEntries.filter(([_, stream]) => stream.status === 'error').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{streamEntries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="bg-white rounded-lg border-2 border-blue-300 overflow-hidden">
          <div className="bg-blue-50 p-4 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Terminal className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Process Debug Information</h3>
                  <p className="text-sm text-gray-600">
                    Monitor all FFmpeg processes and detect orphaned streams
                  </p>
                </div>
              </div>
              <button
                onClick={handleCleanup}
                disabled={cleanupLoading || (debugInfo?.orphanedCount === 0)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                <span>{cleanupLoading ? 'Cleaning...' : 'Cleanup Orphaned'}</span>
              </button>
            </div>
          </div>

          <div className="p-4">
            {debugLoading && !debugInfo ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-600">Loading debug info...</span>
              </div>
            ) : debugInfo ? (
              <div className="space-y-4">
                {/* Resource Usage Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Cpu className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-gray-600">System CPU</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{debugInfo.resourceUsage.totalCpu}%</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <HardDrive className="h-4 w-4 text-purple-600" />
                      <p className="text-sm font-medium text-gray-600">System Memory</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{debugInfo.resourceUsage.totalMemory}%</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Cpu className="h-4 w-4 text-orange-600" />
                      <p className="text-sm font-medium text-gray-600">FFmpeg CPU</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{debugInfo.resourceUsage.ffmpegCpu}%</p>
                  </div>
                  <div className="bg-pink-50 p-3 rounded-lg border border-pink-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <HardDrive className="h-4 w-4 text-pink-600" />
                      <p className="text-sm font-medium text-gray-600">FFmpeg Memory</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{debugInfo.resourceUsage.ffmpegMemory}%</p>
                  </div>
                </div>

                {/* Process Count Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Total FFmpeg Processes</p>
                    <p className="text-2xl font-bold text-gray-900">{debugInfo.allFFmpegProcesses.length}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Tracked Streams</p>
                    <p className="text-2xl font-bold text-green-900">{debugInfo.trackedStreams.length}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Orphaned Processes</p>
                    <p className="text-2xl font-bold text-red-900">{debugInfo.orphanedCount}</p>
                  </div>
                </div>

                {/* Process List */}
                {debugInfo.allFFmpegProcesses.length > 0 ? (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">All FFmpeg Processes</h4>
                    <div className="space-y-2">
                      {debugInfo.allFFmpegProcesses.map((proc, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            proc.tracked
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-300'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  proc.tracked
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {proc.tracked ? 'Tracked' : 'Orphaned'}
                                </span>
                                <span className="font-mono text-sm font-medium text-gray-900">
                                  PID: {proc.pid}
                                </span>
                                {proc.runtime && (
                                  <span className="text-xs text-gray-500">
                                    Runtime: {proc.runtime}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-gray-600 break-all">
                                {proc.cmd}
                              </p>
                            </div>
                          </div>
                          
                          {/* Resource Usage */}
                          {(proc.cpu !== undefined || proc.memory !== undefined) && (
                            <div className="flex items-center space-x-4 pt-2 border-t border-gray-200">
                              {proc.cpu !== undefined && (
                                <div className="flex items-center space-x-1">
                                  <Cpu className="h-3 w-3 text-gray-500" />
                                  <span className={`text-xs font-medium ${
                                    proc.cpu > 50 ? 'text-red-600' : 
                                    proc.cpu > 20 ? 'text-orange-600' : 
                                    'text-gray-600'
                                  }`}>
                                    CPU: {proc.cpu}%
                                  </span>
                                </div>
                              )}
                              {proc.memory !== undefined && (
                                <div className="flex items-center space-x-1">
                                  <HardDrive className="h-3 w-3 text-gray-500" />
                                  <span className="text-xs font-medium text-gray-600">
                                    Memory: {proc.memory}%
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Terminal className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No FFmpeg processes running</p>
                  </div>
                )}

                {/* Tracked Streams Details */}
                {debugInfo.trackedStreams.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Tracked Stream Details</h4>
                    <div className="space-y-2">
                      {debugInfo.trackedStreams.map((stream, idx) => (
                        <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{stream.id}</p>
                              <p className="text-sm text-gray-600">
                                PID: {stream.pid || 'N/A'} • Status: {stream.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning for orphaned processes */}
                {debugInfo.orphanedCount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-red-900">Orphaned Processes Detected</p>
                        <p className="text-sm text-red-800 mt-1">
                          {debugInfo.orphanedCount} FFmpeg process(es) are running but not tracked by the application.
                          These may be leftover from a previous session and should be cleaned up to free system resources.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Streams List */}
      {streamEntries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Streams</h3>
          <p className="text-gray-600 mb-4">
            Start streaming from the Cameras page to see active streams here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {streamEntries.map(([streamId, stream]) => {
            const statusDisplay = getStatusDisplay(stream.status);
            const StatusIcon = statusDisplay.icon;
            const isActionLoading = actionLoading[streamId];
            const isShowingDiagnostics = showDiagnostics[streamId];
            const streamDiagnostics = diagnostics[streamId];

            return (
              <div key={streamId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Stream Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${statusDisplay.bg}`}>
                        <StatusIcon className={`h-5 w-5 ${statusDisplay.color}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{streamId}</h3>
                        <p className="text-sm text-gray-600">
                          {stream.cameraName || stream.cameraHostname || 'Unknown Camera'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color}`}>
                        {statusDisplay.label}
                      </span>
                      
                      <button
                        onClick={() => toggleDiagnostics(streamId)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Toggle Diagnostics"
                      >
                        {isShowingDiagnostics ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stream Details */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Duration</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatDuration(stream.startTime)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-600">FPS</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {stream.stats.fps || 0}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-600">Bitrate</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {stream.stats.bitrate || '0kbits/s'}
                      </p>
                    </div>
                  </div>

                  {/* Error Message */}
                  {stream.errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800">{stream.errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {stream.status === 'running' && (
                      <>
                        <button
                          onClick={() => handleStreamAction(streamId, 'stop')}
                          disabled={isActionLoading === 'stop'}
                          className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <Square className="h-4 w-4" />
                          <span>{isActionLoading === 'stop' ? 'Stopping...' : 'Stop'}</span>
                        </button>
                        
                        <button
                          onClick={() => handleStreamAction(streamId, 'restart')}
                          disabled={isActionLoading === 'restart'}
                          className="flex items-center space-x-2 px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>{isActionLoading === 'restart' ? 'Restarting...' : 'Restart'}</span>
                        </button>
                      </>
                    )}
                    
                    {stream.status === 'error' && (
                      <button
                        onClick={() => handleStreamAction(streamId, 'restart')}
                        disabled={isActionLoading === 'restart'}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>{isActionLoading === 'restart' ? 'Restarting...' : 'Restart'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Diagnostics Panel */}
                {isShowingDiagnostics && streamDiagnostics && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Diagnostics</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Stream Stats</h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Size:</span>
                            <span className="font-mono">{stream.stats.size}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Speed:</span>
                            <span className="font-mono">{stream.stats.speed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Time:</span>
                            <span className="font-mono">{stream.stats.time}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">FFmpeg Info</h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Version:</span>
                            <span className="font-mono">{streamDiagnostics.ffmpegInfo?.version || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Path:</span>
                            <span className="font-mono text-xs">{streamDiagnostics.ffmpegInfo?.path || 'Unknown'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h5 className="font-medium text-gray-700 mb-2">Network Connectivity</h5>
                      <div className="flex items-center space-x-2">
                        {streamDiagnostics.networkConnectivity?.success ? (
                          <>
                            <Wifi className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">Network connectivity OK</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-red-600">Network connectivity issues</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Streams;
