import React, { useState, useEffect } from 'react'
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
type ConnectionStatus = 'idle' | 'connected' | 'disconnected' | 'testing' | 'connecting'

function WhatsAppTab() {
  const { user } = useAuth()
  const [fields, setFields] = useState({
    evolution_url: '',
    evolution_key: '',
    evolution_instance: ''
  })
  const [loadingFields, setLoadingFields] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Load existing values
  useEffect(() => {
    const load = async () => {
      if (!user?.institution_id) return
      try {
        const inst = await DatabaseService.getInstitution(user.institution_id)
        if (inst) {
          setFields({
            evolution_url: inst.evolution_url || '',
            evolution_key: inst.evolution_key || '',
            evolution_instance: inst.evolution_instance || ''
          })
        }
      } catch (err) {
        console.error('Erro ao carregar config WhatsApp:', err)
      } finally {
        setLoadingFields(false)
      }
    }
    load()
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
      console.error('Erro ao salvar config WhatsApp:', err)
      alert('Erro ao salvar configurações.')
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
      const res = await fetch(`${url}/instance/fetchInstances`, {
        headers: { apikey: fields.evolution_key }
      })
      if (res.ok) {
        setConnStatus('connected')
        setTestMsg('Conexão bem-sucedida com a Evolution API.')
      } else {
        setConnStatus('disconnected')
        setTestMsg(`Falha na conexão: HTTP ${res.status}`)
      }
    } catch (err) {
      setConnStatus('disconnected')
      setTestMsg('Não foi possível conectar. Verifique a URL.')
    }
  }

  const handleConnect = async () => {
    if (!fields.evolution_url || !fields.evolution_key || !fields.evolution_instance) {
      alert('Salve as configurações antes de conectar.')
      return
    }
    setConnecting(true)
    setQrCode(null)
    try {
      const url = fields.evolution_url.replace(/\/$/, '')
      // Create instance (or connect if already exists)
      const res = await fetch(`${url}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: fields.evolution_key },
        body: JSON.stringify({ instanceName: fields.evolution_instance, qrcode: true })
      })
      const data = await res.json()
      const base64 = data?.qrcode?.base64 || data?.instance?.qrcode?.base64 || null
      if (base64) {
        setQrCode(base64)
        setConnStatus('disconnected')
      } else if (data?.instance?.state === 'open') {
        setConnStatus('connected')
      } else {
        setConnStatus('disconnected')
      }
    } catch (err) {
      console.error('Erro ao conectar WhatsApp:', err)
      alert('Erro ao conectar. Verifique as configurações.')
    } finally {
      setConnecting(false)
    }
  }

  if (loadingFields) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#14b8a6] border-t-transparent" />
      </div>
    )
  }

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
                <input
                  type="url"
                  value={fields.evolution_url}
                  onChange={(e) => setFields({ ...fields, evolution_url: e.target.value })}
                  className={inputCls + ' pl-9'}
                  placeholder="https://sua-api.evolutionapi.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="password"
                  value={fields.evolution_key}
                  onChange={(e) => setFields({ ...fields, evolution_key: e.target.value })}
                  className={inputCls + ' pl-9'}
                  placeholder="••••••••••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Instância</label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  value={fields.evolution_instance}
                  onChange={(e) => setFields({ ...fields, evolution_instance: e.target.value })}
                  className={inputCls + ' pl-9'}
                  placeholder="minha-escola"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e2d6b] hover:bg-[#151b4e] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : savedOk ? 'Salvo!' : 'Salvar'}
            </button>

            <button
              onClick={handleTestConnection}
              disabled={connStatus === 'testing'}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${connStatus === 'testing' ? 'animate-spin' : ''}`} />
              {connStatus === 'testing' ? 'Testando...' : 'Testar Conexão'}
            </button>
          </div>

          {/* Connection status badge */}
          {connStatus !== 'idle' && connStatus !== 'testing' && (
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
              connStatus === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {connStatus === 'connected'
                ? <Wifi className="h-4 w-4" />
                : <WifiOff className="h-4 w-4" />}
              {connStatus === 'connected' ? 'Conectado ●' : 'Desconectado ●'}
              {testMsg && <span className="font-normal ml-1">— {testMsg}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Right: QR Code + connect */}
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Conectar WhatsApp</h3>
            </div>

            {/* Status pill */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              connStatus === 'connected'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              {connStatus === 'connected' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          {/* QR Code area */}
          <div className="flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-56 mb-4">
            {qrCode ? (
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="h-48 w-48 object-contain"
              />
            ) : (
              <div className="text-center px-4">
                <QrCode className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Salve as configurações e clique em <strong>Conectar</strong> para gerar o QR Code
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {connecting ? 'Aguarde...' : 'Conectar WhatsApp'}
          </button>

          {qrCode && (
            <p className="text-xs text-gray-500 text-center mt-3">
              Abra o WhatsApp no celular → Dispositivos vinculados → Vincular dispositivo
            </p>
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
