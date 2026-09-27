import { useState } from 'react';
import { BarChart3, Package, Film } from 'lucide-react';
import SellerAnalytics from './SellerAnalytics';
import ProductUpload from './ProductUpload';
import ReelManagement from './ReelManagement';

type Tab = 'analytics' | 'products' | 'reels';

export default function SellerDashboard() {
  const [tab, setTab] = useState<Tab>('analytics');

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'products', label: 'My Products', icon: Package },
    { id: 'reels', label: 'Reels', icon: Film },
  ];

  return (
    <div className="text-white">
      <h1 className="text-2xl font-bold mb-6">Seller Dashboard</h1>

      <div className="flex gap-2 mb-6 border-b border-dark-700 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-dark-400 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <SellerAnalytics />}
      {tab === 'products' && <ProductUpload />}
      {tab === 'reels' && <ReelManagement />}
    </div>
  );
}
