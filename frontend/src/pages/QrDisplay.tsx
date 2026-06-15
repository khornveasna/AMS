import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { Copy, Check, Users, Loader2, Maximize, Minimize, ShieldCheck, MapPin, Building2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ScanActivity {
  id: string;
  employeeName: string;
  time: string;
  type: string;
  status: string;
}

export default function QrDisplay() {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [recentScans, setRecentScans] = useState<ScanActivity[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const branchIdFromUrl = searchParams.get('branchId') || '';
  const isFullscreenView = searchParams.get('fullscreen') === 'true';

  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchIdFromUrl);
  const [currentBranchName, setCurrentBranchName] = useState<string>(searchParams.get('branchName') || 'General');

  // Load branches list on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches');
        setBranchesList(res.data);
      } catch (err) {
        console.error('Failed to load branches list', err);
      }
    };
    fetchBranches();
  }, []);

  // Sync selectedBranchId if url parameter changes externally
  useEffect(() => {
    setSelectedBranchId(branchIdFromUrl);
    if (!branchIdFromUrl) {
      setCurrentBranchName('General');
    }
  }, [branchIdFromUrl]);

  const fetchToken = async () => {
    try {
      setLoading(true);
      if (selectedBranchId) {
        // Find matching branch from fetched branches
        const matched = branchesList.find((b: any) => b.id === selectedBranchId);
        if (matched) {
          setToken(`BRANCH_QR:${matched.qrCodeKey}`);
          setCurrentBranchName(matched.name);
        } else if (branchesList.length > 0) {
          // If branches list is loaded but no match, could be missing/deleted
          setToken('BRANCH_NOT_FOUND');
        }
      } else {
        // Fallback to dynamic token
        const res = await api.get('/attendance/qr-token');
        setToken(res.data.token);
      }
      setCountdown(8);
      
      // Fetch latest scans
      const historyRes = await api.get('/attendance/history');
      const recent = historyRes.data.slice(0, 5).map((log: any) => ({
        id: log.id,
        employeeName: log.employee.name,
        time: new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        type: log.checkOut ? 'CHECK OUT' : 'CHECK IN',
        status: log.status
      }));
      setRecentScans(recent);
    } catch (err) {
      console.error('Error fetching QR token/branches', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger token fetch when branchesList or selectedBranchId changes
  useEffect(() => {
    fetchToken();
  }, [selectedBranchId, branchesList]);

  // Handle countdown interval for dynamic QR only
  useEffect(() => {
    if (selectedBranchId) return; // Static branch QR does not rotate

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchToken();
          return 8;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedBranchId]);

  const handleBranchSelect = (id: string) => {
    setSelectedBranchId(id);
    const params = new URLSearchParams(searchParams);
    if (id) {
      params.set('branchId', id);
      const matched = branchesList.find(b => b.id === id);
      if (matched) {
        params.set('branchName', matched.name);
        setCurrentBranchName(matched.name);
      }
    } else {
      params.delete('branchId');
      params.delete('branchName');
      setCurrentBranchName('General');
    }
    setSearchParams(params);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    const params = new URLSearchParams(searchParams);
    if (isFullscreenView) {
      params.delete('fullscreen');
    } else {
      params.set('fullscreen', 'true');
    }
    setSearchParams(params);
  };

  // ------------------------------------------------------------
  // FULLSCREEN TV DISPLAY LAYOUT (DETACHED/CLEAN)
  // ------------------------------------------------------------
  if (isFullscreenView) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-8 text-center select-none relative overflow-hidden font-sans">
        {/* Animated grid overlay for premium look */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>

        {/* Floating Exit Button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-6 right-6 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-1.5 active:scale-95 z-50 backdrop-blur-md"
        >
          <Minimize size={14} />
          <span>ចាកចេញពីពេញអេក្រង់ / Exit Full Screen</span>
        </button>

        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 shadow-[0_0_50px_rgba(59,130,246,0.1)] flex flex-col items-center relative z-10 backdrop-blur-xl">
          <div className="mb-5">
            <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
              <MapPin size={12} />
              {currentBranchName.toUpperCase()} BRANCH TERMINAL
            </span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">ស្កែន QR Code ដើម្បីចុះវត្តមាន</h2>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wide">Scan QR Code to Register Attendance</p>

          {/* QR Container */}
          <div className="my-8 relative p-6 bg-slate-950/80 rounded-3xl border border-slate-900 shadow-2xl">
            {loading && !token ? (
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={40} />
              </div>
            ) : (
              <div className="w-60 h-60 bg-white p-4 rounded-2xl flex items-center justify-center shadow-inner relative group">
                {token ? (
                  <QRCodeSVG value={token} size={220} />
                ) : (
                  <Loader2 className="animate-spin text-slate-400" size={32} />
                )}
              </div>
            )}

            {/* Countdown indicator for dynamic only */}
            {!selectedBranchId && token && (
              <div className="absolute bottom-2 left-6 right-6">
                <div className="h-1 w-full bg-slate-850 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000" 
                    style={{ width: `${(countdown / 8) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Status info */}
          <div className="text-xs text-slate-400 font-bold bg-slate-950/40 px-4 py-2 border border-slate-850 rounded-2xl w-full">
            {selectedBranchId ? (
              <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} />
                ទីតាំងថេរ (Static Location QR)
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="animate-spin text-rose-400" size={12} />
                កូដប្តូរថ្មីរាល់៖ <strong className="text-rose-400">{countdown} វិនាទី</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // STANDARD LAYOUT WITH SIDEBAR/HEADER
  // ------------------------------------------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {/* Left Column: QR Display */}
      <div className="col-span-1 lg:col-span-2 border border-slate-200 bg-white rounded-2xl p-8 flex flex-col items-center text-center justify-center shadow-sm">
        <div className="flex justify-between items-center w-full mb-6 border-b border-slate-100 pb-4">
          <span className="px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-xs font-bold text-rose-600 animate-pulse uppercase tracking-wide">
            LIVE ATTENDANCE TERMINAL - {currentBranchName.toUpperCase()}
          </span>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Maximize size={12} />
            <span>ពេញអេក្រង់ / Full Screen</span>
          </button>
        </div>

        {/* Branch Selector Dropdown */}
        <div className="w-full max-w-sm mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left flex flex-col gap-2">
          <label className="text-slate-600 font-bold text-xs flex items-center gap-1.5">
            <Building2 size={14} className="text-blue-500" />
            <span>ជ្រើសរើសសាខាសម្រាប់ផ្ទាំង QR / Select QR Display Terminal</span>
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => handleBranchSelect(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-sm cursor-pointer"
          >
            <option value="">General Office (កូដប្តូរថ្មីរាល់ ៨វិនាទី / Dynamic QR)</option>
            {branchesList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (កូដថេរ / Static QR)
              </option>
            ))}
          </select>
        </div>

        <h2 className="text-xl font-extrabold text-slate-800 mt-2">ស្កែន QR Code ដើម្បីចុះវត្តមាន</h2>
        <p className="text-slate-400 text-xs font-semibold mt-1 uppercase">Scan QR Code to Register Attendance</p>

        {/* QR Container */}
        <div className="my-8 relative p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
          {loading && !token ? (
            <div className="w-56 h-56 flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={36} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-52 h-52 bg-white p-4 rounded-2xl flex items-center justify-center relative shadow-md">
                {token ? (
                  <QRCodeSVG value={token} size={180} />
                ) : (
                  <Loader2 className="animate-spin text-slate-400" size={32} />
                )}
              </div>
            </div>
          )}

          {/* Countdown progress bar for dynamic only */}
          {!selectedBranchId && token && (
            <div className="absolute bottom-2 left-6 right-6">
              <div className="h-1 w-full bg-slate-850 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-1000" 
                  style={{ width: `${(countdown / 8) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Token display and simulation copy button */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold">QR Type / របៀបស្កែន:</span>
            {selectedBranchId ? (
              <span className="font-extrabold text-emerald-600">Static Branch QR Code</span>
            ) : (
              <span className="font-extrabold text-rose-600">Dynamic QR ({countdown}s remaining)</span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={token}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-500 select-all focus:outline-none"
            />
            <button 
              onClick={handleCopy}
              className={`py-2 px-4 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 ${
                copied ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy Token"}</span>
            </button>
          </div>
          
          <p className="text-[10px] text-slate-500 leading-relaxed text-left font-medium">
            💡 <strong>Simulation Note:</strong> Copy this active token, navigate to the <strong>Mobile Scan Hub</strong> sidebar, select your coordinates, paste it and scan.
          </p>
        </div>
      </div>

      {/* Right Column: Live Logs */}
      <div className="col-span-1 border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <Users size={18} className="text-blue-500" />
          <span>ស្កែនជោគជ័យថ្មីៗ / Live Scan Feeds</span>
        </h3>

        <div className="mt-4 flex flex-col gap-3">
          {recentScans.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
              កំពុងរង់ចាំការស្កែន... / Waiting for scans...
            </div>
          ) : (
            recentScans.map((scan) => (
              <div key={scan.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-850">{scan.employeeName}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{scan.time} • <strong className="text-blue-600">{scan.type}</strong></p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                  scan.status === 'ON_TIME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {scan.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
