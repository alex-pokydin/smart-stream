export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your Smart Stream system preferences</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">Settings Panel</h3>
            <p className="mt-2 text-gray-600">
              Settings interface is under development. This will include:
            </p>
            <ul className="mt-4 text-sm text-gray-500 space-y-1">
              <li>• System configuration</li>
              <li>• Streaming quality settings</li>
              <li>• Network configuration</li>
              <li>• Security settings</li>
              <li>• Backup and restore</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
