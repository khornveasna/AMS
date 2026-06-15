import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Smartphone, MapPin, ShieldCheck, ShieldAlert, History, Loader2, CameraOff, LogIn, LogOut, CheckCircle, Compass } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface HistoryLog {
  id: string;
  checkIn: string;
  checkOut: string | null;
  latitude: number;
  longitude: number;
  distance: number;
  status: string;
  employee?: {
    name: string;
    email: string;
    department?: {
      name: string;
    };
  };
}

export default function ScanHub() {
  const [latitude, setLatitude] = useState(11.5564);
  const [longitude, setLongitude] = useState(104.9282);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);

  // Simulation mode defaults to true so testers can verify branch scans in localhost/office environments without physical GPS spoofing
  const [simulateLocation] = useState(true);

  // Core features: scanType, closest branch proximity, and camera control
  const [scanType, setScanType] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [closestBranch, setClosestBranch] = useState<{name: string, distance: number, inRange: boolean} | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<any>(null);

  // Detect secure context (HTTPS or localhost)
  const isSecure = typeof window !== 'undefined' && window.isSecureContext;

  // QR Scanner States
  const [cameraActive, setCameraActive] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  // Get current user details
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : { role: 'EMPLOYEE' };
  const isAdmin = user.role === 'ADMIN';

  // Calculate distance on frontend to preview
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Helper to request real GPS coordinates from browser Geolocation API
  const getRealPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  };

  const handleDetectClosestBranch = async () => {
    try {
      setDetectingLocation(true);
      setError(null);
      setLocationWarning(null);
      
      let lat = 11.5564;
      let lon = 104.9282;
      let usingBranchMock = false;

      if (employeeProfile?.branch) {
        lat = employeeProfile.branch.latitude;
        lon = employeeProfile.branch.longitude;
        usingBranchMock = true;
      }
      
      try {
        const pos = await getRealPosition();
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);
      } catch (geoErr) {
        console.warn("Real GPS failed, falling back to mock coordinates.", geoErr);
        setLatitude(lat);
        setLongitude(lon);
        if (usingBranchMock) {
          setLocationWarning(`⚠️ មិនអាចចាប់យកទីតាំង GPS ពិតបានទេ (ទូរស័ព្ទស្ថិតលើ HTTP/គ្មានការអនុញ្ញាត)។ ប្រព័ន្ធបានកំណត់ទីតាំងអ្នកទៅកាន់សាខា ${employeeProfile.branch.name} ដោយស្វ័យប្រវត្ត ដើម្បីសម្រួលដល់ការធ្វើតេស្ត! / Mock GPS set to assigned branch ${employeeProfile.branch.name} for testing.`);
        } else {
          setLocationWarning("⚠️ មិនអាចចាប់យកទីតាំង GPS ពិតប្រាកដបានទេ (ទូរស័ព្ទស្ថិតលើ HTTP/គ្មានការអនុញ្ញាត)។ ប្រព័ន្ធបានប្រើទីតាំងការិយាល័យកណ្តាលសាកល្បងជំនួស! / GPS simulation active (HTTP fallback).");
        }
      }

      // Find closest location among office and all branches
      const allLocations = [
        { name: 'Office HQ (ការិយាល័យកណ្តាល)', lat: 11.5564, lon: 104.9282, radius: 50 },
        ...branches.map(b => ({ name: b.name, lat: b.latitude, lon: b.longitude, radius: b.radius }))
      ];

      let minDistance = Infinity;
      let closestLoc = allLocations[0];

      for (const loc of allLocations) {
        const dist = getDistanceInMeters(lat, lon, loc.lat, loc.lon);
        if (dist < minDistance) {
          minDistance = dist;
          closestLoc = loc;
        }
      }

      setClosestBranch({
        name: closestLoc.name,
        distance: minDistance,
        inRange: minDistance <= closestLoc.radius || !isSecure // Auto-allow in HTTP mode for smooth testing
      });
    } catch (err: any) {
      setError("មានបញ្ហាក្នុងការពិនិត្យទីតាំង / Error checking location.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await api.get('/attendance/history');
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data);
    } catch (err) {
      console.error('Failed to load branches', err);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      setEmployeeProfile(res.data);
    } catch (err) {
      console.error('Failed to load profile', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchBranches();
    fetchProfile();
  }, []);

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setSuccessData(null);
    setCameraActive(false);
    setError(null);
    setResult(null);
  };

  const submitScan = async (token: string, lat: number, lon: number, explicitType: 'CHECK_IN' | 'CHECK_OUT') => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.post('/attendance/scan', {
        qrToken: token,
        latitude: lat,
        longitude: lon,
        scanType: explicitType
      });
      setSuccessData(res.data);
      setShowSuccessModal(true);
      setResult(null);
      fetchHistory();
      // Auto-return to main screen after 4 seconds
      setTimeout(() => {
        handleCloseSuccessModal();
      }, 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Scan failed due to an error');
    } finally {
      setLoading(false);
    }
  };

  const handleScanClick = (type: 'CHECK_IN' | 'CHECK_OUT') => {
    setScanType(type);
    setError(null);
    setResult(null);
    setCameraActive(true);
  };

  // QR Scanner initializer effect
  useEffect(() => {
    if (!cameraActive) {
      if (scanner) {
        scanner.stop().catch(err => console.error("Error stopping scanner:", err));
        setScanner(null);
      }
      return;
    }

    let isMounted = true;
    let qrScanner: Html5Qrcode | null = null;

    const initScanner = async () => {
      // Check if element is ready in DOM
      const readerEl = document.getElementById("reader");
      if (!readerEl) {
        if (isMounted) setTimeout(initScanner, 100);
        return;
      }

      try {
        qrScanner = new Html5Qrcode("reader");
        if (!isMounted) return;
        setScanner(qrScanner);

        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (devices && devices.length > 0) {
          const backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
          );
          const cameraId = backCamera ? backCamera.id : devices[devices.length - 1].id;

          await qrScanner.start(
            cameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            async (decodedText) => {
              // Stop scanning once detected
              try {
                if (qrScanner?.isScanning) {
                  await qrScanner.stop();
                }
              } catch (stopErr) {
                console.error("Failed to stop scanner", stopErr);
              }
              if (isMounted) {
                setCameraActive(false);
                setScanner(null);
              }

            let lat = latitude;
            let lon = longitude;
            let tokenToSubmit = decodedText;

            const isSimulated = isAdmin || simulateLocation;
            let cleanToken = decodedText;
            if (decodedText.startsWith('BRANCH_QR:')) {
              cleanToken = decodedText.replace('BRANCH_QR:', '');
            }
            
            const matchedBranch = branches.find(b => b.qrCodeKey === cleanToken);
            if (matchedBranch) {
              tokenToSubmit = `BRANCH_QR:${cleanToken}`;
              if (isSimulated) {
                lat = matchedBranch.latitude;
                lon = matchedBranch.longitude;
              }
            } else if (isSimulated) {
              try {
                const parts = decodedText.split('.');
                if (parts.length === 3) {
                  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                  if (payload && payload.branchId) {
                    const mb = branches.find(b => b.id === payload.branchId);
                    if (mb) {
                      lat = mb.latitude;
                      lon = mb.longitude;
                    }
                  }
                }
              } catch (jwtErr) {
                // Ignore
              }
            }

            await submitScan(tokenToSubmit, lat, lon, scanType);
          },
          () => {
            // verbose callback
          }
        );
      } else {
        throw new Error("No camera devices found.");
      }
    } catch (err) {
        console.error("Failed to start html5-qrcode scanner:", err);
        if (isMounted) {
          setCameraActive(false);
          setScanner(null);
          // Fallback to native device camera file picker
          document.getElementById('qr-file-input')?.click();
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      if (qrScanner) {
        try {
          if (qrScanner.isScanning) {
            qrScanner.stop().catch(err => console.warn("Scanner stopped on unmount:", err));
          }
        } catch (err) {
          console.error("Failed to stop scanner in cleanup", err);
        }
      }
    };
  }, [cameraActive, scanType]);

  const stopCamera = async () => {
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        console.error("Error stopping camera:", err);
      }
      setScanner(null);
    }
    setCameraActive(false);
  };

  const resizeImageFile = (file: File, maxDimension: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Canvas context is not available"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas to Blob conversion failed"));
            }
          }, file.type || 'image/jpeg', 0.85);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    setLoading(true);
    setError(null);
    setResult(null);

    let html5QrCode: Html5Qrcode | null = null;
    try {
      html5QrCode = new Html5Qrcode("hidden-reader");
      let fileToScan = originalFile;
      try {
        const resizedBlob = await resizeImageFile(originalFile, 800);
        fileToScan = new File([resizedBlob], originalFile.name, { type: originalFile.type });
      } catch (resizeErr) {
        console.warn("Failed to resize image, attempting to scan original", resizeErr);
      }

      const decodedText = await html5QrCode.scanFile(fileToScan, false);
      
      let lat = latitude;
      let lon = longitude;
      let tokenToSubmit = decodedText;

      const isSimulated = isAdmin || simulateLocation;
      let cleanToken = decodedText;
      if (decodedText.startsWith('BRANCH_QR:')) {
        cleanToken = decodedText.replace('BRANCH_QR:', '');
      }

      const matchedBranch = branches.find(b => b.qrCodeKey === cleanToken);
      if (matchedBranch) {
        tokenToSubmit = `BRANCH_QR:${cleanToken}`;
        if (isSimulated) {
          lat = matchedBranch.latitude;
          lon = matchedBranch.longitude;
        }
      } else if (isSimulated) {
        try {
          const parts = decodedText.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload && payload.branchId) {
              const mb = branches.find(b => b.id === payload.branchId);
              if (mb) {
                lat = mb.latitude;
                lon = mb.longitude;
              }
            }
          }
        } catch (jwtErr) {
          // Ignore
        }
      }

      await submitScan(tokenToSubmit, lat, lon, scanType);
    } catch (err: any) {
      console.error(err);
      setError("រកមិនឃើញ QR Code ក្នុងរូបភាពនេះទេ។ សូមថតរូបឱ្យចំពីមុខ និងកុំឱ្យងងឹតពេក។");
    } finally {
      if (html5QrCode) {
        try {
          html5QrCode.clear();
        } catch (clearErr) {
          console.error("Failed to clear html5QrCode", clearErr);
        }
      }
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="text-center py-2">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          ស្កែនវត្តមានទូរស័ព្ទ / Employee Scan Hub
        </h1>
        <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-wider">
          សូមផ្ទៀងផ្ទាត់ទីតាំង និងស្កែន QR Code ដើម្បីកត់ត្រាវត្តមាន
        </p>
      </div>

      {/* Employee Profile Header Card */}
      {employeeProfile && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
          {/* Decorative background shapes for a premium look */}
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-50 rounded-full opacity-60 pointer-events-none"></div>
          <div className="absolute -right-2 -top-10 w-20 h-20 bg-blue-50 rounded-full opacity-60 pointer-events-none"></div>
          
          {/* Avatar Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center text-white shrink-0 font-black text-lg shadow-md uppercase">
            {employeeProfile.name ? employeeProfile.name.substring(0, 2) : 'EM'}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-800 truncate">{employeeProfile.name}</h2>
              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider shrink-0">
                {employeeProfile.employeeIdCode || 'EMP'}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5 uppercase tracking-wide truncate">
              {employeeProfile.jobTitle || 'Staff'} • {employeeProfile.department?.name || 'Department'}
            </p>

            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>សាខាបំពេញការងារ៖</span>
              <span className="text-slate-800 underline decoration-emerald-400 decoration-2 underline-offset-2 font-black">
                {employeeProfile.branch?.name || 'ការិយាល័យកណ្តាល (HQ)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Proximity check Card */}
      <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
          <Compass size={18} className="text-blue-500 animate-spin-slow" />
          <span>១. ផ្ទៀងផ្ទាត់ទីតាំង / 1. Verify GPS Proximity</span>
        </h3>

        <button
          type="button"
          onClick={handleDetectClosestBranch}
          disabled={detectingLocation}
          className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          {detectingLocation ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <MapPin size={14} className="text-blue-400 animate-bounce" />
          )}
          <span>{detectingLocation ? 'កំពុងចាប់ទីតាំង...' : 'ពិនិត្យ/ចាប់យកទីតាំង (Check Proximity)'}</span>
        </button>

        {closestBranch ? (
          <div className="flex flex-col gap-3">
            <div className={`p-4 rounded-xl border text-left flex flex-col gap-2.5 ${
              closestBranch.inRange 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50/70 border-rose-200 text-rose-800'
            }`}>
              <p className="text-xs font-bold flex items-center gap-1.5">
                <CheckCircle size={14} className={closestBranch.inRange ? 'text-emerald-600' : 'text-rose-600'} />
                <span>ទីតាំងជិតបំផុត៖ <strong>{closestBranch.name}</strong></span>
              </p>
              
              <div className="text-[11px] font-semibold flex flex-col gap-1 ml-5">
                <span>ចម្ងាយ៖ <strong>{Math.round(closestBranch.distance)} ម៉ែត្រ</strong></span>
                <span className="font-bold">
                  {closestBranch.inRange 
                    ? '🟢 ស្ថិតក្នុងរង្វង់អនុញ្ញាត (In Range - OK)' 
                    : '🔴 នៅក្រៅរង្វង់អនុញ្ញាត (Too Far - Blocked)'}
                </span>
              </div>

              {closestBranch.inRange && (
                <div className="mt-2 pt-2 border-t border-emerald-200/50 flex flex-col gap-1 text-[11px] font-bold text-emerald-900">
                  <span className="bg-emerald-100/80 px-2.5 py-1 rounded-lg w-fit text-[10px] text-emerald-800">
                    📍 វត្តមាននៅ៖ {closestBranch.name} (Active Terminal)
                  </span>
                  <span className="leading-relaxed mt-0.5">
                    👉 សូមស្កែនកូដ QR ដែលបង្ហាញលើអេក្រង់ធំនៅច្រកចូលនៃ {closestBranch.name} ដើម្បីកត់ត្រាវត្តមាន។
                  </span>
                  <span className="text-[9px] text-emerald-600 font-semibold uppercase tracking-wider">
                    Please scan the QR code displayed on the entrance screen at {closestBranch.name}
                  </span>
                </div>
              )}
            </div>
            
            {locationWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-semibold text-left leading-relaxed">
                {locationWarning}
              </div>
            )}

            {employeeProfile?.branch?.name && !closestBranch.name.includes(employeeProfile.branch.name) && (
              <div className="p-3 bg-rose-55/90 border border-rose-200 rounded-xl text-rose-900 text-[11px] font-semibold text-left leading-relaxed">
                ⚠️ <strong>ទីតាំងមិនត្រឹមត្រូវ៖</strong> សាខាដែលបានកំណត់របស់អ្នកគឺ <strong>{employeeProfile.branch.name}</strong> ប៉ុន្តែអ្នកកំពុងស្ថិតនៅក្បែរ <strong>{closestBranch.name}</strong>។ អ្នកនឹងមិនអាចស្កែនវត្តមាននៅទីនេះបានទេ។ / Warning: Your assigned branch is {employeeProfile.branch.name} but your current location is near {closestBranch.name}.
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs font-medium">
            📍 សូមចុចប៊ូតុងខាងលើ ដើម្បីស្វែងរកទីតាំង និងវាស់ចម្ងាយទៅកាន់សាខាជិតបំផុត។
          </div>
        )}
      </div>

      {/* 2. Scan Action Card */}
      <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
          <Smartphone size={18} className="text-indigo-500" />
          <span>២. ស្កែនវត្តមាន / 2. Select Action & Scan</span>
        </h3>

        {/* Big Colored Scan Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={loading || cameraActive}
            onClick={() => handleScanClick('CHECK_IN')}
            className="py-6 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base transition-all flex flex-col items-center justify-center gap-3 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
          >
            <LogIn size={32} />
            <span>Check In (ចូលបំពេញការងារ)</span>
          </button>

          <button
            type="button"
            disabled={loading || cameraActive}
            onClick={() => handleScanClick('CHECK_OUT')}
            className="py-6 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-base transition-all flex flex-col items-center justify-center gap-3 cursor-pointer shadow-md shadow-rose-600/20 active:scale-95 disabled:opacity-50"
          >
            <LogOut size={32} />
            <span>Check Out (ចេញពីការងារ)</span>
          </button>
        </div>

        {/* Camera View Area in a Premium Floating Popup Modal */}
        {cameraActive && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 relative">
              <div className="absolute left-6 right-6 top-6 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse z-20"></div>
              
              <div className="flex flex-col gap-1 mt-2">
                <h2 className="text-lg font-black text-slate-800">ស្កែនកូដ QR / Scan QR Code</h2>
                <p className="text-xs font-bold text-slate-500">
                  ប្រភេទ៖ <span className={scanType === 'CHECK_IN' ? 'text-emerald-600' : 'text-rose-600'}>
                    {scanType === 'CHECK_IN' ? 'Check In (ចូល)' : 'Check Out (ចេញ)'}
                  </span>
                </p>
              </div>

              <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 aspect-square max-w-xs mx-auto shadow-inner">
                <div id="reader" className="w-full h-full"></div>
              </div>

              <button
                type="button"
                onClick={stopCamera}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 mt-2"
              >
                <CameraOff size={16} />
                <span>បិទកាមេរ៉ា / Close Scanner</span>
              </button>
            </div>
          </div>
        )}

        {/* Fallback Image Picker for non-secure HTTP or when camera is blocked */}
        <div className="hidden">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={loading}
            onChange={handleFileScan}
            id="qr-file-input"
          />
        </div>

        {/* Result Messages */}
        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 flex flex-col gap-2 shadow-sm text-left">
            <div className="flex items-center gap-2 font-bold text-xs">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>ស្កែនជោគជ័យ / Scan Success: {result?.type}</span>
            </div>
            <p className="text-xs font-semibold">{result?.message}</p>
            <div className="text-[10px] text-emerald-600 font-semibold">
              កូអរដោនេ៖ {result?.attendance?.latitude != null ? result.attendance.latitude.toFixed(4) : 'N/A'}, {result?.attendance?.longitude != null ? result.attendance.longitude.toFixed(4) : 'N/A'} (ចម្ងាយ {result?.distance != null ? Math.round(result.distance) : 0}m)
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-150 rounded-xl text-rose-800 flex flex-col gap-2 shadow-sm text-left">
            <div className="flex items-center gap-2 font-bold text-xs">
              <ShieldAlert size={16} className="text-rose-600" />
              <span>ស្កែនបរាជ័យ / Scan Failed</span>
            </div>
            <p className="text-xs font-semibold leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      {/* 3. Scan History Section */}
      <div className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-extrabold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <History size={18} className="text-indigo-500" />
          <span>ប្រវត្តិស្កែនរបស់អ្នក / Attendance Scan History</span>
        </h3>

        {historyLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="animate-spin text-blue-600" size={20} />
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-semibold">
            មិនទាន់មានប្រវត្តិចុះវត្តមាននៅឡើយទេ / No scanning history found.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">ឈ្មោះ / Name</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Check In Time</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Check Out Time</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">GPS Distance</th>
                  <th className="py-2.5 px-3 bg-slate-50 text-slate-500 font-bold text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-3 text-slate-800 font-black text-xs">
                      {log.employee?.name || 'Unknown'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-xs">
                      {new Date(log.checkIn).toLocaleString([], { hour12: false })}
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-xs">
                      {log.checkOut ? new Date(log.checkOut).toLocaleString([], { hour12: false }) : (
                        <span className="text-slate-400 italic">No checkout yet</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-xs">
                      {Math.round(log.distance)} meters
                    </td>
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
      {/* Hidden reader element for local file scanning */}
      <div id="hidden-reader" style={{ display: 'none' }}></div>

      {/* Success Modal Popup */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 animate-bounce">
              <CheckCircle size={48} className="stroke-[2.5]" />
            </div>
            
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black text-slate-800">ស្កែនទទួលបានជោគជ័យ!</h2>
              <p className="text-sm font-bold text-slate-500">Scan Operation Successful</p>
            </div>

            <div className="w-full bg-slate-50 rounded-2xl p-4 flex flex-col gap-2.5 text-left border border-slate-100">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold">ប្រភេទ / Type:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  successData?.type === 'CHECK_IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {successData?.type === 'CHECK_IN' ? 'CHECK IN (ចូល)' : 'CHECK OUT (ចេញ)'}
                </span>
              </div>
              
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="text-slate-400 font-semibold">លទ្ធផល / Status:</span>
                <span className="text-slate-700 font-bold leading-relaxed">{successData?.message}</span>
              </div>

              {successData?.attendance && (
                <div className="flex justify-between items-center text-[11px] pt-2 border-t border-slate-200/60 text-slate-500 font-medium">
                  <span>ចម្ងាយ៖ {successData?.distance != null ? Math.round(successData.distance) : 0} ម៉ែត្រ</span>
                  <span>ម៉ោង៖ {new Date(successData.attendance.checkIn).toLocaleTimeString([], { hour12: false })}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleCloseSuccessModal}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              យល់ព្រម / OK
            </button>
            <span className="text-[10px] text-slate-400 font-semibold">ប្រព័ន្ធនឹងត្រលប់ទៅទំព័រដើមវិញក្នុងរយៈពេលខ្លី...</span>
          </div>
        </div>
      )}
    </div>
  );
}
