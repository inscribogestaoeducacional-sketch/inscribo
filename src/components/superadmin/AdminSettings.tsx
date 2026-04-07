// src/components/superadmin/AdminSettings.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { Settings, Save, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'

function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all'

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={inputCls + ' pr-10'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [settings, setSettings] = useState({
    default_plan_value: '550',
    default_campaign_start_month: '8',
    zapsign_api_token: '',
    asaas_api_key: '',
    contract_template_url: '',
    whatsapp_aion: '',
  })

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((r: any) => { map[r.key] = r.value })
        setSettings(prev => ({ ...prev, ...map }))
      }
    } catch {
      // table may not exist yet — use defaults
    }
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const entries = Object.entries(settings).map(([key, value]) => ({ key, value }))
      const { error } = await supabase.from('platform_settings').upsert(entries, { onConflict: 'key' })
      if (error) throw error
      setToast('Configurações salvas com sucesso!')
    } catch {
      setToast('Erro ao salvar. Verifique se a tabela platform_settings existe.')
    } finally {
      setSaving(false)
      setTimeout(() => setToast(''), 3500)
    }
  }

  const months = [
    { v: '1', l: 'Janeiro' }, { v: '2', l: 'Fevereiro' }, { v: '3', l: 'Março' },
    { v: '4', l: 'Abril' }, { v: '5', l: 'Maio' }, { v: '6', l: 'Junho' },
    { v: '7', l: 'Julho' }, { v: '8', l: 'Agosto' }, { v: '9', l: 'Setembro' },
    { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
  ]

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6 max-w-2xl">

        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 ${
            toast.includes('Erro') ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}>
            {toast.includes('Erro') ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações globais</h1>
            <p className="text-gray-500 text-sm">Parâmetros da plataforma Áion Edu</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
          </div>
        ) : (
          <div className="space-y-6">

            {/* Financeiro */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-800 text-base">Financeiro</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Valor padrão do plano (R$)
                </label>
                <input
                  type="number"
                  className={inputCls}
                  value={settings.default_plan_value}
                  onChange={e => setSettings(s => ({ ...s, default_plan_value: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Valor sugerido ao criar um novo contrato.</p>
              </div>
            </div>

            {/* Campanha */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-800 text-base">Campanha de matrículas</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Mês padrão de início de campanha
                </label>
                <select
                  className={inputCls}
                  value={settings.default_campaign_start_month}
                  onChange={e => setSettings(s => ({ ...s, default_campaign_start_month: e.target.value }))}
                >
                  {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </div>
            </div>

            {/* ZapSign */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-800 text-base">ZapSign — Contratos</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Chave API ZapSign
                </label>
                <SecretInput
                  value={settings.zapsign_api_token}
                  onChange={v => setSettings(s => ({ ...s, zapsign_api_token: v }))}
                  placeholder="Bearer token da API ZapSign"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Obtida em <span className="font-medium">app.zapsign.com.br → API → Token</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  URL do template padrão de contrato (PDF)
                </label>
                <input
                  type="url"
                  className={inputCls}
                  value={settings.contract_template_url}
                  onChange={e => setSettings(s => ({ ...s, contract_template_url: e.target.value }))}
                  placeholder="https://..."
                />
                <p className="text-xs text-gray-400 mt-1">URL pública do PDF base que será enviado para assinatura.</p>
              </div>
            </div>

            {/* Asaas */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-base">Asaas — Cobranças automáticas</h2>
                <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">Opcional</span>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Chave API Asaas
                </label>
                <SecretInput
                  value={settings.asaas_api_key}
                  onChange={v => setSettings(s => ({ ...s, asaas_api_key: v }))}
                  placeholder="$aact_..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Obtida em <span className="font-medium">asaas.com → Integrações → Chaves API</span>
                </p>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-800 text-base">Contato da Áion Edu</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Número WhatsApp da Áion Edu
                </label>
                <input
                  type="tel"
                  className={inputCls}
                  value={settings.whatsapp_aion}
                  onChange={e => setSettings(s => ({ ...s, whatsapp_aion: e.target.value }))}
                  placeholder="5511999999999"
                />
                <p className="text-xs text-gray-400 mt-1">Formato: código do país + DDD + número (sem espaços ou traços).</p>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
              ) : (
                <><Save className="w-4 h-4" /> Salvar configurações</>
              )}
            </button>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
