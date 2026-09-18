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
import { type TemplateContext } from '../../lib/templateVariableLabels'
import {
  MessageSquare, Plus, X, Search, RefreshCw, Send,
  CheckCircle2, Clock, XCircle, MinusCircle, Link as LinkIcon, Eye, EyeOff, Building2,
  Users, ChevronUp, ChevronDown,
} from 'lucide-react'

interface TemplateDefinition {
  id: string
  name: string
  display_name: string | null
  category: 'UTILITY' | 'MARKETING'
  language: string
  body_text: string
  variable_examples: Record<string, string> | null
  variable_labels: Record<string, string> | null
  available_contexts: TemplateContext[] | null
  button_config: { type?: string; text?: string; url_base?: string } | null
  scope: 'all' | 'specific'
  created_at: string
}

interface TemplateVariant {
  body_text: string
  category: 'UTILITY' | 'MARKETING'
  approved_institution_ids: string[]
  approved_institution_names: string[]
  template_definition_id: string | null
  display_name: string | null
}

interface TemplateGroup {
  name: string
  language: string
  variants: TemplateVariant[]
}

// Rótulos amigáveis dos 4 contextos onde um template pode ser escolhido
// manualmente (available_contexts) — mesmos valores usados pra filtrar os
// pickers em WhatsAppHub.tsx, AionInboxHub.tsx e AdminAionInbox.tsx.
const CONTEXT_OPTIONS: { value: TemplateContext; label: string; hint: string }[] = [
  { value: 'manual_send',       label: 'Enviar numa conversa',    hint: 'Botão de enviar template dentro de uma conversa existente' },
  { value: 'new_conversation',  label: 'Iniciar nova conversa',   hint: 'Template ao começar uma conversa nova com um contato' },
  { value: 'scheduled_message', label: 'Agendar mensagem',        hint: 'Modal "Agendar mensagem" de uma conversa' },
  { value: 'broadcast',         label: 'Transmissão em massa',    hint: 'Campanha de broadcast do Inbox Áion' },
]

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
  institution_city: string | null
}

type StatusValue = 'not_submitted' | 'pending' | 'approved' | 'rejected'

interface StatusRow {
  template_definition_id: string
  institution_id: string
  status: StatusValue
  error_message: string | null
  visible_to_school: boolean
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
  // '' = visão agregada "Todas as escolas" (padrão/inicial); com um
  // institution_id selecionado, a tabela de status filtra pra só essa escola
  // e ganha o toggle "Visível pra esta escola".
  const [filterInstitutionId, setFilterInstitutionId] = useState('')
  const [togglingVisibility, setTogglingVisibility]   = useState<string | null>(null) // `${tplId}:${instId}`

  // Aba "Todos os Templates" (padrão/inicial) — visão permanente de TODO
  // template aprovado em QUALQUER escola via whatsapp_templates, cadastrado
  // em template_definitions ou não. Substitui o antigo modal de importação
  // única. "Cadastrados" é a aba com o que já existia (lista + grid de
  // status por escola).
  const [activeTab, setActiveTab]         = useState<'all' | 'registered'>('all')
  const [templateGroups, setTemplateGroups] = useState<TemplateGroup[]>([])
  const [loadingGroups, setLoadingGroups]   = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  // Edição inline (rótulos/display_name/contextos/escopo) de um template já
  // cadastrado, direto na linha — sem reabrir o formulário de "Novo Template".
  const [editForm, setEditForm] = useState<{
    defId: string; displayName: string; labels: Record<string, string>
    contexts: TemplateContext[]; scope: 'all' | 'specific'; bodyText: string
  } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Exclusão — modal de confirmação com duas ações separadas ("remover só
  // daqui" vs "remover também da Meta"), já que nem sempre excluir da Meta é
  // desejado (o gestor pode querer manter o template aprovado lá pra uso
  // manual direto no WhatsApp Manager, só tirando ele da nossa lista).
  const [deletingTemplate, setDeletingTemplate] = useState<{ defId: string; name: string; displayName: string } | null>(null)
  const [deletingInProgress, setDeletingInProgress] = useState(false)

  const [form, setForm] = useState({
    name: '', displayName: '', category: 'UTILITY' as 'UTILITY' | 'MARKETING', bodyText: '',
    examples: {} as Record<string, string>,
    labels: {} as Record<string, string>,
    contexts: [] as TemplateContext[],
    hasButton: false, buttonText: '', buttonUrlBase: '', buttonExample: '',
    // Template criado na mão no WhatsApp Manager antes dessa tela existir
    // (ex reais em produção: iniciar_contato, reativar_atendimento) — em vez
    // de tentar recriar na Meta em toda escola, registra 'approved' direto
    // pra quem já tem (via whatsapp_templates) e só submete de verdade pra
    // quem não tem. Marcado automaticamente ao vir da aba "Todos os Templates".
    alreadyExists: false,
    // Escopo de escolas: 'all' (padrão, comportamento de sempre) ou
    // 'specific' — só as instituições marcadas em scopeInstitutionIds
    // recebem submissão/registro; as demais nem tentativa nem linha em
    // template_institution_status.
    scope: 'all' as 'all' | 'specific',
    scopeInstitutionIds: [] as string[],
  })

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => { loadAll(); loadAllTemplateGroups() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [defsRes, phonesRes, statusRes] = await Promise.all([
        supabase.from('template_definitions').select('*').order('created_at', { ascending: false }),
        // Mesma fonte de verdade usada pelo endpoint server-side e por
        // AdminSchools.tsx/InstitutionDetails.tsx — institutions.
        // whatsapp_business_id nunca é lido em nenhum outro lugar do projeto.
        supabase.from('whatsapp_phone_numbers')
          .select('institution_id, institutions(id, name, city)')
          .eq('is_active', true).not('waba_id', 'is', null),
        supabase.from('template_institution_status')
          .select('template_definition_id, institution_id, status, error_message, visible_to_school'),
      ])
      if (defsRes.error) throw defsRes.error
      setTemplates((defsRes.data || []) as TemplateDefinition[])

      const insts: EligibleInstitution[] = (phonesRes.data || [])
        .map((r: any) => ({
          institution_id:   r.institution_id,
          institution_name: r.institutions?.name || r.institution_id,
          institution_city: r.institutions?.city || null,
        }))
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
    name: '', displayName: '', category: 'UTILITY', bodyText: '', examples: {}, labels: {}, contexts: [],
    hasButton: false, buttonText: '', buttonUrlBase: '', buttonExample: '',
    alreadyExists: false, scope: 'all', scopeInstitutionIds: [],
  })

  const toggleScopeInstitution = (institutionId: string) => setForm(f => ({
    ...f, scopeInstitutionIds: f.scopeInstitutionIds.includes(institutionId)
      ? f.scopeInstitutionIds.filter(id => id !== institutionId)
      : [...f.scopeInstitutionIds, institutionId],
  }))

  const toggleContext = (ctx: TemplateContext) => setForm(f => ({
    ...f, contexts: f.contexts.includes(ctx) ? f.contexts.filter(c => c !== ctx) : [...f.contexts, ctx],
  }))

  const handleCreate = async () => {
    const name = slugify(form.name)
    if (!name) { showToast('Informe um nome válido.', false); return }
    if (!form.displayName.trim()) { showToast('Informe o nome de exibição.', false); return }
    if (!form.bodyText.trim()) { showToast('Informe o texto do corpo.', false); return }
    if (bodyVarNumbers.some(n => !form.examples[n]?.trim())) {
      showToast('Preencha o exemplo de todas as variáveis do corpo.', false); return
    }
    if (form.hasButton && (!form.buttonUrlBase.trim() || !form.buttonText.trim() || !form.buttonExample.trim())) {
      showToast('Preencha texto, URL base e exemplo do botão.', false); return
    }
    if (form.scope === 'specific' && form.scopeInstitutionIds.length === 0) {
      showToast('Selecione pelo menos uma escola pro escopo específico.', false); return
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
          display_name:      form.displayName.trim(),
          category:          form.category,
          language:          'pt_BR',
          body_text:         form.bodyText.trim(),
          variable_examples,
          variable_labels,
          available_contexts: form.contexts,
          button_config:     form.hasButton
            ? { type: 'URL', text: form.buttonText.trim(), url_base: form.buttonUrlBase.trim() }
            : null,
          scope:      form.scope,
          created_by: user?.id || null,
        })
        .select('id').single()
      if (insErr) throw insErr

      showToast(
        form.alreadyExists
          ? 'Template cadastrado! Registrando o que já está aprovado...'
          : 'Template cadastrado! Submetendo para todas as escolas...',
        true
      )
      setShowNew(false)
      const scopeInstitutionIds = form.scope === 'specific' ? form.scopeInstitutionIds : undefined
      resetForm()
      await loadAll()

      const headers = await authHeaders()
      const res = await fetch('/api/whatsapp/template-definitions', {
        method: 'POST', headers,
        body: JSON.stringify(
          form.alreadyExists
            ? { action: 'register_existing', template_definition_id: inserted.id, institution_ids: scopeInstitutionIds }
            : { action: 'submit', template_definition_ids: [inserted.id], institution_ids: scopeInstitutionIds }
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao registrar/submeter template')

      const results: any[] = data.results || []
      const failed = results.filter(r => r.status === 'rejected').length
      if (form.alreadyExists) {
        const alreadyApproved = results.filter(r => r.status === 'approved').length
        showToast(
          results.length === 0
            ? 'Template cadastrado, mas nenhuma escola com WhatsApp conectado foi encontrada.'
            : `Registrado: ${alreadyApproved} escola(s) já aprovada(s) direto${results.length > alreadyApproved ? `, ${results.length - alreadyApproved} submetida(s) pra Meta` : ''}${failed > 0 ? ` (${failed} com erro)` : ''}.`,
          failed === 0
        )
      } else {
        showToast(
          results.length === 0
            ? 'Template cadastrado, mas nenhuma escola com WhatsApp conectado foi encontrada.'
            : failed > 0
              ? `Submetido pra ${results.length} escola(s), ${failed} com erro.`
              : `Submetido com sucesso pra ${results.length} escola(s)!`,
          failed === 0
        )
      }
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao cadastrar template.', false)
    } finally {
      setSaving(false)
    }
  }

  // Aba "Todos os Templates" — lista via server (whatsapp_templates tem RLS
  // por instituição, o Super Admin não enxergaria isso client-side) TODO
  // template aprovado em qualquer escola, agrupado por (nome, idioma) com as
  // variantes de corpo detectadas — cadastrado em template_definitions ou não.
  const loadAllTemplateGroups = async () => {
    setLoadingGroups(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/whatsapp/template-definitions', {
        method: 'POST', headers, body: JSON.stringify({ action: 'list_all_templates' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao listar templates')
      setTemplateGroups(data.groups || [])
    } catch (e: any) {
      showToast(e.message || 'Erro ao listar templates.', false)
      setTemplateGroups([])
    } finally {
      setLoadingGroups(false)
    }
  }

  const toggleGroupExpanded = (groupKey: string) => setExpandedGroups(prev => {
    const next = new Set(prev)
    if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey)
    return next
  })

  // Pré-preenche o formulário de "Novo Template" com uma variante ainda não
  // cadastrada — o admin só completa rótulo/nome de exibição/contextos antes
  // de salvar. alreadyExists já marcado: vir de uma variante já aprovada em
  // alguma escola já deixa implícito que isso é "registrar o que já existe",
  // não recriar do zero.
  const handleConfigure = (group: TemplateGroup, variant: TemplateVariant) => {
    const preset = KNOWN_TEMPLATE_LABEL_PRESETS[group.name]
    setForm(f => ({
      ...f,
      name:         group.name,
      category:     variant.category,
      bodyText:     variant.body_text,
      labels:       preset || f.labels,
      alreadyExists: true,
    }))
    setShowNew(true)
  }

  // Edição inline — só os 4 campos que o pedido lista (display_name, rótulos,
  // contextos, escopo). Nunca mexe em nome técnico/corpo/categoria (isso
  // definiria um template diferente) nem em quais escolas já foram
  // processadas (isso é ação de envio, não de metadado — ver aba "Cadastrados"
  // pra reenviar/retry por escola).
  const handleStartEdit = (defId: string) => {
    const def = templates.find(t => t.id === defId)
    if (!def) return
    setEditForm({
      defId,
      displayName: def.display_name || '',
      labels: { ...(def.variable_labels || {}) },
      contexts: [...(def.available_contexts || [])],
      scope: def.scope || 'all',
      bodyText: def.body_text,
    })
  }

  const handleSaveEdit = async () => {
    if (!editForm) return
    if (!editForm.displayName.trim()) { showToast('Informe o nome de exibição.', false); return }
    setSavingEdit(true)
    try {
      const bodyVarNums = extractVarNumbers(editForm.bodyText)
      const variable_labels: Record<string, string> = {}
      for (const n of bodyVarNums) {
        if (editForm.labels[n]?.trim()) variable_labels[n] = editForm.labels[n].trim()
      }
      const { error } = await supabase.from('template_definitions').update({
        display_name:       editForm.displayName.trim(),
        variable_labels,
        available_contexts: editForm.contexts,
        scope:               editForm.scope,
      }).eq('id', editForm.defId)
      if (error) throw error
      showToast('Template atualizado!')
      setEditForm(null)
      await Promise.all([loadAll(), loadAllTemplateGroups()])
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar alterações.', false)
    } finally {
      setSavingEdit(false)
    }
  }

  // deleteFromMeta=true: tenta remover da Meta em cada WABA onde o template
  // tem status gravado (falha individual nunca bloqueia — ver comentário no
  // server) antes de limpar template_institution_status + template_definitions.
  // deleteFromMeta=false: só limpa a nossa base, mantém aprovado na Meta pra
  // uso manual direto no WhatsApp Manager depois.
  const handleDeleteConfirmed = async (deleteFromMeta: boolean) => {
    if (!deletingTemplate) return
    setDeletingInProgress(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/whatsapp/template-definitions', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'delete', template_definition_id: deletingTemplate.defId, delete_from_meta: deleteFromMeta }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir template')

      if (deleteFromMeta) {
        const results: { outcome: 'deleted' | 'not_found' | 'error' }[] = data.meta_results || []
        const deletedCount  = results.filter(r => r.outcome === 'deleted').length
        const notFoundCount = results.filter(r => r.outcome === 'not_found').length
        const errorCount    = results.filter(r => r.outcome === 'error').length
        const parts: string[] = []
        if (deletedCount)  parts.push(`removido de ${deletedCount} WABA${deletedCount === 1 ? '' : 's'}`)
        if (notFoundCount) parts.push(`${notFoundCount} já não existia${notFoundCount === 1 ? '' : 'm'} na Meta`)
        if (errorCount)    parts.push(`${errorCount} com erro`)
        showToast(`Excluído da nossa base. ${parts.length ? parts.join(', ') + '.' : 'Nenhuma escola tinha esse template na Meta.'}`, errorCount === 0)
      } else {
        showToast('Template removido da nossa base — continua aprovado na Meta pra uso manual.')
      }

      if (editForm?.defId === deletingTemplate.defId) setEditForm(null)
      setDeletingTemplate(null)
      await Promise.all([loadAll(), loadAllTemplateGroups()])
    } catch (e: any) {
      showToast(e.message || 'Erro ao excluir template.', false)
    } finally {
      setDeletingInProgress(false)
    }
  }

  // Painel de edição inline (display_name/rótulos/contextos/escopo) —
  // reaproveitado em QUALQUER lugar que liste um template já cadastrado
  // (aba "Cadastrados" e aba "Todos os Templates"), pra garantir que todo
  // template em template_definitions tenha caminho de edição, independente
  // de já ter sido aprovado pela Meta em alguma escola ou não (root cause
  // do item 2: antes só existia dentro de "Todos os Templates", que só
  // mostra template com >=1 aprovação em whatsapp_templates — um template
  // recém-criado, ainda 'pending', nunca aparecia lá).
  const renderEditPanel = (defId: string) => {
    if (editForm?.defId !== defId) return null
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
        <div>
          <label className={lbl}>Nome de exibição *</label>
          <input className={inp} value={editForm.displayName}
            onChange={e => setEditForm(f => f && ({ ...f, displayName: e.target.value }))} />
        </div>

        {extractVarNumbers(editForm.bodyText).length > 0 && (
          <div>
            <p className={lbl}>Rótulo de cada variável</p>
            <div className="space-y-2">
              {extractVarNumbers(editForm.bodyText).map(n => (
                <div key={n} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500 w-10">{`{{${n}}}`}</span>
                  <input className={inp} placeholder="Ex: Nome do responsável" value={editForm.labels[n] || ''}
                    onChange={e => setEditForm(f => f && ({ ...f, labels: { ...f.labels, [n]: e.target.value } }))} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className={lbl}>Onde pode ser escolhido manualmente</p>
          <div className="space-y-1.5">
            {CONTEXT_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.contexts.includes(opt.value)}
                  onChange={() => setEditForm(f => f && ({
                    ...f, contexts: f.contexts.includes(opt.value) ? f.contexts.filter(c => c !== opt.value) : [...f.contexts, opt.value],
                  }))} />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className={lbl}>Pra quais escolas</p>
          <div className="flex gap-2">
            {(['all', 'specific'] as const).map(s => (
              <button key={s} type="button" onClick={() => setEditForm(f => f && ({ ...f, scope: s }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 ${editForm.scope === s ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-500'}`}>
                {s === 'all' ? 'Todas' : 'Específicas'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Só muda o rótulo guardado — pra reenviar/retry por escola, use a aba "Cadastrados".
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={() => setEditForm(null)}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSaveEdit} disabled={savingEdit}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg disabled:opacity-60">
            {savingEdit ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    )
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

  // Esconde/mostra um template aprovado de UMA escola específica sem tocar
  // no status de aprovação da Meta (visible_to_school, item 2 do pedido).
  // Pode não existir linha ainda (template nunca chegou a ser submetido pra
  // essa escola) — upsert cobre os dois casos.
  const handleToggleVisibility = async (templateId: string, institutionId: string, currentValue: boolean) => {
    const key = `${templateId}:${institutionId}`
    setTogglingVisibility(key)
    try {
      const nextValue = !currentValue
      const { error } = await supabase.from('template_institution_status')
        .upsert(
          { template_definition_id: templateId, institution_id: institutionId, visible_to_school: nextValue },
          { onConflict: 'template_definition_id,institution_id' }
        )
      if (error) throw error
      setStatusRows(prev => {
        const exists = prev.some(r => r.template_definition_id === templateId && r.institution_id === institutionId)
        if (exists) {
          return prev.map(r => r.template_definition_id === templateId && r.institution_id === institutionId
            ? { ...r, visible_to_school: nextValue } : r)
        }
        return [...prev, { template_definition_id: templateId, institution_id: institutionId, status: 'not_submitted', error_message: null, visible_to_school: nextValue }]
      })
    } catch (e: any) {
      showToast(e.message || 'Erro ao atualizar visibilidade.', false)
    } finally {
      setTogglingVisibility(null)
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

        {/* Abas — "Todos os Templates" é a visão principal/padrão (todo
            template aprovado em qualquer escola, cadastrado ou não);
            "Cadastrados" é a visão anterior (grid de status por escola). */}
        <div className="flex gap-1 border-b border-gray-200">
          {([
            { key: 'all' as const,        label: 'Todos os Templates' },
            { key: 'registered' as const, label: 'Cadastrados' },
          ]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${activeTab === t.key ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'registered' && (
        <>
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
                      <span className="text-sm font-bold text-gray-900">{t.display_name || t.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">{t.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{t.category}</span>
                      {t.button_config && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> botão URL
                        </span>
                      )}
                      {t.scope === 'specific' && (
                        <span title="Só foi submetido/registrado pras escolas marcadas na criação, não pra todas"
                          className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold flex items-center gap-1">
                          <Users className="w-3 h-3" /> Escolas selecionadas ({statusRows.filter(r => r.template_definition_id === t.id).length})
                        </span>
                      )}
                      <button onClick={() => editForm?.defId === t.id ? setEditForm(null) : handleStartEdit(t.id)}
                        className="ml-auto text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full hover:bg-cyan-100 flex-shrink-0">
                        {editForm?.defId === t.id ? 'Fechar' : 'Editar'}
                      </button>
                      <button onClick={() => setDeletingTemplate({ defId: t.id, name: t.name, displayName: t.display_name || t.name })}
                        className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full hover:bg-red-100 flex-shrink-0">
                        Excluir
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{t.body_text}</p>
                    {t.variable_labels && Object.keys(t.variable_labels).length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Rótulos: {Object.entries(t.variable_labels).map(([n, l]) => `{{${n}}} = ${l}`).join(' · ')}
                      </p>
                    )}
                    {t.available_contexts && t.available_contexts.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.available_contexts.map(ctx => (
                          <span key={ctx} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 font-medium">
                            {CONTEXT_OPTIONS.find(c => c.value === ctx)?.label || ctx}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-1.5 italic">Sem contexto marcado — só disparado por automação, não aparece em nenhum picker manual.</p>
                    )}
                    {renderEditPanel(t.id)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status de aprovação — "Todas as escolas" é a visão padrão/inicial
            (grid completo, igual sempre foi); escolher uma escola no filtro
            troca pra uma lista dessa escola só, com o toggle de visibilidade. */}
        {templates.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm font-semibold text-gray-700">
                {filterInstitutionId
                  ? `Status de aprovação — ${institutions.find(i => i.institution_id === filterInstitutionId)?.institution_name || ''}`
                  : 'Status de aprovação por escola'}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-white min-w-[220px]"
                    value={filterInstitutionId}
                    onChange={e => setFilterInstitutionId(e.target.value)}
                  >
                    <option value="">Todas as escolas</option>
                    {institutions.map(i => (
                      <option key={i.institution_id} value={i.institution_id}>{i.institution_name}</option>
                    ))}
                  </select>
                </div>
                {!filterInstitutionId && (
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                      placeholder="Buscar escola..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {filterInstitutionId ? (
              <div className="divide-y divide-gray-50">
                {templates.map(t => {
                  const row = statusMap.get(`${t.id}:${filterInstitutionId}`)
                  const status = row?.status || 'not_submitted'
                  const meta = STATUS_META[status]
                  const Icon = meta.icon
                  const key = `${t.id}:${filterInstitutionId}`
                  const canRetry = status === 'rejected' || status === 'not_submitted'
                  // Sem linha em template_institution_status = nunca escondido
                  // explicitamente pra essa escola (DEFAULT true no banco).
                  const visible = row?.visible_to_school !== false
                  return (
                    <div key={t.id} className="px-5 py-3 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{t.display_name || t.name}</p>
                          <p className="font-mono text-[11px] text-gray-400 truncate">{t.name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}
                            title={row?.error_message || ''}>
                            <Icon className="w-3 h-3" /> {meta.label}
                          </span>
                          {canRetry && (
                            <button onClick={() => handleRetry(t.id, filterInstitutionId)} disabled={retrying === key}
                              title="Reenviar" className="p-1 text-gray-400 hover:text-cyan-600 disabled:opacity-50">
                              {retrying === key
                                ? <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                : <Send className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleVisibility(t.id, filterInstitutionId, visible)}
                            disabled={togglingVisibility === key}
                            title={visible ? 'Visível pra esta escola — clique pra esconder' : 'Escondido dessa escola — clique pra mostrar'}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border disabled:opacity-50 ${visible ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                          >
                            {togglingVisibility === key
                              ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              : visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            {visible ? 'Visível' : 'Escondido'}
                          </button>
                        </div>
                      </div>
                      {status === 'rejected' && row?.error_message && (
                        <p className="text-[11px] text-red-600">Motivo: {row.error_message}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-y border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50">Escola</th>
                      {templates.map(t => (
                        <th key={t.id} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {t.display_name || t.name}
                            {t.scope === 'specific' && (
                              <span title="Escopo: escolas selecionadas, não todas"><Users className="w-3 h-3 text-amber-500" /></span>
                            )}
                          </span>
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
            )}
          </div>
        )}
        </>
        )}

        {activeTab === 'all' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-1">Todos os templates aprovados em pelo menos uma escola ({templateGroups.length})</p>
            <p className="text-xs text-gray-400 mb-3">Cadastrado ou não em "Templates Automáticos" — inclui o que foi criado direto no WhatsApp Manager antes dessa tela existir.</p>
            {loadingGroups ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : templateGroups.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">Nenhum template aprovado em nenhuma escola ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templateGroups.map(group => {
                  const groupKey = `${group.name} ${group.language}`
                  const hasVariation = group.variants.length > 1
                  const expanded = expandedGroups.has(groupKey) || !hasVariation
                  const totalApproved = new Set(group.variants.flatMap(v => v.approved_institution_ids)).size

                  return (
                    <div key={groupKey} className="border border-gray-100 rounded-xl bg-gray-50 overflow-hidden">
                      <div className={`flex items-center gap-3 p-3.5 ${hasVariation ? 'cursor-pointer' : ''}`}
                        onClick={hasVariation ? () => toggleGroupExpanded(groupKey) : undefined}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-gray-800">{group.name}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {totalApproved} escola{totalApproved === 1 ? '' : 's'}
                            </span>
                            {hasVariation && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                                ⚠️ Texto varia entre escolas ({group.variants.length} versões)
                              </span>
                            )}
                          </div>
                          {!hasVariation && <p className="text-xs text-gray-600 truncate mt-1">{group.variants[0].body_text}</p>}
                        </div>
                        {hasVariation && (expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />)}
                      </div>

                      {expanded && (
                        <div className={hasVariation ? 'border-t border-gray-100 divide-y divide-gray-100' : ''}>
                          {group.variants.map((variant, vIdx) => (
                            <div key={vIdx} className="p-3.5 bg-white">
                              {hasVariation && (
                                <p className="text-xs text-gray-600 mb-2">{variant.body_text}</p>
                              )}
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-[11px] text-gray-400">
                                  Aprovado em: {variant.approved_institution_names.join(', ')}
                                </p>
                                {variant.template_definition_id ? (
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={() => handleStartEdit(variant.template_definition_id!)}
                                      className="text-xs font-semibold text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-lg hover:bg-cyan-100">
                                      {variant.display_name || 'Editar'}
                                    </button>
                                    <button onClick={() => setDeletingTemplate({ defId: variant.template_definition_id!, name: group.name, displayName: variant.display_name || group.name })}
                                      className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">
                                      Excluir
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => handleConfigure(group, variant)}
                                    className="text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 rounded-lg flex-shrink-0">
                                    Configurar
                                  </button>
                                )}
                              </div>

                              {variant.template_definition_id && renderEditPanel(variant.template_definition_id)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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
                  <label className={lbl}>Nome de exibição *</label>
                  <input className={inp} placeholder="ex: Falar sobre assunto específico" value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
                  <p className="text-[11px] text-gray-400 mt-1">O que o atendente/gestor vê em vez do nome técnico, em toda tela que lista templates.</p>
                </div>

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

                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={form.alreadyExists}
                      onChange={e => setForm(f => ({ ...f, alreadyExists: e.target.checked }))} />
                    <span>
                      <span className="block text-sm font-semibold text-gray-700">
                        Este template já existe em algumas escolas — apenas registrar, não reenviar
                      </span>
                      <span className="block text-[11px] text-gray-400 mt-0.5">
                        Pra template criado na mão no WhatsApp Manager antes dessa tela existir.
                        Escola que já tem esse nome+idioma+corpo aprovado (conferido pelo cache de templates da própria escola) é registrada direto,
                        sem chamar a Meta de novo. Escola que ainda não tem é submetida normalmente.
                      </span>
                    </span>
                  </label>
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

                <div className="border border-gray-100 rounded-xl p-3">
                  <p className={lbl}>Onde esse template pode ser escolhido manualmente</p>
                  <p className="text-[11px] text-gray-400 mb-2">
                    Deixe tudo desmarcado pra um template disparado só por automação (ex: confirmação/lembrete de visita) — sem nenhum contexto marcado, ele não aparece em nenhum picker.
                  </p>
                  <div className="space-y-2">
                    {CONTEXT_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" className="mt-0.5" checked={form.contexts.includes(opt.value)}
                          onChange={() => toggleContext(opt.value)} />
                        <span>
                          <span className="block text-sm font-medium text-gray-700">{opt.label}</span>
                          <span className="block text-[11px] text-gray-400">{opt.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl p-3">
                  <p className={lbl}>Pra quais escolas</p>
                  <div className="flex gap-2 mb-2">
                    {(['all', 'specific'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, scope: s }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 ${form.scope === s ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-500'}`}>
                        {s === 'all' ? 'Todas as escolas' : 'Escolas específicas'}
                      </button>
                    ))}
                  </div>
                  {form.scope === 'specific' && (
                    <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
                      {institutions.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Nenhuma escola com WhatsApp conectado.</p>
                      ) : institutions.map(i => (
                        <label key={i.institution_id} className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={form.scopeInstitutionIds.includes(i.institution_id)}
                            onChange={() => toggleScopeInstitution(i.institution_id)} />
                          <span className="text-sm text-gray-700">{i.institution_name}{i.institution_city ? ` — ${i.institution_city}` : ''}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {form.scope === 'specific' && (
                    <p className="text-[11px] text-gray-400 mt-1.5">{form.scopeInstitutionIds.length} escola(s) selecionada(s) — só elas recebem submissão/registro.</p>
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
                  {form.alreadyExists ? 'Salvar e registrar já-aprovados' : 'Salvar e submeter pra todas as escolas'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: excluir template — duas ações separadas porque excluir da
            Meta nem sempre é desejado (o gestor pode preferir manter o
            template aprovado lá pra uso manual direto no WhatsApp Manager,
            só tirando ele da nossa lista). */}
        {deletingTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Excluir template</h2>
              <p className="text-sm text-gray-600 mb-4">
                Isso vai excluir o template <strong>"{deletingTemplate.displayName}"</strong> (<span className="font-mono text-xs">{deletingTemplate.name}</span>) da nossa base.
                Você escolhe abaixo se ele também é removido da Meta em todas as escolas onde foi submetido — isso libera o nome técnico pra reuso, mas impede o uso manual desse template direto no WhatsApp Manager depois.
              </p>
              <p className="text-xs font-semibold text-red-600 mb-5">Essa ação não pode ser desfeita.</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => handleDeleteConfirmed(true)} disabled={deletingInProgress}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                  {deletingInProgress ? 'Excluindo...' : 'Excluir também da Meta'}
                </button>
                <button onClick={() => handleDeleteConfirmed(false)} disabled={deletingInProgress}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-60">
                  Remover só daqui (mantém aprovado na Meta)
                </button>
                <button onClick={() => setDeletingTemplate(null)} disabled={deletingInProgress}
                  className="w-full py-2 text-xs font-semibold text-gray-400 hover:text-gray-600">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </SuperAdminLayout>
  )
}
