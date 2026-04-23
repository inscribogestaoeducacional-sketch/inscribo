import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowRightLeft, Plus, Copy, ExternalLink, Sparkles, Eye,
  AlertTriangle, CheckCircle, Clock, Users, X, ChevronRight,
  Loader2, Check, MoreHorizontal, Pencil, Trash2, History, RotateCcw
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../hooks/useAudit'
import AuditModal from '../../components/common/AuditModal'

// ─── types ────────────────────────────────────────────────────────────────────
interface Transfer {
  id: string
  institution_id: string
  student_name: string
  course_grade: string
  transfer_date: string
  reason_category: string | null
  reason_detail: string | null
  survey_token: string | null
  survey_completed_at: string | null
  survey_responses: Record<string, unknown> | null
  ai_diagnosis: string | null
  ai_risk_factors: string[] | null
  stated_reason: string | null
  internal_notes: string | null
  status: string | null
  lead_id: string | null
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

interface DiagnosisData {
  primary_reason?: string
  confidence?: number
  diagnosis?: string
  risk_factors?: string[]
  retention_opportunity?: boolean
  retention_note?: string
}

interface TransferForm {
  studentName: string
  grade: string
  statedReason: string
  internalNotes: string
  lead_id: string | null
}


// ─── constants ────────────────────────────────────────────────────────────────
const GRADES = [
  'Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V',
  '1º Ano EF','2º Ano EF','3º Ano EF','4º Ano EF','5º Ano EF',
  '6º Ano EF','7º Ano EF','8º Ano EF','9º Ano EF',
  'Ensino Médio 1','Ensino Médio 2','Ensino Médio 3',
]

const REASON_MAP: Record<string, { label: string; color: string; bg: string }> = {
  financial:    { label: 'Financeiro',     color: '#dc2626', bg: '#fee2e2' },
  pedagogical:  { label: 'Pedagógico',     color: '#d97706', bg: '#fef3c7' },
  distance:     { label: 'Localização',    color: '#64748b', bg: '#f1f5f9' },
  competition:  { label: 'Outra escola',   color: '#7c3aed', bg: '#ede9fe' },
  relocation:   { label: 'Mudança',        color: '#64748b', bg: '#f1f5f9' },
  relationship: { label: 'Relacionamento', color: '#7c3aed', bg: '#ede9fe' },
  other:        { label: 'Outro',          color: '#64748b', bg: '#f1f5f9' },
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
  background: '#FAFAFA', boxSizing: 'border-box',
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function parseDiagnosis(raw: string | null | unknown): DiagnosisData | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as DiagnosisData
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as DiagnosisData } catch { return null }
  }
  return null
}

function getStatusInfo(t: Transfer) {
  if (t.status === 'cancelled') return { label: 'Cancelado',        color: '#64748b', bg: '#f1f5f9' }
  if (t.ai_diagnosis)           return { label: 'Diagnóstico pronto', color: '#16a34a', bg: '#dcfce7' }
  if (t.survey_responses)       return { label: 'Respondido',        color: '#1d4ed8', bg: '#dbeafe' }
  if (t.survey_token)           return { label: 'Pesquisa enviada',   color: '#d97706', bg: '#fef3c7' }
  return                               { label: 'Aguardando pesquisa', color: '#64748b', bg: '#f1f5f9' }
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(n) }

const EMPTY_FORM: TransferForm = { studentName: '', grade: '', statedReason: '', internalNotes: '', lead_id: null }

// ─── component ────────────────────────────────────────────────────────────────
export default function GestorTransfers() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'
  const userName = user?.full_name || 'Usuário'
  const userRole = user?.role || 'user'

  const [transfers, setTransfers]             = useState<Transfer[]>([])
  const [deletedTransfers, setDeletedTransfers] = useState<Transfer[]>([])
  const [activeTab, setActiveTab]             = useState<'active' | 'deleted'>('active')
  const [loading, setLoading]                 = useState(true)
  const [showNewModal, setShowNewModal]       = useState(false)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
  const [diagnosisTransfer, setDiagnosisTransfer] = useState<Transfer | null>(null)
  const [deleteId, setDeleteId]               = useState<string | null>(null)
  const [openDropdown, setOpenDropdown]       = useState<string | null>(null)
  const [generatingId, setGeneratingId]       = useState<string | null>(null)
  const [savingForm, setSavingForm]           = useState(false)
  const [toast, setToast]                     = useState<string | null>(null)
  const [form, setForm]                       = useState<TransferForm>(EMPTY_FORM)
  const [formError, setFormError]             = useState<string | null>(null)
  const [auditTransferId, setAuditTransferId] = useState<string | null>(null)

  // lead search (new transfer modal)
  const [pickMode, setPickMode]         = useState<'new' | 'existing'>('new')
  const [leadSearch, setLeadSearch]     = useState('')
  const [leadResults, setLeadResults]   = useState<{ id: string; responsible_name: string | null; student_name: string | null; grade_interest: string | null; phone: string | null }[]>([])
  const [searchingLeads, setSearchingLeads] = useState(false)
  const [selectedLead, setSelectedLead] = useState<{ id: string; student_name: string | null } | null>(null)

  useEffect(() => { if (!institutionId) return; load() }, [institutionId])

  useEffect(() => {
    if (pickMode !== 'existing' || leadSearch.length < 2) { setLeadResults([]); return }
    const t = setTimeout(async () => {
      setSearchingLeads(true)
      const { data } = await supabase.from('leads')
        .select('id, responsible_name, student_name, grade_interest, phone')
        .eq('institution_id', institutionId)
        .or(`student_name.ilike.%${leadSearch}%,responsible_name.ilike.%${leadSearch}%`)
        .is('deleted_at', null)
        .limit(6)
      setLeadResults(data || [])
      setSearchingLeads(false)
    }, 300)
    return () => clearTimeout(t)
  }, [leadSearch, pickMode])

  // close dropdown when clicking outside
  useEffect(() => {
    const close = () => setOpenDropdown(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    try {
      // Tenta buscar com filtro de soft delete
      const { data: activeData, error: activeErr } = await supabase
        .from('student_transfers').select('*').eq('institution_id', institutionId)
        .is('deleted_at', null).order('created_at', { ascending: false })

      const { data: deletedData, error: deletedErr } = await supabase
        .from('student_transfers').select('*').eq('institution_id', institutionId)
        .not('deleted_at', 'is', null).order('deleted_at', { ascending: false })

      // Se der erro (coluna não existe ainda), busca sem filtro
      if (activeErr || deletedErr) {
        const { data: fallback } = await supabase
          .from('student_transfers').select('*').eq('institution_id', institutionId)
          .order('created_at', { ascending: false })
        setTransfers((fallback ?? []) as Transfer[])
        setDeletedTransfers([])
      } else {
        setTransfers((activeData ?? []) as Transfer[])
        setDeletedTransfers((deletedData ?? []) as Transfer[])
      }
    } finally {
      setLoading(false)
    }
  }

  // ── new / edit save ─────────────────────────────────────────────────────
  async function handleSaveForm() {
    if (!form.studentName.trim()) { setFormError('Nome do aluno é obrigatório.'); return }
    if (!form.grade) { setFormError('Selecione a série.'); return }
    setFormError(null)
    setSavingForm(true)
    try {
      if (editingTransfer) {
        const { error } = await supabase.from('student_transfers').update({
          student_name:   form.studentName.trim(),
          course_grade:   form.grade,
          stated_reason:  form.statedReason || null,
          internal_notes: form.internalNotes || null,
        }).eq('id', editingTransfer.id)
        if (error) throw new Error(error.message)
        await logAudit({
          institution_id: institutionId, module: 'transfers', record_id: editingTransfer.id,
          action: 'updated', field_changed: 'dados',
          old_value: `${editingTransfer.student_name} — ${editingTransfer.course_grade}`,
          new_value: `${form.studentName.trim()} — ${form.grade}`,
          user_id: user!.id, user_name: userName, user_role: userRole,
        })
        showToast('Transferência atualizada.')
      } else {
        const { data: inserted, error } = await supabase.from('student_transfers').insert({
          institution_id: institutionId,
          student_name:   form.studentName.trim(),
          course_grade:   form.grade,
          transfer_date:  new Date().toISOString().split('T')[0],
          stated_reason:  form.statedReason || null,
          internal_notes: form.internalNotes || null,
          lead_id:        form.lead_id || null,
          created_at:     new Date().toISOString(),
        }).select('id').single()
        if (error) throw new Error(error.message)
        await logAudit({
          institution_id: institutionId, module: 'transfers', record_id: inserted.id,
          action: 'created',
          new_value: `${form.studentName.trim()} — ${form.grade}`,
          user_id: user!.id, user_name: userName, user_role: userRole,
        })
        showToast('Transferência registrada.')
      }
      closeForm()
      await load()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSavingForm(false)
    }
  }

  function openEdit(t: Transfer) {
    setForm({ studentName: t.student_name, grade: t.course_grade, statedReason: t.stated_reason ?? '', internalNotes: t.internal_notes ?? '', lead_id: t.lead_id ?? null })
    setEditingTransfer(t)
    setShowNewModal(true)
  }

  function closeForm() {
    setShowNewModal(false)
    setEditingTransfer(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setPickMode('new')
    setLeadSearch('')
    setLeadResults([])
    setSelectedLead(null)
  }

  function selectLead(l: { id: string; responsible_name: string | null; student_name: string | null; grade_interest: string | null; phone: string | null }) {
    setForm(f => ({ ...f, studentName: l.student_name || '', grade: l.grade_interest || '', lead_id: l.id }))
    setSelectedLead({ id: l.id, student_name: l.student_name })
    setLeadSearch('')
    setLeadResults([])
  }

  // ── delete (soft) ───────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const t = transfers.find(x => x.id === id)
    const { error } = await supabase.from('student_transfers').update({
      deleted_at: new Date().toISOString(),
      deleted_by: userName,
    }).eq('id', id)
    if (error) { showToast('Erro ao excluir.'); return }
    await logAudit({
      institution_id: institutionId, module: 'transfers', record_id: id,
      action: 'deleted',
      old_value: t ? `${t.student_name} — ${t.course_grade}` : undefined,
      user_id: user!.id, user_name: userName, user_role: userRole,
    })
    setDeleteId(null)
    showToast('Transferência movida para excluídos.')
    await load()
  }

  // ── restore ──────────────────────────────────────────────────────────────
  async function handleRestore(id: string) {
    await supabase.from('student_transfers').update({ deleted_at: null, deleted_by: null }).eq('id', id)
    showToast('Transferência restaurada.')
    await load()
  }

  // ── permanent delete ─────────────────────────────────────────────────────
  async function handlePermanentDelete(id: string) {
    const confirmed = window.confirm(
      'Apagar definitivamente? Esta ação não pode ser desfeita e removerá todos os dados desta transferência.'
    )
    if (!confirmed) return
    const { error } = await supabase.from('student_transfers').delete().eq('id', id)
    if (!error) {
      showToast('Registro apagado definitivamente.')
      await load()
    }
  }

  async function handlePermanentDeleteAll() {
    if (deletedTransfers.length === 0) return
    const confirmed = window.confirm(
      `Apagar ${deletedTransfers.length} registro(s) definitivamente? Esta ação não pode ser desfeita.`
    )
    if (!confirmed) return
    const ids = deletedTransfers.map(t => t.id)
    await supabase.from('student_transfers').delete().in('id', ids)
    showToast('Todos os registros excluídos permanentemente.')
    await load()
  }

  // ── link generation ─────────────────────────────────────────────────────
  async function handleGenerateLink(t: Transfer) {
    const token = crypto.randomUUID()
    const { error } = await supabase.from('student_transfers').update({ survey_token: token }).eq('id', t.id)
    if (error) { showToast('Erro ao gerar link.'); return }
    const url = `${window.location.origin}/survey/${token}`
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    showToast('Link copiado! Envie para a família via WhatsApp.')
    setTransfers(prev => prev.map(x => x.id === t.id ? { ...x, survey_token: token } : x))
  }

  async function handleCopyLink(t: Transfer) {
    if (!t.survey_token) return
    const url = `${window.location.origin}/survey/${t.survey_token}`
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    showToast('Link copiado para a área de transferência.')
  }

  // ── AI diagnosis ────────────────────────────────────────────────────────
  async function handleGenerateDiagnosis(t: Transfer) {
    if (!t.survey_responses) return
    setGeneratingId(t.id)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer_diagnosis',
          payload: { responses: t.survey_responses, studentName: t.student_name, grade: t.course_grade },
        }),
      })
      const { result } = await response.json()
      const diagJson = JSON.stringify(result)
      const { error } = await supabase.from('student_transfers').update({ ai_diagnosis: diagJson }).eq('id', t.id)
      if (error) throw new Error(error.message)
      setTransfers(prev => prev.map(x => x.id === t.id ? { ...x, ai_diagnosis: diagJson } : x))
      showToast('Diagnóstico gerado com sucesso.')
    } catch {
      showToast('Erro ao gerar diagnóstico. Tente novamente.')
    } finally {
      setGeneratingId(null)
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    await supabase.from('student_transfers').update({ status }).eq('id', id)
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    setDiagnosisTransfer(prev => prev?.id === id ? { ...prev, status } : prev)
    showToast(status === 'retained' ? 'Aluno marcado como retido!' : 'Transferência confirmada.')
  }

  // ── derived ──────────────────────────────────────────────────────────────
  const total         = transfers.length
  const withDiagnosis = transfers.filter(t => t.ai_diagnosis).length
  const pending       = transfers.filter(t => !t.survey_token && !t.ai_diagnosis && t.status !== 'cancelled').length
  const thisMonth     = transfers.filter(t => {
    const d = new Date(t.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  // ─── render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1e2d6b', color: 'white', fontSize: 13, fontWeight: 500,
          padding: '12px 18px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Check size={14} /> {toast}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRightLeft size={18} color="#00A896" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Transferências</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46 }}>
            Gerencie solicitações de transferência e entenda os motivos reais
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditingTransfer(null); setShowNewModal(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#00A896', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Nova transferência
        </button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['active', 'deleted'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '6px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === tab ? '#fff' : 'transparent',
            color: activeTab === tab ? '#1e2d6b' : '#64748b',
            boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
          }}>
            {tab === 'active' ? `Ativos (${transfers.length})` : `Excluídos (${deletedTransfers.length})`}
          </button>
        ))}
      </div>

      {/* ── KPI cards (aba Ativos) ─────────────────────────────────────────── */}
      {activeTab === 'active' && (
      loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 90, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }} className="animate-pulse" />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard label="Total"                value={fmt(total)}         icon={<ArrowRightLeft size={18} color="#DC2626" />} bg="#FEE2E2" />
          <KpiCard label="Este mês"             value={fmt(thisMonth)}     icon={<Clock size={18} color="#D97706" />}          bg="#FEF3C7" />
          <KpiCard label="Aguardando pesquisa"  value={fmt(pending)}       icon={<AlertTriangle size={18} color="#64748B" />}  bg="#F1F5F9" />
          <KpiCard label="Com diagnóstico IA"   value={fmt(withDiagnosis)} icon={<Sparkles size={18} color="#8B5CF6" />}       bg="#EDE9FE" />
        </div>
      )
      )}

      {/* ── Tabela Ativos ──────────────────────────────────────────────────── */}
      {activeTab === 'active' && <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Registros de transferência</h3>
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => <div key={i} style={{ height: 52, borderRadius: 10, background: '#f8fafc' }} className="animate-pulse" />)}
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ArrowRightLeft size={24} color="#00A896" />
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Nenhuma transferência registrada</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', maxWidth: 440, marginInline: 'auto', lineHeight: 1.6 }}>
              Quando uma família solicitar transferência, registre aqui para acompanhar e entender os motivos reais com auxílio da IA.
            </p>
            <button onClick={() => setShowNewModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} /> Registrar primeira transferência
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Nome do aluno','Série','Data','Status','Diagnóstico','Ações',''].map(col => (
                    <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, idx) => {
                  const statusInfo = getStatusInfo(t)
                  const diag = parseDiagnosis(t.ai_diagnosis)
                  const isCancelled = t.status === 'cancelled'
                  const isGenerating = generatingId === t.id
                  return (
                    <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', opacity: isCancelled ? 0.65 : 1 }}>

                      {/* Nome */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.student_name}</div>
                        {t.stated_reason && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.stated_reason}</div>
                        )}
                      </td>

                      {/* Série */}
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>{t.course_grade}</td>

                      {/* Data */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(t.transfer_date).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: statusInfo.bg, color: statusInfo.color, whiteSpace: 'nowrap' }}>
                          {statusInfo.label}
                        </span>
                        {t.status === 'retained' && (
                          <span style={{ display: 'inline-block', marginLeft: 6, padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>Retido ✓</span>
                        )}
                      </td>

                      {/* Diagnóstico */}
                      <td style={{ padding: '12px 16px' }}>
                        {diag?.primary_reason ? (
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, ...(REASON_MAP[diag.primary_reason] ?? REASON_MAP['other']) }}>
                            {REASON_MAP[diag.primary_reason]?.label ?? diag.primary_reason}
                          </span>
                        ) : <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* Ações rápidas */}
                      <td style={{ padding: '12px 16px' }}>
                        {!isCancelled && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {!t.survey_token && (
                              <ActionBtn onClick={() => handleGenerateLink(t)} color="#8B5CF6" bg="#EDE9FE" icon={<ExternalLink size={12} />} label="Gerar link" />
                            )}
                            {t.survey_token && !t.survey_responses && (
                              <>
                                <ActionBtn onClick={() => handleCopyLink(t)} color="#D97706" bg="#FEF3C7" icon={<Copy size={12} />} label="Copiar link" />
                                <a href={`${window.location.origin}/survey/${t.survey_token}`} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                                  <ExternalLink size={12} /> Ver link
                                </a>
                              </>
                            )}
                            {t.survey_responses && !t.ai_diagnosis && isAdmin && (
                              <button onClick={() => handleGenerateDiagnosis(t)} disabled={isGenerating}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#EDE9FE', color: '#7C3AED', border: 'none', fontSize: 11, fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.7 : 1 }}>
                                {isGenerating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                                {isGenerating ? 'Gerando...' : 'Gerar IA'}
                              </button>
                            )}
                            {t.ai_diagnosis && (
                              <ActionBtn onClick={() => {
                                console.log('[Diagnóstico] transfer selecionado:', t)
                                console.log('[Diagnóstico] ai_diagnosis:', t.ai_diagnosis)
                                setDiagnosisTransfer(t)
                              }} color="#16a34a" bg="#dcfce7" icon={<Eye size={12} />} label="Ver diagnóstico" />
                            )}
                          </div>
                        )}
                      </td>

                      {/* Menu ... */}
                      <td style={{ padding: '12px 8px' }}>
                        <DropdownMenu
                          isOpen={openDropdown === t.id}
                          onToggle={e => { e.stopPropagation(); setOpenDropdown(openDropdown === t.id ? null : t.id) }}
                          items={[
                            { icon: <Pencil size={13} />, label: 'Editar', onClick: () => openEdit(t) },
                            { icon: <History size={13} />, label: 'Ver histórico', onClick: () => setAuditTransferId(t.id) },
                            ...(isAdmin ? [{ icon: <Trash2 size={13} />, label: 'Excluir', onClick: () => setDeleteId(t.id), danger: true }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* ── Aba Excluídos ──────────────────────────────────────────────────── */}
      {activeTab === 'deleted' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Transferências excluídas</h3>
            {deletedTransfers.length > 0 && isAdmin && (
              <button
                onClick={handlePermanentDeleteAll}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
              >
                <Trash2 size={12} /> Apagar todos definitivamente
              </button>
            )}
          </div>
          {deletedTransfers.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>Nenhuma transferência excluída.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Nome do aluno', 'Série', 'Data', 'Excluído por', ''].map(col => (
                      <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deletedTransfers.map((t, idx) => (
                    <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', opacity: 0.75 }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.student_name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{t.course_grade}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(t.transfer_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                          {t.deleted_by && <span style={{ fontWeight: 600 }}>{t.deleted_by}</span>}
                          {t.deleted_at && <span style={{ color: '#94a3b8' }}> em {new Date(t.deleted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {isAdmin && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => handleRestore(t.id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#0f766e', cursor: 'pointer' }}>
                              <RotateCcw size={12} /> Restaurar
                            </button>
                            <button onClick={() => handlePermanentDelete(t.id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>
                              <Trash2 size={12} /> Apagar definitivamente
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Nova / Editar transferência ───────────────────────────── */}
      {showNewModal && (
        <Modal onClose={closeForm} title={editingTransfer ? 'Editar transferência' : 'Registrar transferência'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Mode toggle — only on new transfer */}
            {!editingTransfer && (
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 9, padding: 4 }}>
                {(['new', 'existing'] as const).map(mode => (
                  <button key={mode} onClick={() => { setPickMode(mode); setSelectedLead(null); setLeadSearch(''); setLeadResults([]) }}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      background: pickMode === mode ? '#fff' : 'transparent',
                      color: pickMode === mode ? '#1e2d6b' : '#64748b',
                      boxShadow: pickMode === mode ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                    }}>
                    {mode === 'new' ? 'Novo aluno' : 'Escolher contato existente'}
                  </button>
                ))}
              </div>
            )}

            {/* Lead search */}
            {pickMode === 'existing' && !editingTransfer && (
              <div>
                <label style={labelStyle}>Buscar aluno ou responsável</label>
                <input style={inputStyle} placeholder="Digite o nome..." value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)} autoFocus />
                {searchingLeads && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94A3B8' }}>Buscando...</p>}
                {leadResults.length > 0 && (
                  <div style={{ marginTop: 6, border: '1px solid #E2E8F0', borderRadius: 9, overflow: 'hidden' }}>
                    {leadResults.map(l => (
                      <button key={l.id} onClick={() => selectLead(l)}
                        style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '9px 12px', background: 'white', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{l.student_name || l.responsible_name || '—'}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{[l.grade_interest, l.phone].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedLead && (
                  <div style={{ marginTop: 6, padding: '7px 12px', background: '#D1FAE5', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#065F46' }}>
                    ✓ Contato selecionado: {selectedLead.student_name || 'Aluno'}
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={labelStyle}>Nome do aluno <span style={{ color: '#F43F5E' }}>*</span></label>
              <input style={inputStyle} placeholder="Nome completo" value={form.studentName}
                onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))}
                autoFocus={pickMode === 'new' && !editingTransfer} />
            </div>
            <div>
              <label style={labelStyle}>Série <span style={{ color: '#F43F5E' }}>*</span></label>
              <select style={inputStyle} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
                <option value="">Selecione a série...</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Motivo informado pela família</label>
              <input style={inputStyle} placeholder="Opcional — o que a família disse" value={form.statedReason}
                onChange={e => setForm(f => ({ ...f, statedReason: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Observações internas</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} placeholder="Opcional — anotações para a equipe"
                value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} />
            </div>
            {formError && (
              <p style={{ margin: 0, fontSize: 13, color: '#DC2626', background: '#FFF5F5', padding: '8px 12px', borderRadius: 8 }}>{formError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={closeForm} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
              <button onClick={handleSaveForm} disabled={savingForm}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 9, border: 'none', background: '#00A896', color: 'white', fontSize: 13, fontWeight: 600, cursor: savingForm ? 'not-allowed' : 'pointer', opacity: savingForm ? 0.7 : 1 }}>
                {savingForm ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><ChevronRight size={13} /> {editingTransfer ? 'Salvar' : 'Registrar'}</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirmar exclusão ─────────────────────────────────────── */}
      {deleteId && (
        <Modal onClose={() => setDeleteId(null)} title="Confirmar exclusão">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              Tem certeza? Esta ação <strong>não pode ser desfeita</strong> — o registro e todos os dados associados serão removidos permanentemente.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteId)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, border: 'none', background: '#DC2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Diagnóstico ────────────────────────────────────────────── */}
      {diagnosisTransfer && (
        <Modal onClose={() => setDiagnosisTransfer(null)} title="Diagnóstico IA" wide>
          <DiagnosisView
            transfer={diagnosisTransfer}
            onUpdateStatus={handleUpdateStatus}
            onGenerateDiagnosis={handleGenerateDiagnosis}
            isGenerating={generatingId === diagnosisTransfer.id}
            isAdmin={isAdmin}
          />
        </Modal>
      )}

      {/* ── Modal: Histórico de alterações ───────────────────────────────── */}
      {auditTransferId && (
        <AuditModal
          recordId={auditTransferId}
          moduleName="transfers"
          isOpen={!!auditTransferId}
          onClose={() => setAuditTransferId(null)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

function ActionBtn({ onClick, color, bg, icon, label }: { onClick: () => void; color: string; bg: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: bg, color, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
      {icon} {label}
    </button>
  )
}

interface DropdownItem { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; muted?: boolean }

function DropdownMenu({ isOpen, onToggle, items }: { isOpen: boolean; onToggle: (e: React.MouseEvent) => void; items: DropdownItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: isOpen ? '#f8fafc' : '#fff', cursor: 'pointer', color: '#64748b' }}>
        <MoreHorizontal size={14} />
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, top: 34, zIndex: 200,
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 190, overflow: 'hidden',
        }} onClick={e => e.stopPropagation()}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.onClick() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                color: item.danger ? '#dc2626' : item.muted ? '#64748b' : '#1e293b',
                fontWeight: 500,
                borderTop: i > 0 ? '1px solid #f8fafc' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = item.danger ? '#fef2f2' : '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: wide ? 680 : 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

function DiagnosisView({ transfer, onUpdateStatus, onGenerateDiagnosis, isGenerating, isAdmin }: {
  transfer: Transfer
  onUpdateStatus: (id: string, status: string) => void
  onGenerateDiagnosis: (t: Transfer) => void
  isGenerating: boolean
  isAdmin: boolean
}) {
  console.log('[Diagnóstico] transfer selecionado:', transfer)
  console.log('[Diagnóstico] ai_diagnosis:', transfer.ai_diagnosis)

  const rawDiag = transfer.ai_diagnosis
  const diag = parseDiagnosis(rawDiag)
  // plain text stored instead of JSON (legacy or fallback)
  const isPlainText = !!rawDiag && !diag

  if (!diag) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0', textAlign: 'center' }}>
        <Sparkles size={32} color="#8B5CF6" strokeWidth={1.5} />
        {isPlainText ? (
          <div style={{ width: '100%', textAlign: 'left' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#64748b' }}>Diagnóstico salvo em formato de texto (não estruturado):</p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#334155', background: '#f8fafc', padding: '12px 14px', borderRadius: 10, lineHeight: 1.6 }}>{rawDiag as string}</p>
            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => onGenerateDiagnosis(transfer)} disabled={isGenerating}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, border: 'none', background: '#8B5CF6', color: 'white', fontSize: 13, fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.7 : 1 }}>
                  {isGenerating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                  {isGenerating ? 'Gerando...' : 'Regenerar diagnóstico estruturado'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Diagnóstico não gerado ainda</p>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{transfer.survey_responses ? 'Pesquisa respondida — clique para gerar o diagnóstico.' : 'Aguardando a família responder a pesquisa.'}</p>
            </div>
            {transfer.survey_responses && isAdmin && (
              <button onClick={() => onGenerateDiagnosis(transfer)} disabled={isGenerating}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, border: 'none', background: '#8B5CF6', color: 'white', fontSize: 13, fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.7 : 1 }}>
                {isGenerating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                {isGenerating ? 'Gerando diagnóstico...' : 'Gerar diagnóstico agora'}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  const reasonInfo = diag.primary_reason ? (REASON_MAP[diag.primary_reason] ?? REASON_MAP['other']) : null
  const confidencePct = typeof diag.confidence === 'number'
    ? diag.confidence <= 1 ? Math.round(diag.confidence * 100) : Math.round(diag.confidence)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Aluno */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={18} color="#DC2626" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{transfer.student_name}</p>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{transfer.course_grade}</p>
        </div>
      </div>

      {/* Motivo + confiança lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {reasonInfo && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Motivo principal</p>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: reasonInfo.bg, color: reasonInfo.color }}>
              {reasonInfo.label}
            </span>
          </div>
        )}
        {confidencePct !== null && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confiança</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2d6b' }}>{confidencePct}%</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${confidencePct}%`, background: confidencePct >= 70 ? 'linear-gradient(90deg,#00A896,#0DD3BF)' : 'linear-gradient(90deg,#F59E0B,#FCD34D)', borderRadius: 99 }} />
            </div>
          </div>
        )}
      </div>

      {/* Diagnóstico */}
      {diag.diagnosis && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Diagnóstico completo</p>
          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: '12px 14px', borderRadius: 10 }}>{diag.diagnosis}</p>
        </div>
      )}

      {/* Fatores de risco */}
      {diag.risk_factors && diag.risk_factors.length > 0 && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fatores de risco</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {diag.risk_factors.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retenção */}
      {diag.retention_opportunity && diag.retention_note && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <CheckCircle size={15} color="#16a34a" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Oportunidade de retenção</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#15803d', lineHeight: 1.5 }}>{diag.retention_note}</p>
        </div>
      )}

      {/* Botões de status */}
      {transfer.status !== 'retained' && transfer.status !== 'confirmed' && transfer.status !== 'cancelled' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={() => onUpdateStatus(transfer.id, 'retained')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, border: 'none', background: '#f0fdf4', color: '#16a34a', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <CheckCircle size={14} /> Marcar como retido
          </button>
          <button onClick={() => onUpdateStatus(transfer.id, 'confirmed')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, border: 'none', background: '#FEE2E2', color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <ArrowRightLeft size={14} /> Transferência confirmada
          </button>
        </div>
      )}

      {(transfer.status === 'retained' || transfer.status === 'confirmed') && (
        <div style={{ padding: '10px 14px', borderRadius: 10, textAlign: 'center', fontSize: 13, fontWeight: 600, background: transfer.status === 'retained' ? '#f0fdf4' : '#FEF2F2', color: transfer.status === 'retained' ? '#16a34a' : '#DC2626' }}>
          {transfer.status === 'retained' ? '✓ Aluno retido' : '✗ Transferência confirmada'}
        </div>
      )}
    </div>
  )
}
