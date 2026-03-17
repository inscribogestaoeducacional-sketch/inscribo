import React, { useState, useEffect, useRef } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe, Palette,
  MessageCircle, Wifi, WifiOff, RefreshCw, QrCode
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// ─── Shared input style ───────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none transition-all'

// ─── Tab: Geral ───────────────────────────────────────────────────────────────
function GeralTab() {
  const [settings, setSettings] = useState({
    name: '', email: '', phone: '', address: '', website: '',
    logo_url: '', primary_color: '#3B82F6', secondary_color: '#10B981'
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Erro ao salvar:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setSettings({ ...settings, logo_url: ev.target?.result as string })
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Institution info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Informações da Instituição</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Instituição</label>
                <input type="text" value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className={inputCls} placeholder="Nome da sua instituição" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="email" value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className={inputCls + ' pl-9'} placeholder="contato@escola.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="tel" value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className={inputCls + ' pl-9'} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Endereço</label>
                <input type="text" value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className={inputCls} placeholder="Endereço completo" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="url" value={settings.website}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    className={inputCls + ' pl-9'} placeholder="https://www.escola.com" />
                </div>
              </div>
            </div>
          </div>

          {/* Visual identity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Identidade Visual</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Cor Primária', key: 'primary_color' },
                { label: 'Cor Secundária', key: 'secondary_color' }
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={(settings as any)[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                      className="h-9 w-14 border border-gray-300 rounded cursor-pointer" />
                    <input type="text" value={(settings as any)[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                      className={inputCls + ' flex-1'} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading}
              className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                saved ? 'bg-green-600 text-white' : 'bg-[#1e2d6b] hover:bg-[#151b4e] text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
              <Save className="h-4 w-4" />
              {loading ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>

      {/* Logo Upload */}
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Logo da Instituição</h3>
          <div className="text-center">
            <div className="mb-4">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo"
                  className="mx-auto h-24 w-24 object-cover rounded-lg border border-gray-200" />
              ) : (
                <div className="mx-auto h-24 w-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              <Upload className="h-4 w-4" />
              Fazer Upload
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
            <p className="text-xs text-gray-400 mt-2">PNG, JPG até 2MB</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Preview</h3>
          <div className="p-3 rounded-lg" style={{ backgroundColor: settings.primary_color + '20' }}>
            <div className="flex items-center gap-3">
              {settings.logo_url
                ? <img src={settings.logo_url} alt="Logo" className="h-8 w-8 object-cover rounded" />
                : <div className="h-8 w-8 bg-gray-300 rounded" />}
              <div>
                <p className="text-sm font-medium" style={{ color: settings.primary_color }}>
                  {settings.name || 'Nome da Instituição'}
                </p>
                <p className="text-xs text-gray-500">Sistema Inscribo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: WhatsApp ────────────────────────────────────────────────────────────
const QR_TTL = 60

type ConnStatus = 'checking' | 'disconnected' | 'connecting' | 'waiting_qr' | 'connected'

function WhatsAppTab() {
  const { user } = useAuth()
  const instance = user?.institution_id ? `inst-${user.institution_id.slice(0, 8)}` : ''

  const [status, setStatus] = useState<ConnStatus>('checking')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(QR_TTL)
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null)
  const [connectedAt, setConnectedAt] = useState<Date | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [justConnected, setJustConnected] = useState(false)
  const [configuringWebhook, setConfiguringWebhook] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  const stopCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  const configureWebhook = async () => {
    setConfiguringWebhook(true)
    try {
      await fetch('/api/evolution/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: instance,
          webhookUrl: `https://www.meuinscribo.com.br/api/evolution/webhook?institution_id=${user?.institution_id}`,
        })
      })
    } catch { /* ignore */ } finally {
      setConfiguringWebhook(false)
    }
  }

  const onConnected = (phone?: string) => {
    stopPolling()
    stopCountdown()
    setQrCode(null)
    setConnectedPhone(phone ?? null)
    setConnectedAt(new Date())
    setJustConnected(true)
    setStatus('connected')
    setTimeout(() => setJustConnected(false), 3000)
    configureWebhook()
  }

  const checkState = async (): Promise<{ exists: boolean; connected: boolean; phone?: string }> => {
    try {
      console.log('[WA] checkState:', instance)
      const res = await fetch(`/api/evolution/connection-state?instanceName=${instance}`)
      console.log('[WA] connectionState HTTP', res.status)
      if (!res.ok) return { exists: false, connected: false }
      const data = await res.json()
      console.log('[WA] connectionState data:', JSON.stringify(data))
      const state = data?.instance?.state || data?.state
      const phone = data?.instance?.profileName || data?.instance?.wuid?.replace('@s.whatsapp.net', '') || undefined
      if (state === 'open') {
        onConnected(phone)
        return { exists: true, connected: true, phone }
      }
      // 404 / instance not found responses vary — treat missing state as non-existent
      const notFound = data?.error || data?.message?.toLowerCase?.().includes('not found') || data?.statusCode === 404
      return { exists: !notFound, connected: false }
    } catch (e) {
      console.error('[WA] checkState error:', e)
      return { exists: false, connected: false }
    }
  }

  const fetchQrCode = async (): Promise<string | null> => {
    try {
      console.log('[WA] fetchQrCode for:', instance)
      const res = await fetch(`/api/evolution/get-qrcode?instanceName=${instance}`)
      console.log('[WA] getQrcode HTTP', res.status)
      const data = await res.json()
      console.log('[WA] getQrcode data:', JSON.stringify(data))
      return data?.qrcode?.base64 || data?.base64 || null
    } catch (e) {
      console.error('[WA] fetchQrCode error:', e)
      return null
    }
  }

  const startPolling = () => {
    stopPolling()
    pollRef.current = setInterval(checkState, 3000)
  }

  const startCountdown = () => {
    stopCountdown()
    setCountdown(QR_TTL)
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          stopCountdown()
          stopPolling()
          setQrCode(null)
          setStatus('disconnected')
          return QR_TTL
        }
        return c - 1
      })
    }, 1000)
  }

  // Check state on mount
  useEffect(() => {
    if (!instance) return
    checkState().then(({ connected }) => {
      if (!connected) setStatus(s => s === 'checking' ? 'disconnected' : s)
    })
    return () => { stopPolling(); stopCountdown() }
  }, [instance])

  const handleConnect = async () => {
    if (!instance) return
    setStatus('connecting')
    setQrCode(null)
    stopPolling()

    try {
      // Step 1: check if instance already exists
      console.log('[WA] handleConnect — step 1: check existing state')
      const { exists, connected } = await checkState()
      if (connected) return // onConnected already called inside checkState

      if (exists) {
        // Step 2a: instance exists but disconnected — fetch QR directly
        console.log('[WA] instance exists, fetching QR')
        const qr = await fetchQrCode()
        if (qr) {
          setQrCode(qr)
          setStatus('waiting_qr')
          startPolling()
          startCountdown()
          return
        }
        // QR not available yet — fall through to create
        console.log('[WA] no QR from existing instance, recreating')
      }

      // Step 2b: instance doesn't exist (or QR unavailable) — create it
      console.log('[WA] creating instance')
      const res = await fetch('/api/evolution/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instance, institutionId: user?.institution_id })
      })
      const data = await res.json()
      console.log('[WA] create-instance response:', JSON.stringify(data))

      const base64 = data?.qrcode?.base64 || data?.instance?.qrcode?.base64 || null
      if (data?.instance?.state === 'open') {
        onConnected()
      } else if (base64) {
        setQrCode(base64)
        setStatus('waiting_qr')
        startPolling()
        startCountdown()
      } else {
        // Last resort: try fetching QR from connect endpoint
        console.log('[WA] no QR in create response, trying get-qrcode')
        const qr = await fetchQrCode()
        if (qr) {
          setQrCode(qr)
          setStatus('waiting_qr')
          startPolling()
          startCountdown()
        } else {
          setStatus('disconnected')
        }
      }
    } catch (e) {
      console.error('[WA] handleConnect error:', e)
      setStatus('disconnected')
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp desta escola?')) return
    setDisconnecting(true)
    stopPolling()
    stopCountdown()
    try {
      await fetch('/api/evolution/delete-instance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instance })
      })
      setStatus('disconnected')
      setQrCode(null)
      setConnectedPhone(null)
      setConnectedAt(null)
    } catch {
      /* ignore */
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Loading ──
  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#14b8a6] border-t-transparent" />
      </div>
    )
  }

  // ── Connected ──
  if (status === 'connected') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          {justConnected ? (
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wifi className="h-10 w-10 text-green-600" />
            </div>
          )}

          <h2 className="text-lg font-bold text-gray-900 mb-1">WhatsApp Conectado!</h2>

          {connectedPhone && (
            <p className="text-sm font-semibold text-[#14b8a6] mb-1">{connectedPhone}</p>
          )}

          {connectedAt && (
            <p className="text-xs text-gray-400 mb-6">
              Conectado em {connectedAt.toLocaleDateString('pt-BR')} às {connectedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}

          <div className="flex items-center gap-2 justify-center px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl mb-6">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-green-700">Online e recebendo mensagens</span>
          </div>

          <button onClick={configureWebhook} disabled={configuringWebhook}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 mb-3">
            <RefreshCw className={`h-4 w-4 ${configuringWebhook ? 'animate-spin' : ''}`} />
            {configuringWebhook ? 'Configurando...' : 'Reconfigurar Webhook'}
          </button>

          <button onClick={handleDisconnect} disabled={disconnecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
            <WifiOff className="h-4 w-4" />
            {disconnecting ? 'Desconectando...' : 'Desconectar WhatsApp'}
          </button>
        </div>
      </div>
    )
  }

  // ── Waiting QR ──
  if (status === 'waiting_qr' && qrCode) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <h2 className="text-base font-bold text-gray-900 mb-1">Escaneie o QR Code</h2>
          <p className="text-xs text-gray-500 mb-5">
            Abra o WhatsApp → <strong>Dispositivos Vinculados</strong> → <strong>Vincular dispositivo</strong> → Escaneie o QR Code
          </p>

          <div className="inline-block mb-3">
            <img
              src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Code WhatsApp"
              className="h-56 w-56 object-contain rounded-xl border-2 border-gray-100"
            />
          </div>

          <p className={`text-2xl font-bold tabular-nums mb-1 ${countdown <= 10 ? 'text-red-500' : 'text-amber-500'}`}>
            {countdown}s
          </p>
          <p className="text-xs text-gray-500 mb-3">QR Code expira em {countdown} segundos</p>

          <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Verificando conexão automaticamente...
          </div>
        </div>
      </div>
    )
  }

  // ── Disconnected / Connecting ──
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        {/* Phone illustration */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-[#14b8a6]/10 to-[#1e2d6b]/10 rounded-full flex items-center justify-center">
              <div className="w-14 h-14 bg-gradient-to-br from-[#14b8a6] to-[#1e2d6b] rounded-2xl flex items-center justify-center shadow-lg">
                <MessageCircle className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white border-2 border-gray-100 rounded-full flex items-center justify-center shadow-sm">
              <QrCode className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">Conecte seu WhatsApp</h2>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          Vincule o número da escola para começar a atender os pais e responsáveis diretamente pelo Inscribo.
        </p>

        <button
          onClick={handleConnect}
          disabled={status === 'connecting'}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:from-[#0d9488] hover:to-[#0f766e] disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          {status === 'connecting' ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Gerando QR Code...
            </>
          ) : (
            <>
              <span className="text-base">📱</span>
              Conectar WhatsApp
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── SystemSettings ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'geral', label: 'Geral', icon: Building },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('geral')

  return (
    <div className="p-6" style={{ background: 'var(--color-bg)', minHeight: '100%' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1e2d6b]">Configurações do Sistema</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie as configurações da instituição</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-[#1e2d6b] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'geral' && <GeralTab />}
      {activeTab === 'whatsapp' && <WhatsAppTab />}
    </div>
  )
}
