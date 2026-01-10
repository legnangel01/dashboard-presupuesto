import React, { useEffect, useState } from 'react';
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
let firebaseConfig = null;
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  console.error("Error parseando __firebase_config", e);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-budget-app';

// Inicialización segura para evitar errores de duplicidad o llaves vacías
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

  // Validación de entorno inicial
  useEffect(() => {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      setError("Configuración de Firebase no detectada. Por favor, asegúrate de estar en el entorno correcto.");
      setLoading(false);
    }
  }, []);

  // Paso 1: Autenticación (REGLA 3)
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Error de Auth:", err);
        setError("Error al iniciar sesión de forma anónima.");
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Paso 2: Carga de datos tras autenticación
  useEffect(() => {
    if (!user || !db) return;

    /**
     * REGLA 1: Ruta estricta para datos públicos
     * /artifacts/{appId}/public/data/{collectionName}
     */
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        try {
          if (snapshot.empty) {
            setData([]);
          } else {
            const items = snapshot.docs.map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                ramo: d.DESC_RAMO || "Sin nombre",
                aprobado: Number(d.MONTO_APROBADO) || 0,
                pagado: Number(d.MONTO_PAGADO) || 0,
                ur: d.DESC_UR || "N/A"
              };
            });
            setData(items);
          }
          setLoading(false);
        } catch (err) {
          setError("Error al procesar la información de presupuesto.");
          setLoading(false);
        }
      }, 
      (err) => {
        setError(`Error de Firestore: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // KPIs
  const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
  const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
  const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(1) : 0;

  const chartData = Object.values(data.reduce((acc, curr) => {
    if (!acc[curr.ramo]) acc[curr.ramo] = { name: curr.ramo, aprobado: 0, pagado: 0 };
    acc[curr.ramo].aprobado += curr.aprobado;
    acc[curr.ramo].pagado += curr.pagado;
    return acc;
  }, {})).sort((a, b) => b.aprobado - a.aprobado).slice(0, 7);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mb-4"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validando Credenciales...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-20">
      <nav className="bg-white/70 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 h-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Landmark className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none mb-1">ANALÍTICA FISCAL</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Presupuesto Federal 2025</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setView('dashboard')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            <LayoutDashboard size={14} /> PANEL
          </button>
          <button onClick={() => setView('table')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            <TableIcon size={14} /> DATOS
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-10">
        {error && (
          <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex flex-col gap-2 text-red-800 shadow-sm">
            <div className="flex items-center gap-3 font-black text-xs uppercase tracking-widest">
              <AlertCircle size={18} /> Error de Configuración
            </div>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MetricCard label="Presupuesto Aprobado" value={totalApproved} icon={<TrendingUp size={20} />} trend="PGE 2025" />
          <MetricCard label="Gasto Ejercido" value={totalPaid} icon={<Wallet size={20} />} color="text-emerald-600" trend="Monto Pagado" />
          <MetricCard label="Eficiencia" value={`${executionRate}%`} icon={<PieIcon size={20} />} color="text-amber-600" isPercent />
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Top 7 Ramos por Presupuesto</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Participación en Gasto Pagado</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="pagado" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: '800', paddingTop: '20px'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="p-6">Unidad Responsable</th>
                  <th className="p-6 text-right">Aprobado</th>
                  <th className="p-6 text-right">Pagado</th>
                  <th className="p-6 text-center">Avance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-6">
                      <p className="text-[9px] font-bold text-blue-500 uppercase mb-0.5">{item.ur}</p>
                      <p className="text-sm font-bold text-slate-700">{item.ramo}</p>
                    </td>
                    <td className="p-6 text-right font-mono text-sm text-slate-400">${item.aprobado.toLocaleString()}</td>
                    <td className="p-6 text-right font-mono text-sm font-black text-slate-900">${item.pagado.toLocaleString()}</td>
                    <td className="p-6 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-100 text-[10px] font-black text-blue-600 shadow-sm group-hover:border-blue-200">
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
  <div className="bg-white p-7 rounded-[2.2rem] border border-slate-100 shadow-sm relative overflow-hidden">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2.5 bg-slate-50 rounded-xl text-blue-600">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <h2 className={`text-2xl font-black tracking-tight ${color}`}>
      {!isPercent && "$"}
      {typeof value === 'number' ? value.toLocaleString() : value}
    </h2>
    {trend && (
      <p className="mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block"></span> {trend}
      </p>
    )}
  </div>
);

export default App;
