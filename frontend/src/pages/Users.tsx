import { useEffect, useState } from 'react';
import api from '../utils/api';
import { 
  ShieldCheck, 
  Key, 
  UserPlus, 
  Trash2, 
  Search, 
  ShieldAlert, 
  Loader2, 
  UserCheck, 
  X,
  Check,
  Building,
  MapPin,
  Download,
  UploadCloud,
  AlertTriangle,
  RefreshCw,
  History,
  Settings
} from 'lucide-react';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeIdCode: string | null;
  department: { name: string };
  branch: { name: string } | null;
  createdAt: string;
}

export default function Users() {
  const loggedInUserRaw = localStorage.getItem('user');
  const loggedInUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : null;
  const isSuperAdmin = loggedInUser?.email === 'superadmin@gmail.com';

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'backup' | 'settings'>('users');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Form States for Creating User
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'EMPLOYEE'>('ADMIN');
  const [departmentId, setDepartmentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [employeeIdCode, setEmployeeIdCode] = useState('');

  // Form State for Password Reset
  const [newPassword, setNewPassword] = useState('');

  // Backup & Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Auto Backup states
  const [autoBackups, setAutoBackups] = useState<{ filename: string; size: number; createdAt: string }[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // System Settings states
  const [companyName, setCompanyName] = useState('AMS SYSTEM');
  const [companyLogo, setCompanyLogo] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data.company_name) {
        setCompanyName(res.data.company_name);
      }
      if (res.data.company_logo) {
        setCompanyLogo(res.data.company_logo);
      }
    } catch (err: any) {
      console.error('Failed to fetch system settings', err);
    }
  };

  const fetchUsersData = async () => {
    try {
      setLoading(true);
      setError('');
      const [empRes, deptRes] = await Promise.all([
        api.get('/employees'),
        api.get('/departments')
      ]);
      setUsers(empRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load system users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
    fetchSettings();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('សូមបំពេញព័ត៌មានដែលចាំបាច់ (ឈ្មោះ, អុីម៉ែល, និងលេខកូដសម្ងាត់)');
      return;
    }
    setError('');

    const payload = {
      name,
      email,
      role,
      departmentId: departmentId || null,
      branchId: branchId || null,
      employeeIdCode: employeeIdCode.trim() || null,
      password
    };

    try {
      await api.post('/employees', payload);
      setSuccessMsg('គណនីអ្នកប្រើប្រាស់ត្រូវបានបង្កើតឡើងដោយជោគជ័យ!');
      setTimeout(() => setSuccessMsg(''), 3000);
      closeAddModal();
      fetchUsersData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user account.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;

    try {
      setError('');
      await api.put(`/employees/${selectedUser.id}`, {
        password: newPassword
      });
      setSuccessMsg(`លេខកូដសម្ងាត់សម្រាប់ ${selectedUser.name} ត្រូវបានផ្លាស់ប្តូរជោគជ័យ!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      closeResetModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password.');
    }
  };



  const handleDeleteUser = async (user: UserAccount) => {
    const loggedInUserRaw = localStorage.getItem('user');
    const loggedInUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : null;
    if (loggedInUser && loggedInUser.email === user.email) {
      alert('អ្នកមិនអាចលុបគណនីដែលកំពុង Login ប្រើប្រាស់សព្វថ្ងៃបានទេ!');
      return;
    }

    if (!confirm(`តើអ្នកប្រាកដជាចង់លុបគណនីរបស់ ${user.name} ចេញពីប្រព័ន្ធទាំងស្រុងដែរឬទេ? សកម្មភាពនេះមិនអាចសង្គ្រោះវិញបានឡើយ!`)) return;

    try {
      setError('');
      await api.delete(`/employees/${user.id}`);
      setSuccessMsg('បានលុបគណនីអ្នកប្រើប្រាស់ជោគជ័យ!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchUsersData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setBackingUp(true);
      setError('');
      const response = await api.get('/admin/backup', { responseType: 'blob' });
      
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ams_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg('បានចម្លងទិន្នន័យទុកដោយជោគជ័យ! / Backup downloaded successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAutoBackups();
    } catch (err: any) {
      setError('ការចម្លងទិន្នន័យមិនបានសម្រេច៖ ' + (err.response?.data?.error || err.message));
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;

    if (!confirm('⚠️ ប្រុងប្រយ័ត្ន៖ ការស្តារទិន្នន័យនឹងលុបទិន្នន័យបច្ចុប្បន្នទាំងអស់! តើអ្នកប្រាកដជាចង់បន្ត?')) {
      return;
    }

    try {
      setRestoring(true);
      setError('');
      
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          await api.post('/admin/restore', json);
          setSuccessMsg('បានស្តារទិន្នន័យឡើងវិញដោយជោគជ័យ! / Database restored successfully.');
          setRestoreFile(null);
          setTimeout(() => setSuccessMsg(''), 4000);
          fetchUsersData();
        } catch (err: any) {
          setError('ឯកសារ Backup មិនត្រឹមត្រូវ ឬមានបញ្ហា៖ ' + (err.response?.data?.error || err.message));
        } finally {
          setRestoring(false);
        }
      };
      fileReader.readAsText(restoreFile);
    } catch (err: any) {
      setError('មិនអាចអានឯកសារនេះបានទេ៖ ' + err.message);
      setRestoring(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError('រូបឡូហ្គោត្រូវតែតូចជាង 1MB / Logo must be smaller than 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setCompanyLogo(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      await api.post('/settings', {
        company_name: companyName,
        company_logo: companyLogo
      });
      setSuccessMsg('រក្សាទុកការកំណត់បានជោគជ័យ / Settings saved successfully');
      localStorage.setItem('company_name', companyName);
      localStorage.setItem('company_logo', companyLogo);
      window.dispatchEvent(new Event('settings_updated'));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoBackups = async () => {
    if (!isSuperAdmin) return;
    try {
      setLoadingBackups(true);
      const res = await api.get('/admin/backups/list');
      setAutoBackups(res.data);
    } catch (err: any) {
      console.error('Failed to fetch auto backups list:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchAutoBackups();
    }
  }, [activeTab]);

  const handleDownloadAutoBackup = async (filename: string) => {
    try {
      const response = await api.get(`/admin/backups/download/${filename}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('ការទាញយកមិនបានសម្រេច៖ ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRestoreAutoBackup = async (filename: string) => {
    if (!confirm(`⚠️ ប្រុងប្រយ័ត្ន៖ ការស្តារទិន្នន័យពីឯកសារ "${filename}" នឹងលុបទិន្នន័យបច្ចុប្បន្នទាំងអស់! តើអ្នកប្រាកដជាចង់បន្ត?`)) {
      return;
    }

    try {
      setRestoring(true);
      setError('');
      await api.post(`/admin/backups/restore/${filename}`);
      setSuccessMsg('បានស្តារទិន្នន័យឡើងវិញដោយជោគជ័យ! / Database restored successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchUsersData();
      fetchAutoBackups();
    } catch (err: any) {
      setError('ការស្តារទិន្នន័យមិនបានសម្រេច៖ ' + (err.response?.data?.error || err.message));
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteAutoBackup = async (filename: string) => {
    if (!confirm(`តើអ្នកប្រាកដជាចង់លុបឯកសារចម្លង "${filename}" នេះចេញពី Server ដែរឬទេ?`)) {
      return;
    }

    try {
      setError('');
      await api.delete(`/admin/backups/delete/${filename}`);
      setSuccessMsg('បានលុបឯកសារចម្លងដោយជោគជ័យ!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAutoBackups();
    } catch (err: any) {
      setError('មិនអាចលុបឯកសារនេះបានទេ៖ ' + (err.response?.data?.error || err.message));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const closeAddModal = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('ADMIN');
    setDepartmentId('');
    setBranchId('');
    setEmployeeIdCode('');
    setIsAddModalOpen(false);
  };

  const closeResetModal = () => {
    setNewPassword('');
    setSelectedUser(null);
    setIsResetModalOpen(false);
  };

  // Filter accounts
  const filteredUsers = users.filter((u) => {
    if (u.role !== 'ADMIN') return false;

    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.employeeIdCode && u.employeeIdCode.toLowerCase().includes(term));

    return matchesSearch;
  });

  if (loading && users.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-slate-500 text-xs font-semibold">កំពុងផ្ទុកបញ្ជីអ្នកប្រើប្រាស់... / Loading Users...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">គ្រប់គ្រងគណនី និងប្រព័ន្ធ / Credentials & System</h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">Manage logins, passwords, privileges and database backups</p>
        </div>
        {activeTab === 'users' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer self-start sm:self-auto"
          >
            <UserPlus size={16} />
            <span>បង្កើតអ្នកប្រើប្រាស់ថ្មី / Create User Login</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-semibold rounded-xl">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl animate-bounce">
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold transition-all relative cursor-pointer uppercase tracking-wider ${
            activeTab === 'users' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>គ្រប់គ្រងគណនី / User Accounts</span>
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer uppercase tracking-wider ${
              activeTab === 'backup' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span>ចម្លង និងស្តារទិន្នន័យ / Backup & Restore</span>
            {activeTab === 'backup' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        )}
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 text-xs font-bold transition-all relative cursor-pointer uppercase tracking-wider ${
            activeTab === 'settings' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>ការកំណត់ប្រព័ន្ធ / System Settings</span>
          {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
      </div>

      {/* Render Tab 1: User Accounts List */}
      {activeTab === 'users' && (
        <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
          {/* Filter controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-500" />
              <span>គណនីដែលទទួលបានសិទ្ធិចូលប្រព័ន្ធ / Access Logins</span>
            </h3>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative flex-1 md:flex-none md:w-64">
                <input
                  type="text"
                  placeholder="ស្វែងរកតាម ឈ្មោះ, អុីម៉ែល..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl py-2 px-3 pl-9 text-xs text-slate-850 font-semibold"
                />
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">អ្នកប្រើប្រាស់ / System User</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">ការិយាល័យ និង សាខា / Dept & Branch</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">សិទ្ធិប្រព័ន្ធ / Privilege</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">កាលបរិច្ឆេទបង្កើត / Created At</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs text-right">សកម្មភាព / Security Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-semibold">
                      មិនមានគណនីអ្នកប្រើប្រាស់ទេ / No user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      
                      {/* Col 1: Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-850 text-xs">{user.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Dept & Branch */}
                      <td className="py-3 px-4 text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-slate-700 font-semibold">
                            <Building size={12} className="text-slate-400" />
                            {user.department.name}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                            <MapPin size={11} className="text-slate-400" />
                            {user.branch ? user.branch.name : 'General Office'}
                          </span>
                        </div>
                      </td>

                      {/* Col 3: Role Badge */}
                      <td className="py-3 px-4">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 w-max">
                          <UserCheck size={10} />
                          {user.role}
                        </span>
                      </td>

                      {/* Col 4: Date */}
                      <td className="py-3 px-4 text-slate-500 text-xs font-semibold">
                        {new Date(user.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}
                      </td>

                      {/* Col 5: Security Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {/* Change Password */}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setIsResetModalOpen(true);
                            }}
                            className="flex items-center gap-1 py-1.5 px-3 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                            title="ប្តូរលេខកូដសម្ងាត់"
                          >
                            <Key size={11} />
                            <span>Reset Password</span>
                          </button>

                          {/* Delete User Login */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all cursor-pointer"
                            title="លុបគណនី"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Render Tab 2: Backup & Restore Panel */}
      {activeTab === 'backup' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Download Backup */}
            <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
                  <Download size={24} />
                </div>
                <h3 className="font-extrabold text-slate-800 text-lg">ចម្លងទិន្នន័យប្រព័ន្ធទុក / Backup Database</h3>
                <p className="text-slate-550 text-xs mt-2 leading-relaxed font-semibold">
                  ទាញយកទិន្នន័យទាំងអស់ពីប្រព័ន្ធ (ការិយាល័យ, បុគ្គលិក, កាលវិភាគការងារ, សាខា, និងប្រវត្តិនៃការស្កែនវត្តមានទាំងអស់) យកមករក្សាទុកក្នុងកុំព្យូទ័ររបស់អ្នកក្នុងទម្រង់ជាឯកសារ JSON សុវត្ថិភាព។
                </p>
                <div className="mt-4 p-3.5 bg-blue-50/50 rounded-xl text-[11px] text-blue-700 border border-blue-100/50 leading-relaxed font-medium">
                  💡 <strong>ណែនាំ៖</strong> លោកអ្នកគួរតែចម្លងទិន្នន័យទុកជាប្រចាំ ឬមុនពេលធ្វើការផ្លាស់ប្តូរទិន្នន័យធំៗ ដើម្បីការពារការបាត់បង់ទិន្នន័យជាយថាហេតុ។
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={handleDownloadBackup}
                  disabled={backingUp}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  {backingUp ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>កំពុងទាញយក... / Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>ទាញយកឯកសារចម្លងទិន្នន័យ / Download Backup File</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card 2: Restore Backup */}
            <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100">
                  <UploadCloud size={24} />
                </div>
                <h3 className="font-extrabold text-slate-800 text-lg">ស្តារទិន្នន័យឡើងវិញ / Restore Database</h3>
                <p className="text-slate-555 text-xs mt-2 leading-relaxed font-semibold">
                  ជ្រើសរើសឯកសារ Backup (.json) ដែលបានទាញទុកពីមុន ដើម្បីស្តារទិន្នន័យប្រព័ន្ធឡើងវិញ។
                </p>

                <div className="mt-4 p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-700">
                  <AlertTriangle size={24} className="shrink-0 text-rose-600" />
                  <div className="text-[10px] leading-relaxed font-semibold">
                    <strong className="text-rose-800 uppercase block mb-1">🔴 ការព្រមានដ៏សំខាន់ (Critical Warning):</strong>
                    ការស្តារទិន្នន័យនេះ នឹងលុបទិន្នន័យចាស់ដែលមានទាំងអស់ក្នុងប្រព័ន្ធបច្ចុប្បន្នចោលភ្លាមៗ ហើយជំនួសមកវិញនូវទិន្នន័យពីឯកសារ Backup។ សកម្មភាពនេះមិនអាចត្រឡប់ថយក្រោយវិញបានឡើយ!
                  </div>
                </div>

                {/* File Input */}
                <div className="mt-4">
                  <label className="block text-slate-600 font-bold text-xs mb-1">ជ្រើសរើសឯកសារ Backup (.json) / Select File</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setRestoreFile(e.target.files[0]);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:outline-none rounded-xl p-2 text-xs font-semibold cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={handleRestoreBackup}
                  disabled={restoring || !restoreFile}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  {restoring ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>កំពុងស្តារទិន្នន័យ... / Restoring...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>ស្តារទិន្នន័យឥឡូវនេះ / Start Database Restore</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Table: Auto Backup History */}
          <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2 mb-2">
              <History size={18} className="text-blue-500 animate-pulse" />
              <span>ប្រវត្តិនៃការចម្លងទិន្នន័យស្វ័យប្រវត្តិ / Auto-Backup History</span>
            </h3>
            <p className="text-slate-500 text-xs mb-4 font-semibold">
              ឯកសារខាងក្រោមត្រូវបានប្រព័ន្ធចម្លងទុកដោយស្វ័យប្រវត្តិនៅលើ Server ជារៀងរាល់ថ្ងៃនៅម៉ោង <strong>១៨:០០ យប់ (6:00 PM)</strong>។
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-4 text-slate-600 font-bold text-xs">កាលបរិច្ឆេទ / Date & Time</th>
                    <th className="py-3 px-4 text-slate-600 font-bold text-xs">ឈ្មោះឯកសារ / Filename</th>
                    <th className="py-3 px-4 text-slate-600 font-bold text-xs">ទំហំ / Size</th>
                    <th className="py-3 px-4 text-slate-600 font-bold text-xs text-right">សកម្មភាព / Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBackups ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-400 font-semibold">
                        កំពុងទាញយកបញ្ជីឯកសារ... / Loading backups...
                      </td>
                    </tr>
                  ) : autoBackups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-400 font-semibold">
                        មិនទាន់មានឯកសារចម្លងស្វ័យប្រវត្តិនៅឡើយទេ / No auto-backups available yet.
                      </td>
                    </tr>
                  ) : (
                    autoBackups.map((bk) => (
                      <tr key={bk.filename} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-700 text-xs font-bold">
                          {new Date(bk.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                          {bk.filename}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold text-xs">
                          {formatFileSize(bk.size)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* Download */}
                            <button
                              onClick={() => handleDownloadAutoBackup(bk.filename)}
                              title="Download to PC"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600 transition-colors cursor-pointer border border-slate-100 hover:border-slate-200"
                            >
                              <Download size={14} />
                            </button>
                            {/* Restore */}
                            <button
                              onClick={() => handleRestoreAutoBackup(bk.filename)}
                              title="Restore Database from this file"
                              disabled={restoring}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-amber-600 transition-colors cursor-pointer border border-slate-100 hover:border-slate-200 disabled:opacity-50"
                            >
                              <UploadCloud size={14} />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteAutoBackup(bk.filename)}
                              title="Delete from Server"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-rose-600 transition-colors cursor-pointer border border-slate-100 hover:border-slate-200"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Render Tab 3: System Settings Panel */}
      {activeTab === 'settings' && (
        <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
            <Settings size={18} className="text-blue-500" />
            <span>ការកំណត់ប្រព័ន្ធទូទៅ / General System Settings</span>
          </h3>

          <form onSubmit={handleSaveSettings} className="max-w-xl flex flex-col gap-6">
            {/* Company Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-650 font-bold text-xs">ឈ្មោះក្រុមហ៊ុន/ប្រព័ន្ធ / Company Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-3 text-xs text-slate-800 font-semibold"
                placeholder="e.g. AMS SYSTEM"
              />
            </div>

            {/* Logo Upload */}
            <div className="flex flex-col gap-2.5">
              <label className="text-slate-650 font-bold text-xs">រូបសញ្ញាក្រុមហ៊ុន (ឡូហ្គោ) / Company Logo</label>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-slate-200 bg-slate-50/50 rounded-xl">
                {/* Logo Preview */}
                <div className="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                  {companyLogo ? (
                    <>
                      <img src={companyLogo} alt="Logo Preview" className="w-full h-full object-contain p-1.5" />
                      <button
                        type="button"
                        onClick={() => setCompanyLogo('')}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <UploadCloud size={28} className="text-slate-400" />
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex flex-col gap-1.5 w-full">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={handleLogoUpload}
                    id="logo-file-input"
                    className="hidden"
                  />
                  <label
                    htmlFor="logo-file-input"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm self-start"
                  >
                    <UploadCloud size={14} />
                    <span>Upload Logo Image</span>
                  </label>
                  <p className="text-[10px] text-slate-455 font-medium leading-relaxed">
                    គាំទ្រទម្រង់ PNG, JPG ឬ SVG (ទំហំអតិបរមា 1MB)។ រូបភាពគួរតែជាការ៉េ ឬសមាមាត្រស្អាត។ / Supports PNG, JPG, or SVG (max 1MB). Recommended square aspect ratio.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-slate-100 pt-5 flex items-center justify-end gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 transition-all cursor-pointer"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                <span>រក្សាទុកការកំណត់ / Save Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 1: Create User Account */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <UserPlus size={18} className="text-blue-500" />
                <span>បង្កើតអ្នកប្រើប្រាស់ថ្មី / Create Access Account</span>
              </h3>
              <button
                onClick={closeAddModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-bold text-xs">ឈ្មោះពេញ / Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sok San"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-bold text-xs">សិទ្ធិប្រព័ន្ធ / System Privilege</label>
                <div className="bg-purple-50 text-purple-700 border border-purple-200 rounded-xl p-2.5 text-xs font-bold flex items-center gap-2">
                  <ShieldCheck size={14} />
                  <span>ADMIN (គ្រប់គ្រងប្រព័ន្ធ / System Admin)</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-bold text-xs">អុីម៉ែល (ប្រើជា Username សម្រាប់ Login) *</label>
                <input
                  type="email"
                  required
                  placeholder="user@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-bold text-xs">លេខកូដសម្ងាត់ / Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-bold text-xs">ការិយាល័យ / Department *</label>
                <select
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="">-- select --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="font-bold py-2 px-4 border border-slate-200 bg-slate-100 text-slate-700 rounded-xl text-xs hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="font-bold py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reset Password */}
      {isResetModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Key size={16} className="text-amber-500 animate-pulse" />
                <span>Reset User Password</span>
              </h3>
              <button
                onClick={closeResetModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 flex flex-col gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 text-xs font-semibold leading-relaxed">
                កំពុងផ្លាស់ប្តូរលេខសម្ងាត់សម្រាប់៖ <br />
                <strong className="text-slate-800 font-bold">{selectedUser.name}</strong> ({selectedUser.email})
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-bold text-xs">លេខកូដសម្ងាត់ថ្មី / New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="វាយលេខកូដសម្ងាត់ថ្មី..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-2 pt-2">
                <button
                  type="button"
                  onClick={closeResetModal}
                  className="font-bold py-2 px-4 border border-slate-200 bg-slate-100 text-slate-700 rounded-xl text-xs hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="font-bold py-2 px-5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
