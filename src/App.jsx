import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, Wallet, LayoutDashboard, Table as TableIcon, PieChart as PieIcon, AlertCircle, ArrowUpRight, ShieldAlert } from 'lucide-react';

/**
 * Lógica de configuración compatible con entornos ES2015/Legacy
 * Se eliminan las referencias directas a import.meta para evitar errores de compilación
 */
const getFirebaseConfig = () => {
  try {
    // 1. Prioridad: Variable global inyectada por el entorno (__firebase_config)
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
    
    // 2. Fallback: Intentar leer de variables globales de proceso (común en despliegues node/build)
    if (typeof process !== 'undefined' && process.env && process.env.VITE_FIREBASE_CONFIG) {
      return JSON.parse(process.env.VITE_FIREBASE_CONFIG);
    }

    // 3. Fallback: Detección segura de import.meta envolviéndolo para evitar errores de sintaxis en target es2015
    const metaEnv = (function() {
      try { return (new Function('return import.meta.env'))(); } catch (e) { return null; }
    })();

    if (metaEnv && metaEnv.VITE_FIREBASE_CONFIG) {
      return JSON.parse(metaEnv.VITE_FIREBASE_CONFIG);
    }
  } catch (e) {
    console.error("Error al procesar la configuración:", e);
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'budget-analytics-2025';

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

  useEffect(() => {
    // Verificación de configuración con delay para entornos de carga lenta
    if (!firebaseConfig || !auth) {
      const timer = setTimeout(() => {
        if (!auth) {
          setError("No se detectó la configuración de Firebase. Si usas GitHub Secrets, asegúrate de que el proceso de build inyecte la variable __firebase_config o use un prefijo compatible.");
          setLoading(false);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setError(`Error de Acceso: ${err.message}`);
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    // Ruta de colección siguiendo la REGLA 1
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          ramo: doc.data().DESC_RAMO || "Otros Ramos",
          aprobado: Number(doc.data().MONTO_APROBADO) || 0,
          pagado: Number(doc.data().MONTO_PAGADO) || 0,
        }));
        setData(items);
        setLoading(false);
      }, 
      (err) => {
        setError(`Error de base de datos: ${err.message}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
    const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
    const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(1) : "0.0";
    
    const grouped = data.reduce((acc, curr) => {
      const name = curr.ramo;
      if (!acc[name]) acc[name] = { name, aprobado: 0, pagado: 0 };
      acc[name].aprobado += curr.aprobado;
      acc[name].pagado += curr.pagado;
      return acc;
    }, {});

    const chartData = Object.values(grouped).sort((a, b) => b.aprobado - a.aprobado).slice(0, 7);
    return { totalApproved, totalPaid, executionRate, chartData };
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando con la Hacienda Pública...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-10">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 h-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Landmark className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none mb-1 uppercase">Analítica Fiscal</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Plataforma de Transparencia</p>
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
          <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[2.5rem] shadow-sm animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3 text-red-800 mb-3">
              <ShieldAlert size={22} />
              <h2 className="font-black text-sm uppercase tracking-widest">Error de Sincronización</h2>
            </div>
            <p className="text-sm text-red-700 mb-6 leading-relaxed">{error}</p>
            <div className="bg-white/40 p-4 rounded-2xl border border-red-100">
              <p className="text-[10px] font-black text-red-400 uppercase mb-2 tracking-widest">Estado del Entorno:</p>
              <ul className="text-[9px] font-mono space-y-1">
                <li className="flex justify-between">__firebase_config: <span className={typeof __firebase_config !== 'undefined' ? "text-green-600 font-bold" : "text-red-500"}>{typeof __firebase_config !== 'undefined' ? "LISTO" : "AUSENTE"}</span></li>
                <li className="flex justify-between">Servicio Auth: <span className={auth ? "text-green-600 font-bold" : "text-red-500"}>{auth ? "INICIALIZADO" : "PENDIENTE"}</span></li>
              </ul>
            </div>
          </div>
        )}

        {!error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MetricCard label="Presupuesto Aprobado" value={stats.totalApproved} icon={<TrendingUp size={20} />} trend="PGE 2025" />
              <MetricCard label="Gasto Pagado" value={stats.totalPaid} icon={<Wallet size={20} />} color="text-emerald-600" trend="Monto Ejercido" />
              <MetricCard label="Tasa de Ejecución" value={`${stats.executionRate}%`} icon={<PieIcon size={20} />} color="text-amber-600" isPercent />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartContainer title="Distribución por Ramos (Aprobado)">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={stats.chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold'}} />
                      <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title="Concentración de Gasto Pagado">
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie data={stats.chartData} dataKey="pagado" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4}>
                        {stats.chartData.map((_, i) => <Cell key={i} fill={['#1e40af', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#0891b2', '#db2777'][i % 7]} />)}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold'}} />
                      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: '800', paddingTop: '20px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ramo Administrativo</th>
                      <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobado</th>
                      <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagado</th>
                      <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Eficiencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-10 text-center text-slate-400 italic font-medium">No se han cargado registros aún.</td>
                      </tr>
                    ) : (
                      data.map(item => (
                        <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                          <td className="p-6">
                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter mb-0.5">{item.ur}</p>
                            <p className="text-sm font-bold text-slate-700">{item.ramo}</p>
                          </td>
                          <td className="p-6 text-right font-mono text-sm text-slate-400">
                            ${item.aprobado.toLocaleString('es-MX')}
                          </td>
                          <td className="p-6 text-right font-mono text-sm font-black text-slate-900">
                            ${item.pagado.toLocaleString('es-MX')}
                          </td>
                          <td className="p-6 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-white px-3 py-2 rounded-full border border-slate-200 text-[10px] font-black text-blue-700 shadow-sm">
                              {item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0}%
                              <ArrowUpRight size={10} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color = "text-slate-900", isPercent = false, trend }) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2.5 bg-blue-50 rounded-xl text-blue-700">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <h2 className={`text-2xl font-black tracking-tight ${color}`}>
      {!isPercent && "$"}
      {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
    </h2>
    {trend && <p className="mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{trend}</p>}
  </div>
);

const ChartContainer = ({ title, children }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-10">{title}</h3>
    {children}
  </div>
);

export default App;
