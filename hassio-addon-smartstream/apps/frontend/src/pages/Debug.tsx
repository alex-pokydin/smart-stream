import React, { useState, useEffect } from 'react';
import { 
  Bug,
  Trash2,
  Terminal,
  Cpu,
  HardDrive,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { streamService } from '../services/api';

const Debug: React.FC = () => {
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
  const [error, setError] = useState<string | null>(null);

  // Load debug info
  const loadDebugInfo = async () => {
    try {
      setDebugLoading(true);
      setError(null);
      const info = await streamService.getProcessDebugInfo();
      setDebugInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debug info');
    } finally {
      setDebugLoading(false);
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

  // Load on mount and set up auto-refresh
  useEffect(() => {
    loadDebugInfo();
    const interval = setInterval(loadDebugInfo, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debug & Diagnostics</h1>
          <p className="text-gray-600 mt-1">
            Monitor FFmpeg processes, system resources, and troubleshoot issues
          </p>
        </div>
        <button
          onClick={loadDebugInfo}
          disabled={debugLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${debugLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Process Debug Panel */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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

      {/* Future Features Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Bug className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Additional Debug Features</h3>
        </div>
        <p className="text-gray-600 mb-4">
          More debugging tools are planned for future releases:
        </p>
        <ul className="text-sm text-gray-500 space-y-2">
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            <span>Real-time log streaming and filtering</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            <span>Network connectivity diagnostics</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            <span>Historical resource usage graphs</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            <span>FFmpeg command builder and tester</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            <span>Export diagnostic reports</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Debug;

