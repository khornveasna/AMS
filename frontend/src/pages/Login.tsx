import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Lock, Mail, Users, ShieldAlert, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState(localStorage.getItem('company_name') || 'AMS Enterprise');
  const [companyLogo, setCompanyLogo] = useState(localStorage.getItem('company_logo') || '');

  const updateFavicon = (logoUrl: string) => {
    const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link');
    link.type = logoUrl.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = logoUrl || '/favicon.svg';
    if (!document.querySelector("link[rel*='icon']")) {
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  };

  useEffect(() => {
    const initialName = localStorage.getItem('company_name');
    if (initialName) {
      document.title = `${initialName} - Attendance Management System`;
    }
    const initialLogo = localStorage.getItem('company_logo');
    if (initialLogo) {
      updateFavicon(initialLogo);
    }
    api.get('/settings/public')
      .then(res => {
        if (res.data.company_name) {
          setCompanyName(res.data.company_name);
          localStorage.setItem('company_name', res.data.company_name);
          document.title = `${res.data.company_name} - Attendance Management System`;
        }
        if (res.data.company_logo) {
          setCompanyLogo(res.data.company_logo);
          localStorage.setItem('company_logo', res.data.company_logo);
          updateFavicon(res.data.company_logo);
        }
      })
      .catch(err => console.error('Failed to load public settings', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      if (res.data.user.role === 'ADMIN') {
        navigate('/dashboard');
      } else {
        navigate('/scan-hub');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = async (type: 'admin' | 'employee') => {
    setLoading(true);
    setError('');
    const credentials = type === 'admin' 
      ? { email: 'superadmin@gmail.com', password: 'Kvs@@15091993' }
      : { email: 'leakhena@ams.com', password: 'password123' };
    
    try {
      const res = await api.post('/auth/login', credentials);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      if (res.data.user.role === 'ADMIN') {
        navigate('/dashboard');
      } else {
        navigate('/scan-hub');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 px-4 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-emerald-600/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          {companyLogo ? (
            <div className="w-20 h-20 bg-white rounded-2xl mb-4 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden">
              <img src={companyLogo} alt="Logo" className="w-full h-full object-contain p-1.5" />
            </div>
          ) : (
            <div className="inline-flex p-3 bg-blue-650/20 text-blue-400 rounded-2xl mb-4 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Users size={32} />
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{companyName}</h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិកកម្រិតខ្ពស់</p>
        </div>

        <div className="p-8 border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl rounded-2xl">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-white mb-2">ចូលប្រើប្រាស់ប្រព័ន្ធ / Login</h2>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-semibold text-xs">អុីម៉ែល / Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  required
                  placeholder="example@ams.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-semibold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-semibold text-xs">លេខកូដសម្ងាត់ / Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {loading && <Loader2 className="animate-spin" size={14} />}
              <span>ចូលប្រព័ន្ធ / Sign In</span>
            </button>
          </form>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-slate-700/60"></div>
            <span className="flex-shrink mx-4 text-slate-450 text-[10px] font-semibold uppercase tracking-wider">Quick Test / គណនីសាកល្បង</span>
            <div className="flex-grow border-t border-slate-700/60"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => loginDemo('admin')}
              disabled={loading}
              className="py-2 border border-slate-700 bg-slate-800/40 text-blue-300 font-bold text-xs rounded-xl hover:bg-slate-800/80 transition-all disabled:opacity-50"
            >
              Admin Mock
            </button>
            <button
              type="button"
              onClick={() => loginDemo('employee')}
              disabled={loading}
              className="py-2 border border-slate-700 bg-slate-800/40 text-emerald-300 font-bold text-xs rounded-xl hover:bg-slate-800/80 transition-all disabled:opacity-50"
            >
              Employee Mock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
