// src/components/superadmin/AdminWhatsApp.tsx
// Financeiro > WhatsApp: painel de consumo de todas as escolas (sem valores em dinheiro).
import SuperAdminLayout from './SuperAdminLayout'
import UsageDashboard from './whatsapp/UsageDashboard'

export default function AdminWhatsApp() {
  return (
    <SuperAdminLayout>
      <div className="p-4 sm:p-8 space-y-6">
        <div className="aion-band">
          <h1 className="aion-band-title">WhatsApp</h1>
          <p className="aion-band-sub">Consumo geral e por escola</p>
        </div>
        <UsageDashboard />
      </div>
    </SuperAdminLayout>
  )
}
