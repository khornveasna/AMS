import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Building2, Edit2, Trash2, ShieldAlert, History, ArrowRight, Loader2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  _count: {
    employees: number;
  };
}

interface MovementLog {
  id: string;
  employee: { name: string; email: string };
  fromDepartment: { name: string } | null;
  toDepartment: { name: string };
  movedAt: string;
}

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [movements, setMovements] = useState<MovementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const deptsRes = await api.get('/departments');
      setDepartments(deptsRes.data);
      const movesRes = await api.get('/movements');
      setMovements(movesRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load department data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');

    try {
      if (editId) {
        await api.put(`/departments/${editId}`, { name });
      } else {
        await api.post('/departments', { name });
      }
      setName('');
      setEditId(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save department');
    }
  };

  const startEdit = (dept: Department) => {
    setEditId(dept.id);
    setName(dept.name);
  };

  const deleteDept = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    setError('');
    try {
      await api.delete(`/departments/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete department');
    }
  };

  if (loading && departments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-slate-500 text-xs font-semibold">កំពុងទាញយកទិន្នន័យ... / Loading Departments...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">គ្រប់គ្រងការិយាល័យ / Departments Management</h1>
        <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">Configure organizational divisions and audit transfer histories</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-semibold rounded-xl">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create/Update Form */}
        <div className="col-span-1 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm h-fit">
          <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
            <Building2 size={18} className="text-blue-500" />
            <span>{editId ? 'កែប្រែព័ត៌មានការិយាល័យ / Edit Department' : 'បង្កើតការិយាល័យថ្មី / Create Department'}</span>
          </h3>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 font-bold text-xs">ឈ្មោះការិយាល័យ / Department Name</label>
              <input
                type="text"
                required
                placeholder="e.g. IT Department, HR Office"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
              />
            </div>
            <div className="flex gap-2">
              <button 
                type="submit" 
                className="font-bold flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs transition-all cursor-pointer text-center"
              >
                {editId ? 'រក្សាទុក / Update' : 'បន្ថែម / Create'}
              </button>
              {editId && (
                <button 
                  type="button"
                  onClick={() => { setEditId(null); setName(''); }}
                  className="font-bold py-2 px-4 border border-slate-200 bg-slate-100 text-slate-705 rounded-xl text-xs hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Departments Table List */}
        <div className="col-span-1 lg:col-span-2 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
            <Building2 size={18} className="text-indigo-500" />
            <span>បញ្ជីការិយាល័យសរុប / Departments List</span>
          </h3>
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Name</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Total Employees</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{dept.name}</td>
                    <td className="py-3 px-3 text-slate-650 text-xs">{dept._count.employees} employees</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          className="p-1 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          onClick={() => startEdit(dept)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="p-1 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          onClick={() => deleteDept(dept.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Movement Audit Trails Grid */}
      <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <History size={18} className="text-indigo-500" />
          <span>ប្រវត្តិប្តូរការិយាល័យបុគ្គលិក / Employee Movement History Log</span>
        </h3>

        {movements.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-semibold">
            មិនទាន់មានប្រវត្តិផ្លាស់ប្តូរការិយាល័យនៅឡើយទេ / No transfer history logged.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Employee Name</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Email</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Department Change Route</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Date Transferred</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{log.employee.name}</td>
                    <td className="py-3 px-3 text-slate-600 text-xs">{log.employee.email}</td>
                    <td className="py-3 px-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">{log.fromDepartment?.name || 'N/A'}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span className="text-blue-600 font-bold">{log.toDepartment.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-650 text-xs">
                      {new Date(log.movedAt).toLocaleString([], { hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
