import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, AlertCircle, LayoutDashboard, Table as TableIcon, Wallet, Database } from 'lucide-react';

/**
 * Función segura para obtener variables de entorno de Vite.
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

// Inicialización de Firebase
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

    const collectionName = "presupuesto_2025";
    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Mapeo directo asumiendo que ya no hay espacios al inicio de los nombres
      const items = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          DESC_RAMO: d.DESC_RAMO || "Sin Clasificar",
          aprobado: Number(d.MONTO_APROBADO) || 0,
          pagado: Number(d.MONTO_PAGADO) || 0
        };
      });
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error("Error Firestore:", err);
      setError(`Error de Firestore: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cálculos de totales
  const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
  const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
  const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(2) : 0;

  // Preparación de datos para gráficos (Agrupado por Ramo)
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
  }, []).sort((a, b) => b.aprobado - a.aprobado).slice(0, 5);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Sincronizando con Firestore...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error de Configuración</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-blue-100 text-center">
          <Database className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Sin datos disponibles</h2>
          <p className="text-gray-600 text-sm mb-6">La conexión fue exitosa, pero la colección 'presupuesto_2025' parece estar vacía.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 font-black text-xl tracking-tight">
            <Landmark className="text-blue-600" /> VISOR PRESUPUESTO 2025
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Dashboard</button>
            <button onClick={() => setView('table')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Datos</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Monto Aprobado</p>
            <p className="text-3xl font-black mt-1 text-gray-900">${totalApproved.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Monto Pagado</p>
            <p className="text-3xl font-black text-green-600 mt-1">${totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ejecución Total</p>
            <p className="text-3xl font-black text-blue-600 mt-1">{executionRate}%</p>
          </div>
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm min-h-[450px]">
              <h3 className="text-lg font-bold mb-8">Top 5 Ramos por Presupuesto</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm min-h-[450px]">
              <h3 className="text-lg font-bold mb-8">Distribución de Montos Pagados</h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={chartData} dataKey="pagado" innerRadius={70} outerRadius={90} paddingAngle={5}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '10px', border: 'none'}} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b text-[10px] font-black uppercase text-gray-400">
                <tr>
                  <th className="p-6">Ramo Presupuestario</th>
                  <th className="p-6 text-right">Aprobado</th>
                  <th className="p-6 text-right">Pagado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-6 text-sm font-bold text-gray-700">{item.DESC_RAMO}</td>
                    <td className="p-6 text-sm text-right font-mono">${item.aprobado.toLocaleString()}</td>
                    <td className="p-6 text-sm text-right font-mono text-green-600 font-bold">${item.pagado.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      
      <footer className="text-center py-12 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
        Sistema de Visualización de Datos Gubernamentales 2025
      </footer>
    </div>
  );
};

export default App;
