import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, Wallet, LayoutDashboard, Table as TableIcon, PieChart as PieIcon, AlertCircle, ArrowUpRight, ShieldAlert, Settings } from 'lucide-react';

/**
 * Función robusta para extraer la configuración de Firebase
 */
const getSafeConfig = () => {
  try {
    // Prioridad 1: Variable global inyectada por el editor (__firebase_config)
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
    
    // Prioridad 2: Variables de entorno de Vite/Process
    const env = typeof process !== 'undefined' ? process.env : {};
    if (env.VITE_FIREBASE_CONFIG) return JSON.parse(env.VITE_FIREBASE_CONFIG);

    // Prioridad 3: Intento de lectura de objeto global window
    if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;

  } catch (e) {
    console.error("Error interpretando JSON de configuración:", e);
  }
  return null;
};

const config = getSafeConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'budget-analytics-2025';

let db = null;
let auth = null;

if (config && config.apiKey) {
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
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
    if (!config || !auth) {
      const timeout = setTimeout(() => {
        if (!auth) {
          setError("Configuración de servicios no detectada.");
          setLoading(false);
        }
      }, 1500);
      return () => clearTimeout(timeout);
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setError(`Fallo de Autenticación: ${err.message}`);
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

    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ramo: doc.data().DESC_RAMO || "Otros Ramos",
          aprobado: Number(doc.data().MONTO_APROBADO) || 0,
          pagado: Number(doc.data().MONTO_PAGADO) || 0,
          ur: doc.data().DESC_UR || "N/A"
        }));
        setData(items);
        setLoading(false);
      }, 
      (err) => {
        setError(`Error de Firestore: ${err.message}`);
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
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Conectando con el servidor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-10 font-sans">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 h-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <Landmark size={20} />
          </div>
          <div>
            <h1 className="font-black text-lg uppercase leading-none tracking-tight">Analítica Fiscal</h1>
            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.2em]">Hacienda Pública 2025</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            RESUMEN
          </button>
          <button onClick={() => setView('table')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            DETALLE
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-8">
        {error && (
          <div className="mb-8 p-8 bg-white border border-red-100 rounded-[2.5rem] shadow-xl shadow-red-50/50 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 className="font-black text-sm uppercase tracking-widest text-red-800">Estado de Conexión</h2>
                <p className="text-xs text-red-600/80 font-medium">Se requiere configuración técnica para continuar.</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {error} <br/>
                Para solucionar esto, asegúrate de que el objeto <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-blue-600">FIREBASE_CONFIG</code> esté definido en los secretos de tu entorno.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Detección de Variables:</p>
                  <ul className="space-y-1.5">
                    <DebugItem label="__firebase_config" active={!!(typeof __firebase_config !== 'undefined' && __firebase_config)} />
                    <DebugItem label="VITE_FIREBASE_CONFIG" active={!!(typeof process !== 'undefined' && process.env?.VITE_FIREBASE_CONFIG)} />
                    <DebugItem label="Firebase Auth Service" active={!!auth} />
                  </ul>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-blue-800 mb-1">
                    <Settings size={14} className="animate-spin-slow" />
                    <p className="text-[10px] font-black uppercase tracking-wider">¿Cómo configurar?</p>
                  </div>
                  <p className="text-[10px] text-blue-700 font-medium leading-tight">
                    Agrega tus llaves de Firebase en la sección de Configuración/Secrets del editor o repositorio para activar la base de datos en tiempo real.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MetricCard label="Presupuesto Aprobado" value={stats.totalApproved} icon={<TrendingUp size={20} />} />
              <MetricCard label="Gasto Pagado" value={stats.totalPaid} icon={<Wallet size={20} />} color="text-emerald-600" />
              <MetricCard label="Avance Presupuestal" value={`${stats.executionRate}%`} icon={<PieIcon size={20} />} color="text-amber-600" isPercent />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartContainer title="Top Ramos por Inversión">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title="Distribución de Gasto Ejercido">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={stats.chartData} dataKey="pagado" innerRadius={60} outerRadius={85} paddingAngle={5}>
                        {stats.chartData.map((_, i) => <Cell key={i} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entidad Pública</th>
                      <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobado</th>
                      <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagado</th>
                      <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-12 text-center text-slate-400 italic text-sm">No hay datos disponibles en la colección seleccionada.</td>
                      </tr>
                    ) : (
                      data.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6">
                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter mb-0.5">{item.ur}</p>
                            <p className="text-sm font-bold text-slate-700">{item.ramo}</p>
                          </td>
                          <td className="p-6 text-right font-mono text-xs text-slate-400">${item.aprobado.toLocaleString('es-MX')}</td>
                          <td className="p-6 text-right font-mono text-sm font-black text-slate-900">${item.pagado.toLocaleString('es-MX')}</td>
                          <td className="p-6 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full text-[10px] font-black text-blue-600">
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

const MetricCard = ({ label, value, icon, color = "text-slate-900", isPercent = false }) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <h2 className={`text-2xl font-black tracking-tight ${color}`}>
      {!isPercent && "$"}
      {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
    </h2>
  </div>
);

const ChartContainer = ({ title, children }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10">{title}</h3>
    {children}
  </div>
);

const DebugItem = ({ label, active }) => (
  <li className="flex items-center justify-between text-[10px] font-mono">
    <span className="text-slate-500">{label}:</span>
    <span className={active ? "text-emerald-400 font-bold" : "text-red-400"}>
      {active ? "DETECTADO" : "PENDIENTE"}
    </span>
  </li>
);

export default App;
