import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Camera, 
  Settings, 
  Bug,
  Activity
} from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  currentPath: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Cameras', href: '/cameras', icon: Camera },
  { name: 'Streams', href: '/streams', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Debug', href: '/debug', icon: Bug },
];

export default function Sidebar({ currentPath }: SidebarProps) {
  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200">
      <nav className="p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = currentPath === item.href;
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={clsx(
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'bg-primary-50 text-primary-700 border border-primary-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon 
                className={clsx(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-primary-600' : 'text-gray-400'
                )}
              />
              {item.name}
              {item.badge && (
                <span className="ml-auto bg-primary-100 text-primary-600 rounded-full px-2 py-0.5 text-xs font-medium">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      
      <div className="mt-8 p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 space-y-1">
          <div>Version 1.0.0</div>
          <div>© 2023 Smart Stream</div>
        </div>
      </div>
    </div>
  );
}
