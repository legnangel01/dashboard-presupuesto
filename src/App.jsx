import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, Wallet, LayoutDashboard, Table as TableIcon, PieChart as PieIcon, AlertCircle, ArrowUpRight } from 'lucide-react';

/**
 * Gestión de Configuración Global de Firebase
 */
const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Error al parsear la configuración de Firebase", e);
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'budget-analytics-2025';

// Inicialización diferida para mayor estabilidad
let app, db, auth;
if (firebaseConfig && firebaseConfig.apiKey) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
}

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [user, setUser] = useState(null);

  // Efecto de inicialización y validación (REGLA 3)
  useEffect(() => {
    if (!firebaseConfig || !auth) {
      setError("Configuración de servicios no detectada. Por favor, verifica el entorno de ejecución.");
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Error de Auth:", err);
        setError("Error de autenticación: No se pudo establecer una sesión segura.");
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Carga de datos desde Firestore (REGLA 1)
  useEffect(() => {
    // Solo procedemos si el usuario está autenticado y la DB existe
    if (!user || !db) return;

    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        try {
          const items = snapshot.docs.map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              ramo: d.DESC_RAMO || "Otros Ramos",
              aprobado: Number(d.MONTO_APROBADO) || 0,
              pagado: Number(d.MONTO_PAGADO) || 0,
              ur: d.DESC_UR || "N/A"
            };
          });
          setData(items);
          setLoading(false);
        } catch (err) {
          setError("Error al procesar los datos recibidos.");
          setLoading(false);
        }
      }, 
      (err) => {
        console.error("Error de Firestore:", err);
        // No bloqueamos toda la UI si hay datos previos, solo informamos
        if (data.length === 0) {
          setError(`Acceso denegado o error de red: ${err.message}`);
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [user, data.length]);

  // Cálculos estadísticos
  const stats = useMemo(() => {
    const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
    const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
    const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(1) : "0.0";
    
    const grouped = data.reduce((acc, curr) => {
      if (!acc[curr.ramo]) acc[curr.ramo] = { name: curr.ramo, aprobado: 0, pagado: 0 };
      acc[curr.ramo].aprobado += curr.aprobado;
      acc[curr.ramo].pagado += curr.pagado;
      return acc;
    }, {});

    const chartData = Object.values(grouped)
      .sort((a, b) => b.aprobado - a.aprobado)
      .slice(0, 7);

    return { totalApproved, totalPaid, executionRate, chartData };
  }, [data]);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Cargando Sistema Fiscal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-10">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 h-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Landmark className="text-white w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-black text-lg tracking-tight leading-none mb-1 uppercase">Analítica Presupuestaria</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Plataforma de Transparencia 2025</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            <LayoutDashboard size={14} /> PANEL
          </button>
          <button onClick={() => setView('table')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            <TableIcon size={14} /> EXPLORADOR
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-8">
        {error && (
          <div className="mb-8 p-5 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 text-red-800">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-black text-[10px] uppercase tracking-widest mb-1">Error detectado</p>
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard label="Presupuesto Aprobado" value={stats.totalApproved} icon={<TrendingUp size={20} />} trend="PGE Federal" />
          <MetricCard label="Gasto Pagado" value={stats.totalPaid} icon={<Wallet size={20} />} color="text-emerald-600" trend="Monto Ejercido" />
          <MetricCard label="Eficiencia" value={`${stats.executionRate}%`} icon={<PieIcon size={20} />} color="text-amber-600" isPercent />
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ChartContainer title="Top 7 Ramos Administrativos">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stats.chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                  <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer title="Distribución de Gasto Ejercido">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie data={stats.chartData} dataKey="pagado" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5}>
                    {stats.chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: '800', paddingTop: '20px'}} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad Responsable / Ramo</th>
                  <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobado</th>
                  <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagado</th>
                  <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-6">
                      <p className="text-[9px] font-bold text-blue-500 uppercase mb-0.5">{item.ur}</p>
                      <p className="text-sm font-bold text-slate-700">{item.ramo}</p>
                    </td>
                    <td className="p-6 text-right font-mono text-sm text-slate-400">
                      ${item.aprobado.toLocaleString('es-MX')}
                    </td>
                    <td className="p-6 text-right font-mono text-sm font-black text-slate-900">
                      ${item.pagado.toLocaleString('es-MX')}
                    </td>
                    <td className="p-6 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-100 text-[10px] font-black text-blue-600 shadow-sm">
                        {item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0}%
                        <ArrowUpRight size={10} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color = "text-slate-900", isPercent = false, trend }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-slate-50 rounded-lg text-blue-600">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <h2 className={`text-2xl font-black tracking-tight ${color}`}>
      {!isPercent && "$"}
      {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
    </h2>
    {trend && (
      <p className="mt-3 text-[9px] font-bold text-slate-400 uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> {trend}
      </p>
    )}
  </div>
);

const ChartContainer = ({ title, children }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8">{title}</h3>
    {children}
  </div>
);

export default App;
