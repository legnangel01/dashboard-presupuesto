import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, AlertCircle, LayoutDashboard, Table as TableIcon } from 'lucide-react';

/**
 * Solución al error de compilación:
 * En algunos entornos de despliegue, import.meta.env puede fallar si el target es es2015.
 * Usamos una validación segura para acceder a las variables de entorno de Vite.
 */
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

// Inicializamos Firebase con una verificación de seguridad
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.error("Error al inicializar Firebase:", e);
}

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    // Verificación de credenciales
    if (!firebaseConfig.apiKey) {
      setError("No se detectaron las credenciales de Firebase. Verifica los 'Secrets' en GitHub.");
      setLoading(false);
      return;
    }

    if (!db) {
      setError("Error crítico al inicializar la base de datos.");
      setLoading(false);
      return;
    }

    // Nombre de la colección exacto como está en tu Firebase
    const q = query(collection(db, "presupuesto_2025"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error("Error de Firestore:", err);
      setError("Error de permisos o conexión con Firestore.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cálculos de métricas
  const totalApproved = data.reduce((acc, curr) => acc + (Number(curr["MONTO_APROBADO"]) || 0), 0);
  const totalPaid = data.reduce((acc, curr) => acc + (Number(curr["MONTO_PAGADO"]) || 0), 0);
  const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(2) : 0;

  // Procesamiento para gráficos (Top 5 Ramos)
  const chartData = data.reduce((acc, curr) => {
    const ramo = curr.DESC_RAMO || "Otros";
    const existing = acc.find(item => item.name === ramo);
    if (existing) {
      existing.aprobado += (Number(curr["MONTO_APROBADO"]) || 0);
      existing.pagado += (Number(curr["MONTO_PAGADO"]) || 0);
    } else {
      acc.push({ 
        name: ramo, 
        aprobado: (Number(curr["MONTO_APROBADO"]) || 0), 
        pagado: (Number(curr["MONTO_PAGADO"]) || 0) 
      });
    }
    return acc;
  }, []).sort((a, b) => b.aprobado - a.aprobado).slice(0, 5);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Conectando con Firebase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error de Configuración</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-all">
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Landmark className="text-white w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tight">VISOR<span className="text-blue-600">2025</span></span>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('dashboard')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutDashboard size={16} /> Dashboard
            </button>
            <button 
              onClick={() => setView('table')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <TableIcon size={16} /> Datos
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Resumen de KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-full">TOTAL</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Monto Aprobado</p>
            <p className="text-3xl font-black text-gray-900 mt-1">${totalApproved.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Wallet size={20} /></div>
              <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded-full">PAGADO</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Monto Ejecutado</p>
            <p className="text-3xl font-black text-green-600 mt-1">${totalPaid.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><TrendingUp size={20} /></div>
              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-full">PORCENTAJE</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Tasa de Ejecución</p>
            <p className="text-3xl font-black text-blue-600 mt-1">{executionRate}%</p>
          </div>
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gráfico de Barras */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                Top 5 Ramos por Presupuesto
              </h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Pastel */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-green-600 rounded-full"></div>
                Distribución del Gasto Pagado
              </h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="pagado" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          /* Vista de Tabla */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Desglose Detallado</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-gray-400 text-[11px] font-black uppercase tracking-widest">
                    <th className="p-6">Descripción del Ramo</th>
                    <th className="p-6 text-right">Aprobado</th>
                    <th className="p-6 text-right">Pagado</th>
                    <th className="p-6 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-6 text-sm font-bold text-gray-700">{item.DESC_RAMO}</td>
                      <td className="p-6 text-sm text-right font-mono font-medium">${(Number(item["MONTO_APROBADO"]) || 0).toLocaleString()}</td>
                      <td className="p-6 text-sm text-right font-mono font-bold text-green-600">${(Number(item["MONTO_PAGADO"]) || 0).toLocaleString()}</td>
                      <td className="p-6 text-center">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${Number(item["MONTO_PAGADO"]) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {Number(item["MONTO_PAGADO"]) > 0 ? 'EJECUTADO' : 'PENDIENTE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      
      <footer className="max-w-7xl mx-auto px-6 py-10 text-center border-t border-gray-100 mt-10">
        <p className="text-gray-400 text-xs font-medium">Presupuesto General 2025 • Actualizado vía Firestore</p>
      </footer>
    </div>
  );
};

export default App;
