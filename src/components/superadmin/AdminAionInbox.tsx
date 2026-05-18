import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import WhatsAppHub from '../whatsapp/WhatsAppHub'
import { Settings, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function AdminAionInbox() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('platform_whatsapp')
        .select('phone_number_id')
        .eq('connected', true)
        .maybeSingle()
      setIsConnected(!!data)
      setChecking(false)
    }
    check()
  }, [])

  if (checking) {
    return (
      <SuperAdminLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent" />
        </div>
      </SuperAdminLayout>
    )
  }

  if (!isConnected) {
    return (
      <SuperAdminLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F0FDFB' }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ width: 80, height: 80, background: '#E6F7F5', border: '2px solid #D1FAE5', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <MessageCircle style={{ width: 40, height: 40, color: '#00A896' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', marginBottom: 8 }}>WhatsApp Áion não configurado</h2>
            <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.6 }}>
              Configure o WhatsApp corporativo da Áion nas Configurações para acessar o inbox.
            </p>
            <button
              onClick={() => navigate('/super-admin/settings')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#00A896', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#007A6E')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00A896')}
            >
              <Settings style={{ width: 16, height: 16 }} />
              Ir para Configurações
            </button>
          </div>
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <WhatsAppHub isAionInbox={true} />
    </SuperAdminLayout>
  )
}
