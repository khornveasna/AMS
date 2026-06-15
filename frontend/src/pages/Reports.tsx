import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Download, ShieldAlert, Loader2, AlertTriangle, Clock, UserX, TrendingUp, X } from 'lucide-react';

interface ClockException {
  id: string;
  employeeName: string;
  departmentName: string;
  checkIn: string;
  type: string;
}

interface ShiftException {
  id: string;
  employeeIdCode?: string;
  employeeName: string;
  departmentName: string;
  date: string;
  timetable: string;
  onDuty: string;
  offDuty: string;
  clockIn: string;
  clockOut: string;
  late: string;
  early: string;
  absent: string;
  workTime: string;
  type: string;
  details: string;
}

interface MiscException {
  id: string;
  employeeName: string;
  departmentName: string;
  date: string;
  type: string;
  details: string;
  gps: string;
}


interface CalculatedItem {
  employeeId: string;
  name: string;
  department: string;
  totalScheduled: number;
  present: number;
  onTime: number;
  late: number;
  absent: number;
  hoursWorked: number;
  overtime: number;
}

interface OTReport {
  id: string;
  employeeName: string;
  departmentName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  shiftEnd: string;
  otHours: number;
  details: string;
}

interface NoShiftAtt {
  id: string;
  employeeName: string;
  departmentName: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  distance: number;
}

type TabType = 'clock-ex' | 'shift-ex' | 'misc-ex' | 'calc-items' | 'ot-reports' | 'no-shift';

interface EmployeeSelectInfo {
  id: string;
  name: string;
  departmentId: string;
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabType>('shift-ex');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Reports states
  const [clockExceptions, setClockExceptions] = useState<ClockException[]>([]);
  const [shiftExceptions, setShiftExceptions] = useState<ShiftException[]>([]);
  const [miscExceptions, setMiscExceptions] = useState<MiscException[]>([]);
  const [calculatedItems, setCalculatedItems] = useState<CalculatedItem[]>([]);
  const [otReports, setOtReports] = useState<OTReport[]>([]);
  const [noShiftAtts, setNoShiftAtts] = useState<NoShiftAtt[]>([]);

  // Filter states
  const [departments, setDepartments] = useState<Array<{id:string; name:string}>>([]);
  const [employees, setEmployees] = useState<EmployeeSelectInfo[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset page when filter inputs change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedDeptId, selectedEmployeeId, dateFrom, dateTo, searchTerm]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError('');
      const [reportsRes, deptRes, empRes] = await Promise.all([
        api.get('/attendance/dashboard-reports'),
        api.get('/departments'),
        api.get('/employees'),
      ]);
      const { reports } = reportsRes.data;
      setClockExceptions(reports.clockExceptions);
      setShiftExceptions(reports.shiftExceptions);
      setMiscExceptions(reports.miscExceptions);
      setCalculatedItems(reports.calculatedItems);
      setOtReports(reports.otReports);
      setNoShiftAtts(reports.noShiftAtts);

      setDepartments(deptRes.data);
      setEmployees(empRes.data);
    } catch (err: any) {
      setError('Failed to fetch reports. Ensure the backend is connected.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Reset employee selection if department changes
  const handleDepartmentChange = (deptId: string) => {
    setSelectedDeptId(deptId);
    setSelectedEmployeeId('all');
  };

  const handleClearFilters = () => {
    setSelectedDeptId('all');
    setSelectedEmployeeId('all');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
  };

  // Helper to filter clock exceptions
  const getFilteredClockExceptions = () => {
    return clockExceptions.filter(ex => {
      const targetDeptName = departments.find(d => d.id === selectedDeptId)?.name;
      if (selectedDeptId !== 'all' && (!ex.departmentName || ex.departmentName.trim().toLowerCase() !== targetDeptName?.trim().toLowerCase())) return false;

      const targetEmpName = employees.find(e => e.id === selectedEmployeeId)?.name;
      if (selectedEmployeeId !== 'all' && (!ex.employeeName || ex.employeeName.trim().toLowerCase() !== targetEmpName?.trim().toLowerCase())) return false;

      const exDateStr = (ex.checkIn || '').substring(0, 10);
      if (dateFrom && exDateStr < dateFrom) return false;
      if (dateTo && exDateStr > dateTo) return false;

      if (searchTerm && !(ex.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  };

  // Helper to filter shift exceptions
  const getFilteredShiftExceptions = () => {
    return shiftExceptions.filter(ex => {
      const targetDeptName = departments.find(d => d.id === selectedDeptId)?.name;
      if (selectedDeptId !== 'all' && (!ex.departmentName || ex.departmentName.trim().toLowerCase() !== targetDeptName?.trim().toLowerCase())) return false;

      const targetEmpName = employees.find(e => e.id === selectedEmployeeId)?.name;
      if (selectedEmployeeId !== 'all' && (!ex.employeeName || ex.employeeName.trim().toLowerCase() !== targetEmpName?.trim().toLowerCase())) return false;

      const exDateStr = (ex.date || '').substring(0, 10);
      if (dateFrom && exDateStr < dateFrom) return false;
      if (dateTo && exDateStr > dateTo) return false;

      if (searchTerm && !(ex.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  };

  // Helper to filter misc exceptions
  const getFilteredMiscExceptions = () => {
    return miscExceptions.filter(ex => {
      // Resolve department name dynamically from employees list since backend doesn't return it
      const emp = employees.find(e => e.name === ex.employeeName);
      const empDeptName = emp ? departments.find(d => d.id === emp.departmentId)?.name : undefined;

      const targetDeptName = departments.find(d => d.id === selectedDeptId)?.name;
      if (selectedDeptId !== 'all' && (!empDeptName || empDeptName.trim().toLowerCase() !== targetDeptName?.trim().toLowerCase())) return false;

      const targetEmpName = employees.find(e => e.id === selectedEmployeeId)?.name;
      if (selectedEmployeeId !== 'all' && (!ex.employeeName || ex.employeeName.trim().toLowerCase() !== targetEmpName?.trim().toLowerCase())) return false;

      const exDateStr = (ex.date || '').substring(0, 10);
      if (dateFrom && exDateStr < dateFrom) return false;
      if (dateTo && exDateStr > dateTo) return false;

      if (searchTerm && !(ex.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  };

  // Helper to filter calculated items
  const getFilteredCalculatedItems = () => {
    return calculatedItems.filter(item => {
      const targetDeptName = departments.find(d => d.id === selectedDeptId)?.name;
      if (selectedDeptId !== 'all' && (!item.department || item.department.trim().toLowerCase() !== targetDeptName?.trim().toLowerCase())) return false;

      const targetEmpName = employees.find(e => e.id === selectedEmployeeId)?.name;
      if (selectedEmployeeId !== 'all' && (!item.name || item.name.trim().toLowerCase() !== targetEmpName?.trim().toLowerCase())) return false;

      if (searchTerm && !(item.name || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  };

  // Helper to filter OT reports
  const getFilteredOtReports = () => {
    return otReports.filter(ot => {
      const targetDeptName = departments.find(d => d.id === selectedDeptId)?.name;
      if (selectedDeptId !== 'all' && (!ot.departmentName || ot.departmentName.trim().toLowerCase() !== targetDeptName?.trim().toLowerCase())) return false;

      const targetEmpName = employees.find(e => e.id === selectedEmployeeId)?.name;
      if (selectedEmployeeId !== 'all' && (!ot.employeeName || ot.employeeName.trim().toLowerCase() !== targetEmpName?.trim().toLowerCase())) return false;

      const exDateStr = (ot.date || ot.checkIn || '').substring(0, 10);
      if (dateFrom && exDateStr < dateFrom) return false;
      if (dateTo && exDateStr > dateTo) return false;

      if (searchTerm && !(ot.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  };

  // Helper to filter no shift atts
  const getFilteredNoShiftAtts = () => {
    return noShiftAtts.filter(log => {
      const targetDeptName = departments.find(d => d.id === selectedDeptId)?.name;
      if (selectedDeptId !== 'all' && (!log.departmentName || log.departmentName.trim().toLowerCase() !== targetDeptName?.trim().toLowerCase())) return false;

      const targetEmpName = employees.find(e => e.id === selectedEmployeeId)?.name;
      if (selectedEmployeeId !== 'all' && (!log.employeeName || log.employeeName.trim().toLowerCase() !== targetEmpName?.trim().toLowerCase())) return false;

      const exDateStr = (log.date || log.checkIn || '').substring(0, 10);
      if (dateFrom && exDateStr < dateFrom) return false;
      if (dateTo && exDateStr > dateTo) return false;

      if (searchTerm && !(log.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  };

  const handleExport = (reportName: string) => {
    alert(`[Simulated Export] Downloading "${reportName}" as Excel spreadsheet (.xlsx)...`);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-slate-500 text-xs font-semibold">កំពុងរៀបចំរបាយការណ៍... / Loading Reports...</span>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; khmerLabel: string }[] = [
    { id: 'shift-ex', label: 'Shift Exception', khmerLabel: 'ខុសវេនការងារ' },
    { id: 'clock-ex', label: 'Clock In/Out Exceptions', khmerLabel: 'អត់ស្កែនចេញ' },
    { id: 'misc-ex', label: 'Misc Exception', khmerLabel: 'បញ្ហា GPS/Token' },
    { id: 'calc-items', label: 'Calculated Items', khmerLabel: 'របាយការណ៍បូកសរុប' },
    { id: 'ot-reports', label: 'OT Reports', khmerLabel: 'របាយការណ៍ថែមម៉ោង' },
    { id: 'no-shift', label: 'No Shift User Att', khmerLabel: 'វត្តមានក្រៅកាលវិភាគ' },
  ];

  const filteredClockExceptions = getFilteredClockExceptions();
  const filteredShiftExceptions = getFilteredShiftExceptions();
  const filteredMiscExceptions = getFilteredMiscExceptions();
  const filteredCalculatedItems = getFilteredCalculatedItems();
  const filteredOtReports = getFilteredOtReports();
  const filteredNoShiftAtts = getFilteredNoShiftAtts();

  const paginatedClockExceptions = filteredClockExceptions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedShiftExceptions = filteredShiftExceptions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedMiscExceptions = filteredMiscExceptions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedCalculatedItems = filteredCalculatedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedOtReports = filteredOtReports.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedNoShiftAtts = filteredNoShiftAtts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderPagination = (totalItems: number) => {
    const totalPages = Math.ceil(totalItems / pageSize);
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
  };

  // Dynamic calculations based on filtered datasets
  const totalAnomalies = filteredClockExceptions.length + filteredShiftExceptions.length + filteredMiscExceptions.length;
  const totalLate = filteredShiftExceptions.filter(ex => ex.type === 'LATE').length;
  const totalAbsent = filteredShiftExceptions.filter(ex => ex.type === 'ABSENT').length;
  const totalOTHours = filteredOtReports.reduce((sum, ot) => sum + ot.otHours, 0);

  // Filter employees options based on selected department
  const filteredEmployeesForSelect = selectedDeptId === 'all'
    ? employees
    : employees.filter(e => e.departmentId === selectedDeptId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">របាយការណ៍មិនប្រក្រតី / Exception Reports</h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">គណនាការអនុលោមតាមកាលវិភាគ ពិនិត្យបញ្ហា GPS និងការថែមម៉ោងរបស់បុគ្គលិក / Audit schedules compliance, GPS mock failures and overtime</p>
        </div>
        <button 
          onClick={fetchReports}
          className="px-4 py-2 bg-blue-50 border border-blue-200 text-xs font-bold text-blue-600 rounded-xl hover:bg-blue-100 transition-all cursor-pointer shadow-sm self-start sm:self-auto"
        >
          ធ្វើបច្ចុប្បន្នភាព / Refresh Reports
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-semibold rounded-xl">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Dynamic Statistics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Anomalies */}
        <div className="bg-rose-50/50 border border-rose-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">ករណីមិនប្រក្រតីសរុប / Total Anomalies</span>
            <span className="text-2xl font-black text-rose-700 mt-1">{totalAnomalies} <span className="text-xs font-normal text-rose-500">ដង (Times)</span></span>
          </div>
          <div className="p-3 bg-rose-100/80 text-rose-600 rounded-xl">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Card 2: Total Late */}
        <div className="bg-amber-50/50 border border-amber-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">មកយឺតសរុប / Total Late</span>
            <span className="text-2xl font-black text-amber-700 mt-1">{totalLate} <span className="text-xs font-normal text-amber-500">ដង (Times)</span></span>
          </div>
          <div className="p-3 bg-amber-100/80 text-amber-600 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        {/* Card 3: Total Absent */}
        <div className="bg-orange-50/50 border border-orange-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">អវត្តមានសរុប / Total Absences</span>
            <span className="text-2xl font-black text-orange-700 mt-1">{totalAbsent} <span className="text-xs font-normal text-orange-500">ថ្ងៃ (Days)</span></span>
          </div>
          <div className="p-3 bg-orange-100/80 text-orange-600 rounded-xl">
            <UserX size={20} />
          </div>
        </div>

        {/* Card 4: Total OT Hours */}
        <div className="bg-indigo-50/50 border border-indigo-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">ម៉ោងថែមសរុប / Total Overtime</span>
            <span className="text-2xl font-black text-indigo-700 mt-1">+{totalOTHours} <span className="text-xs font-normal text-indigo-500">ម៉ោង (Hours)</span></span>
          </div>
          <div className="p-3 bg-indigo-100/80 text-indigo-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
        {/* Department Select */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[180px]">
          <span className="text-xs font-bold text-slate-600">ការិយាល័យ ឬផ្នែក / Department</span>
          <select
            value={selectedDeptId}
            onChange={e => handleDepartmentChange(e.target.value)}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold cursor-pointer shadow-sm transition-all"
          >
            <option value="all">ទាំងអស់ / All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Employee Select */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[180px]">
          <span className="text-xs font-bold text-slate-600">ជ្រើសរើសបុគ្គលិក / Employee</span>
          <select
            value={selectedEmployeeId}
            onChange={e => setSelectedEmployeeId(e.target.value)}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold cursor-pointer shadow-sm transition-all"
          >
            <option value="all">បុគ្គលិកទាំងអស់ / All Employees</option>
            {filteredEmployeesForSelect.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[140px]">
          <span className="text-xs font-bold text-slate-600">ចាប់ពីថ្ងៃ / From Date</span>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={e => setDateFrom(e.target.value)} 
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl py-1.5 px-3 text-xs text-slate-700 font-semibold cursor-pointer shadow-sm transition-all"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[140px]">
          <span className="text-xs font-bold text-slate-600">ដល់ថ្ងៃ / To Date</span>
          <input 
            type="date" 
            value={dateTo} 
            onChange={e => setDateTo(e.target.value)} 
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl py-1.5 px-3 text-xs text-slate-700 font-semibold cursor-pointer shadow-sm transition-all"
          />
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-grow max-w-xs">
          <span className="text-xs font-bold text-slate-600">ស្វែងរកឈ្មោះ / Search Name</span>
          <input 
            type="text" 
            placeholder="បញ្ចូលឈ្មោះបុគ្គលិក..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold shadow-sm transition-all"
          />
        </div>

        {/* Clear filters */}
        <button
          onClick={handleClearFilters}
          className="px-3.5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto self-stretch sm:self-auto"
          title="Clear all filters"
        >
          <X size={14} />
          <span>សម្អាតតម្រង / Clear</span>
        </button>
      </div>

      {/* Main Reports Hub Tabs */}
      <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
        {/* Tabs switcher header */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-4 scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-455 hover:text-slate-600'
              }`}
            >
              <span className="mr-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                {tab.khmerLabel}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab contents */}
        <div className="mt-4">
          
          {/* TAB 1: Clock In/Out Log Exceptions */}
          {activeTab === 'clock-ex' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500 font-bold">Logs missing checkout timestamps (past days)</span>
                <button 
                  onClick={() => handleExport('Clock In-Out Exceptions')}
                  className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Export Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Employee</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Department</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Check In Time</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Anomaly Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClockExceptions.map((ex) => (
                      <tr key={ex.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{ex.employeeName}</td>
                        <td className="py-3 px-3 text-slate-655 text-xs">{ex.departmentName}</td>
                        <td className="py-3 px-3 text-slate-655 text-xs">{new Date(ex.checkIn).toLocaleString([], { hour12: false })}</td>
                        <td className="py-3 px-3 text-xs">
                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-full text-[9px] uppercase">
                            {ex.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredClockExceptions.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-400 font-bold text-xs" colSpan={4}>
                          No missing clock out anomalies recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredClockExceptions.length)}
            </div>
          )}

          {/* TAB 2: Shift Exception */}
          {activeTab === 'shift-ex' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500 font-bold">Scheduled shifts marked as ABSENT or LATE</span>
                <button 
                  onClick={() => handleExport('Shift Exceptions')}
                  className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Export Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">អត្តលេខ / ID</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ឈ្មោះ / Name</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ថ្ងៃខែឆ្នាំ / Date</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">វេនការងារ / Timetable</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ម៉ោងត្រូវចូល / On Duty</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ម៉ោងត្រូវចេញ / Off Duty</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ស្កែនចូល / Clock In</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ស្កែនចេញ / Clock Out</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">យឺត / Late</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ចេញមុន / Early</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">អវត្តមាន / Absent</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ម៉ោងសរុប / Work Time</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">ប្រភេទ / Exception</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedShiftExceptions.map((ex) => (
                       <tr key={ex.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{ex.employeeIdCode}</td>
                          <td className="py-3 px-3 font-bold text-slate-800 text-xs">{ex.employeeName}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs">
                            {new Date(ex.date).toLocaleDateString([], { dateStyle: 'medium' })}
                          </td>
                          <td className="py-3 px-3 text-slate-655 text-xs font-semibold">{ex.timetable}</td>
                          <td className="py-3 px-3 text-slate-500 text-xs">{ex.onDuty}</td>
                          <td className="py-3 px-3 text-slate-500 text-xs">{ex.offDuty}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs font-semibold">{ex.clockIn}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs font-semibold">{ex.clockOut}</td>
                          <td className="py-3 px-3 text-amber-600 font-bold text-xs">{ex.late}</td>
                          <td className="py-3 px-3 text-orange-600 font-bold text-xs">{ex.early}</td>
                          <td className="py-3 px-3 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                              ex.absent === 'Yes' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                            >
                              {ex.absent === 'Yes' ? 'Yes/បាទ' : 'No/ទេ'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-bold text-xs">{ex.workTime}</td>
                          <td className="py-3 px-3 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                              ex.type === 'ABSENT' 
                                ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                : ex.type === 'LATE'
                                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                  : 'bg-orange-50 text-orange-600 border border-orange-100'
                            }`}
                            >
                              {ex.type}
                            </span>
                          </td>
                       </tr>
                    ))}
                    {filteredShiftExceptions.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-400 font-bold text-xs" colSpan={13}>
                          No violations (Absences or Tardiness) detected.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredShiftExceptions.length)}
            </div>
          )}

          {/* TAB 3: Misc Exception */}
          {activeTab === 'misc-ex' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500 font-bold">Failed scan registrations (GPS failures & expired tokens)</span>
                <button 
                  onClick={() => handleExport('Misc Exceptions')}
                  className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Export Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Name</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Date / Time</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Type</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">GPS Mocks</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Verification Alert Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMiscExceptions.map((ex) => (
                       <tr key={ex.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{ex.employeeName}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs">{new Date(ex.date).toLocaleString([], { hour12: false })}</td>
                          <td className="py-3 px-3 text-xs font-bold text-slate-500">{ex.type}</td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-600">{ex.gps}</td>
                          <td className="py-3 px-3 text-rose-600 text-xs font-semibold max-w-sm">{ex.details}</td>
                       </tr>
                    ))}
                    {filteredMiscExceptions.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-400 font-bold text-xs" colSpan={5}>
                          No system verification alerts triggered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredMiscExceptions.length)}
            </div>
          )}

          {/* TAB 4: Calculated items */}
          {activeTab === 'calc-items' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500 font-bold">Aggregated Attendance Metrics Ledger</span>
                <button 
                  onClick={() => handleExport('Calculated Attendance Ledger')}
                  className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Export Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Name</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Department</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Scheduled</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs">Present</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs">On Time</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs">Late</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-550 font-bold text-xs">Absent</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Hours Worked</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs text-right">OT Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCalculatedItems.map((item) => (
                       <tr key={item.employeeId} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{item.name}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs">{item.department}</td>
                          <td className="py-3 px-3 text-slate-800 text-xs font-bold">{item.totalScheduled}</td>
                          <td className="py-3 px-3 text-slate-850 text-xs font-bold text-blue-600">{item.present}</td>
                          <td className="py-3 px-3 text-slate-650 text-xs text-emerald-600 font-bold">{item.onTime}</td>
                          <td className="py-3 px-3 text-slate-650 text-xs text-amber-600 font-bold">{item.late}</td>
                          <td className="py-3 px-3 text-slate-650 text-xs text-rose-600 font-bold">{item.absent}</td>
                          <td className="py-3 px-3 text-slate-800 text-xs font-semibold">{item.hoursWorked} hrs</td>
                          <td className="py-3 px-3 text-right text-indigo-600 font-bold text-xs">{item.overtime} hrs</td>
                       </tr>
                    ))}
                    {filteredCalculatedItems.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-400 font-bold text-xs" colSpan={9}>
                          No calculated attendance ledger records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredCalculatedItems.length)}
            </div>
          )}

          {/* TAB 5: OT Reports */}
          {activeTab === 'ot-reports' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500 font-bold">Calculated Overtime Hours log</span>
                <button 
                  onClick={() => handleExport('Overtime Reports')}
                  className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Export Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Employee</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Date</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Check In / Out</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Shift End</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-555 font-bold text-xs text-right">OT Hours</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOtReports.map((ot) => (
                       <tr key={ot.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{ot.employeeName}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs">
                            {new Date(ot.date).toLocaleDateString([], { dateStyle: 'medium' })}
                          </td>
                          <td className="py-3 px-3 text-[10px] text-slate-655 leading-relaxed font-semibold">
                            IN: {new Date(ot.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} <br/>
                            OUT: {new Date(ot.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                          </td>
                          <td className="py-3 px-3 text-slate-650 text-xs font-bold">{ot.shiftEnd}</td>
                          <td className="py-3 px-3 text-right text-indigo-600 font-black text-xs">+{ot.otHours} hrs</td>
                          <td className="py-3 px-3 text-slate-500 text-xs max-w-xs">{ot.details}</td>
                       </tr>
                    ))}
                    {filteredOtReports.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-400 font-bold text-xs" colSpan={6}>
                          No overtime hours recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredOtReports.length)}
            </div>
          )}

          {/* TAB 6: No Shift User Att */}
          {activeTab === 'no-shift' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500 font-bold">Attendance registered without active calendar schedules</span>
                <button 
                  onClick={() => handleExport('Unscheduled Attendance logs')}
                  className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Export Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Employee</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Department</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Date</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">In/Out Times</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs text-right">Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedNoShiftAtts.map((log) => (
                       <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800 text-xs">{log.employeeName}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs">{log.departmentName}</td>
                          <td className="py-3 px-3 text-slate-655 text-xs">
                            {new Date(log.date).toLocaleDateString([], { dateStyle: 'medium' })}
                          </td>
                          <td className="py-3 px-3 text-[10px] text-slate-600 font-semibold leading-relaxed">
                            IN: {new Date(log.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} <br/>
                            OUT: {log.checkOut ? `OUT: ${new Date(log.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}` : 'Pending'}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-655 text-xs font-bold">{log.distance}m</td>
                       </tr>
                    ))}
                    {filteredNoShiftAtts.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-400 font-bold text-xs" colSpan={5}>
                          No unscheduled attendance records logged.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredNoShiftAtts.length)}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
