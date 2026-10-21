import { useState } from 'react'
import { Link2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── "Vincular conta da Áion" (ficha da escola → WhatsApp, só admin_geral) ──
// O popup da Meta não deixa usar o portfólio da Áion ("This Meta Business
// Account owns the app"). Então a conta da escola nasce no WhatsApp Manager da
// Áion, o número entra por lá (coexistência, código pelo WhatsApp) e aqui só
// se cola o ID da conta (WABA). O servidor (api/_lib/whatsappConnect.ts)
// lista os números, exige dona = Áion, nunca troca a conta já salva, inscreve
// o webhook, pede o histórico e grava. Nunca chama /register.

interface WabaPhone {
  id: string
  display_phone_number: string | null
  verified_name: string | null
  status: string | null
  platform_type: string | null
  is_on_biz_app: boolean | null
}

interface LinkResult {
  waba_id: string
  phone_number_id: string
  phone_number: string
  display_name: string
  app_subscribed: boolean
  app_subscribed_erro: string | null
  historico: string
  meta?: { status?: string | null; platform_type?: string | null; is_on_biz_app?: boolean | null }
}

async function post(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sessão expirada — faça login novamente.')
  const res = await fetch('/api/whatsapp/embedded-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || `Erro ${res.status}`)
  return body
}

const platformLabel = (p: WabaPhone) =>
  p.is_on_biz_app ? 'coexistência (app no celular)' : (p.platform_type || 'plataforma desconhecida')

export default function LinkAionWabaPanel({ institutionId, savedWabaId, onLinked }: {
  institutionId: string
  savedWabaId: string | null
  onLinked: () => void
}) {
  const [wabaId, setWabaId] = useState(savedWabaId ?? '')
  const [phones, setPhones] = useState<WabaPhone[] | null>(null)
  const [owner, setOwner] = useState('')
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LinkResult | null>(null)

  const reset = () => { setPhones(null); setChosen(''); setError(''); setResult(null) }

  const listPhones = async () => {
    reset()
    setBusy(true)
    try {
      const r = await post({ action: 'vincular_listar', institution_id: institutionId, waba_id: wabaId.trim() })
      const list: WabaPhone[] = r.phones ?? []
      setPhones(list)
      setOwner(r.dona_nome ? `${r.dona_nome} (${r.dona})` : r.dona)
      if (list.length === 1) setChosen(list[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const link = async () => {
    if (!chosen) return
    setBusy(true)
    setError('')
    try {
      const r = await post({ action: 'vincular', institution_id: institutionId, waba_id: wabaId.trim(), phone_number_id: chosen })
      setResult(r as LinkResult)
      setPhones(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-cyan-900">Vincular conta da Áion</p>
        <p className="text-xs text-cyan-900/80 mt-1 leading-relaxed">
          Para conta criada no WhatsApp Manager da Áion, com o número já adicionado lá. Cole o ID da conta (WABA):
          a Áion confere que a dona é a Aion Solucoes Tecnologicas, liga o webhook e pede o histórico. O número continua no app do celular.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
          placeholder="ID da conta (WABA), ex.: 877913328502884"
          inputMode="numeric"
          value={wabaId}
          disabled={busy || (!!savedWabaId && !result)}
          onChange={e => { setWabaId(e.target.value.replace(/\D/g, '')); reset() }}
        />
        <button
          type="button"
          onClick={listPhones}
          disabled={busy || !wabaId.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-cyan-700 text-white hover:bg-cyan-800 disabled:opacity-50"
        >
          {busy && !phones ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Vincular conta da Áion
        </button>
      </div>
      {savedWabaId && (
        <p className="text-xs text-cyan-900/70">Esta escola já tem a conta {savedWabaId} salva; outra conta é recusada sem alterar nada.</p>
      )}

      {phones && (
        <div className="bg-white rounded-lg border border-cyan-100 p-3 space-y-2">
          <p className="text-xs text-gray-600">
            Conta {wabaId} · dona: <strong>{owner}</strong>. {phones.length > 1 ? 'Escolha o número:' : 'Número encontrado:'}
          </p>
          {phones.map(p => (
            <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="radio" name="waba-phone" className="mt-1" checked={chosen === p.id} onChange={() => setChosen(p.id)} />
              <span>
                <strong>{p.display_phone_number || p.id}</strong>{p.verified_name ? ` · ${p.verified_name}` : ''}
                <span className="block text-xs text-gray-500">id {p.id} · {p.status || 'status desconhecido'} · {platformLabel(p)}</span>
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={link}
            disabled={busy || !chosen}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar vínculo
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 text-xs font-semibold text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="bg-white rounded-lg border border-green-200 p-3 text-xs text-gray-700 space-y-1">
          <p className="text-sm font-bold text-green-700">Conta vinculada</p>
          <p>Conta (WABA): <strong>{result.waba_id}</strong></p>
          <p>Número: <strong>{result.phone_number || result.phone_number_id}</strong>{result.display_name ? ` · ${result.display_name}` : ''} (id {result.phone_number_id})</p>
          <p>Plataforma: {result.meta?.is_on_biz_app ? 'coexistência (app no celular)' : (result.meta?.platform_type || '—')}{result.meta?.status ? ` · ${result.meta.status}` : ''}</p>
          <p>Webhook: {result.app_subscribed
            ? <span className="text-green-700 font-semibold">inscrito</span>
            : <span className="text-red-700 font-semibold">não inscrito{result.app_subscribed_erro ? ` (${result.app_subscribed_erro})` : ''}</span>}</p>
          <p>Histórico: {result.historico}</p>
          <button type="button" onClick={onLinked} className="mt-1 text-cyan-700 font-semibold hover:underline">Atualizar a ficha</button>
        </div>
      )}
    </div>
  )
}
