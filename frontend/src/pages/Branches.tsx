import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  QrCode, 
  Printer, 
  Copy, 
  Check, 
  Loader2, 
  X,
  Locate,
  Tv
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Branch {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  qrCodeKey: string;
  createdAt: string;
}

function parseGoogleMapsUrl(url: string) {
  // 1. Match @latitude,longitude format (standard Google Maps URL)
  const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  let match = url.match(atRegex);
  if (match) {
    return { lat: match[1], lng: match[2] };
  }

  // 2. Match ?q=latitude,longitude or &q=latitude,longitude
  const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
  match = url.match(qRegex);
  if (match) {
    return { lat: match[1], lng: match[2] };
  }

  // 3. Match bang parameters !3dlatitude!4dlongitude (embeds and location sharing links)
  const bangRegex = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
  match = url.match(bangRegex);
  if (match) {
    return { lat: match[1], lng: match[2] };
  }

  // 4. Match plain coordinates: 11.5564, 104.9282
  const plainRegex = /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/;
  match = url.match(plainRegex);
  if (match) {
    return { lat: match[1], lng: match[2] };
  }

  return null;
}

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('50');
  const [mapsUrl, setMapsUrl] = useState('');

  const handleMapsUrlChange = (value: string) => {
    setMapsUrl(value);
    if (!value.trim()) return;
    const parsed = parseGoogleMapsUrl(value.trim());
    if (parsed) {
      setLatitude(parsed.lat);
      setLongitude(parsed.lng);
    }
  };

  // QR Modal States
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [copied, setCopied] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រ Geolocation ទេ។ / Your browser does not support geolocation.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setDetecting(false);
      },
      (error) => {
        console.error(error);
        alert("មិនអាចចាប់យកទីតាំងបានទេ។ សូមអនុញ្ញាតឱ្យចូលប្រើទីតាំង (GPS) ក្នុង browser របស់អ្នក។ / Failed to get location. Please allow location access in your browser.");
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Map References
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!modalOpen || !mapContainerRef.current) return;

    const initialLat = Number(latitude) || 11.5564;
    const initialLng = Number(longitude) || 104.9282;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Fix default marker icon issues in Leaflet with bundlers (Vite)
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    });

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 14);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setLatitude(position.lat.toFixed(6));
      setLongitude(position.lng.toFixed(6));
    });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
    });

    // In React 18+ strict mode/transitions, Leaflet needs a tiny timeout to calculate size correctly
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [modalOpen]);

  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const currentLatLng = markerRef.current.getLatLng();
        if (currentLatLng.lat.toFixed(6) !== lat.toFixed(6) || currentLatLng.lng.toFixed(6) !== lng.toFixed(6)) {
          markerRef.current.setLatLng([lat, lng]);
          mapRef.current.setView([lat, lng], mapRef.current.getZoom());
        }
      }
    }
  }, [latitude, longitude]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/branches');
      setBranches(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch branches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    // Default to office center for convenience
    setLatitude('11.5564');
    setLongitude('104.9282');
    setRadius('50');
    setMapsUrl('');
    setModalOpen(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setIsEditing(true);
    setEditingId(branch.id);
    setName(branch.name);
    setLatitude(String(branch.latitude));
    setLongitude(String(branch.longitude));
    setRadius(String(branch.radius));
    setMapsUrl('');
    setModalOpen(true);
  };

  const handleDelete = async (id: string, branchName: string) => {
    if (!confirm(`តើអ្នកពិតជាចង់លុបសាខា "${branchName}" នេះមែនទេ? / Are you sure you want to delete branch "${branchName}"?`)) return;
    try {
      await api.delete(`/branches/${id}`);
      fetchBranches();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete branch');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !latitude.trim() || !longitude.trim()) {
      alert('Please fill out all fields');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius)
      };

      if (isEditing && editingId) {
        await api.put(`/branches/${editingId}`, payload);
      } else {
        await api.post('/branches', payload);
      }
      setModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save branch');
    }
  };

  const handleOpenQR = (branch: Branch) => {
    setSelectedBranch(branch);
    setQrModalOpen(true);
    setCopied(false);
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintQR = (branch: Branch) => {
    const qrValue = `BRANCH_QR:${branch.qrCodeKey}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - ${branch.name}</title>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 90vh;
              margin: 0;
              text-align: center;
              background-color: white;
            }
            .container {
              border: 3px solid #1e293b;
              padding: 40px;
              border-radius: 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .logo {
              font-size: 20px;
              font-weight: 900;
              color: #2563eb;
              letter-spacing: 0.1em;
              margin-bottom: 25px;
            }
            h1 {
              font-size: 28px;
              font-weight: 800;
              color: #0f172a;
              margin: 10px 0 5px 0;
            }
            p {
              font-size: 15px;
              color: #475569;
              margin-bottom: 30px;
              font-weight: 600;
            }
            #qr-code canvas {
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
              border: 1px solid #e2e8f0;
              padding: 10px;
              border-radius: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">AMS SYSTEM</div>
            <div id="qr-code"></div>
            <h1>${branch.name}</h1>
            <p>សូមស្កែន QR នេះដើម្បីចុះវត្តមាន<br/>Scan QR Code to Register Attendance</p>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.getElementById('qr-code'), '${qrValue}', { width: 260 }, function (error) {
              if (error) console.error(error);
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            ការគ្រប់គ្រងសាខា / Branch & QR Management
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 uppercase">
            Configure branch geofencing coordinates and print/download physical static QR codes
          </p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/10"
        >
          <Plus size={16} />
          <span>បន្ថែមសាខា / Add Branch</span>
        </button>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-150 rounded-xl text-rose-800 text-xs font-bold">
          {error}
        </div>
      ) : branches.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 bg-white shadow-sm">
          <MapPin className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-sm font-bold">មិនទាន់មានសាខាត្រូវបានកំណត់នៅឡើយទេ / No branches configured yet</p>
          <button 
            onClick={handleOpenAdd}
            className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-500 underline cursor-pointer"
          >
            បង្កើតសាខាដំបូងរបស់អ្នក / Create your first branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {branches.map((branch) => (
            <div key={branch.id} className="border border-slate-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-850 text-base">{branch.name}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Created: {new Date(branch.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 my-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Coordinates / GPS</span>
                    <span className="text-xs font-bold text-slate-700 tracking-wide">{branch.latitude.toFixed(5)}, {branch.longitude.toFixed(5)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Scan Radius / ចម្ងាយ</span>
                    <span className="text-xs font-bold text-slate-700">{branch.radius} ម៉ែត្រ / meters</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 justify-end">
                <button
                  onClick={() => navigate(`/qr-display?branchId=${branch.id}&branchName=${encodeURIComponent(branch.name)}&fullscreen=true`)}
                  className="px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Tv size={14} />
                  <span>បង្ហាញលើអេក្រង់ធំ / Launch QR Terminal</span>
                </button>
                <button
                  onClick={() => handleOpenQR(branch)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <QrCode size={14} />
                  <span>QR Code</span>
                </button>
                <button
                  onClick={() => handleOpenEdit(branch)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Edit2 size={14} />
                  <span>កែប្រែ / Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(branch.id, branch.name)}
                  className="px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>លុប / Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-800">
                {isEditing ? 'កែប្រែព័ត៌មានសាខា / Edit Branch' : 'បង្កើតសាខាថ្មី / Add New Branch'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 font-bold text-xs">ឈ្មោះសាខា / Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. សាខាបឹងកេងកង / BKK Branch"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-605 font-bold text-xs">បញ្ចូលតំណភ្ជាប់ Google Maps / Paste Google Maps Link</label>
                <input
                  type="text"
                  placeholder="Paste Google Maps URL here (e.g. https://www.google.com/maps/...)"
                  value={mapsUrl}
                  onChange={(e) => handleMapsUrlChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 font-medium">
                  💡 ប្រព័ន្ធនឹងទាញយក Latitude/Longitude ពី URL របស់ Google Maps ដោយស្វ័យប្រវត្ត។
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">Latitude / ម៉ាស៊ីនបោះទីតាំង</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 11.5564"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600 font-bold text-xs">Longitude / ម៉ាស៊ីនបោះទីតាំង</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 104.9282"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Geolocation detection button */}
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detecting}
                  className="px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {detecting ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Locate size={14} />
                  )}
                  <span>{detecting ? 'កំពុងចាប់យកទីតាំង...' : 'ចាប់យកទីតាំងបច្ចុប្បន្ន / Detect My Location'}</span>
                </button>
              </div>

              {/* Interactive Leaflet Map */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-slate-650 font-bold text-xs">ជ្រើសរើសទីតាំងលើផែនទី / Pin Location on Map</label>
                <div 
                  ref={mapContainerRef} 
                  className="w-full h-44 rounded-2xl border border-slate-200 overflow-hidden relative z-10 shadow-inner bg-slate-50"
                ></div>
                <span className="text-[10px] text-slate-400 font-semibold">
                  💡 ចុចលើផែនទី ឬអូស Marker ដើម្បីកំណត់ទីតាំង / Click on map or drag marker to set coordinates.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 font-bold text-xs">ចម្ងាយស្កែនវត្តមាន / Scan Radius Limit (meters)</label>
                <input
                  type="number"
                  required
                  min="5"
                  max="1000"
                  placeholder="e.g. 50"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Geo Helper */}
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[10px] text-blue-600 leading-relaxed font-semibold">
                💡 <strong>គន្លឹះ៖</strong> កូអរដោនេខាងលើនឹងប្រើសម្រាប់ផ្ទៀងផ្ទាត់ GPS ទូរស័ព្ទរបស់បុគ្គលិកនៅពេលគាត់ស្កែន QR របស់សាខានេះ។
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  បោះបង់ / Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-blue-600/10"
                >
                  {isEditing ? 'រក្សាទុក / Save Changes' : 'បង្កើត / Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Display & Printing Modal */}
      {qrModalOpen && selectedBranch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-800">
                វត្តមានតាមសាខា / Branch Static QR Code
              </h2>
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-slate-655 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center text-center">
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[10px] font-bold text-emerald-600 mb-2">
                {selectedBranch.name}
              </span>

              {/* QR Render */}
              <div className="my-6 p-4 bg-white border border-slate-250 rounded-2xl shadow-sm flex items-center justify-center">
                <QRCodeSVG value={`BRANCH_QR:${selectedBranch.qrCodeKey}`} size={200} />
              </div>

              <h3 className="font-extrabold text-slate-800 text-sm">{selectedBranch.name}</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1 uppercase">Scan QR Code to Register Attendance</p>

              {/* Token Display (For copy & testing) */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 mt-6">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 font-bold">QR Token Key (សម្រាប់តេស្ត/Simulation):</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`BRANCH_QR:${selectedBranch.qrCodeKey}`}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[9px] font-mono text-slate-500 focus:outline-none"
                  />
                  <button 
                    onClick={() => handleCopyToken(`BRANCH_QR:${selectedBranch.qrCodeKey}`)}
                    className={`py-1.5 px-3 rounded-xl text-[10px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer ${
                      copied ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 w-full mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setQrModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  បិទ / Close
                </button>
                <button
                  onClick={() => handlePrintQR(selectedBranch)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-1.5"
                >
                  <Printer size={14} />
                  <span>បោះពុម្ព QR / Print QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
