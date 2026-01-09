import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, getDocs, limit } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, AlertCircle, LayoutDashboard, Table as TableIcon, Wallet, Database, Search, Info } from 'lucide-react';

const getEnv = (key) => {
  try {
    return import.meta.env[key] || "";
  } catch (e) {
    return "";
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: `${getEnv('VITE_FIREBASE_PROJECT_ID')}.firebaseapp.com`,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: `${getEnv('VITE_FIREBASE_PROJECT_ID')}.appspot.com`,
  messagingSenderId: "123456789",
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

let db;
try {
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Error al inicializar Firebase:", e);
}

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    if (!firebaseConfig.apiKey) {
      setError("Faltan los Secrets de GitHub (API Key).");
      setLoading(false);
      return;
    }

    if (!db) {
      setError("Error en la conexión con la base de datos.");
      setLoading(false);
      return;
    }

    // Nombre de la colección - Asegúrate que sea idéntico en la Consola
    const collectionName = "presupuesto_2025";
    const colRef = collection(db, collectionName);
    const q = query(colRef);

    console.log(`🔍 Iniciando escucha en la colección: "${collectionName}"...`);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        console.warn(`⚠️ La colección "${collectionName}" está vacía.`);
        setDebugInfo(`Consultando proyecto: ${firebaseConfig.projectId}. Colección: ${collectionName}`);
        setData([]);
        setLoading(false);
        return;
      }

      const items = snapshot.docs.map(doc => {
        const rawData = doc.data();
        
        // Buscador de campos flexible (Ignora espacios y mayúsculas)
        const findValue = (target) => {
          const key = Object.keys(rawData).find(k => k.trim().toUpperCase() === target.toUpperCase());
          return key ? rawData[key] : null;
        };

        return {
          id: doc.id,
          DESC_RAMO: findValue('DESC_RAMO') || "Sin Nombre",
          aprobado: Number(findValue('MONTO_APROBADO')) || 0,
          pagado: Number(findValue('MONTO_PAGADO')) || 0
        };
      });

      console.log("✅ Datos procesados correctamente:", items.length, "registros.");
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error("❌ Error de Firestore:", err);
      setError(`Error de Firestore: ${err.message}. Revisa las reglas de seguridad.`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
  const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
  const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(2) : 0;

  const chartData = data.reduce((acc, curr) => {
    const ramo = curr.DESC_RAMO;
    const existing = acc.find(item => item.name === ramo);
    if (existing) {
      existing.aprobado += curr.aprobado;
      existing.pagado += curr.pagado;
    } else {
      acc.push({ name: ramo, aprobado: curr.aprobado, pagado: curr.pagado });
    }
    return acc;
  }, []).sort((a, b) => b.aprobado - a.aprobado).slice(0, 8);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Nube...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-red-100 border border-red-50 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Error Crítico</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all transform active:scale-95 shadow-lg shadow-slate-200">
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 p-6">
        <div className="max-w-lg w-full bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-blue-100 border border-blue-50">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">Colección Vacía</h2>
          <p className="text-slate-500 text-sm mb-8 text-center leading-relaxed">
            Firebase devolvió una respuesta exitosa, pero no encontró documentos en <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-blue-600 font-bold">presupuesto_2025</span>.
          </p>
          
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-slate-600 leading-tight uppercase tracking-tight">Guía de solución rápida:</p>
            </div>
            <ul className="space-y-3">
              <li className="flex gap-3 text-xs text-slate-500 font-medium">
                <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-black border border-slate-200 shrink-0">1</span>
                Verifica que en Firestore el nombre sea <span className="font-bold text-slate-800">presupuesto_2025</span> (todo en minúsculas).
              </li>
              <li className="flex gap-3 text-xs text-slate-500 font-medium">
                <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-black border border-slate-200 shrink-0">2</span>
                Asegúrate de que el ID del proyecto en tus Secrets sea: <span className="font-bold text-slate-800">{firebaseConfig.projectId}</span>.
              </li>
              <li className="flex gap-3 text-xs text-slate-500 font-medium">
                <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-black border border-slate-200 shrink-0">3</span>
                Revisa que los documentos no estén dentro de una subcolección.
              </li>
            </ul>
          </div>
          <p className="text-[10px] text-center text-slate-300 font-bold uppercase tracking-widest">{debugInfo}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans">
      {/* Header Estilo Apple */}
      <nav className="bg-white/70 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100">
              <Landmark className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-xl leading-none tracking-tighter">FINANZAS PÚBLICAS</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Datos en Vivo 2025</p>
              </div>
            </div>
          </div>
          
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
            <button 
              onClick={() => setView('dashboard')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${view === 'dashboard' ? 'bg-white shadow-xl shadow-slate-200/50 text-blue-600 scale-105' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <LayoutDashboard size={14} /> PANEL
            </button>
            <button 
              onClick={() => setView('table')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${view === 'table' ? 'bg-white shadow-xl shadow-slate-200/50 text-blue-600 scale-105' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <TableIcon size={14} /> LISTADO
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Tarjetas de Métricas Superior */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {[
            { label: 'Presupuesto Inicial', value: totalApproved, color: 'text-slate-900', icon: <TrendingUp className="text-blue-600" /> },
            { label: 'Total Devengado', value: totalPaid, color: 'text-emerald-600', icon: <Wallet className="text-emerald-500" /> },
            { label: 'Avance Presupuestario', value: `${executionRate}%`, color: 'text-indigo-600', icon: <div className="text-indigo-600 font-black">%</div> }
          ].map((kpi, i) => (
            <div key={i} className="group bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">{kpi.icon}</div>
                <span className="text-[10px] font-black px-3 py-1 bg-slate-100 rounded-full text-slate-400">ANUAL</span>
              </div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{kpi.label}</p>
              <p className={`text-4xl font-black tracking-tighter ${kpi.color}`}>
                {typeof kpi.value === 'number' ? `$${kpi.value.toLocaleString()}` : kpi.value}
              </p>
            </div>
          ))}
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Gráfico de Barras - Top Ramos */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black mb-10 flex items-center gap-3">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                Top 8 Ramos Presupuestarios
              </h3>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)'}} />
                    <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 12, 12, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Torta - Distribución */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center">
              <h3 className="text-lg font-black mb-10 flex items-center justify-center gap-3">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                Cuota de Gasto Pagado
              </h3>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="pagado" cx="50%" cy="50%" innerRadius={90} outerRadius={125} paddingAngle={10}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{paddingTop: '30px', fontSize: '10px', fontWeight: 'bold'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
              <div className="flex items-center gap-3">
                <TableIcon className="text-blue-600" size={20} />
                <h3 className="font-black text-slate-900 text-lg tracking-tight">Detalle de Ejecución Fiscal</h3>
              </div>
              <span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-xl tracking-widest">{data.length} ENTIDADES</span>
            </div>
            <div className="overflow-x-auto px-6 pb-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="p-8">Ramo Presupuestario</th>
                    <th className="p-8 text-right">Aprobado</th>
                    <th className="p-8 text-right">Pagado</th>
                    <th className="p-8 text-center">Estado de Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map(item => {
                    const perc = item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="p-8 text-sm font-black text-slate-700">{item.DESC_RAMO}</td>
                        <td className="p-8 text-sm text-right font-mono font-bold text-slate-400">${item.aprobado.toLocaleString()}</td>
                        <td className="p-8 text-sm text-right font-mono font-black text-emerald-600 transition-all group-hover:scale-110 origin-right">${item.pagado.toLocaleString()}</td>
                        <td className="p-8 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(perc, 100)}%` }}></div>
                            </div>
                            <span className="text-[11px] font-black text-slate-900 w-10">{perc}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
        <p className="text-[10px] font-black tracking-[0.4em] uppercase">Gobierno Transparente &bull; Visor 2025</p>
        <div className="flex gap-8">
          <span className="text-[10px] font-black uppercase tracking-widest">Firestore v11.6</span>
          <span className="text-[10px] font-black uppercase tracking-widest">React v18.3</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
