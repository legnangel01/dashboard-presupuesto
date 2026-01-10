import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
// Corregido el nombre del paquete de iconos de 'lucide-center' a 'lucide-react'
import { Landmark, TrendingUp, Wallet, PieChart as PieIcon, ShieldAlert, Key, ArrowUpRight, Activity } from 'lucide-react';

/**
 * Función para obtener la configuración de Firebase de forma extremadamente segura.
 * Intenta múltiples fuentes para asegurar la compatibilidad con Canvas y GitHub.
 */
const getFirebaseConfig = () => {
  try {
    // 1. Intentar desde las variables globales del entorno de previsualización (Prioridad en Canvas)
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }

    // 2. Intentar desde las variables de entorno de Vite (Prioridad en GitHub Pages)
    const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) 
      ? import.meta.env.VITE_FIREBASE_CONFIG 
      : null;

    if (viteEnv) {
      return typeof viteEnv === 'string' ? JSON.parse(viteEnv) : viteEnv;
    }
  } catch (error) {
    console.error("Error al detectar la configuración de Firebase:", error);
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dashboard-presupuesto-2025';

// Inicialización diferida
let db = null;
let auth = null;

if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.error("Error al inicializar Firebase:", e);
  }
}

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!firebaseConfig || !auth) {
      const timer = setTimeout(() => {
        if (!auth) {
          setError("Configuración no detectada. Revisa los Secrets de GitHub o la base de datos.");
          setLoading(false);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    const performAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setError(`Fallo de autenticación: ${err.message}`);
        setLoading(false);
      }
    };

    performAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(collectionPath, 
      (snapshot) => {
        const result = snapshot.docs.map(doc => ({
          id: doc.id,
          ramo: doc.data().DESC_RAMO || "Sin clasificar",
          aprobado: Number(doc.data().MONTO_APROBADO) || 0,
          pagado: Number(doc.data().MONTO_PAGADO) || 0,
          ur: doc.data().DESC_UR || "N/A"
        }));
        setData(result);
        setLoading(false);
      }, 
      (err) => {
        console.error("Firestore Error:", err);
        setError(`Error de base de datos: ${err.message}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const analytics = useMemo(() => {
    const totalAprobado = data.reduce((acc, curr) => acc + curr.aprobado, 0);
    const totalPagado = data.reduce((acc, curr) => acc + curr.pagado, 0);
    const porcentaje = totalAprobado > 0 ? ((totalPagado / totalAprobado) * 100).toFixed(1) : "0.0";
    
    const agrupado = data.reduce((acc, curr) => {
      const clave = curr.ramo;
      if (!acc[clave]) acc[clave] = { name: clave, aprobado: 0, pagado: 0 };
      acc[clave].aprobado += curr.aprobado;
      acc[clave].pagado += curr.pagado;
      return acc;
    }, {});

    const topRamos = Object.values(agrupado).sort((a, b) => b.aprobado - a.aprobado).slice(0, 8);
    return { totalAprobado, totalPagado, porcentaje, topRamos };
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Iniciando Protocolos Fiscales...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-12 font-sans">
      <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 px-8 h-20 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="font-black text-xl uppercase leading-none tracking-tight">Analítica Fiscal</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mt-1">Presupuesto Público 2025</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button onClick={() => setView('dashboard')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            DASHBOARD
          </button>
          <button onClick={() => setView('table')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${view === 'table' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            EXPLORADOR
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 pt-10">
        {error ? (
          <div className="bg-white border border-slate-200 rounded-[3rem] p-12 text-center shadow-xl">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Estado: Fuera de Línea</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">{error}</p>
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 inline-block text-left">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Key size={14} /> Auditoría de Conectividad
              </h3>
              <ul className="space-y-3 text-xs font-mono text-slate-500">
                <li className="flex justify-between gap-12">
                  <span>Configuración Detectada:</span> 
                  <span className={firebaseConfig ? "text-emerald-500 font-bold" : "text-red-400"}>
                    {firebaseConfig ? "SÍ" : "NO"}
                  </span>
                </li>
                <li className="flex justify-between gap-12">
                  <span>Autenticación (Auth):</span> 
                  <span className={auth ? "text-emerald-500 font-bold" : "text-red-400"}>
                    {auth ? "ACTIVA" : "FALLIDA"}
                  </span>
                </li>
                <li className="flex justify-between gap-12">
                  <span>Sesión de Usuario:</span> 
                  <span className={user ? "text-emerald-500 font-bold" : "text-red-400"}>
                    {user ? "ESTABLECIDA" : "PENDIENTE"}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <MetricCard label="Monto Aprobado" value={analytics.totalAprobado} icon={<TrendingUp size={20} />} />
              <MetricCard label="Monto Pagado" value={analytics.totalPagado} icon={<Wallet size={20} />} color="text-emerald-600" />
              <MetricCard label="Avance Presupuestal" value={`${analytics.porcentaje}%`} icon={<Activity size={20} />} color="text-amber-600" isPercent />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <ChartBox title="Presupuesto por Ramo Administrativo">
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={analytics.topRamos} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={110} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>

                <ChartBox title="Distribución de Gasto Realizado">
                  <ResponsiveContainer width="100%" height={380}>
                    <PieChart>
                      <Pie data={analytics.topRamos} dataKey="pagado" innerRadius={80} outerRadius={110} paddingAngle={8}>
                        {analytics.topRamos.map((_, i) => <Cell key={i} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />)}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', paddingTop: '20px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>
            ) : (
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden mb-10">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad / Ramo Administrativo</th>
                      <th className="p-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Aprobado</th>
                      <th className="p-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Pagado</th>
                      <th className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.length > 0 ? data.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-8">
                          <p className="text-[10px] font-black text-blue-500 mb-1 uppercase tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity">{item.ur}</p>
                          <p className="text-sm font-black text-slate-700">{item.ramo}</p>
                        </td>
                        <td className="p-8 text-right font-mono text-xs text-slate-400 tracking-tighter">${item.aprobado.toLocaleString('es-MX')}</td>
                        <td className="p-8 text-right font-mono text-sm font-black text-slate-900 tracking-tighter">${item.pagado.toLocaleString('es-MX')}</td>
                        <td className="p-8 text-center">
                          <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl text-[11px] font-black text-blue-600 border border-blue-100 shadow-sm">
                            {item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0}%
                            <ArrowUpRight size={12} strokeWidth={3} />
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="p-20 text-center text-slate-400 font-bold italic uppercase tracking-widest opacity-50">Esperando sincronización de datos...</td>
                      </tr>
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
  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-400 transition-all group overflow-hidden relative">
    <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full group-hover:bg-blue-50 transition-colors"></div>
    <div className="relative z-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">{icon}</div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <h2 className={`text-4xl font-black tracking-tight ${color}`}>
        {!isPercent && "$"}
        {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
      </h2>
    </div>
  </div>
);

const ChartBox = ({ title, children }) => (
  <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12 flex items-center gap-3">
      <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse shadow-lg shadow-blue-200"></div>
      {title}
    </h3>
    {children}
  </div>
);

export default App;
