import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Users, CheckCircle, ShieldAlert, Wrench, Clock, Loader2 } from 'lucide-react';

interface KPIS {
  totalEmployees: number;
  presentToday: number;
  activeShifts: number;
  activeMaintenance: number;
  verificationFailures: number;
}

interface ActivityLog {
  id: string;
  employeeName: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  distance: number;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIS | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/dashboard-reports?kpisOnly=true');
      setKpis(res.data.kpis);

      const historyRes = await api.get('/attendance/history');
      setRecentLogs(historyRes.data.slice(0, 5)); // show top 5 recent scans
    } catch (err) {
      console.error('Error fetching dashboard details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-slate-500 text-xs font-semibold">កំពុងទាញយកទិន្នន័យ / Loading Dashboard...</span>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'បុគ្គលិកសរុប / Total Employees',
      value: kpis?.totalEmployees || 0,
      icon: Users,
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    {
      title: 'វត្តមានថ្ងៃនេះ / Present Today',
      value: kpis?.presentToday || 0,
      icon: CheckCircle,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    {
      title: 'វេនការងារសកម្ម / Active Shifts',
      value: kpis?.activeShifts || 0,
      icon: Clock,
      color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    },
    {
      title: 'ការជួសជុលប្រព័ន្ធ / Maintenance Mode',
      value: kpis?.activeMaintenance ? 'ACTIVE' : 'INACTIVE',
      icon: Wrench,
      color: kpis?.activeMaintenance 
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse' 
        : 'bg-slate-500/10 text-slate-650 border-slate-500/20',
    },
    {
      title: 'ស្កែនបរាជ័យ / Scan Failures',
      value: kpis?.verificationFailures || 0,
      icon: ShieldAlert,
      color: (kpis?.verificationFailures || 0) > 0
        ? 'bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold animate-pulse'
        : 'bg-slate-500/10 text-slate-650 border-slate-500/20',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">ផ្ទាំងគ្រប់គ្រងប្រព័ន្ធ / System Overview</h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">AMS Enterprise Management Realtime Metrics</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
        >
          ធ្វើបច្ចុប្បន្នភាព / Refresh
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="border border-slate-200/80 bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-xl border ${card.color} shrink-0`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 truncate uppercase">{card.title}</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live System Status & Map Simulation Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Geofencing Info Card */}
        <div className="col-span-1 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
            <ShieldAlert size={18} className="text-blue-500" />
            <span>ព័ត៌មាន GPS Geofencing / GPS Settings</span>
          </h3>
          <div className="mt-4 flex flex-col gap-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Office Coordinates</span>
              <span className="font-bold text-slate-800">11.5564° N, 104.9282° E</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Allowed Radius Limit</span>
              <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">50 Meters</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-semibold">Verification Mode</span>
              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active GPS + QR Check</span>
            </div>
            <div className="p-3.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl mt-2 leading-relaxed font-medium">
              <strong>តម្រូវការដាច់ខាត:</strong> បុគ្គលិកត្រូវតែស្ថិតនៅក្នុងរង្វង់ 50 ម៉ែត្រជុំវិញក្រុមហ៊ុន និងស្កែន QR Code ដែលផ្លាស់ប្តូរ Token រាល់ 8 វិនាទីម្តង ទើបប្រព័ន្ធយល់ព្រមចុះវត្តមាន។
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="col-span-1 lg:col-span-2 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
            <Clock size={18} className="text-indigo-500" />
            <span>កំណត់ត្រាស្កែនថ្មីៗ / Recent Attendance Scan Logs</span>
          </h3>
          
          {recentLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
              មិនទាន់មានកំណត់ត្រាស្កែនវត្តមាននៅឡើយទេ / No logs found.
            </div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Employee</th>
                    <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Date / Time</th>
                    <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Type</th>
                    <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">GPS Distance</th>
                    <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-semibold text-slate-850 text-xs">{log.employeeName}</td>
                      <td className="py-3 px-3 text-slate-600 text-xs">
                        {new Date(log.checkIn).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: false })}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          log.checkOut ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          {log.checkOut ? 'CHECK OUT' : 'CHECK IN'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-xs">{Math.round(log.distance)} meters</td>
                      <td className="py-3 px-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          log.status === 'ON_TIME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
