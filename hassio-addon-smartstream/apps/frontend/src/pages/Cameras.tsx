export default function Cameras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cameras</h1>
        <p className="text-gray-600">Manage your ONVIF cameras and their configurations</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">Camera Management</h3>
            <p className="mt-2 text-gray-600">
              Camera management interface is under development. This will include:
            </p>
            <ul className="mt-4 text-sm text-gray-500 space-y-1">
              <li>• Add and configure ONVIF cameras</li>
              <li>• Discover cameras on your network</li>
              <li>• Test camera connections</li>
              <li>• Manage camera settings</li>
              <li>• Enable/disable autostart</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
