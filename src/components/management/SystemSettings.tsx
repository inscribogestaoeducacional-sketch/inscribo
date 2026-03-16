import React, { useState, useEffect, useRef } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe, Palette,
  MessageCircle, Key, Link, Wifi, WifiOff, RefreshCw, QrCode
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService } from '../../lib/supabase'

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
const DEFAULT_URL = 'https://evolution-api-production-a00c.up.railway.app'
const DEFAULT_KEY = '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

type ConnectionStatus = 'idle' | 'connected' | 'disconnected' | 'testing' | 'connecting' | 'waiting_qr'

const STATUS_CFG: Record<ConnectionStatus, { cls: string; dot: string; label: string }> = {
  idle:        { cls: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400',   label: 'Não verificado'      },
  connected:   { cls: 'bg-green-100 text-green-700', dot: 'bg-green-500',  label: '✅ WhatsApp Conectado!' },
  disconnected:{ cls: 'bg-red-100 text-red-700',     dot: 'bg-red-500',    label: 'Desconectado'        },
  testing:     { cls: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400',   label: 'Testando conexão...' },
  connecting:  { cls: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400',   label: 'Conectando...'       },
  waiting_qr:  { cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400',  label: 'Aguardando QR ●'     },
}

function WhatsAppTab() {
  const { user } = useAuth()
  const [fields, setFields] = useState({
    evolution_url: DEFAULT_URL,
    evolution_key: DEFAULT_KEY,
    evolution_instance: ''
  })
  const [loadingFields, setLoadingFields] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const checkState = async (url: string, key: string, instance: string) => {
    try {
      const res = await fetch(`${url}/instance/connectionState/${instance}`, { headers: { apikey: key } })
      if (!res.ok) return
      const data = await res.json()
      const state = data?.instance?.state || data?.state
      if (state === 'open') {
        setConnStatus('connected')
        setQrCode(null)
        stopPolling()
      }
    } catch { /* ignore */ }
  }

  const startPolling = (url: string, key: string, instance: string) => {
    stopPolling()
    pollRef.current = setInterval(() => checkState(url, key, instance), 3000)
  }

  useEffect(() => {
    const load = async () => {
      if (!user?.institution_id) return
      try {
        const inst = await DatabaseService.getInstitution(user.institution_id)
        if (inst) {
          const url = inst.evolution_url || DEFAULT_URL
          const key = inst.evolution_key || DEFAULT_KEY
          const instance = inst.evolution_instance || ''
          setFields({ evolution_url: url, evolution_key: key, evolution_instance: instance })
          if (instance && url && key) checkState(url.replace(/\/$/, ''), key, instance)
        }
      } catch (err) {
        console.error('Erro ao carregar config WhatsApp:', err)
      } finally {
        setLoadingFields(false)
      }
    }
    load()
    return () => stopPolling()
  }, [user])

  const handleSave = async () => {
    if (!user?.institution_id) return
    setSaving(true)
    try {
      await DatabaseService.updateInstitution(user.institution_id, {
        evolution_url: fields.evolution_url.trim(),
        evolution_key: fields.evolution_key.trim(),
        evolution_instance: fields.evolution_instance.trim()
      })
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    } catch (err) {
      console.error('Erro ao salvar:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!fields.evolution_url || !fields.evolution_key) {
      setTestMsg('Preencha a URL e a API Key antes de testar.')
      setConnStatus('disconnected')
      return
    }
    setConnStatus('testing')
    setTestMsg('')
    try {
      const url = fields.evolution_url.replace(/\/$/, '')
      const res = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: fields.evolution_key } })
      if (res.ok) {
        setConnStatus('connected')
        setTestMsg('Conexão bem-sucedida com a Evolution API.')
      } else {
        setConnStatus('disconnected')
        setTestMsg(`Falha: HTTP ${res.status}`)
      }
    } catch {
      setConnStatus('disconnected')
      setTestMsg('Não foi possível conectar. Verifique a URL.')
    }
  }

  const handleConnect = async () => {
    if (!fields.evolution_url || !fields.evolution_key || !fields.evolution_instance) {
      setTestMsg('Preencha e salve todos os campos antes de conectar.')
      setConnStatus('disconnected')
      return
    }
    setConnecting(true)
    setQrCode(null)
    stopPolling()
    const url = fields.evolution_url.replace(/\/$/, '')
    const { evolution_key: key, evolution_instance: instance } = fields
    try {
      const res = await fetch(`${url}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ instanceName: instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' })
      })
      const data = await res.json()
      const base64 = data?.qrcode?.base64 || data?.instance?.qrcode?.base64 || null
      if (data?.instance?.state === 'open') {
        setConnStatus('connected')
      } else if (base64) {
        setQrCode(base64)
        setConnStatus('waiting_qr')
        startPolling(url, key, instance)
      } else {
        // Instance may already exist — try to fetch its QR or connect
        const connectRes = await fetch(`${url}/instance/connect/${instance}`, { headers: { apikey: key } })
        if (connectRes.ok) {
          const cd = await connectRes.json()
          const qr = cd?.qrcode?.base64 || cd?.base64 || null
          if (qr) {
            setQrCode(qr)
            setConnStatus('waiting_qr')
            startPolling(url, key, instance)
          } else {
            await checkState(url, key, instance)
          }
        } else {
          setConnStatus('disconnected')
          setTestMsg('Erro ao criar instância. Verifique as configurações.')
        }
      }
    } catch (err) {
      console.error('Erro ao conectar WhatsApp:', err)
      setConnStatus('disconnected')
      setTestMsg('Erro ao conectar. Verifique a URL e a API Key.')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!fields.evolution_url || !fields.evolution_key || !fields.evolution_instance) return
    if (!confirm(`Desconectar a instância "${fields.evolution_instance}"?`)) return
    setDisconnecting(true)
    stopPolling()
    const url = fields.evolution_url.replace(/\/$/, '')
    try {
      await fetch(`${url}/instance/delete/${fields.evolution_instance}`, {
        method: 'DELETE',
        headers: { apikey: fields.evolution_key }
      })
      setConnStatus('disconnected')
      setQrCode(null)
    } catch (err) {
      console.error('Erro ao desconectar:', err)
    } finally {
      setDisconnecting(false)
    }
  }

  if (loadingFields) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#14b8a6] border-t-transparent" />
      </div>
    )
  }

  const statusInfo = STATUS_CFG[connStatus]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Left: Config fields */}
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <MessageCircle className="h-4 w-4 text-[#14b8a6]" />
            <h3 className="text-sm font-semibold text-gray-900">Configuração da Evolution API</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">URL da Evolution API</label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input type="url" value={fields.evolution_url}
                  onChange={(e) => setFields({ ...fields, evolution_url: e.target.value })}
                  className={inputCls + ' pl-9'} placeholder={DEFAULT_URL} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input type="password" value={fields.evolution_key}
                  onChange={(e) => setFields({ ...fields, evolution_key: e.target.value })}
                  className={inputCls + ' pl-9'} placeholder="••••••••••••••••" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Instância</label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input type="text" value={fields.evolution_instance}
                  onChange={(e) => setFields({ ...fields, evolution_instance: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  className={inputCls + ' pl-9'} placeholder="nome-da-escola" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Letras minúsculas, números e hífens. Ex: <code>colegio-inscribo</code></p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-100 flex-wrap">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e2d6b] hover:bg-[#151b4e] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : savedOk ? 'Salvo! ✓' : 'Salvar'}
            </button>
            <button onClick={handleTestConnection} disabled={connStatus === 'testing'}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${connStatus === 'testing' ? 'animate-spin' : ''}`} />
              Testar Conexão
            </button>
          </div>

          {/* Status badge */}
          {connStatus !== 'idle' && (
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${statusInfo.cls}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusInfo.dot} ${connStatus === 'waiting_qr' ? 'animate-pulse' : ''}`} />
              {statusInfo.label}
              {testMsg && <span className="font-normal ml-1 text-inherit">— {testMsg}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Right: QR Code + connect/disconnect */}
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Conectar WhatsApp</h3>
            </div>
            {/* Status pill */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.cls}`}>
              <span className={`w-2 h-2 rounded-full ${statusInfo.dot} ${connStatus === 'waiting_qr' ? 'animate-pulse' : ''}`} />
              {connStatus === 'connected' ? 'Conectado' : connStatus === 'waiting_qr' ? 'Aguardando QR' : 'Desconectado'}
            </span>
          </div>

          {/* QR Code area */}
          <div className="flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-56 mb-4">
            {connStatus === 'connected' ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Wifi className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-green-700">WhatsApp Conectado!</p>
                <p className="text-xs text-gray-400 mt-1">{fields.evolution_instance}</p>
              </div>
            ) : qrCode ? (
              <div className="text-center">
                <img
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="h-44 w-44 object-contain mx-auto"
                />
              </div>
            ) : (
              <div className="text-center px-4">
                <QrCode className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Preencha as configurações e clique em <strong>Conectar WhatsApp</strong> para gerar o QR Code
                </p>
              </div>
            )}
          </div>

          {/* Instruction when waiting QR */}
          {connStatus === 'waiting_qr' && qrCode && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">Escaneie o QR Code com seu WhatsApp</p>
              <p className="text-xs text-amber-600 mt-0.5">Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Verificando conexão automaticamente...
              </p>
            </div>
          )}

          {/* Connect / Disconnect buttons */}
          {connStatus !== 'connected' ? (
            <button onClick={handleConnect} disabled={connecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              <MessageCircle className="h-4 w-4" />
              {connecting ? 'Aguarde...' : 'Conectar WhatsApp'}
            </button>
          ) : (
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              <WifiOff className="h-4 w-4" />
              {disconnecting ? 'Desconectando...' : 'Desconectar'}
            </button>
          )}
        </div>
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
    <div className="p-6 bg-gray-50 min-h-screen">
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
