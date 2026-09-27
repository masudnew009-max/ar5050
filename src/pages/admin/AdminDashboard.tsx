import { useState } from 'react';
import { Percent, MapPin } from 'lucide-react';
import CommissionSettings from './CommissionSettings';
import DeliveryZones from './DeliveryZones';

type Tab = 'commission' | 'delivery';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('commission');

  const tabs: { id: Tab; label: string; icon: typeof Percent }[] = [
    { id: 'commission', label: 'Commission', icon: Percent },
    { id: 'delivery', label: 'Delivery Zones', icon: MapPin },
  ];

  return (
    <div className="text-white">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

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

      {tab === 'commission' && <CommissionSettings />}
      {tab === 'delivery' && <DeliveryZones />}
    </div>
  );
}
