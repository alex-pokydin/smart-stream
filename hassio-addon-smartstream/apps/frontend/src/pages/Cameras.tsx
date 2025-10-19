import { useState, useEffect } from 'react';
import { 
  Camera, 
  Search, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Edit3,
  TestTube,
  Save,
  X,
  Youtube,
  Radio,
  Activity,
  Video,
  VideoOff
} from 'lucide-react';
import { cameraService, streamService } from '@/services/api';
import { 
  CameraConfig, 
  CameraDiscoveryResult, 
  AddCameraRequest, 
  UpdateCameraRequest 
} from '@smart-stream/shared';
import toast from 'react-hot-toast';
import CameraPreview from '@/components/CameraPreview';

interface AddCameraFormData {
  hostname: string;
  port: number;
  username: string;
  password: string;
  autostart: boolean;
  youtubeStreamKey: string;
  twitchStreamKey: string;
  defaultPlatform: 'youtube' | 'twitch' | 'custom' | '';
}

interface EditCameraFormData extends Partial<AddCameraFormData> {
  hostname: string;
}

export default function Cameras() {
  const [cameras, setCameras] = useState<Record<string, CameraConfig>>({});
  const [discoveredCameras, setDiscoveredCameras] = useState<CameraDiscoveryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [testingConnections, setTestingConnections] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCamera, setEditingCamera] = useState<string | null>(null);
  const [discoveryDuration, setDiscoveryDuration] = useState<number | null>(null);
  const [previewingCameras, setPreviewingCameras] = useState<Set<string>>(new Set());

  const [addForm, setAddForm] = useState<AddCameraFormData>({
    hostname: '',
    port: 80,
    username: 'admin',
    password: '',
    autostart: false,
    youtubeStreamKey: '',
    twitchStreamKey: '',
    defaultPlatform: ''
  });

  const [editForm, setEditForm] = useState<EditCameraFormData>({
    hostname: '',
    port: undefined,
    username: '',
    password: '',
    autostart: undefined,
    youtubeStreamKey: '',
    twitchStreamKey: '',
    defaultPlatform: ''
  });

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setLoading(true);
      const camerasData = await cameraService.getCameras();
      setCameras(camerasData);
    } catch (error) {
      toast.error('Failed to load cameras');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const discoverCameras = async () => {
    try {
      setDiscovering(true);
      setDiscoveredCameras([]);
      setDiscoveryDuration(null);
      
      const result = await cameraService.discoverCameras();
      setDiscoveredCameras(result.cameras);
      setDiscoveryDuration(result.duration);
      
      toast.success(`Discovered ${result.cameras.length} cameras in ${result.duration}ms`);
    } catch (error) {
      toast.error('Camera discovery failed');
      console.error(error);
    } finally {
      setDiscovering(false);
    }
  };

  const testCameraConnection = async (hostname: string) => {
    try {
      setTestingConnections(prev => new Set(prev).add(hostname));
      const result = await cameraService.testCamera(hostname);
      
      if (result.connected) {
        toast.success(`Camera ${hostname} is connected`);
      } else {
        toast.error(`Camera ${hostname} connection failed`);
      }
      
      return result.connected;
    } catch (error) {
      toast.error(`Connection test failed for ${hostname}`);
      console.error(error);
      return false;
    } finally {
      setTestingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(hostname);
        return newSet;
      });
    }
  };

  const addCamera = async (formData: AddCameraFormData) => {
    try {
      const cameraData: AddCameraRequest = {
        hostname: formData.hostname,
        port: formData.port,
        username: formData.username,
        password: formData.password,
        autostart: formData.autostart,
        youtubeStreamKey: formData.youtubeStreamKey || undefined,
        twitchStreamKey: formData.twitchStreamKey || undefined,
        defaultPlatform: formData.defaultPlatform || undefined
      };

      await cameraService.addCamera(cameraData);
      toast.success(`Camera ${formData.hostname} added successfully`);
      
      setShowAddForm(false);
      setAddForm({
        hostname: '',
        port: 80,
        username: 'admin',
        password: '',
        autostart: false,
        youtubeStreamKey: '',
        twitchStreamKey: '',
        defaultPlatform: ''
      });
      
      await loadCameras();
    } catch (error) {
      toast.error('Failed to add camera');
      console.error(error);
    }
  };

  const updateCamera = async (hostname: string, updates: UpdateCameraRequest) => {
    try {
      console.log('Frontend sending update request:', { hostname, updates });
      await cameraService.updateCamera(hostname, updates);
      toast.success(`Camera ${hostname} updated successfully`);
      
      setEditingCamera(null);
      setEditForm({
        hostname: '',
        port: undefined,
        username: '',
        password: '',
        autostart: undefined,
        youtubeStreamKey: '',
        twitchStreamKey: '',
        defaultPlatform: ''
      });
      
      await loadCameras();
    } catch (error) {
      toast.error('Failed to update camera');
      console.error(error);
    }
  };

  const deleteCamera = async (hostname: string) => {
    if (!confirm(`Are you sure you want to delete camera ${hostname}?`)) {
      return;
    }

    try {
      await cameraService.deleteCamera(hostname);
      toast.success(`Camera ${hostname} deleted successfully`);
      await loadCameras();
    } catch (error) {
      toast.error('Failed to delete camera');
      console.error(error);
    }
  };

  const toggleAutostart = async (hostname: string) => {
    try {
      await cameraService.toggleAutostart(hostname);
      toast.success(`Camera ${hostname} autostart toggled`);
      await loadCameras();
    } catch (error) {
      toast.error('Failed to toggle autostart');
      console.error(error);
    }
  };

  const addDiscoveredCamera = (discoveredCamera: CameraDiscoveryResult) => {
    setAddForm({
      hostname: discoveredCamera.hostname,
      port: discoveredCamera.port,
      username: discoveredCamera.username || 'admin',
      password: discoveredCamera.password || '',
      autostart: false,
      youtubeStreamKey: '',
      twitchStreamKey: '',
      defaultPlatform: ''
    });
    setShowAddForm(true);
  };

  const startEdit = (camera: CameraConfig) => {
    console.log('Starting edit for camera:', camera);
    setEditForm({
      hostname: camera.hostname,
      port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
      username: camera.username,
      password: '', // Don't pre-fill password for security
      autostart: camera.autostart,
      youtubeStreamKey: camera.youtubeStreamKey || '',
      twitchStreamKey: camera.twitchStreamKey || '',
      defaultPlatform: camera.defaultPlatform || ''
    });
    setEditingCamera(camera.hostname);
  };

  const cancelEdit = () => {
    setEditingCamera(null);
    setEditForm({
      hostname: '',
      port: undefined,
      username: '',
      password: '',
      autostart: undefined,
      youtubeStreamKey: '',
      twitchStreamKey: '',
      defaultPlatform: ''
    });
  };

  const startYouTubeStream = async (camera: CameraConfig) => {
    if (!camera.youtubeStreamKey) {
      toast.error('YouTube stream key not configured for this camera');
      return;
    }

    try {
      const streamStatus = await streamService.startYouTubeStream(camera.hostname, camera.youtubeStreamKey);
      toast.success(`YouTube stream started: ${streamStatus.id}`);
    } catch (error) {
      toast.error('Failed to start YouTube stream');
      console.error(error);
    }
  };

  const startTwitchStream = async (camera: CameraConfig) => {
    if (!camera.twitchStreamKey) {
      toast.error('Twitch stream key not configured for this camera');
      return;
    }

    try {
      const streamStatus = await streamService.startTwitchStream(camera.hostname, camera.twitchStreamKey);
      toast.success(`Twitch stream started: ${streamStatus.id}`);
    } catch (error) {
      toast.error('Failed to start Twitch stream');
      console.error(error);
    }
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'youtube':
        return <Youtube className="h-4 w-4 text-red-600" />;
      case 'twitch':
        return <Radio className="h-4 w-4 text-purple-600" />;
      case 'custom':
        return <Activity className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const togglePreview = (hostname: string) => {
    setPreviewingCameras(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hostname)) {
        newSet.delete(hostname);
      } else {
        newSet.add(hostname);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-8 w-8" />
        <span className="ml-2 text-gray-600">Loading cameras...</span>
      </div>
    );
  }

  const cameraList = Object.values(cameras);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cameras</h1>
        <p className="text-gray-600">Manage your ONVIF cameras and their configurations</p>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={discoverCameras}
          disabled={discovering}
          className="btn btn-primary btn-md"
        >
          {discovering ? (
            <>
              <div className="loading-spinner mr-2" />
              Discovering...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Discover Cameras
            </>
          )}
        </button>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-outline btn-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Camera Manually
        </button>
      </div>

      {/* Discovery Results */}
      {discoveredCameras.length > 0 && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Discovered Cameras
              </h3>
              <span className="badge badge-primary">
                {discoveredCameras.length} found
                {discoveryDuration && ` in ${discoveryDuration}ms`}
              </span>
            </div>
            
            <div className="space-y-3">
              {discoveredCameras.map((camera) => (
                <div 
                  key={`${camera.hostname}:${camera.port}`}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Camera className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {camera.hostname}:{camera.port}
                      </div>
                      <div className="text-sm text-gray-500">
                        {camera.username ? `User: ${camera.username}` : 'Authentication required'}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => addDiscoveredCamera(camera)}
                    className="btn btn-sm btn-primary"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Camera Form */}
      {showAddForm && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Camera</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="btn btn-ghost btn-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                addCamera(addForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Hostname/IP Address</label>
                  <input
                    type="text"
                    value={addForm.hostname}
                    onChange={(e) => setAddForm(prev => ({ ...prev, hostname: e.target.value }))}
                    className="form-input"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input
                    type="number"
                    value={addForm.port}
                    onChange={(e) => setAddForm(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    className="form-input"
                    min="1"
                    max="65535"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    value={addForm.username}
                    onChange={(e) => setAddForm(prev => ({ ...prev, username: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Default Platform</label>
                <select
                  value={addForm.defaultPlatform}
                  onChange={(e) => setAddForm(prev => ({ ...prev, defaultPlatform: e.target.value as any }))}
                  className="form-input"
                >
                  <option value="">Select platform (optional)</option>
                  <option value="youtube">YouTube Live</option>
                  <option value="twitch">Twitch</option>
                  <option value="custom">Custom RTMP</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">YouTube Stream Key</label>
                  <input
                    type="password"
                    value={addForm.youtubeStreamKey}
                    onChange={(e) => setAddForm(prev => ({ ...prev, youtubeStreamKey: e.target.value }))}
                    className="form-input"
                    placeholder="Optional - for YouTube Live streaming"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Twitch Stream Key</label>
                  <input
                    type="password"
                    value={addForm.twitchStreamKey}
                    onChange={(e) => setAddForm(prev => ({ ...prev, twitchStreamKey: e.target.value }))}
                    className="form-input"
                    placeholder="Optional - for Twitch streaming"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={addForm.autostart}
                    onChange={(e) => setAddForm(prev => ({ ...prev, autostart: e.target.checked }))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable autostart
                  </span>
                </label>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-outline btn-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Add Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cameras List */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Configured Cameras
            </h3>
            <span className="badge badge-gray">
              {cameraList.length} camera{cameraList.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {cameraList.length === 0 ? (
            <div className="text-center py-12">
              <Camera className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No cameras configured</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by discovering cameras on your network or adding them manually.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cameraList.map((camera) => (
                <div
                  key={camera.hostname}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  {editingCamera === camera.hostname ? (
                    // Edit Form
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        console.log('Form submit - camera:', camera);
                        console.log('Form submit - editForm:', editForm);
                        
                        const updates: UpdateCameraRequest = {
                          hostname: camera.hostname
                        };
                        
                        const currentPort = typeof camera.port === 'string' ? parseInt(camera.port) : camera.port;
                        if (editForm.port !== undefined && editForm.port !== currentPort) {
                          console.log('Port change detected:', { editFormPort: editForm.port, cameraPort: camera.port, currentPort });
                          updates.port = editForm.port;
                        }
                        if (editForm.username && editForm.username.trim() !== '' && editForm.username !== camera.username) {
                          console.log('Username change detected:', { editFormUsername: editForm.username, cameraUsername: camera.username });
                          updates.username = editForm.username;
                        }
                        if (editForm.password && editForm.password.trim() !== '') {
                          console.log('Password change detected:', { hasPassword: true });
                          updates.password = editForm.password;
                        }
                        if (editForm.autostart !== undefined && editForm.autostart !== camera.autostart) {
                          updates.autostart = editForm.autostart;
                        }
                        if (editForm.youtubeStreamKey !== undefined && editForm.youtubeStreamKey !== camera.youtubeStreamKey) {
                          updates.youtubeStreamKey = editForm.youtubeStreamKey || undefined;
                        }
                        if (editForm.twitchStreamKey !== undefined && editForm.twitchStreamKey !== camera.twitchStreamKey) {
                          updates.twitchStreamKey = editForm.twitchStreamKey || undefined;
                        }
                        if (editForm.defaultPlatform !== undefined && editForm.defaultPlatform !== camera.defaultPlatform) {
                          updates.defaultPlatform = editForm.defaultPlatform || undefined;
                        }
                        
                        updateCamera(camera.hostname, updates);
                      }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="form-group">
                          <label className="form-label">Port</label>
                          <input
                            type="number"
                            value={editForm.port || ''}
                            onChange={(e) => setEditForm(prev => ({ 
                              ...prev, 
                              port: parseInt(e.target.value) || undefined 
                            }))}
                            className="form-input"
                            min="1"
                            max="65535"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Username</label>
                          <input
                            type="text"
                            value={editForm.username}
                            onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                            className="form-input"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">New Password</label>
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                            className="form-input"
                            placeholder="Leave empty to keep current"
                          />
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Default Platform</label>
                        <select
                          value={editForm.defaultPlatform || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, defaultPlatform: e.target.value as any }))}
                          className="form-input"
                        >
                          <option value="">Select platform (optional)</option>
                          <option value="youtube">YouTube Live</option>
                          <option value="twitch">Twitch</option>
                          <option value="custom">Custom RTMP</option>
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-group">
                          <label className="form-label">YouTube Stream Key</label>
                          <input
                            type="password"
                            value={editForm.youtubeStreamKey || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, youtubeStreamKey: e.target.value }))}
                            className="form-input"
                            placeholder="Leave empty to keep current"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Twitch Stream Key</label>
                          <input
                            type="password"
                            value={editForm.twitchStreamKey || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, twitchStreamKey: e.target.value }))}
                            className="form-input"
                            placeholder="Leave empty to keep current"
                          />
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editForm.autostart ?? false}
                            onChange={(e) => setEditForm(prev => ({ ...prev, autostart: e.target.checked }))}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Enable autostart
                          </span>
                        </label>
                      </div>
                      
                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="btn btn-outline btn-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save Changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    // Display Mode
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <Camera className="h-8 w-8 text-gray-400" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-gray-900">{camera.hostname}</h4>
                              {camera.autostart && (
                                <span className="badge badge-primary">Autostart</span>
                              )}
                              {camera.defaultPlatform && (
                                <div className="flex items-center space-x-1">
                                  {getPlatformIcon(camera.defaultPlatform)}
                                  <span className="text-xs text-gray-500 capitalize">{camera.defaultPlatform}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {camera.username}@{camera.hostname}:{camera.port}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              {camera.youtubeStreamKey && (
                                <span className="inline-flex items-center space-x-1 text-xs text-red-600">
                                  <Youtube className="h-3 w-3" />
                                  <span>YouTube</span>
                                </span>
                              )}
                              {camera.twitchStreamKey && (
                                <span className="inline-flex items-center space-x-1 text-xs text-purple-600">
                                  <Radio className="h-3 w-3" />
                                  <span>Twitch</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {/* Preview Toggle Button */}
                          <button
                            onClick={() => togglePreview(camera.hostname)}
                            className={`btn btn-ghost btn-sm ${previewingCameras.has(camera.hostname) ? 'text-primary-600' : ''}`}
                            title={previewingCameras.has(camera.hostname) ? 'Hide Preview' : 'Show Preview'}
                          >
                            {previewingCameras.has(camera.hostname) ? (
                              <VideoOff className="h-4 w-4" />
                            ) : (
                              <Video className="h-4 w-4" />
                            )}
                          </button>
                          
                          {/* Stream Action Buttons */}
                          {camera.youtubeStreamKey && (
                            <button
                              onClick={() => startYouTubeStream(camera)}
                              className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                              title="Start YouTube Stream"
                            >
                              <Youtube className="h-4 w-4" />
                            </button>
                          )}
                          
                          {camera.twitchStreamKey && (
                            <button
                              onClick={() => startTwitchStream(camera)}
                              className="btn btn-ghost btn-sm text-purple-600 hover:text-purple-700"
                              title="Start Twitch Stream"
                            >
                              <Radio className="h-4 w-4" />
                            </button>
                          )}
                          
                          {/* Management Action Buttons */}
                          <button
                            onClick={() => testCameraConnection(camera.hostname)}
                            disabled={testingConnections.has(camera.hostname)}
                            className="btn btn-ghost btn-sm"
                            title="Test Connection"
                          >
                            {testingConnections.has(camera.hostname) ? (
                              <div className="loading-spinner h-4 w-4" />
                            ) : (
                              <TestTube className="h-4 w-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => toggleAutostart(camera.hostname)}
                            className="btn btn-ghost btn-sm"
                            title="Toggle Autostart"
                          >
                            {camera.autostart ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => startEdit(camera)}
                            className="btn btn-ghost btn-sm"
                            title="Edit Camera"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => deleteCamera(camera.hostname)}
                            className="btn btn-ghost btn-sm text-error-600 hover:text-error-700"
                            title="Delete Camera"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Camera Preview */}
                      {previewingCameras.has(camera.hostname) && (
                        <div className="mt-4">
                          <CameraPreview 
                            hostname={camera.hostname}
                            refreshInterval={1000}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
