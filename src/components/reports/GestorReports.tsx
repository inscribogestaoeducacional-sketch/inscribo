import React, { useState } from 'react'
import {
  TrendingUp,
  Target,
  RefreshCw,
  UserX,
  Clock,
  CheckSquare,
  BarChart3
} from 'lucide-react'

const TABS = [
  { id: 'marketing', label: 'Marketing & CPA',      icon: TrendingUp  },
  { id: 'funnel',    label: 'Funil de Vendas',       icon: Target      },
  { id: 'reenroll',  label: 'Rematrículas',          icon: RefreshCw   },
  { id: 'churn',     label: 'Desistências',          icon: UserX       },
  { id: 'time',      label: 'Tempo Médio',           icon: Clock       },
  { id: 'actions',   label: 'Ações Estratégicas',    icon: CheckSquare },
]

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <BarChart3 className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-base font-semibold text-gray-500">{label}</p>
      <p className="text-sm mt-1">Dados em breve disponíveis</p>
    </div>
  )
}

export default function GestorReports() {
  const [activeTab, setActiveTab] = useState('marketing')

  return (
    <div className="p-6" style={{ background: 'var(--color-bg)', minHeight: '100%' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1e2d6b]">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Análises e métricas estratégicas</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/5'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          <EmptyTab label={TABS.find(t => t.id === activeTab)?.label ?? ''} />
        </div>
      </div>
    </div>
  )
}
