import React, { useState, useEffect } from 'react'
import {
  ArrowRightLeft, Plus, Copy, ExternalLink, Sparkles, Eye,
  AlertTriangle, CheckCircle, Clock, Users, X, ChevronRight,
  Loader2, Check
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

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
  created_at: string
}

interface DiagnosisData {
  primary_reason?: string
  confidence?: number
  diagnosis?: string
  risk_factors?: string[]
  retention_opportunity?: boolean
  retention_note?: string
}

interface NewTransferForm {
  studentName: string
  grade: string
  statedReason: string
  internalNotes: string
}

// ─── constants ────────────────────────────────────────────────────────────────
const GRADES = [
  'Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V',
  '1º Ano EF','2º Ano EF','3º Ano EF','4º Ano EF','5º Ano EF',
  '6º Ano EF','7º Ano EF','8º Ano EF','9º Ano EF','Ensino Médio 1','Ensino Médio 2','Ensino Médio 3',
]

const REASON_MAP: Record<string, { label: string; color: string; bg: string }> = {
  financial:   { label: 'Financeiro',    color: '#dc2626', bg: '#fee2e2' },
  pedagogical: { label: 'Pedagógico',    color: '#d97706', bg: '#fef3c7' },
  distance:    { label: 'Localização',   color: '#64748b', bg: '#f1f5f9' },
  competition: { label: 'Outra escola',  color: '#7c3aed', bg: '#ede9fe' },
  relocation:  { label: 'Mudança',       color: '#64748b', bg: '#f1f5f9' },
  relationship:{ label: 'Relacionamento',color: '#7c3aed', bg: '#ede9fe' },
  other:       { label: 'Outro',         color: '#64748b', bg: '#f1f5f9' },
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
function parseDiagnosis(raw: string | null): DiagnosisData | null {
  if (!raw) return null
  try { return typeof raw === 'object' ? (raw as DiagnosisData) : JSON.parse(raw) }
  catch { return null }
}

function getStatusInfo(t: Transfer) {
  if (t.ai_diagnosis)      return { label: 'Diagnóstico pronto', color: '#16a34a', bg: '#dcfce7' }
  if (t.survey_responses)  return { label: 'Respondido',         color: '#1d4ed8', bg: '#dbeafe' }
  if (t.survey_token)      return { label: 'Pesquisa enviada',   color: '#d97706', bg: '#fef3c7' }
  return                          { label: 'Aguardando pesquisa',color: '#64748b', bg: '#f1f5f9' }
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(n) }

// ─── component ────────────────────────────────────────────────────────────────
export default function GestorTransfers() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!

  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [diagnosisTransfer, setDiagnosisTransfer] = useState<Transfer | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [savingNew, setSavingNew] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newForm, setNewForm] = useState<NewTransferForm>({ studentName: '', grade: '', statedReason: '', internalNotes: '' })
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!institutionId) return
    load()
  }, [institutionId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('student_transfers')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
      setTransfers((data ?? []) as Transfer[])
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveNew() {
    if (!newForm.studentName.trim()) { setFormError('Nome do aluno é obrigatório.'); return }
    if (!newForm.grade) { setFormError('Selecione a série.'); return }
    setFormError(null)
    setSavingNew(true)
    try {
      const { error } = await supabase.from('student_transfers').insert({
        institution_id: institutionId,
        student_name: newForm.studentName.trim(),
        course_grade: newForm.grade,
        transfer_date: new Date().toISOString().split('T')[0],
        stated_reason: newForm.statedReason || null,
        internal_notes: newForm.internalNotes || null,
        created_at: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      setShowNewModal(false)
      setNewForm({ studentName: '', grade: '', statedReason: '', internalNotes: '' })
      await load()
      showToast('Transferência registrada com sucesso.')
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSavingNew(false)
    }
  }

  async function handleGenerateLink(t: Transfer) {
    const token = crypto.randomUUID()
    const { error } = await supabase
      .from('student_transfers')
      .update({ survey_token: token })
      .eq('id', t.id)
    if (error) { showToast('Erro ao gerar link.'); return }
    const surveyUrl = `${window.location.origin}/survey/${token}`
    try { await navigator.clipboard.writeText(surveyUrl) } catch { /* ignore clipboard errors */ }
    showToast('Link copiado! Envie para a família via WhatsApp.')
    await load()
  }

  async function handleCopyLink(t: Transfer) {
    if (!t.survey_token) return
    const surveyUrl = `${window.location.origin}/survey/${t.survey_token}`
    try { await navigator.clipboard.writeText(surveyUrl) } catch { /* ignore */ }
    showToast('Link copiado para a área de transferência.')
  }

  async function handleGenerateDiagnosis(t: Transfer) {
    if (!t.survey_responses) return
    setGeneratingId(t.id)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer_diagnosis',
          payload: {
            responses: t.survey_responses,
            studentName: t.student_name,
            grade: t.course_grade,
          },
        }),
      })
      const { result } = await response.json()
      const { error } = await supabase
        .from('student_transfers')
        .update({ ai_diagnosis: JSON.stringify(result) })
        .eq('id', t.id)
      if (error) throw new Error(error.message)
      setTransfers(prev => prev.map(x => x.id === t.id ? { ...x, ai_diagnosis: JSON.stringify(result) } : x))
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
  const total = transfers.length
  const withDiagnosis = transfers.filter(t => t.ai_diagnosis).length
  const pending = transfers.filter(t => !t.survey_token && !t.ai_diagnosis).length
  const thisMonth = transfers.filter(t => new Date(t.created_at).getMonth() === new Date().getMonth() && new Date(t.created_at).getFullYear() === new Date().getFullYear()).length

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
          animation: 'fadeIn 0.2s ease',
        }}>
          <Check size={14} /> {toast}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRightLeft size={18} color="#DC2626" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Transferências</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46 }}>
            Gerencie solicitações de transferência e entenda os motivos reais
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10, border: 'none',
            background: '#DC2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          <Plus size={15} /> Nova transferência
        </button>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 90, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }} className="animate-pulse" />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard label="Total" value={fmt(total)} icon={<ArrowRightLeft size={18} color="#DC2626" />} bg="#FEE2E2" />
          <KpiCard label="Este mês" value={fmt(thisMonth)} icon={<Clock size={18} color="#D97706" />} bg="#FEF3C7" />
          <KpiCard label="Aguardando pesquisa" value={fmt(pending)} icon={<AlertTriangle size={18} color="#64748B" />} bg="#F1F5F9" />
          <KpiCard label="Com diagnóstico IA" value={fmt(withDiagnosis)} icon={<Sparkles size={18} color="#8B5CF6" />} bg="#EDE9FE" />
        </div>
      )}

      {/* ── Tabela ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
            Registros de transferência
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => <div key={i} style={{ height: 52, borderRadius: 10, background: '#f8fafc' }} className="animate-pulse" />)}
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ArrowRightLeft size={24} color="#DC2626" />
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Nenhuma transferência registrada</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', maxWidth: 440, marginInline: 'auto', lineHeight: 1.6 }}>
              Quando uma família solicitar transferência, registre aqui para acompanhar e entender os motivos reais com auxílio da IA.
            </p>
            <button onClick={() => setShowNewModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#DC2626', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} /> Registrar primeira transferência
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Nome do aluno', 'Série', 'Data', 'Status', 'Diagnóstico', 'Ações'].map(col => (
                    <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, idx) => {
                  const status = getStatusInfo(t)
                  const diag = parseDiagnosis(t.ai_diagnosis)
                  const reasonInfo = t.reason_category ? REASON_MAP[t.reason_category] : null
                  const isGenerating = generatingId === t.id
                  return (
                    <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {/* Nome */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.student_name}</div>
                        {t.stated_reason && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.stated_reason}
                          </div>
                        )}
                      </td>

                      {/* Série */}
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>
                        {t.course_grade}
                      </td>

                      {/* Data */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(t.transfer_date).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                          fontSize: 11, fontWeight: 600,
                          background: status.bg, color: status.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {status.label}
                        </span>
                        {t.status === 'retained' && (
                          <span style={{ display: 'inline-block', marginLeft: 6, padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>
                            Retido ✓
                          </span>
                        )}
                      </td>

                      {/* Diagnóstico */}
                      <td style={{ padding: '12px 16px' }}>
                        {diag?.primary_reason ? (
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                            fontSize: 11, fontWeight: 600,
                            ...(reasonInfo ?? REASON_MAP['other']),
                          }}>
                            {REASON_MAP[diag.primary_reason]?.label ?? diag.primary_reason}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {/* sem token → Gerar link */}
                          {!t.survey_token && (
                            <ActionButton onClick={() => handleGenerateLink(t)} color="#8B5CF6" bg="#EDE9FE" icon={<ExternalLink size={12} />} label="Gerar link" />
                          )}

                          {/* tem token, sem resposta → Copiar + Ver */}
                          {t.survey_token && !t.survey_responses && (
                            <>
                              <ActionButton onClick={() => handleCopyLink(t)} color="#D97706" bg="#FEF3C7" icon={<Copy size={12} />} label="Copiar link" />
                              <a
                                href={`${window.location.origin}/survey/${t.survey_token}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                                <ExternalLink size={12} /> Ver link
                              </a>
                            </>
                          )}

                          {/* tem respostas, sem diagnóstico → Gerar diagnóstico */}
                          {t.survey_responses && !t.ai_diagnosis && (
                            <button
                              onClick={() => handleGenerateDiagnosis(t)}
                              disabled={isGenerating}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#EDE9FE', color: '#7C3AED', border: 'none', fontSize: 11, fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.7 : 1 }}>
                              {isGenerating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                              {isGenerating ? 'Gerando...' : 'Gerar diagnóstico IA'}
                            </button>
                          )}

                          {/* tem diagnóstico → Ver */}
                          {t.ai_diagnosis && (
                            <ActionButton onClick={() => { setDiagnosisTransfer(t) }} color="#16a34a" bg="#dcfce7" icon={<Eye size={12} />} label="Ver diagnóstico" />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Nova transferência ─────────────────────────────────────── */}
      {showNewModal && (
        <Modal onClose={() => { setShowNewModal(false); setFormError(null) }} title="Registrar transferência">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome do aluno <span style={{ color: '#F43F5E' }}>*</span></label>
              <input
                style={inputStyle}
                placeholder="Nome completo"
                value={newForm.studentName}
                onChange={e => setNewForm(f => ({ ...f, studentName: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle}>Série <span style={{ color: '#F43F5E' }}>*</span></label>
              <select
                style={inputStyle}
                value={newForm.grade}
                onChange={e => setNewForm(f => ({ ...f, grade: e.target.value }))}>
                <option value="">Selecione a série...</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Motivo informado pela família</label>
              <input
                style={inputStyle}
                placeholder="Opcional — o que a família disse"
                value={newForm.statedReason}
                onChange={e => setNewForm(f => ({ ...f, statedReason: e.target.value }))}
              />
            </div>

            <div>
              <label style={labelStyle}>Observações internas</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                placeholder="Opcional — anotações para a equipe"
                value={newForm.internalNotes}
                onChange={e => setNewForm(f => ({ ...f, internalNotes: e.target.value }))}
              />
            </div>

            {formError && (
              <p style={{ margin: 0, fontSize: 13, color: '#DC2626', background: '#FFF5F5', padding: '8px 12px', borderRadius: 8 }}>{formError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => { setShowNewModal(false); setFormError(null) }}
                style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer', fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={handleSaveNew} disabled={savingNew}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 9, border: 'none', background: '#DC2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: savingNew ? 'not-allowed' : 'pointer', opacity: savingNew ? 0.7 : 1 }}>
                {savingNew ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><ChevronRight size={13} /> Registrar</>}
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
          />
        </Modal>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
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

function ActionButton({ onClick, color, bg, icon, label }: { onClick: () => void; color: string; bg: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 7,
      background: bg, color, border: 'none',
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>
      {icon} {label}
    </button>
  )
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%',
        maxWidth: wide ? 680 : 500, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function DiagnosisView({ transfer, onUpdateStatus }: { transfer: Transfer; onUpdateStatus: (id: string, status: string) => void }) {
  const diag = parseDiagnosis(transfer.ai_diagnosis)
  if (!diag) return <p style={{ color: '#94a3b8', fontSize: 13 }}>Diagnóstico não disponível.</p>

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

      {/* Motivo principal */}
      {diag.primary_reason && reasonInfo && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Motivo principal</p>
          <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: reasonInfo.bg, color: reasonInfo.color }}>
            {reasonInfo.label}
          </span>
        </div>
      )}

      {/* Confiança */}
      {confidencePct !== null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confiança da análise</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2d6b' }}>{confidencePct}%</span>
          </div>
          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${confidencePct}%`, background: confidencePct >= 70 ? 'linear-gradient(90deg, #00A896, #0DD3BF)' : 'linear-gradient(90deg, #F59E0B, #FCD34D)', borderRadius: 99 }} />
          </div>
        </div>
      )}

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

      {/* Oportunidade de retenção */}
      {diag.retention_opportunity && diag.retention_note && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <CheckCircle size={15} color="#16a34a" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Oportunidade de retenção</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#15803d', lineHeight: 1.5 }}>{diag.retention_note}</p>
        </div>
      )}

      {/* Ações de status */}
      {transfer.status !== 'retained' && transfer.status !== 'confirmed' && (
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
        <div style={{ padding: '10px 14px', borderRadius: 10, background: transfer.status === 'retained' ? '#f0fdf4' : '#FEF2F2', textAlign: 'center', fontSize: 13, fontWeight: 600, color: transfer.status === 'retained' ? '#16a34a' : '#DC2626' }}>
          {transfer.status === 'retained' ? '✓ Aluno retido' : '✗ Transferência confirmada'}
        </div>
      )}
    </div>
  )
}
