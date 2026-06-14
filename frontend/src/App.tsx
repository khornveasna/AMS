import React from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Calendar, 
  FileSpreadsheet, 
  QrCode, 
  Smartphone, 
  LogOut, 
  Menu, 
  X, 
  UserCircle,
  MapPin
} from 'lucide-react';

// Import Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Employees from './pages/Employees';
import Schedules from './pages/Schedules';
import Reports from './pages/Reports';
import QrDisplay from './pages/QrDisplay';
import ScanHub from './pages/ScanHub';
import Branches from './pages/Branches';

const queryClient = new QueryClient();

// Protected Route Guard
function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');

  if (!token || !userRaw) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userRaw);
  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/scan-hub" replace />;
  }

  return <>{children}</>;
}

// Main App Layout Shell
function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFullscreen = searchParams.get('fullscreen') === 'true';
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : { name: 'Guest', role: 'EMPLOYEE', department: 'None' };
  const isAdmin = user.role === 'ADMIN';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    ...(isAdmin ? [
      { path: '/dashboard', label: 'ផ្ទាំងគ្រប់គ្រង / Dashboard', icon: LayoutDashboard, adminOnly: true },
      { path: '/departments', label: 'ការិយាល័យ / Departments', icon: Building2, adminOnly: true },
      { path: '/employees', label: 'បុគ្គលិក / Employees', icon: Users, adminOnly: true },
      { path: '/schedules', label: 'ពេលវេលា / Timetable', icon: Calendar, adminOnly: true },
      { path: '/reports', label: 'របាយការណ៍ / Exceptions Reports', icon: FileSpreadsheet, adminOnly: true },
      { path: '/qr-display', label: 'អេក្រង់ QR / Company QR Screen', icon: QrCode, adminOnly: true },
      { path: '/branches', label: 'សាខា / Branches & QR', icon: MapPin, adminOnly: true },
    ] : []),
    { path: '/scan-hub', label: 'ស្កែនវត្តមាន / Mobile Scan Hub', icon: Smartphone, adminOnly: false },
  ];

  if (isFullscreen) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden w-screen">
        <main className="flex-1 overflow-auto bg-slate-50 p-6 h-full w-full">
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute requireAdmin><Departments /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute requireAdmin><Employees /></ProtectedRoute>} />
            <Route path="/schedules" element={<ProtectedRoute requireAdmin><Schedules /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
            <Route path="/qr-display" element={<ProtectedRoute requireAdmin><QrDisplay /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute requireAdmin><Branches /></ProtectedRoute>} />
            <Route path="/scan-hub" element={<ProtectedRoute><ScanHub /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={isAdmin ? "/dashboard" : "/scan-hub"} replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 md:translate-x-0 md:static ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Users size={20} />
            </div>
            <span className="font-extrabold text-white text-lg tracking-wider">AMS SYSTEM</span>
          </div>
          <button className="text-slate-400 md:hidden hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3 mb-3">
            <UserCircle size={36} className="text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500 font-semibold truncate uppercase">
                {user.role} • {user.department}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-rose-950 hover:text-rose-200 border border-slate-700/50 text-slate-300 rounded-xl text-xs font-bold transition-all"
          >
            <LogOut size={14} />
            <span>ចាកចេញ / Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button className="text-slate-600 md:hidden hover:text-slate-900" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-800 md:block hidden">
              {navItems.find(item => item.path === location.pathname)?.label.split(' / ')[0] || 'ទំព័រដើម'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs font-bold text-blue-600 uppercase">
              {user.role}
            </div>
            <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
              {user.department}
            </div>
          </div>
        </header>

        {/* Page Main Content Container */}
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute requireAdmin><Departments /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute requireAdmin><Employees /></ProtectedRoute>} />
            <Route path="/schedules" element={<ProtectedRoute requireAdmin><Schedules /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
            <Route path="/qr-display" element={<ProtectedRoute requireAdmin><QrDisplay /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute requireAdmin><Branches /></ProtectedRoute>} />
            <Route path="/scan-hub" element={<ProtectedRoute><ScanHub /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={isAdmin ? "/dashboard" : "/scan-hub"} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
