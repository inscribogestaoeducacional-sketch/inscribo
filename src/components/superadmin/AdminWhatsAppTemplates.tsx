// src/components/superadmin/AdminWhatsAppTemplates.tsx
//
// "Templates Automáticos" — cadastra um template de WhatsApp UMA vez e
// submete pra aprovação em todas as escolas de uma vez via API da Meta, em
// vez do fluxo manual existente (AdminSchools.tsx/InstitutionDetails.tsx →
// aba "Templates", um WABA de cada vez). A submissão de verdade pra Meta
// roda no servidor (api/whatsapp/template-definitions.ts) — esta tela só
// cadastra a definição e lê o status já sincronizado no banco.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'
import {
  MessageSquare, Plus, X, Search, RefreshCw, Send,
  CheckCircle2, Clock, XCircle, MinusCircle, Link as LinkIcon,
} from 'lucide-react'

interface TemplateDefinition {
  id: string
  name: string
  category: 'UTILITY' | 'MARKETING'
  language: string
  body_text: string
  variable_examples: Record<string, string> | null
  variable_labels: Record<string, string> | null
  button_config: { type?: string; text?: string; url_base?: string } | null
  created_at: string
}

// Rótulos padrão pra templates conhecidos — pré-preenche o campo de rótulo
// quando o nome técnico digitado bate com um desses, sem travar o super
// admin de ajustar antes de salvar. contato_assunto_escola: template do
// formulário de contato do site da escola (nome do responsável, assunto e
// mensagem livre) — item 4 do pedido de rótulos legíveis.
const KNOWN_TEMPLATE_LABEL_PRESETS: Record<string, Record<string, string>> = {
  contato_assunto_escola: { '1': 'Nome do responsável', '2': 'Assunto', '3': 'Mensagem' },
}

interface EligibleInstitution {
  institution_id: string
  institution_name: string
}

type StatusValue = 'not_submitted' | 'pending' | 'approved' | 'rejected'

interface StatusRow {
  template_definition_id: string
  institution_id: string
  status: StatusValue
  error_message: string | null
}

const STATUS_META: Record<StatusValue, { label: string; cls: string; icon: any }> = {
  not_submitted: { label: 'Não enviado', cls: 'bg-gray-100 text-gray-500',   icon: MinusCircle },
  pending:       { label: 'Em análise',  cls: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved:      { label: 'Aprovado',    cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected:      { label: 'Rejeitado',   cls: 'bg-red-100 text-red-700',     icon: XCircle },
}

const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'
const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none'

function slugify(raw: string): string {
  return raw
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function extractVarNumbers(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]))].sort((a, b) => Number(a) - Number(b))
}

export default function AdminWhatsAppTemplates() {
  const { user } = useAuth()

  const [templates, setTemplates]         = useState<TemplateDefinition[]>([])
  const [institutions, setInstitutions]   = useState<EligibleInstitution[]>([])
  const [statusRows, setStatusRows]       = useState<StatusRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [refreshingStatus, setRefreshingStatus] = useState(false)
  const [retrying, setRetrying]           = useState<string | null>(null) // `${tplId}:${instId}`
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null)

  const [showNew, setShowNew]             = useState(false)
  const [saving, setSaving]               = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'UTILITY' as 'UTILITY' | 'MARKETING', bodyText: '',
    examples: {} as Record<string, string>,
    labels: {} as Record<string, string>,
    hasButton: false, buttonText: '', buttonUrlBase: '', buttonExample: '',
  })

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [defsRes, phonesRes, statusRes] = await Promise.all([
        supabase.from('template_definitions').select('*').order('created_at', { ascending: false }),
        // Mesma fonte de verdade usada pelo endpoint server-side e por
        // AdminSchools.tsx/InstitutionDetails.tsx — institutions.
        // whatsapp_business_id nunca é lido em nenhum outro lugar do projeto.
        supabase.from('whatsapp_phone_numbers')
          .select('institution_id, institutions(id, name)')
          .eq('is_active', true).not('waba_id', 'is', null),
        supabase.from('template_institution_status')
          .select('template_definition_id, institution_id, status, error_message'),
      ])
      if (defsRes.error) throw defsRes.error
      setTemplates((defsRes.data || []) as TemplateDefinition[])

      const insts: EligibleInstitution[] = (phonesRes.data || [])
        .map((r: any) => ({ institution_id: r.institution_id, institution_name: r.institutions?.name || r.institution_id }))
        .sort((a, b) => a.institution_name.localeCompare(b.institution_name))
      setInstitutions(insts)

      setStatusRows((statusRes.data || []) as StatusRow[])
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar dados.', false)
    } finally {
      setLoading(false)
    }
  }

  const statusMap = useMemo(() => {
    const map = new Map<string, StatusRow>()
    for (const row of statusRows) map.set(`${row.template_definition_id}:${row.institution_id}`, row)
    return map
  }, [statusRows])

  const filteredInstitutions = institutions.filter(i =>
    !search || i.institution_name.toLowerCase().includes(search.toLowerCase())
  )

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Sessão expirada — faça login novamente.')
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
  }

  // ── Form: variáveis detectadas no corpo, na ordem em que aparecem ──
  const bodyVarNumbers = extractVarNumbers(form.bodyText)

  const resetForm = () => setForm({
    name: '', category: 'UTILITY', bodyText: '', examples: {}, labels: {},
    hasButton: false, buttonText: '', buttonUrlBase: '', buttonExample: '',
  })

  const handleCreate = async () => {
    const name = slugify(form.name)
    if (!name) { showToast('Informe um nome válido.', false); return }
    if (!form.bodyText.trim()) { showToast('Informe o texto do corpo.', false); return }
    if (bodyVarNumbers.some(n => !form.examples[n]?.trim())) {
      showToast('Preencha o exemplo de todas as variáveis do corpo.', false); return
    }
    if (form.hasButton && (!form.buttonUrlBase.trim() || !form.buttonText.trim() || !form.buttonExample.trim())) {
      showToast('Preencha texto, URL base e exemplo do botão.', false); return
    }

    setSaving(true)
    try {
      const variable_examples: Record<string, string> = { ...form.examples }
      if (form.hasButton) variable_examples.button = form.buttonExample.trim()

      // Só grava rótulos das variáveis que existem no corpo e foram
      // preenchidas — sem lixo de rótulo órfão se o admin editar o corpo
      // depois de já ter digitado algo no campo de rótulo de uma variável
      // que não existe mais.
      const variable_labels: Record<string, string> = {}
      for (const n of bodyVarNumbers) {
        if (form.labels[n]?.trim()) variable_labels[n] = form.labels[n].trim()
      }

      const { data: inserted, error: insErr } = await supabase
        .from('template_definitions')
        .insert({
          name,
          category:          form.category,
          language:          'pt_BR',
          body_text:         form.bodyText.trim(),
          variable_examples,
          variable_labels,
          button_config:     form.hasButton
            ? { type: 'URL', text: form.buttonText.trim(), url_base: form.buttonUrlBase.trim() }
            : null,
          created_by: user?.id || null,
        })
        .select('id').single()
      if (insErr) throw insErr

      showToast('Template cadastrado! Submetendo para todas as escolas...', true)
      setShowNew(false)
      resetForm()
      await loadAll()

      const headers = await authHeaders()
      const res = await fetch('/api/whatsapp/template-definitions', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'submit', template_definition_ids: [inserted.id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao submeter template')

      const results: any[] = data.results || []
      const failed = results.filter(r => r.status === 'rejected').length
      showToast(
        results.length === 0
          ? 'Template cadastrado, mas nenhuma escola com WhatsApp conectado foi encontrada.'
          : failed > 0
            ? `Submetido pra ${results.length} escola(s), ${failed} com erro.`
            : `Submetido com sucesso pra ${results.length} escola(s)!`,
        failed === 0
      )
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao cadastrar template.', false)
    } finally {
      setSaving(false)
    }
  }

  const handleRefreshStatus = async () => {
    setRefreshingStatus(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/whatsapp/template-definitions', {
        method: 'POST', headers, body: JSON.stringify({ action: 'check-status' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar status')
      showToast(`${data.updated || 0} status atualizado(s).`)
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao atualizar status.', false)
    } finally {
      setRefreshingStatus(false)
    }
  }

  const handleRetry = async (templateDefinitionId: string, institutionId: string) => {
    const key = `${templateDefinitionId}:${institutionId}`
    setRetrying(key)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/whatsapp/template-definitions', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'submit', template_definition_ids: [templateDefinitionId], institution_ids: [institutionId] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao reenviar')
      const result = data.results?.[0]
      showToast(result?.status === 'rejected' ? `Falhou: ${result.error_message}` : 'Reenviado!', result?.status !== 'rejected')
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao reenviar.', false)
    } finally {
      setRetrying(null)
    }
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Templates Automáticos</h1>
            <p className="text-sm text-gray-500 mt-1">Cadastre um template uma vez e submeta pra todas as escolas via API da Meta</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefreshStatus} disabled={refreshingStatus}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${refreshingStatus ? 'animate-spin' : ''}`} /> Atualizar status
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Novo Template
            </button>
          </div>
        </div>

        {toast && (
          <div className={`rounded-xl border p-3 text-sm font-medium ${toast.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {toast.msg}
          </div>
        )}

        {/* Lista de templates cadastrados */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Templates cadastrados ({templates.length})</p>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhum template cadastrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="border border-gray-100 rounded-xl p-3.5 bg-gray-50 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-gray-800">{t.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{t.category}</span>
                      {t.button_config && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> botão URL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{t.body_text}</p>
                    {t.variable_labels && Object.keys(t.variable_labels).length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Rótulos: {Object.entries(t.variable_labels).map(([n, l]) => `{{${n}}} = ${l}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grid de status por escola */}
        {templates.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm font-semibold text-gray-700">Status de aprovação por escola</p>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                  placeholder="Buscar escola..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50">Escola</th>
                    {templates.map(t => (
                      <th key={t.id} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {institutions.length === 0 ? (
                    <tr><td colSpan={templates.length + 1} className="px-5 py-10 text-center text-sm text-gray-400">
                      Nenhuma escola com WhatsApp conectado (WABA) encontrada.
                    </td></tr>
                  ) : filteredInstitutions.length === 0 ? (
                    <tr><td colSpan={templates.length + 1} className="px-5 py-10 text-center text-sm text-gray-400">Nenhuma escola encontrada.</td></tr>
                  ) : filteredInstitutions.map(inst => (
                    <tr key={inst.institution_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap sticky left-0 bg-white">
                        {inst.institution_name}
                      </td>
                      {templates.map(t => {
                        const row = statusMap.get(`${t.id}:${inst.institution_id}`)
                        const status = row?.status || 'not_submitted'
                        const meta = STATUS_META[status]
                        const Icon = meta.icon
                        const key = `${t.id}:${inst.institution_id}`
                        const canRetry = status === 'rejected' || status === 'not_submitted'
                        return (
                          <td key={t.id} className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}
                                title={row?.error_message || ''}>
                                <Icon className="w-3 h-3" /> {meta.label}
                              </span>
                              {canRetry && (
                                <button onClick={() => handleRetry(t.id, inst.institution_id)} disabled={retrying === key}
                                  title="Reenviar" className="p-1 text-gray-400 hover:text-cyan-600 disabled:opacity-50">
                                  {retrying === key
                                    ? <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                    : <Send className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: novo template */}
        {showNew && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Novo Template Automático</h2>
                <button onClick={() => { setShowNew(false); resetForm() }}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={lbl}>Nome técnico (usado na Meta)</label>
                  <input className={`${inp} font-mono`} placeholder="ex: boas_vindas_2026" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onBlur={e => {
                      const slug = slugify(e.target.value)
                      const preset = KNOWN_TEMPLATE_LABEL_PRESETS[slug]
                      setForm(f => ({
                        ...f, name: slug,
                        // Só aplica o preset se o admin ainda não tiver digitado
                        // nenhum rótulo — nunca sobrescreve o que já foi editado.
                        labels: preset && Object.keys(f.labels).length === 0 ? preset : f.labels,
                      }))
                    }} />
                  {form.name && <p className="text-[11px] text-gray-400 mt-1">Será salvo como: <span className="font-mono">{slugify(form.name)}</span></p>}
                </div>

                <div>
                  <label className={lbl}>Categoria</label>
                  <div className="flex gap-2">
                    {(['UTILITY', 'MARKETING'] as const).map(c => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, category: c }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 ${form.category === c ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-500'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={lbl}>Texto do corpo</label>
                  <textarea className={inp} rows={4} placeholder="Olá, {{1}}! Sua mensalidade de {{2}} está disponível."
                    value={form.bodyText} onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))} />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Use <span className="font-mono">{'{{1}}'}</span>, <span className="font-mono">{'{{2}}'}</span>... pra marcar onde entram as variáveis.
                  </p>
                </div>

                {bodyVarNumbers.length > 0 && (
                  <div className="space-y-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <div>
                      <p className={lbl}>Exemplo de cada variável (a Meta exige pra aprovar)</p>
                      <div className="space-y-2">
                        {bodyVarNumbers.map(n => (
                          <div key={n} className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500 w-10">{`{{${n}}}`}</span>
                            <input className={inp} placeholder={`Exemplo pra {{${n}}}`} value={form.examples[n] || ''}
                              onChange={e => setForm(f => ({ ...f, examples: { ...f.examples, [n]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className={lbl}>Rótulo de cada variável (opcional — mostrado no lugar de "Variável N" em toda tela que preenche esse template pra enviar)</p>
                      <div className="space-y-2">
                        {bodyVarNumbers.map(n => (
                          <div key={n} className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500 w-10">{`{{${n}}}`}</span>
                            <input className={inp} placeholder={`Ex: Nome do responsável`} value={form.labels[n] || ''}
                              onChange={e => setForm(f => ({ ...f, labels: { ...f.labels, [n]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="border border-gray-100 rounded-xl p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.hasButton}
                      onChange={e => setForm(f => ({ ...f, hasButton: e.target.checked }))} />
                    Adicionar botão de URL dinâmica
                  </label>
                  {form.hasButton && (
                    <div className="mt-3 space-y-2">
                      <input className={inp} placeholder="Texto do botão (ex: Pagar agora)" value={form.buttonText}
                        onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))} />
                      <input className={inp} placeholder="URL base (ex: https://www.aionedu.com.br/pagar/)" value={form.buttonUrlBase}
                        onChange={e => setForm(f => ({ ...f, buttonUrlBase: e.target.value }))} />
                      <input className={inp} placeholder="Exemplo do trecho final (ex: ABC123)" value={form.buttonExample}
                        onChange={e => setForm(f => ({ ...f, buttonExample: e.target.value }))} />
                      <p className="text-[11px] text-gray-400">
                        No envio, só o trecho final (código) é enviado — a Meta concatena com a URL base aprovada. Máx. 1 variável dinâmica por botão.
                      </p>
                    </div>
                  )}
                </div>

                {form.bodyText && (
                  <div>
                    <label className={lbl}>Preview</label>
                    <div className="bg-[#DCF8C6] rounded-xl px-4 py-3 text-sm text-gray-800 border border-green-200 whitespace-pre-wrap">
                      {form.bodyText}
                      {form.hasButton && form.buttonText && (
                        <div className="mt-2 pt-2 border-t border-green-300 text-center text-cyan-700 font-semibold text-xs">{form.buttonText}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowNew(false); resetForm() }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleCreate} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                  Salvar e submeter pra todas as escolas
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </SuperAdminLayout>
  )
}
