import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Users, Edit2, Trash2, ShieldAlert, Loader2, Camera, Plus, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Employee {
  id: string;
  employeeIdCode: string | null;
  photo: string | null;
  name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  gender: string | null;
  nationality: string | null;
  phone: string | null;
  jobTitle: string | null;
  dob: string | null;
  dateOfEmployment: string | null;
  departmentId: string;
  department: { name: string };
  branchId: string | null;
  branch: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'EMPLOYEE'>('EMPLOYEE');
  const [departmentId, setDepartmentId] = useState('');
  const [branchId, setBranchId] = useState('');
  
  // Expanded Fields
  const [employeeIdCode, setEmployeeIdCode] = useState('');
  const [photo, setPhoto] = useState('');
  const [gender, setGender] = useState('Male');
  const [nationality, setNationality] = useState('Khmer');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [dob, setDob] = useState('');
  const [dateOfEmployment, setDateOfEmployment] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Search, Filter & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const empRes = await api.get('/employees');
      setEmployees(empRes.data);
      const deptsRes = await api.get('/departments');
      setDepartments(deptsRes.data);
      const branchesRes = await api.get('/branches');
      setBranches(branchesRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load employees data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setError('File size too large. Please upload an image under 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || (!editId && !password) || !departmentId) {
      setError('Please fill in all required fields (Name, Email, Password, Department)');
      return;
    }
    setError('');

    const payload = {
      name,
      email,
      role,
      departmentId,
      branchId: branchId || null,
      employeeIdCode: employeeIdCode.trim() || null,
      photo: photo || null,
      gender,
      nationality: nationality.trim() || null,
      phone: phone.trim() || null,
      jobTitle: jobTitle.trim() || null,
      dob: dob || null,
      dateOfEmployment: dateOfEmployment || null,
      password: password || undefined
    };

    try {
      if (editId) {
        await api.put(`/employees/${editId}`, payload);
      } else {
        await api.post('/employees', payload);
      }
      closeAndResetForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save employee');
    }
  };

  const closeAndResetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('EMPLOYEE');
    setDepartmentId('');
    setBranchId('');
    setEmployeeIdCode('');
    setPhoto('');
    setGender('Male');
    setNationality('Khmer');
    setPhone('');
    setJobTitle('');
    setDob('');
    setDateOfEmployment('');
    setEditId(null);
    setError('');
    setIsModalOpen(false);
  };

  const startEdit = (emp: Employee) => {
    setEditId(emp.id);
    setName(emp.name);
    setEmail(emp.email);
    setRole(emp.role);
    setDepartmentId(emp.departmentId);
    setBranchId(emp.branchId || '');
    setEmployeeIdCode(emp.employeeIdCode || '');
    setPhoto(emp.photo || '');
    setGender(emp.gender || 'Male');
    setNationality(emp.nationality || 'Khmer');
    setPhone(emp.phone || '');
    setJobTitle(emp.jobTitle || '');
    setDob(emp.dob || '');
    setDateOfEmployment(emp.dateOfEmployment || '');
    setPassword(''); // optional reset
    setIsModalOpen(true);
  };

  const deleteEmp = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    setError('');
    try {
      await api.delete(`/employees/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete employee');
    }
  };

  // Directory Search and Department Filter Logic
  const filteredEmployees = employees.filter((emp) => {
    if (emp.role !== 'EMPLOYEE') return false;

    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      emp.name.toLowerCase().includes(term) ||
      (emp.employeeIdCode && emp.employeeIdCode.toLowerCase().includes(term)) ||
      (emp.phone && emp.phone.includes(term));

    const matchesDept = 
      selectedDeptFilter === 'ALL' || 
      emp.departmentId === selectedDeptFilter;

    return matchesSearch && matchesDept;
  });

  // Directory Statistics (Computed over EMPLOYEE role only)
  const employeeList = employees.filter(e => e.role === 'EMPLOYEE');
  const totalCount = employeeList.length;
  const maleCount = employeeList.filter(e => e.gender === 'Male').length;
  const femaleCount = employeeList.filter(e => e.gender === 'Female').length;

  // Pagination calculations
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading && employees.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-slate-500 text-xs font-semibold">កំពុងទាញយកទិន្នន័យ... / Loading Employees...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Header Panel with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">គ្រប់គ្រងគណនីបុគ្គលិក / Employee Accounts</h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">Manage registry, credentials and detailed employee profiles</p>
        </div>
        <button
          onClick={() => {
            closeAndResetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>ចុះឈ្មោះបុគ្គលិកថ្មី / Register Employee</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-semibold rounded-xl">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Full Width Employees Directory Table */}
      <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
        
        {/* Table Header with Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
            <Users size={18} className="text-indigo-500" />
            <span>បញ្ជីបុគ្គលិកសរុប / Employees Directory</span>
          </h3>
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="ស្វែងរកតាម ឈ្មោះ, ID, លេខទូរស័ព្ទ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl py-2 px-3 pl-9 text-xs text-slate-850 font-semibold"
            />
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-3 text-slate-600 font-bold text-xs">បុគ្គលិក / Employee</th>
                <th className="py-3 px-3 text-slate-600 font-bold text-xs">ព័ត៌មានការងារ / Job Info</th>
                <th className="py-3 px-3 text-slate-600 font-bold text-xs">ព័ត៌មានផ្ទាល់ខ្លួន / Profile</th>
                <th className="py-3 px-3 text-slate-600 font-bold text-xs">ទំនាក់ទំនង / Contact</th>
                <th className="py-3 px-3 text-slate-600 font-bold text-xs">សិទ្ធិ / Privilege</th>
                <th className="py-3 px-3 text-slate-600 font-bold text-xs text-right">សកម្មភាព / Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-semibold">
                    មិនមានទិន្នន័យស្វែងរកឡើយ / No employees found.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    
                    {/* Column 1: Avatar, Name, Email */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0">
                          {emp.photo ? (
                            <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <Users size={18} className="text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs truncate">{emp.name}</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{emp.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: ID, Title, Dept */}
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-700 text-xs">{emp.employeeIdCode || <span className="text-slate-350 font-normal">N/A</span>}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{emp.jobTitle || 'No Title'}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[9px] font-bold">
                          {emp.department.name}
                        </span>
                        {emp.branch && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-bold">
                            {emp.branch.name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 3: Gender, Nationality, DOB */}
                    <td className="py-3 px-3 text-xs text-slate-750 font-medium">
                      <p>{emp.gender || 'N/A'} • {emp.nationality || 'N/A'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        DOB: {emp.dob ? new Date(emp.dob).toLocaleDateString() : 'N/A'}
                      </p>
                    </td>

                    {/* Column 4: Phone, Employment Date */}
                    <td className="py-3 px-3 text-xs text-slate-750 font-medium">
                      <p>{emp.phone || <span className="text-slate-400">N/A</span>}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Joined: {emp.dateOfEmployment ? new Date(emp.dateOfEmployment).toLocaleDateString() : 'N/A'}
                      </p>
                    </td>

                    {/* Column 5: Role badge */}
                    <td className="py-3 px-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-extrabold text-[9px] ${
                        emp.role === 'ADMIN' 
                          ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                          : 'bg-slate-100 text-slate-655 border border-slate-200'
                      }`}>
                        {emp.role}
                      </span>
                    </td>

                    {/* Column 6: Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-all border border-transparent hover:border-slate-200 bg-white"
                          onClick={() => startEdit(emp)}
                          title="កែប្រែព័ត៌មាន"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-all border border-transparent hover:border-slate-200 bg-white"
                          onClick={() => deleteEmp(emp.id)}
                          title="លុបបុគ្គលិក"
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

        {/* Directory Footer (Left: Stats | Right: Filters & Pagination) */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-150">
          
          {/* Left Footer: Employee Gender Statistics */}
          <div className="text-xs text-slate-600 font-bold flex items-center gap-3">
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
              បុគ្គលិកសរុប៖ {totalCount} នាក់
            </span>
            <span className="px-2.5 py-1 bg-blue-50/70 text-blue-700 rounded-lg border border-blue-100">
              ប្រុស៖ {maleCount}
            </span>
            <span className="px-2.5 py-1 bg-rose-50/70 text-rose-700 rounded-lg border border-rose-100">
              ស្រី៖ {femaleCount}
            </span>
          </div>

          {/* Right Footer: Filter & Pagination panel */}
          <div className="flex flex-wrap items-center gap-3 justify-center">
            
            {/* Department Filter */}
            <select
              value={selectedDeptFilter}
              onChange={(e) => {
                setSelectedDeptFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl py-1.5 px-3 text-xs text-slate-700 font-semibold cursor-pointer"
            >
              <option value="ALL">គ្រប់ការិយាល័យ / All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Items Per Page Select */}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl py-1.5 px-3 text-xs text-slate-700 font-semibold cursor-pointer"
            >
              <option value={5}>5 នាក់/ទំព័រ (5/page)</option>
              <option value={10}>10 នាក់/ទំព័រ (10/page)</option>
              <option value={20}>20 នាក់/ទំព័រ (20/page)</option>
            </select>

            {/* Pagination controls */}
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-all cursor-pointer shadow-sm"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-slate-600 font-bold px-1.5">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-all cursor-pointer shadow-sm"
              >
                <ChevronRight size={14} />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Floating Popup Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                <span>{editId ? 'កែប្រែព័ត៌មានបុគ្គលិក / Edit Employee' : 'ចុះឈ្មោះបុគ្គលិកថ្មី / Register Employee'}</span>
              </h3>
              <button
                onClick={closeAndResetForm}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-5">
              
              {/* Photo Upload Area */}
              <div className="flex flex-col items-center gap-2 pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-bold text-xs">រូបថតបុគ្គលិក / Employee Photo</span>
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center shadow-inner">
                    {photo ? (
                      <img src={photo} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={32} className="text-slate-400" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full cursor-pointer shadow-md transition-all">
                    <Camera size={14} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="text-[10px] font-bold text-rose-600 hover:underline"
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              {/* Two-Column input field grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-slate-600 font-bold text-xs">ឈ្មោះពេញ / Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chan Leakhena"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">លេខ ID / Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-001"
                    value={employeeIdCode}
                    onChange={(e) => setEmployeeIdCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">តួនាទី / Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Developer"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-slate-600 font-bold text-xs">អុីម៉ែល / Email Address <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="leakhena@ams.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-slate-600 font-bold text-xs">
                    {editId ? 'លេខកូដសម្ងាត់ថ្មី / New Password (Optional)' : 'លេខកូដសម្ងាត់ / Password *'}
                  </label>
                  <input
                    type="password"
                    required={!editId}
                    placeholder={editId ? "Leave empty to keep current" : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">ភេទ / Gender</label>
                  <select 
                    value={gender} 
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="Male">Male / ប្រុស</option>
                    <option value="Female">Female / ស្រី</option>
                    <option value="Other">Other / ផ្សេងៗ</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">សញ្ជាតិ / Nationality</label>
                  <input
                    type="text"
                    placeholder="e.g. Khmer"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-slate-600 font-bold text-xs">លេខទូរស័ព្ទ / Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">ថ្ងៃខែឆ្នាំកំណើត / DOB</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">ថ្ងៃចូលការងារ / Employment</label>
                  <input
                    type="date"
                    value={dateOfEmployment}
                    onChange={(e) => setDateOfEmployment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">សិទ្ធិប្រព័ន្ធ / Privilege</label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 font-bold">
                    EMPLOYEE (សម្រាប់ស្កែនវត្តមានទូរស័ព្ទ)
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">ការិយាល័យ / Department <span className="text-rose-500">*</span></label>
                  <select 
                    value={departmentId} 
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="">-- select --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">សាខាបំពេញការងារ / Work Branch</label>
                  <select 
                    value={branchId} 
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="">General Office / ការិយាល័យកណ្តាល</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions panel */}
              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100 justify-end">
                <button 
                  type="button"
                  onClick={closeAndResetForm}
                  className="font-bold py-2.5 px-5 border border-slate-200 bg-slate-100 text-slate-700 rounded-xl text-xs hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel / Clear
                </button>
                <button 
                  type="submit" 
                  className="font-bold py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs transition-all cursor-pointer text-center shadow-sm"
                >
                  {editId ? 'រក្សាទុក / Update' : 'បន្ថែម / Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
