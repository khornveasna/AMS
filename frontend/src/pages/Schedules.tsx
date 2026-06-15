import { useEffect, useState } from 'react';
import api from '../utils/api';
import { 
  Calendar, 
  Clock, 
  Trash2, 
  Edit2, 
  Save, 
  Building2, 
  Users, 
  Loader2, 
  ShieldAlert, 
  Check, 
  X, 
  Palette
} from 'lucide-react';

interface Timetable {
  id: string;
  name: string;
  onDutyTime: string;
  offDutyTime: string;
  beginningIn: string;
  endingIn: string;
  beginningOut: string;
  endingOut: string;
  lateTime: number;
  leaveEarly: number;
  workdayCount: number;
  color: string;
  mustIn: boolean;
  mustOut: boolean;
}

interface ShiftDayTimetable {
  id: string;
  dayOfWeek: number;
  timetableId: string;
  timetable: Timetable;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriod: number;
  dayTimetables: ShiftDayTimetable[];
}

interface Employee {
  id: string;
  employeeIdCode: string | null;
  name: string;
  gender: string | null;
  jobTitle: string | null;
  departmentId: string;
  department: { name: string };
}

interface Schedule {
  id: string;
  employeeId: string;
  shiftId: string;
  date: string;
  employee: { name: string; employeeIdCode?: string | null; departmentId?: string };
  shift: Shift;
}

interface Department {
  id: string;
  name: string;
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6b7280'  // Gray
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday / អាទិត្យ' },
  { value: 1, label: 'Monday / ច័ន្ទ' },
  { value: 2, label: 'Tuesday / អង្គារ' },
  { value: 3, label: 'Wednesday / ពុធ' },
  { value: 4, label: 'Thursday / ព្រហស្បតិ៍' },
  { value: 5, label: 'Friday / សុក្រ' },
  { value: 6, label: 'Saturday / សៅរ៍' }
];

export default function Schedules() {
  const [activeTab, setActiveTab] = useState<'timetable' | 'shift' | 'schedule'>('timetable');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data list states
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Timetable Form State
  const [editingTimetableId, setEditingTimetableId] = useState<string | null>(null);
  const [ttName, setTtName] = useState('');
  const [ttOnDuty, setTtOnDuty] = useState('08:00');
  const [ttOffDuty, setTtOffDuty] = useState('12:00');
  const [ttBeginningIn, setTtBeginningIn] = useState('07:00');
  const [ttEndingIn, setTtEndingIn] = useState('09:30');
  const [ttBeginningOut, setTtBeginningOut] = useState('11:00');
  const [ttEndingOut, setTtEndingOut] = useState('13:00');
  const [ttLateTime, setTtLateTime] = useState('15');
  const [ttLeaveEarly, setTtLeaveEarly] = useState('15');
  const [ttWorkdayCount, setTtWorkdayCount] = useState('0.5');
  const [ttColor, setTtColor] = useState('#3b82f6');
  const [ttMustIn, setTtMustIn] = useState(true);
  const [ttMustOut, setTtMustOut] = useState(true);

  // Shift Form State
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [weeklyTimetables, setWeeklyTimetables] = useState<Record<number, string[]>>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  });

  // Schedule Assignment State
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [schedShiftId, setSchedShiftId] = useState('');
  const [schedStartDate, setSchedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedEndDate, setSchedEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Preview State
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string>('all');
  const [previewYear, setPreviewYear] = useState(new Date().getFullYear());
  const [previewMonth, setPreviewMonth] = useState(new Date().getMonth());

  // Edit & Bulk Operations State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [bulkSchedules, setBulkSchedules] = useState<Schedule[]>([]);
  const [newShiftId, setNewShiftId] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset page when filter inputs change
  useEffect(() => {
    setCurrentPage(1);
  }, [previewEmployeeId, selectedDeptId, previewMonth, previewYear]);

  const fetchSchedules = async (year: number, month: number, startStr?: string, endStr?: string) => {
    try {
      const pStart = new Date(year, month, 1);
      const pEnd = new Date(year, month + 1, 0);

      let minDate = pStart;
      let maxDate = pEnd;

      if (startStr) {
        const sDate = new Date(startStr);
        if (!isNaN(sDate.getTime()) && sDate < minDate) minDate = sDate;
      }
      if (endStr) {
        const eDate = new Date(endStr);
        if (!isNaN(eDate.getTime()) && eDate > maxDate) maxDate = eDate;
      }

      const startDateQuery = minDate.toISOString().split('T')[0];
      const endDateQuery = maxDate.toISOString().split('T')[0];

      const res = await api.get('/schedules', {
        params: { startDate: startDateQuery, endDate: endDateQuery }
      });
      setSchedules(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch schedules');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [ttRes, shiftRes, deptRes, empRes] = await Promise.all([
        api.get('/timetables'),
        api.get('/shifts'),
        api.get('/departments'),
        api.get('/employees')
      ]);

      setTimetables(ttRes.data);
      setShifts(shiftRes.data);
      setDepartments(deptRes.data);
      setEmployees(empRes.data);

      await fetchSchedules(previewYear, previewMonth, schedStartDate, schedEndDate);

      if (!previewEmployeeId) {
        setPreviewEmployeeId('all');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch schedules data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (timetables.length > 0) {
      fetchSchedules(previewYear, previewMonth, schedStartDate, schedEndDate);
    }
  }, [previewYear, previewMonth, schedStartDate, schedEndDate]);

  // Timetable Operations
  const handleSaveTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttName || !ttOnDuty || !ttOffDuty) return;

    try {
      const payload = {
        name: ttName,
        onDutyTime: ttOnDuty,
        offDutyTime: ttOffDuty,
        beginningIn: ttBeginningIn,
        endingIn: ttEndingIn,
        beginningOut: ttBeginningOut,
        endingOut: ttEndingOut,
        lateTime: Number(ttLateTime),
        leaveEarly: Number(ttLeaveEarly),
        workdayCount: Number(ttWorkdayCount),
        color: ttColor,
        mustIn: ttMustIn,
        mustOut: ttMustOut
      };

      if (editingTimetableId) {
        await api.put(`/timetables/${editingTimetableId}`, payload);
      } else {
        await api.post('/timetables', payload);
      }

      resetTimetableForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save timetable');
    }
  };

  const handleEditTimetable = (tt: Timetable) => {
    setEditingTimetableId(tt.id);
    setTtName(tt.name);
    setTtOnDuty(tt.onDutyTime);
    setTtOffDuty(tt.offDutyTime);
    setTtBeginningIn(tt.beginningIn);
    setTtEndingIn(tt.endingIn);
    setTtBeginningOut(tt.beginningOut);
    setTtEndingOut(tt.endingOut);
    setTtLateTime(String(tt.lateTime));
    setTtLeaveEarly(String(tt.leaveEarly));
    setTtWorkdayCount(String(tt.workdayCount));
    setTtColor(tt.color);
    setTtMustIn(tt.mustIn);
    setTtMustOut(tt.mustOut);
  };

  const handleDeleteTimetable = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timetable?')) return;
    try {
      await api.delete(`/timetables/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete timetable');
    }
  };

  const resetTimetableForm = () => {
    setEditingTimetableId(null);
    setTtName('');
    setTtOnDuty('08:00');
    setTtOffDuty('12:00');
    setTtBeginningIn('07:00');
    setTtEndingIn('09:30');
    setTtBeginningOut('11:00');
    setTtEndingOut('13:00');
    setTtLateTime('15');
    setTtLeaveEarly('15');
    setTtWorkdayCount('0.5');
    setTtColor('#3b82f6');
    setTtMustIn(true);
    setTtMustOut(true);
  };

  // Shift Operations
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName) return;

    // Build the nested dayTimetables payload
    const dayTimetablesPayload: { dayOfWeek: number; timetableId: string }[] = [];
    Object.keys(weeklyTimetables).forEach((dayStr) => {
      const day = Number(dayStr);
      weeklyTimetables[day].forEach((ttId) => {
        dayTimetablesPayload.push({ dayOfWeek: day, timetableId: ttId });
      });
    });

    try {
      const payload = {
        name: shiftName,
        dayTimetables: dayTimetablesPayload,
        // Keep fallback fields
        startTime: '08:00',
        endTime: '17:00',
        gracePeriod: 15
      };

      if (editingShiftId) {
        await api.put(`/shifts/${editingShiftId}`, payload);
      } else {
        await api.post('/shifts', payload);
      }

      resetShiftForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save shift');
    }
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShiftId(shift.id);
    setShiftName(shift.name);

    const initialWeekly: Record<number, string[]> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };
    shift.dayTimetables.forEach((dt) => {
      initialWeekly[dt.dayOfWeek] = [...(initialWeekly[dt.dayOfWeek] || []), dt.timetableId];
    });
    setWeeklyTimetables(initialWeekly);
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    try {
      await api.delete(`/shifts/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete shift');
    }
  };

  const resetShiftForm = () => {
    setEditingShiftId(null);
    setShiftName('');
    setWeeklyTimetables({
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    });
  };

  const addTimetableToDay = (day: number, ttId: string) => {
    if (!ttId) return;
    setWeeklyTimetables(prev => ({
      ...prev,
      [day]: [...prev[day], ttId]
    }));
  };

  const removeTimetableFromDay = (day: number, index: number) => {
    setWeeklyTimetables(prev => {
      const updated = [...prev[day]];
      updated.splice(index, 1);
      return {
        ...prev,
        [day]: updated
      };
    });
  };

  // Schedule Assignment Operations
  const handleAssignSchedules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployeeIds.length === 0 || !schedShiftId) {
      setError('Please select at least one employee and a shift');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Assign for each selected employee
      await Promise.all(
        selectedEmployeeIds.map((empId) =>
          api.post('/schedules', {
            employeeId: empId,
            shiftId: schedShiftId,
            startDate: schedStartDate,
            endDate: schedEndDate
          })
        )
      );

      // Auto-update calendar preview to show the scheduled employee
      if (selectedEmployeeIds.length > 0) {
        setPreviewEmployeeId(selectedEmployeeIds[0]);
        const startD = new Date(schedStartDate);
        if (!isNaN(startD.getTime())) {
          setPreviewYear(startD.getFullYear());
          setPreviewMonth(startD.getMonth());
        }
      }

      setSelectedEmployeeIds([]);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Delete this calendar schedule entry?')) return;
    try {
      await api.delete(`/schedules/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete schedule');
    }
  };

  const handleOpenEditModal = (sched: Schedule) => {
    setSelectedSchedule(sched);
    setNewShiftId(sched.shiftId);
    setIsEditModalOpen(true);
  };

  const handleOpenBulkEditModal = (scheds: Schedule[]) => {
    setBulkSchedules(scheds);
    setNewShiftId('');
    setIsBulkEditModalOpen(true);
  };

  const handleSaveSingleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule || !newShiftId) return;

    try {
      setLoading(true);
      setError('');
      const dateStr = new Date(selectedSchedule.date).toISOString().split('T')[0];
      await api.post('/schedules', {
        employeeId: selectedSchedule.employeeId,
        shiftId: newShiftId,
        date: dateStr
      });
      setIsEditModalOpen(false);
      setSelectedSchedule(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBulkEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkSchedules.length === 0 || !newShiftId) return;

    try {
      setLoading(true);
      setError('');
      const ids = bulkSchedules.map(s => s.id);
      await api.post('/schedules/bulk-update', {
        ids,
        shiftId: newShiftId
      });
      setIsBulkEditModalOpen(false);
      setBulkSchedules([]);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to bulk update schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async (scheds: Schedule[]) => {
    if (scheds.length === 0) return;
    if (!confirm(`តើអ្នកពិតជាចង់លុបកាលវិភាគទាំង ${scheds.length} នេះមែនទេ? / Are you sure you want to delete all ${scheds.length} schedule entries in this preview?`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const ids = scheds.map(s => s.id);
      await api.post('/schedules/bulk-delete', { ids });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to bulk delete schedules');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = selectedDeptId === 'all'
    ? employees
    : employees.filter(e => e.departmentId === selectedDeptId);

  const toggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map(e => e.id));
    }
  };

  // Build schedule calendar list for selected employee
  const getEmployeeCalendarData = () => {
    return schedules.filter(s => {
      const d = new Date(s.date);
      if (d.getFullYear() !== previewYear || d.getMonth() !== previewMonth) {
        return false;
      }

      if (previewEmployeeId === 'all') {
        if (selectedDeptId !== 'all' && s.employee.departmentId !== selectedDeptId) {
          return false;
        }
        return true;
      } else {
        return s.employeeId === previewEmployeeId;
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">ពេលវេលា / Timetable & Shifts</h1>
        <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">Configure work blocks, compile weekly shifts, and schedule employees</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-semibold rounded-xl animate-pulse">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => { setActiveTab('timetable'); setError(''); }}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === 'timetable' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          ១. Shift Timetable Maintenance
        </button>
        <button
          onClick={() => { setActiveTab('shift'); setError(''); }}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === 'shift' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          ២. Shift Management
        </button>
        <button
          onClick={() => { setActiveTab('schedule'); setError(''); }}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === 'schedule' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          ៣. Schedule Employee
        </button>
      </div>

      {loading && timetables.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <span className="text-slate-500 text-xs font-bold uppercase">Loading...</span>
        </div>
      ) : (
        <div className="mt-2">
          {/* TAB 1: Shift Timetable Maintenance */}
          {activeTab === 'timetable' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Timetables Grid */}
              <div className="xl:col-span-2 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                    <Clock size={18} className="text-blue-500" />
                    <span>បញ្ជីកាលវិភាគលម្អិត / Shift Timetables</span>
                  </h3>
                  <span className="text-xs font-bold bg-slate-100 px-2.5 py-1 text-slate-600 rounded-full">
                    {timetables.length} Blocks
                  </span>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="min-w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Name</th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Work Hours</th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Check-In Range</th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Check-Out Range</th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs text-center">Rules</th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs text-center">Workday</th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timetables.map((tt) => (
                        <tr key={tt.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3 text-xs font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tt.color }} />
                            <span>{tt.name}</span>
                          </td>
                          <td className="py-3 px-3 text-xs font-bold text-slate-700">
                            {tt.onDutyTime} - {tt.offDutyTime}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">
                            {tt.beginningIn} - {tt.endingIn}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">
                            {tt.beginningOut} - {tt.endingOut}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${tt.mustIn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>IN</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${tt.mustOut ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>OUT</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs font-black text-slate-800 text-center">
                            {tt.workdayCount}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => handleEditTimetable(tt)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                onClick={() => handleDeleteTimetable(tt.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Card */}
              <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm h-fit">
                <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span>{editingTimetableId ? 'កែសម្រួលពេលវេលា / Edit Timetable' : 'បង្កើតពេលវេលា / Create Timetable'}</span>
                  {editingTimetableId && (
                    <button onClick={resetTimetableForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X size={16} />
                    </button>
                  )}
                </h3>

                <form onSubmit={handleSaveTimetable} className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-605 font-bold text-xs">Timetable Name / ឈ្មោះពេលវេលា</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sat-ME, 08:30-12:30"
                      value={ttName}
                      onChange={(e) => setTtName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-600 font-bold text-xs">On Duty Time</label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm (e.g. 13:30)"
                        pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                        title="Format: HH:mm (24-hour), e.g. 13:30"
                        value={ttOnDuty}
                        onChange={(e) => setTtOnDuty(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-600 font-bold text-xs">Off Duty Time</label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm (e.g. 17:00)"
                        pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                        title="Format: HH:mm (24-hour), e.g. 17:00"
                        value={ttOffDuty}
                        onChange={(e) => setTtOffDuty(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-550 font-bold text-[11px] uppercase">Beginning Check-In</label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm (e.g. 06:00)"
                        pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                        title="Format: HH:mm (24-hour), e.g. 06:00"
                        value={ttBeginningIn}
                        onChange={(e) => setTtBeginningIn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-550 font-bold text-[11px] uppercase">Ending Check-In</label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm (e.g. 08:00)"
                        pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                        title="Format: HH:mm (24-hour), e.g. 08:00"
                        value={ttEndingIn}
                        onChange={(e) => setTtEndingIn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-550 font-bold text-[11px] uppercase">Beginning Check-Out</label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm (e.g. 11:00)"
                        pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                        title="Format: HH:mm (24-hour), e.g. 11:00"
                        value={ttBeginningOut}
                        onChange={(e) => setTtBeginningOut(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-550 font-bold text-[11px] uppercase">Ending Check-Out</label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm (e.g. 12:00)"
                        pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                        title="Format: HH:mm (24-hour), e.g. 12:00"
                        value={ttEndingOut}
                        onChange={(e) => setTtEndingOut(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-600 font-bold text-xs">Late Time Limit (Mins)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={ttLateTime}
                        onChange={(e) => setTtLateTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-600 font-bold text-xs">Leave Early Limit (Mins)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={ttLeaveEarly}
                        onChange={(e) => setTtLeaveEarly(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2 text-xs text-slate-850 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600 font-bold text-xs">Workday Weight (e.g. 0.5 or 1.0)</label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      min="0"
                      max="1.5"
                      value={ttWorkdayCount}
                      onChange={(e) => setTtWorkdayCount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-850 font-semibold"
                    />
                  </div>

                  <div className="flex items-center gap-6 border-t border-slate-100 pt-3">
                    <label className="flex items-center gap-2 text-slate-700 font-bold text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ttMustIn}
                        onChange={(e) => setTtMustIn(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span>Must Check-In</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-700 font-bold text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ttMustOut}
                        onChange={(e) => setTtMustOut(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span>Must Check-Out</span>
                    </label>
                  </div>

                  {/* Preset Colors */}
                  <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                    <span className="text-slate-600 font-bold text-xs flex items-center gap-1.5">
                      <Palette size={14} />
                      <span>Display Color / ពណ៌បង្ហាញ</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setTtColor(color)}
                          className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                            ttColor === color ? 'ring-2 ring-slate-800 scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-200 mt-2"
                  >
                    <Save size={14} />
                    <span>{editingTimetableId ? 'Update Timetable' : 'Create Timetable'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Shift Management */}
          {activeTab === 'shift' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Shifts list */}
              <div className="xl:col-span-4 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm h-fit">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                    <Calendar size={18} className="text-blue-500" />
                    <span>បញ្ជីវេនការងារ / Shifts list</span>
                  </h3>
                  <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full">{shifts.length}</span>
                </div>

                <div className="mt-4 flex flex-col gap-2.5">
                  {shifts.map((s) => (
                    <div 
                      key={s.id} 
                      onClick={() => handleEditShift(s)}
                      className={`p-4 border rounded-2xl flex flex-col gap-1 transition-all cursor-pointer ${
                        editingShiftId === s.id 
                          ? 'border-blue-500 bg-blue-50/20' 
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">{s.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteShift(s.id);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex flex-wrap gap-1">
                        {DAYS_OF_WEEK.map((day) => {
                          const blocksCount = s.dayTimetables.filter(dt => dt.dayOfWeek === day.value).length;
                          if (blocksCount === 0) return null;
                          return (
                            <span key={day.value} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {day.label.split(' / ')[0].slice(0, 3)} ({blocksCount})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {shifts.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                      No shifts found. Create one.
                    </div>
                  )}
                </div>
              </div>

              {/* Shift builder */}
              <div className="xl:col-span-8 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span>{editingShiftId ? 'កែសម្រួលវេន / Edit Shift' : 'បង្កើតវេនថ្មី / Create Shift'}</span>
                  {editingShiftId && (
                    <button onClick={resetShiftForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X size={16} />
                    </button>
                  )}
                </h3>

                <form onSubmit={handleSaveShift} className="mt-4 flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5 max-w-md">
                    <label className="text-slate-600 font-bold text-xs">Shift Name / ឈ្មោះវេនការងារ</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Normal 4-Scan Shift, Office 2-Scan Shift"
                      value={shiftName}
                      onChange={(e) => setShiftName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                    />
                  </div>

                  {/* Shift Time Period Calendar */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-700 font-black text-xs uppercase tracking-tight">Shift Time Period (Mon - Sun)</span>
                      <span className="text-[10px] text-slate-400 font-bold italic">Assign timetables to each day to build 2-scan/4-scan days</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {DAYS_OF_WEEK.map((day) => {
                        const dayTimetableIds = weeklyTimetables[day.value] || [];

                        return (
                          <div key={day.value} className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 p-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <span className="md:col-span-3 text-xs font-bold text-slate-700">{day.label}</span>
                            
                            {/* Assigned timetables */}
                            <div className="md:col-span-6 flex flex-wrap gap-1.5">
                              {dayTimetableIds.map((ttId, idx) => {
                                const tt = timetables.find(t => t.id === ttId);
                                if (!tt) return null;
                                return (
                                  <span 
                                    key={idx} 
                                    className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white flex items-center gap-1 shadow-sm"
                                    style={{ backgroundColor: tt.color }}
                                  >
                                    <span>{tt.name} ({tt.onDutyTime}-{tt.offDutyTime})</span>
                                    <button
                                      type="button"
                                      onClick={() => removeTimetableFromDay(day.value, idx)}
                                      className="text-white/80 hover:text-white hover:bg-black/10 rounded-full p-0.5 transition-colors cursor-pointer"
                                    >
                                      <X size={10} />
                                    </button>
                                  </span>
                                );
                              })}
                              {dayTimetableIds.length === 0 && (
                                <span className="text-[11px] font-semibold text-slate-400 italic">Off-duty / សម្រាក</span>
                              )}
                            </div>

                            {/* Dropdown to add a timetable */}
                            <div className="md:col-span-3 flex justify-end">
                              <select
                                onChange={(e) => {
                                  addTimetableToDay(day.value, e.target.value);
                                  e.target.value = ''; // Reset select
                                }}
                                className="bg-white border border-slate-200 hover:border-slate-350 focus:outline-none rounded-lg py-1 px-2 text-[10px] font-bold text-slate-700 cursor-pointer w-full max-w-[150px]"
                              >
                                <option value="">+ Add Time</option>
                                {timetables.map((tt) => (
                                  <option key={tt.id} value={tt.id}>
                                    {tt.name} ({tt.onDutyTime} - {tt.offDutyTime})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="submit"
                      className="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-blue-100"
                    >
                      <Save size={14} />
                      <span>{editingShiftId ? 'Update Shift' : 'Save Shift'}</span>
                    </button>
                    {editingShiftId && (
                      <button
                        type="button"
                        onClick={resetShiftForm}
                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: Schedule Employee */}
          {activeTab === 'schedule' && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Department Explorer Sidebar */}
              <div className="xl:col-span-1 border border-slate-200 bg-white rounded-2xl p-5 shadow-sm h-fit">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-500" />
                  <span>Departments</span>
                </h4>
                <div className="flex flex-col gap-1 mt-3">
                  <button
                    onClick={() => { setSelectedDeptId('all'); setSelectedEmployeeIds([]); setPreviewEmployeeId('all'); }}
                    className={`text-left text-xs font-bold p-2 rounded-xl transition-all cursor-pointer ${
                      selectedDeptId === 'all' 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All Departments
                  </button>
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => { setSelectedDeptId(dept.id); setSelectedEmployeeIds([]); setPreviewEmployeeId('all'); }}
                      className={`text-left text-xs font-bold p-2 rounded-xl transition-all cursor-pointer truncate ${
                        selectedDeptId === dept.id 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {dept.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee Selection List */}
              <div className="xl:col-span-2 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                    <Users size={18} className="text-indigo-500" />
                    <span>ជ្រើសរើសបុគ្គលិក / Employee Selection</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedEmployeeIds.length} / {filteredEmployees.length} selected
                  </span>
                </div>

                <div className="overflow-x-auto mt-4 max-h-[450px] overflow-y-auto">
                  <table className="min-w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 px-3 bg-slate-50 w-8">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded cursor-pointer"
                            checked={filteredEmployees.length > 0 && selectedEmployeeIds.length === filteredEmployees.length}
                            onChange={toggleSelectAllEmployees}
                          />
                        </th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">ID / Name</th>
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp) => {
                        const hasShiftArranged = schedules.some(s => {
                          if (s.employeeId !== emp.id) return false;
                          const sDateStr = new Date(s.date).toISOString().split('T')[0];
                          return sDateStr >= schedStartDate && sDateStr <= schedEndDate;
                        });

                        return (
                          <tr 
                            key={emp.id} 
                            onClick={() => toggleSelectEmployee(emp.id)}
                            className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer ${
                              selectedEmployeeIds.includes(emp.id) ? 'bg-blue-50/10' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded cursor-pointer"
                                checked={selectedEmployeeIds.includes(emp.id)}
                                onChange={() => {}} // Controlled by row click
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 text-xs">{emp.name}</span>
                                  {hasShiftArranged && (
                                    <span 
                                      className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full px-1.5 py-0.5 font-bold"
                                      title="ចាត់វេនរួចរាល់ / Shift Assigned"
                                    >
                                      <Check size={10} strokeWidth={3} />
                                      <span>ចាត់វេនរួច / Assigned</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-450 font-bold uppercase">{emp.employeeIdCode || 'No ID'}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-xs">
                              {emp.jobTitle || 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assignment Form & Range */}
              <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm h-fit">
                <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Calendar size={18} className="text-emerald-500" />
                  <span>ចាត់វេន / Arrange Shift</span>
                </h3>

                <form onSubmit={handleAssignSchedules} className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-605 font-bold text-xs">Select Shift / ជ្រើសរើសវេន</label>
                    <select
                      required
                      value={schedShiftId}
                      onChange={(e) => setSchedShiftId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                    >
                      <option value="">-- select shift --</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600 font-bold text-xs">Start Date / ថ្ងៃចាប់ផ្តើម</label>
                    <input
                      type="date"
                      required
                      value={schedStartDate}
                      onChange={(e) => setSchedStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600 font-bold text-xs">End Date / ថ្ងៃបញ្ចប់</label>
                    <input
                      type="date"
                      required
                      value={schedEndDate}
                      onChange={(e) => setSchedEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={selectedEmployeeIds.length === 0}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm mt-2"
                  >
                    <Check size={14} />
                    <span>Arrange Shifts ({selectedEmployeeIds.length})</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Bottom Visual Schedule Preview Grid (For TAB 3) */}
          {activeTab === 'schedule' && (
            <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm mt-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-indigo-500" />
                  <h3 className="font-extrabold text-slate-800 text-base">
                    កាលវិភាគលម្អិតរបស់បុគ្គលិក / Schedule Employee's Calendar Preview
                  </h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-600">Employee:</label>
                    <select
                      value={previewEmployeeId}
                      onChange={(e) => setPreviewEmployeeId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:outline-none rounded-xl py-1 px-3 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      <option value="all">All Employees / បុគ្គលិកទាំងអស់</option>
                      {employees
                        .filter(e => selectedDeptId === 'all' || e.departmentId === selectedDeptId)
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.employeeIdCode || 'No ID'})</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-600">Month:</label>
                    <select
                      value={previewMonth}
                      onChange={(e) => setPreviewMonth(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 focus:outline-none rounded-xl py-1 px-3 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i}>
                          {new Date(2000, i, 1).toLocaleDateString([], { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-600">Year:</label>
                    <select
                      value={previewYear}
                      onChange={(e) => setPreviewYear(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 focus:outline-none rounded-xl py-1 px-3 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      {[2025, 2026, 2027, 2028].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Bar for Bulk Edit / Delete */}
              {getEmployeeCalendarData().length > 0 && (
                <div className="flex flex-wrap justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl gap-2 mt-4">
                  <span className="text-xs text-slate-500 font-bold">
                    កាលវិភាគបង្ហាញ៖ {getEmployeeCalendarData().length} ថ្ងៃ / Showing {getEmployeeCalendarData().length} schedule entries
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenBulkEditModal(getEmployeeCalendarData())}
                      className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit2 size={13} />
                      <span>កែប្រែទាំងអស់ / Edit All</span>
                    </button>
                    <button
                      onClick={() => handleBulkDelete(getEmployeeCalendarData())}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>លុបទាំងអស់ / Delete All</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Weekly/Monthly Timeline Grid */}
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {previewEmployeeId === 'all' && (
                        <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs w-48">Employee / បុគ្គលិក</th>
                      )}
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs w-48">Date / ថ្ងៃខែឆ្នាំ</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs w-40">Assigned Shift</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs">Work Blocks (Hours)</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs text-right w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allData = getEmployeeCalendarData();
                      const paginatedData = allData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

                      if (allData.length === 0) {
                        return (
                          <tr>
                            <td colSpan={previewEmployeeId === 'all' ? 5 : 4} className="py-8 text-center text-slate-400 text-xs font-semibold">
                              No schedule calendar assignments found for this employee.
                            </td>
                          </tr>
                        );
                      }

                      return paginatedData.map((sched) => {
                        const dateObj = new Date(sched.date);
                        const dayOfWeekNum = dateObj.getDay();
                        const dayTimetablesForDay = sched.shift.dayTimetables.filter(dt => dt.dayOfWeek === dayOfWeekNum);

                        return (
                          <tr key={sched.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            {previewEmployeeId === 'all' && (
                              <td className="py-3 px-3 font-extrabold text-slate-800 text-xs">
                                {sched.employee.name} ({sched.employee.employeeIdCode || 'No ID'})
                              </td>
                            )}
                            <td className="py-3 px-3 font-semibold text-slate-800 text-xs">
                              {dateObj.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-3 px-3 text-xs">
                              <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                                {sched.shift.name}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1.5">
                                {dayTimetablesForDay.map((dt, idx) => (
                                  <span 
                                    key={idx} 
                                    className="text-[10px] font-black px-2 py-0.5 rounded text-white shadow-sm flex items-center gap-1"
                                    style={{ backgroundColor: dt.timetable.color }}
                                  >
                                    {dt.timetable.name} ({dt.timetable.onDutyTime} - {dt.timetable.offDutyTime})
                                  </span>
                                ))}
                                {dayTimetablesForDay.length === 0 && (
                                  <span className="text-[10px] font-bold text-slate-400 italic">Off-day / សម្រាក</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => handleOpenEditModal(sched)}
                                  className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                  title="កែប្រែ / Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteSchedule(sched.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                  title="លុប / Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination UI */}
              {(() => {
                const allData = getEmployeeCalendarData();
                const totalPages = Math.ceil(allData.length / pageSize);
                if (totalPages <= 1) return null;

                return (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 flex-wrap gap-2 text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>Show</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-slate-700 focus:outline-none cursor-pointer"
                      >
                        {[10, 20, 50, 100].map(size => (
                          <option key={size} value={size}>{size} entries</option>
                        ))}
                      </select>
                      <span>per page</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Single Edit Modal */}
      {isEditModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 max-w-md w-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-base">
                កែសម្រួលកាលវិភាគ / Edit Schedule
              </h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setSelectedSchedule(null); }}
                className="text-slate-400 hover:text-slate-650 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-605 flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div><span className="font-bold text-slate-800">បុគ្គលិក / Employee:</span> {selectedSchedule.employee.name}</div>
              <div><span className="font-bold text-slate-800">កាលបរិច្ឆេទ / Date:</span> {new Date(selectedSchedule.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
              <div><span className="font-bold text-slate-800">វេនចាស់ / Current Shift:</span> {selectedSchedule.shift.name}</div>
            </div>

            <form onSubmit={handleSaveSingleEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 font-bold text-xs">Select New Shift / ជ្រើសរើសវេនថ្មី</label>
                <select
                  required
                  value={newShiftId}
                  onChange={(e) => setNewShiftId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="">-- select shift --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setSelectedSchedule(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  បោះបង់ / Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  រក្សាទុក / Save Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 max-w-md w-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-base">
                កែប្រែទាំងអស់ / Bulk Edit Schedules
              </h3>
              <button 
                onClick={() => { setIsBulkEditModalOpen(false); setBulkSchedules([]); }}
                className="text-slate-400 hover:text-slate-650 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-605 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 leading-relaxed font-bold">
              This will update <span className="text-blue-600 font-extrabold">{bulkSchedules.length}</span> schedule entries currently shown in the preview to the selected shift.
            </div>

            <form onSubmit={handleSaveBulkEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 font-bold text-xs">Select New Shift / ជ្រើសរើសវេនថ្មី</label>
                <select
                  required
                  value={newShiftId}
                  onChange={(e) => setNewShiftId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="">-- select shift --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsBulkEditModalOpen(false); setBulkSchedules([]); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-655 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  បោះបង់ / Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  កែប្រែទាំងអស់ / Update All
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
