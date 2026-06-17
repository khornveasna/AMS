import { useEffect, useState } from 'react';
import api from '../utils/api';
import { 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  ShieldAlert, 
  CheckCircle,
  MapPin,
  X
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  checkIn: string;
  checkOut: string | null;
  status: 'ON_TIME' | 'LATE' | 'ABSENT';
  distance: number;
  latitude: number;
  longitude: number;
  timetableId: string | null;
  branchId: string | null;
  employee: {
    name: string;
    email: string;
    department: {
      name: string;
    };
  };
}

interface EmployeeOption {
  id: string;
  name: string;
  employeeIdCode: string | null;
  departmentId: string;
  branchId: string | null;
  department: {
    name: string;
  };
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  name: string;
}

interface TimetableOption {
  id: string;
  name: string;
  onDutyTime: string;
  offDutyTime: string;
}

export default function Attendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [timetables, setTimetables] = useState<TimetableOption[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters state
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);

  // Form fields
  const [employeeId, setEmployeeId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [modalDeptId, setModalDeptId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [checkInStatus, setCheckInStatus] = useState<'NOT_SCANNED' | 'CUSTOM'>('NOT_SCANNED');
  const [checkInTime, setCheckInTime] = useState('08:00');
  const [checkOutStatus, setCheckOutStatus] = useState<'ACTIVE' | 'NOT_SCANNED' | 'CUSTOM'>('ACTIVE');
  const [checkOutTime, setCheckOutTime] = useState('17:00');
  const [status, setStatus] = useState<'ON_TIME' | 'LATE' | 'ABSENT'>('ON_TIME');
  const [branchId, setBranchId] = useState('');
  const [timetableId, setTimetableId] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [histRes, empRes, deptRes, branchRes, ttRes] = await Promise.all([
        api.get('/attendance/history'),
        api.get('/employees'),
        api.get('/departments'),
        api.get('/branches'),
        api.get('/timetables')
      ]);

      // Filter employees to only show EMPLOYEE role
      const filteredEmployees = empRes.data.filter((e: any) => e.role === 'EMPLOYEE');
      
      setRecords(histRes.data);
      setEmployees(filteredEmployees);
      setDepartments(deptRes.data);
      setBranches(branchRes.data);
      setTimetables(ttRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setEditRecord(null);
    setModalDeptId('');
    setEmployeeId('');
    setSelectedEmployeeIds([]);
    setAttendanceDate(new Date().toLocaleDateString('en-CA'));
    setCheckInStatus('NOT_SCANNED');
    setCheckInTime('08:00');
    setCheckOutStatus('ACTIVE');
    setCheckOutTime('17:00');
    setStatus('ON_TIME');
    setBranchId('');
    setTimetableId('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rec: AttendanceRecord) => {
    setEditRecord(rec);
    setEmployeeId(rec.employeeId);
    setSelectedEmployeeIds([]);
    
    // Find department ID of employee
    const emp = employees.find(e => e.id === rec.employeeId);
    if (emp) {
      setModalDeptId(emp.departmentId);
    } else {
      setModalDeptId('');
    }

    const localDate = new Date(rec.checkIn).toLocaleDateString('en-CA');
    setAttendanceDate(localDate);

    // Parse Check-In Time
    const checkInDateObj = new Date(rec.checkIn);
    const pad = (num: number) => String(num).padStart(2, '0');
    const checkInTimeStr = `${pad(checkInDateObj.getHours())}:${pad(checkInDateObj.getMinutes())}`;
    setCheckInStatus('CUSTOM');
    setCheckInTime(checkInTimeStr);

    // Parse Check-Out Time
    if (rec.checkOut) {
      const checkOutDateObj = new Date(rec.checkOut);
      const checkOutTimeStr = `${pad(checkOutDateObj.getHours())}:${pad(checkOutDateObj.getMinutes())}`;
      setCheckOutStatus('CUSTOM');
      setCheckOutTime(checkOutTimeStr);
    } else {
      setCheckOutStatus('ACTIVE');
      setCheckOutTime('17:00');
    }

    setStatus(rec.status);
    setBranchId(rec.branchId || '');
    setTimetableId(rec.timetableId || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditRecord(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord && selectedEmployeeIds.length === 0) {
      setError('សូមជ្រើសរើសបុគ្គលិកយ៉ាងហោចណាស់ម្នាក់ / Please select at least one employee');
      return;
    }
    if (editRecord && !employeeId) {
      setError('សូមជ្រើសរើសបុគ្គលិក / Please select an employee');
      return;
    }
    if (!attendanceDate || !status) {
      setError('សូមបំពេញព័ត៌មានដែលចាំបាច់ (ថ្ងៃខែ និងស្ថានភាពវត្តមាន)');
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (checkInStatus === 'CUSTOM' && !timeRegex.test(checkInTime)) {
      setError('ទម្រង់ម៉ោងចូលមិនត្រឹមត្រូវទេ ត្រូវកំណត់ជា (ម៉ោង:នាទី) ២៤ម៉ោង (ឧទាហរណ៍៖ ១៣:៣០) / Invalid Check-In time format (HH:MM)');
      return;
    }
    if (checkOutStatus === 'CUSTOM' && !timeRegex.test(checkOutTime)) {
      setError('ទម្រង់ម៉ោងចេញមិនត្រឹមត្រូវទេ ត្រូវកំណត់ជា (ម៉ោង:នាទី) ២៤ម៉ោង (ឧទាហរណ៍៖ ១៧:៣០) / Invalid Check-Out time format (HH:MM)');
      return;
    }

    const timetable = timetables.find(t => t.id === timetableId);
    const defaultOnDuty = timetable ? timetable.onDutyTime.substring(0, 5) : '08:00';
    const defaultOffDuty = timetable ? timetable.offDutyTime.substring(0, 5) : '17:00';

    let checkInISO = '';
    if (checkInStatus === 'NOT_SCANNED') {
      checkInISO = new Date(`${attendanceDate}T${defaultOnDuty}`).toISOString();
    } else {
      checkInISO = new Date(`${attendanceDate}T${checkInTime || '08:00'}`).toISOString();
    }

    let checkOutISO: string | null = null;
    if (checkOutStatus === 'NOT_SCANNED') {
      checkOutISO = new Date(`${attendanceDate}T${defaultOffDuty}`).toISOString();
    } else if (checkOutStatus === 'CUSTOM') {
      checkOutISO = new Date(`${attendanceDate}T${checkOutTime || '17:00'}`).toISOString();
    }

    try {
      setSubmitting(true);
      setError('');
      const payload: any = {
        checkIn: checkInISO,
        checkOut: checkOutISO,
        status,
        branchId: branchId || null,
        timetableId: timetableId || null
      };

      if (editRecord) {
        payload.employeeId = employeeId;
        await api.put(`/attendance/${editRecord.id}`, payload);
        setSuccessMsg('បានកែប្រែទិន្នន័យវត្តមានដោយជោគជ័យ!');
      } else {
        payload.employeeIds = selectedEmployeeIds;
        await api.post('/attendance/manual', payload);
        setSuccessMsg('បានចុះវត្តមានជូនបុគ្គលិកដោយជោគជ័យ!');
      }

      setTimeout(() => setSuccessMsg(''), 3000);
      handleCloseModal();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save attendance record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('តើអ្នកពិតជាចង់លុបប្រវត្តិចុះវត្តមាននេះមែនទេ? / Are you sure you want to delete this record?')) return;
    try {
      setError('');
      await api.delete(`/attendance/${id}`);
      setSuccessMsg('បានលុបប្រវត្តិចុះវត្តមានដោយជោគជ័យ!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete attendance record.');
    }
  };

  // Get filtered employee options based on selected department
  const filteredEmployeeOptions = employees.filter(emp => {
    if (!selectedDeptId) return true;
    return emp.departmentId === selectedDeptId;
  });

  // Get filtered employee options based on selected department for Modal
  const modalFilteredEmployees = employees.filter(emp => {
    if (!modalDeptId) return true;
    return emp.departmentId === modalDeptId;
  });

  const selectedTimetable = timetables.find(t => t.id === timetableId);
  const activeOnDutyTime = selectedTimetable ? selectedTimetable.onDutyTime.substring(0, 5) : '08:00';
  const activeOffDutyTime = selectedTimetable ? selectedTimetable.offDutyTime.substring(0, 5) : '17:00';

  // Filtered records
  const filteredRecords = records.filter(rec => {
    // 1. Department Filter
    const matchesDept = selectedDeptId ? rec.employee.department.name === departments.find(d => d.id === selectedDeptId)?.name : true;
    
    // 2. Employee Filter
    const matchesEmployee = selectedEmployeeId ? rec.employeeId === selectedEmployeeId : true;
    
    // 3. Date From / Date To Filter (using YYYY-MM-DD local comparison)
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const localCheckInDate = new Date(rec.checkIn).toLocaleDateString('en-CA'); // en-CA returns YYYY-MM-DD
      if (dateFrom) {
        matchesDate = matchesDate && localCheckInDate >= dateFrom;
      }
      if (dateTo) {
        matchesDate = matchesDate && localCheckInDate <= dateTo;
      }
    }

    return matchesDept && matchesEmployee && matchesDate;
  });

  if (loading && records.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-slate-500 text-xs font-semibold">កំពុងទាញយកប្រវត្តិចុះវត្តមាន... / Loading Attendance Logs...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">គ្រប់គ្រងវត្តមានបុគ្គលិក / Attendance Management</h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">Audit, correct, or manually record check-in/out logs</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 py-3 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer self-start sm:self-center"
        >
          <Plus size={16} />
          <span>ចុះវត្តមានដោយដៃ / Manual Attendance</span>
        </button>
      </div>

      {/* Alert Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-semibold rounded-xl">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-xs font-semibold rounded-xl">
          <CheckCircle size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Panel */}
      <div className="border border-slate-200 bg-white rounded-2xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Department Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-600 font-bold text-xs">ការិយាល័យ / Department</label>
            <select
              value={selectedDeptId}
              onChange={(e) => {
                setSelectedDeptId(e.target.value);
                setSelectedEmployeeId('');
              }}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
            >
              <option value="">-- បង្ហាញទាំងអស់ --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Employee Dropdown Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-600 font-bold text-xs">ជ្រើសរើសបុគ្គលិក / Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
            >
              <option value="">-- បង្ហាញទាំងអស់ --</option>
              {filteredEmployeeOptions.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-600 font-bold text-xs">ចាប់ពីថ្ងៃ / Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-800 font-semibold"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-600 font-bold text-xs">រហូតដល់ថ្ងៃ / Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-800 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2 mb-4">
          <Clock size={18} className="text-indigo-500" />
          <span>ប្រវត្តិនៃការចុះវត្តមានសរុប / Attendance Scan History</span>
        </h3>

        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold">
            មិនមានប្រវត្តិចុះវត្តមានសម្រាប់លក្ខខណ្ឌនេះទេ / No attendance records found matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/70">
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">បុគ្គលិក / Employee</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">ការិយាល័យ / Department</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">ម៉ោងចូល / Check-In Time</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">ម៉ោងចេញ / Check-Out Time</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">ទីតាំង និងចម្ងាយ / Location</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs">ស្ថានភាព / Status</th>
                  <th className="py-3 px-4 text-slate-600 font-bold text-xs text-right">សកម្មភាព / Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 text-xs">{rec.employee.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{rec.employee.email}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-650 text-xs">
                      {rec.employee.department.name}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold text-xs">
                      {new Date(rec.checkIn).toLocaleString([], { hour12: false })}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold text-xs">
                      {rec.checkOut ? new Date(rec.checkOut).toLocaleString([], { hour12: false }) : (
                        <span className="text-slate-400 text-[10px] font-bold">មិនទាន់ស្កែនចេញ / Active</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-slate-400" />
                        <span>{rec.distance === 0 ? 'Office Scan (0m)' : `${Math.round(rec.distance)} meters`}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        rec.status === 'ON_TIME' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        rec.status === 'LATE' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {rec.status === 'ON_TIME' ? 'ទាន់ពេល / On Time' :
                         rec.status === 'LATE' ? 'មកយឺត / Late' :
                         'អវត្តមាន / Absent'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          onClick={() => handleOpenEditModal(rec)}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          onClick={() => handleDelete(rec.id)}
                          title="Delete"
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
        )}
      </div>

      {/* Modal: Create/Edit Attendance Record */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`relative w-full ${editRecord ? 'max-w-lg' : 'max-w-4xl'} bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Clock size={18} className="text-blue-500" />
                <span>{editRecord ? 'កែប្រែប្រវត្តិចុះវត្តមាន / Edit Attendance Record' : 'ចុះវត្តមានដោយដៃ (ជាក្រុម) / Create Bulk Manual Attendance'}</span>
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
              {!editRecord ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left Column: Department dropdown & Employees checkboxes list */}
                  <div className="md:col-span-5 flex flex-col gap-3 border-r border-slate-100 pr-0 md:pr-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-600 font-bold text-xs">ការិយាល័យ / Department</label>
                      <select
                        value={modalDeptId}
                        onChange={(e) => {
                          setModalDeptId(e.target.value);
                          setSelectedEmployeeIds([]);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                      >
                        <option value="">-- select department --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-600 font-bold text-xs">ជ្រើសរើសបុគ្គលិក / Select Employees *</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmployeeIds(modalFilteredEmployees.map(emp => emp.id));
                            }}
                            className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                          >
                            រើសទាំងអស់ / Select All
                          </button>
                          <span className="text-slate-300 text-xs">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeIds([])}
                            className="text-[10px] text-slate-500 font-bold hover:underline cursor-pointer"
                          >
                            សម្អាត / Clear
                          </button>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl bg-slate-50 p-2.5 h-[280px] overflow-y-auto flex flex-col gap-1.5">
                        {modalFilteredEmployees.length === 0 ? (
                          <div className="text-slate-400 text-xs text-center py-8">គ្មានបុគ្គលិក / No employees</div>
                        ) : (
                          modalFilteredEmployees.map((emp) => {
                            const isChecked = selectedEmployeeIds.includes(emp.id);
                            return (
                              <label
                                key={emp.id}
                                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all border ${
                                  isChecked 
                                    ? 'bg-blue-50/50 border-blue-200 text-blue-800' 
                                    : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                                    } else {
                                      setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-semibold">{emp.name}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-1">
                        បានជ្រើសរើស៖ <span className="font-bold text-blue-600">{selectedEmployeeIds.length}</span> នាក់
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Attendance configuration */}
                  <div className="md:col-span-7 flex flex-col gap-4">
                    {/* Date of Attendance */}
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-600 font-bold text-xs">កាលបរិច្ឆេទវត្តមាន / Date of Attendance *</label>
                      <input
                        type="date"
                        required
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-800 font-semibold"
                      />
                    </div>

                    {/* Status & Timetable */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-600 font-bold text-xs">ស្ថានភាពវត្តមាន / Attendance Status *</label>
                        <select
                          required
                          value={status}
                          onChange={(e) => setStatus(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                        >
                          <option value="ON_TIME">ទាន់ពេល / ON_TIME</option>
                          <option value="LATE">មកយឺត / LATE</option>
                          <option value="ABSENT">អវត្តមាន / ABSENT</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-slate-600 font-bold text-xs">កាលវិភាគ / Timetable</label>
                        <select
                          value={timetableId}
                          onChange={(e) => setTimetableId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                        >
                          <option value="">-- none --</option>
                          {timetables.map((t) => (
                            <option key={t.id} value={t.id}>{t.name} ({t.onDutyTime.substring(0,5)}-{t.offDutyTime.substring(0,5)})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Branch */}
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-600 font-bold text-xs">សាខាបំពេញការងារ / Work Branch</label>
                      <select
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                      >
                        <option value="">-- none (General Office) --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Check-In Row */}
                    <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-slate-600 font-bold text-xs">ម៉ោងចូល / Check-In Status *</label>
                          <select
                            value={checkInStatus}
                            onChange={(e) => setCheckInStatus(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                          >
                            <option value="NOT_SCANNED">មិនបានស្កែន (ម៉ោងតាមកាលវិភាគ) / Did Not Scan</option>
                            <option value="CUSTOM">ម៉ោងកំណត់ដោយខ្លួនឯង / Custom Time</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-slate-600 font-bold text-xs">ពេលវេលា / Check-In Time (២៤ម៉ោង / 24h)</label>
                          {checkInStatus === 'NOT_SCANNED' ? (
                            <input
                              type="text"
                              disabled
                              value={activeOnDutyTime}
                              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-500 font-bold"
                            />
                          ) : (
                            <input
                              type="text"
                              required
                              placeholder="HH:MM (e.g. 13:30)"
                              value={checkInTime}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^0-9:]/g, '');
                                if (val.length === 2 && !val.includes(':') && e.target.value.length > checkInTime.length) {
                                  val += ':';
                                }
                                setCheckInTime(val.substring(0, 5));
                              }}
                              className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Check-Out Row */}
                    <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-slate-600 font-bold text-xs">ម៉ោងចេញ / Check-Out Status *</label>
                          <select
                            value={checkOutStatus}
                            onChange={(e) => setCheckOutStatus(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                          >
                            <option value="ACTIVE">មិនទាន់ស្កែនចេញ / Active (No Check-out)</option>
                            <option value="NOT_SCANNED">មិនបានស្កែន (ម៉ោងតាមកាលវិភាគ) / Did Not Scan</option>
                            <option value="CUSTOM">ម៉ោងកំណត់ដោយខ្លួនឯង / Custom Time</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-slate-600 font-bold text-xs">ពេលវេលា / Check-Out Time (២៤ម៉ោង / 24h)</label>
                          {checkOutStatus === 'ACTIVE' ? (
                            <input
                              type="text"
                              disabled
                              value="Active (No Check-out)"
                              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-400 font-bold"
                            />
                          ) : checkOutStatus === 'NOT_SCANNED' ? (
                            <input
                              type="text"
                              disabled
                              value={activeOffDutyTime}
                              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-500 font-bold"
                            />
                          ) : (
                            <input
                              type="text"
                              required
                              placeholder="HH:MM (e.g. 17:30)"
                              value={checkOutTime}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^0-9:]/g, '');
                                if (val.length === 2 && !val.includes(':') && e.target.value.length > checkOutTime.length) {
                                  val += ':';
                                }
                                setCheckOutTime(val.substring(0, 5));
                              }}
                              className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Edit Mode: Single Record Layout */
                <div className="flex flex-col gap-4">
                  {/* Date of Attendance */}
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-600 font-bold text-xs">កាលបរិច្ឆេទវត្តមាន / Date of Attendance *</label>
                    <input
                      type="date"
                      required
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-800 font-semibold"
                    />
                  </div>

                  {/* Employee Info */}
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-600 font-bold text-xs">បុគ្គលិក / Employee</label>
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold">
                      {editRecord.employee.name} ({editRecord.employee.email})
                    </div>
                  </div>

                  {/* Status & Timetable */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-600 font-bold text-xs">ស្ថានភាពវត្តមាន / Attendance Status *</label>
                      <select
                        required
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                      >
                        <option value="ON_TIME">ទាន់ពេល / ON_TIME</option>
                        <option value="LATE">មកយឺត / LATE</option>
                        <option value="ABSENT">អវត្តមាន / ABSENT</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-600 font-bold text-xs">កាលវិភាគ / Timetable</label>
                      <select
                        value={timetableId}
                        onChange={(e) => setTimetableId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                      >
                        <option value="">-- none --</option>
                        {timetables.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} ({t.onDutyTime.substring(0,5)}-{t.offDutyTime.substring(0,5)})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Branch */}
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-600 font-bold text-xs">សាខាបំពេញការងារ / Work Branch</label>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                    >
                      <option value="">-- none (General Office) --</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Check-In Row */}
                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-600 font-bold text-xs">ម៉ោងចូល / Check-In Status *</label>
                        <select
                          value={checkInStatus}
                          onChange={(e) => setCheckInStatus(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                        >
                          <option value="NOT_SCANNED">មិនបានស្កែន (ម៉ោងតាមកាលវិភាគ) / Did Not Scan</option>
                          <option value="CUSTOM">ម៉ោងកំណត់ដោយខ្លួនឯង / Custom Time</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-slate-600 font-bold text-xs">ពេលវេលា / Check-In Time (២៤ម៉ោង / 24h)</label>
                        {checkInStatus === 'NOT_SCANNED' ? (
                          <input
                            type="text"
                            disabled
                            value={activeOnDutyTime}
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-500 font-bold"
                          />
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="HH:MM (e.g. 13:30)"
                            value={checkInTime}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9:]/g, '');
                              if (val.length === 2 && !val.includes(':') && e.target.value.length > checkInTime.length) {
                                  val += ':';
                              }
                              setCheckInTime(val.substring(0, 5));
                            }}
                            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Check-Out Row */}
                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-600 font-bold text-xs">ម៉ោងចេញ / Check-Out Status *</label>
                        <select
                          value={checkOutStatus}
                          onChange={(e) => setCheckOutStatus(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                        >
                          <option value="ACTIVE">មិនទាន់ស្កែនចេញ / Active (No Check-out)</option>
                          <option value="NOT_SCANNED">មិនបានស្កែន (ម៉ោងតាមកាលវិភាគ) / Did Not Scan</option>
                          <option value="CUSTOM">ម៉ោងកំណត់ដោយខ្លួនឯង / Custom Time</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-slate-600 font-bold text-xs">ពេលវេលា / Check-Out Time (២៤ម៉ោង / 24h)</label>
                        {checkOutStatus === 'ACTIVE' ? (
                          <input
                            type="text"
                            disabled
                            value="Active (No Check-out)"
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-400 font-bold"
                          />
                        ) : checkOutStatus === 'NOT_SCANNED' ? (
                          <input
                            type="text"
                            disabled
                            value={activeOffDutyTime}
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-500 font-bold"
                          />
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="HH:MM (e.g. 17:30)"
                            value={checkOutTime}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9:]/g, '');
                              if (val.length === 2 && !val.includes(':') && e.target.value.length > checkOutTime.length) {
                                  val += ':';
                              }
                              setCheckOutTime(val.substring(0, 5));
                            }}
                            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="font-bold py-2 px-4 border border-slate-200 bg-slate-100 text-slate-700 rounded-xl text-xs hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="font-bold py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  <span>{editRecord ? 'រក្សាទុក / Save Changes' : 'បង្កើត / Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
