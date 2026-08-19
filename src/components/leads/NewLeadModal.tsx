// src/components/leads/NewLeadModal.tsx
//
// Formulário completo de criar/editar lead — fonte única de verdade,
// reaproveitado pelo LeadKanban (CRM principal) e pelo WhatsAppHub (chat das
// escolas). Antes o WhatsAppHub tinha seu próprio formulário divergente e
// mais enxuto (leadForm/handleCreateLead + um mini-form inline na sidebar),
// o que já causou pelo menos um bug (assigned_to nunca era setado por lá).
//
// `createDefaults` é o único ponto de extensão pensado especificamente pro
// caller do WhatsApp: sobrescreve os valores default do modo "novo lead"
// (ex.: pré-preencher responsável/telefone com os dados da conversa ativa,
// origem = "WhatsApp", responsável sugerido = atendente da conversa). Não
// afeta em nada o uso normal do LeadKanban, que não passa essa prop.
import React, { useState, useEffect } from 'react'
import {
  Plus, X, Save, Tag, Megaphone, UserPlus2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import { supabase, type Lead } from '../../lib/supabase'
import {
  type SimpleUser, type AuditEntry, type StudentEntry, type FamilyMatch,
  statusConfig, sourceOptions, LEAD_TEMPERATURES, LEAD_STAGES,
  avatarColor, applyPhoneMask,
} from './leadFormShared'

export interface NewLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Lead> & { familyMatchId?: string | null; additionalStudents?: StudentEntry[] }) => Promise<void>
  editingLead?: Lead | null
  onDelete?: (id: string) => void
  institutionId: string
  users: SimpleUser[]
  activeCampaignLabel?: string | null
  institutionCity?: string
  // Só aplicado no modo "novo lead" (editingLead ausente) — mescla por cima
  // dos defaults padrão do formulário.
  createDefaults?: Partial<{
    student_name: string; grade_interest: string; shift_interest: string
    responsible_name: string; phone: string; email: string; address: string; city: string
    budget_range: string; source: string; notes: string
    status: Lead['status']; assigned_to: string; next_followup: string
    lead_temperature: '' | 'frio' | 'morno' | 'quente'
    origin_school: string; referral_source: string; contest_name: string
  }>
}

export default function NewLeadModal({ isOpen, onClose, onSave, editingLead, onDelete, institutionId, users, activeCampaignLabel, institutionCity, createDefaults }: NewLeadModalProps) {
  const { user: modalUser } = useAuth()
  const { names: gradeNames } = useGradeLevels(institutionId)
  const [activeTab, setActiveTab] = useState<'dados' | 'historico' | 'anotacoes'>('dados')
  const [saving, setSaving] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [savingActivity, setSavingActivity] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<AuditEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [activityForm, setActivityForm] = useState({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().split('T')[0] })
  const [familyMatch, setFamilyMatch] = useState<FamilyMatch | null>(null)
  const [checkingFamily, setCheckingFamily] = useState(false)
  const [familyMatchId, setFamilyMatchId] = useState<string | null>(null)
  // Item 3 — filhos além do primeiro, preenchidos na mesma tela (tanto ao
  // criar quanto ao editar um lead já existente). O primeiro aluno continua
  // em formData (mantém o fluxo de edição de lead único intacto).
  const [extraStudents, setExtraStudents] = useState<StudentEntry[]>([])
  const addStudent = () => setExtraStudents(s => [...s, { student_name: '', grade_interest: '', shift_interest: '', origin_school: '' }])
  const updateStudent = (idx: number, patch: Partial<StudentEntry>) => setExtraStudents(s => s.map((st, i) => i === idx ? { ...st, ...patch } : st))
  const removeStudent = (idx: number) => setExtraStudents(s => s.filter((_, i) => i !== idx))
  const [formData, setFormData] = useState({
    student_name: '', grade_interest: '', shift_interest: '',
    responsible_name: '', phone: '', email: '', address: '', city: '',
    budget_range: '', source: '', notes: '',
    status: 'new' as Lead['status'],
    assigned_to: '' as string,
    next_followup: '' as string,
    lead_temperature: '' as '' | 'frio' | 'morno' | 'quente',
    origin_school: '', referral_source: '', contest_name: '',
  })

  useEffect(() => {
    if (!isOpen) return
    if (editingLead) {
      setFormData({
        student_name: editingLead.student_name ?? '',
        grade_interest: editingLead.grade_interest ?? '',
        shift_interest: (editingLead as any).shift_interest ?? '',
        responsible_name: editingLead.responsible_name ?? '',
        phone: editingLead.phone ?? '',
        email: editingLead.email ?? '',
        address: editingLead.address ?? '',
        city: editingLead.city ?? '',
        budget_range: editingLead.budget_range ?? '',
        source: editingLead.source ?? '',
        notes: editingLead.notes ?? '',
        status: editingLead.status ?? 'new',
        assigned_to: editingLead.assigned_to ?? '',
        next_followup: editingLead.next_followup ? editingLead.next_followup.slice(0, 10) : '',
        lead_temperature: editingLead.lead_temperature ?? '',
        origin_school: editingLead.origin_school ?? '',
        referral_source: editingLead.referral_source ?? '',
        contest_name: editingLead.contest_name ?? '',
      })
    } else {
      setFormData({
        student_name: '', grade_interest: '', shift_interest: '',
        responsible_name: '', phone: '', email: '', address: '', city: institutionCity ?? '',
        budget_range: '', source: '', notes: '',
        status: 'new',
        assigned_to: modalUser?.id ?? '',
        next_followup: '', lead_temperature: '',
        origin_school: '', referral_source: '', contest_name: '',
        ...createDefaults,
      })
    }
    setActiveTab('dados')
    setFieldErrors({})
    setQuickNote('')
    setHistory([])
    setFamilyMatch(null)
    setFamilyMatchId(null)
    setExtraStudents([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLead, isOpen])

  useEffect(() => {
    if (activeTab === 'historico' && editingLead?.id) {
      setLoadingHistory(true)
      ;(async () => {
        try {
          const instId = (editingLead as any).institution_id ?? ''
          const { data } = await supabase.from('audit_logs')
            .select('*')
            .eq('institution_id', instId)
            .eq('record_id', editingLead.id)
            .eq('module', 'lead')
            .order('created_at', { ascending: true })
            .limit(50)
          setHistory((data || []) as AuditEntry[])
        } catch { setHistory([]) }
        finally { setLoadingHistory(false) }
      })()
    }
  }, [activeTab, editingLead?.id])

  // ── Item 3b: detectar família já cadastrada com esse telefone ────────────
  // Só roda ao criar (não editar) e só depois que o campo perde foco, pra não
  // consultar a cada tecla digitada.
  const checkFamilyByPhone = async () => {
    if (editingLead || familyMatchId) return
    const digits = formData.phone.replace(/\D/g, '')
    if (digits.length < 10 || !institutionId) { setFamilyMatch(null); return }
    setCheckingFamily(true)
    try {
      const { data: fam } = await supabase
        .from('lead_families')
        .select('id, responsible_name, phone, email, address')
        .eq('institution_id', institutionId)
        .ilike('phone', `%${digits}%`)
        .limit(1)
        .maybeSingle()
      if (fam) {
        const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('family_id', fam.id)
        setFamilyMatch({ id: fam.id, responsible_name: fam.responsible_name, phone: fam.phone ?? '', email: fam.email, address: fam.address, childrenCount: count ?? 0 })
        return
      }
      // Lead avulso antigo com esse telefone, nunca agrupado em família.
      const { data: soloLead } = await supabase
        .from('leads')
        .select('id, responsible_name, phone, email, address')
        .eq('institution_id', institutionId)
        .is('family_id', null)
        .ilike('phone', `%${digits}%`)
        .limit(1)
        .maybeSingle()
      if (soloLead) {
        setFamilyMatch({ id: `retro:${soloLead.id}`, responsible_name: soloLead.responsible_name, phone: soloLead.phone ?? '', email: soloLead.email ?? null, address: soloLead.address ?? null, childrenCount: 1 })
      } else {
        setFamilyMatch(null)
      }
    } catch { setFamilyMatch(null) } finally { setCheckingFamily(false) }
  }

  const acceptFamilyMatch = () => {
    if (!familyMatch) return
    setFamilyMatchId(familyMatch.id)
    setFormData(f => ({
      ...f,
      responsible_name: familyMatch.responsible_name || f.responsible_name,
      phone: familyMatch.phone || f.phone,
      email: familyMatch.email || f.email,
      address: familyMatch.address || f.address,
    }))
  }

  const dismissFamilyMatch = () => { setFamilyMatch(null); setFamilyMatchId(null) }

  // ── Etiquetas ──────────────────────────────────────────────────────────
  const [leadTags, setLeadTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [tagToast, setTagToast] = useState('')

  useEffect(() => { setLeadTags(editingLead?.tags || []) }, [editingLead])

  useEffect(() => {
    if (!institutionId) return
    ;(async () => {
      const { data } = await supabase.from('whatsapp_tags').select('id, name, color').eq('institution_id', institutionId).order('name')
      if (data) setAvailableTags(data as { id: string; name: string; color: string }[])
    })()
  }, [institutionId])

  const handleAddLeadTag = async (tagName: string) => {
    if (!editingLead || leadTags.includes(tagName)) return
    const newTags = [...leadTags, tagName]
    setLeadTags(newTags)
    const { error } = await supabase.from('leads').update({ tags: newTags }).eq('id', editingLead.id)
    if (error) { console.error('[NewLeadModal] erro ao adicionar etiqueta:', error); setTagToast('Erro ao adicionar etiqueta') }
    else setTagToast('Etiqueta adicionada!')
    setTimeout(() => setTagToast(''), 2500)
  }

  const handleRemoveLeadTag = async (tagName: string) => {
    if (!editingLead) return
    const newTags = leadTags.filter(t => t !== tagName)
    setLeadTags(newTags)
    const { error } = await supabase.from('leads').update({ tags: newTags }).eq('id', editingLead.id)
    if (error) { console.error('[NewLeadModal] erro ao remover etiqueta:', error); setTagToast('Erro ao remover etiqueta') }
    else setTagToast('Etiqueta removida!')
    setTimeout(() => setTagToast(''), 2500)
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.student_name.trim()) errors.student_name = 'Obrigatório'
    if (!formData.responsible_name.trim()) errors.responsible_name = 'Obrigatório'
    if (!formData.phone.trim()) errors.phone = 'Obrigatório'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { setActiveTab('dados'); return }
    setSaving(true)
    try {
      // Filhos extras com nome em branco são descartados silenciosamente —
      // é um bloco que o usuário abriu e não chegou a preencher, não um erro.
      const additionalStudents = extraStudents.filter(s => s.student_name.trim()).map(s => ({ ...s, student_name: s.student_name.trim() }))
      await onSave({ ...formData, lead_temperature: formData.lead_temperature || null, familyMatchId, additionalStudents })
      onClose()
    } finally { setSaving(false) }
  }

  const handleSaveNote = async () => {
    if (!editingLead) return
    const noteText = quickNote || formData.notes
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      await supabase.from('leads').update({ notes: noteText }).eq('id', editingLead.id)
      setFormData(f => ({ ...f, notes: noteText }))
    } catch {} finally { setSavingNote(false) }
  }

  const handleAddActivity = async () => {
    if (!editingLead || !activityForm.descricao.trim()) return
    setSavingActivity(true)
    try {
      const instId = (editingLead as any).institution_id ?? ''
      await supabase.from('audit_logs').insert({
        institution_id: instId, module: 'lead', record_id: editingLead.id,
        action: activityForm.tipo,
        field_changed: activityForm.descricao,
        new_value: activityForm.data,
        user_id: modalUser?.id || null, user_name: modalUser?.full_name || 'Atendente', user_role: '',
      })
      setActivityForm({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().split('T')[0] })
      const { data: h } = await supabase.from('audit_logs')
        .select('*').eq('institution_id', instId).eq('record_id', editingLead.id).eq('module', 'lead')
        .order('created_at', { ascending: true }).limit(50)
      setHistory((h || []) as AuditEntry[])
    } catch {} finally { setSavingActivity(false) }
  }

  if (!isOpen) return null

  const initials = (formData.responsible_name || formData.student_name || '?').charAt(0).toUpperCase()
  const bgColor = avatarColor(formData.responsible_name || formData.student_name || '?')
  const curStageIdx = LEAD_STAGES.findIndex(s => s.key === formData.status)
  const formatDT = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const showReferral = formData.source === 'Indicação'
  const showContest = formData.source === 'Concurso de Bolsas'

  const getEventIcon = (action: string) => {
    if (action === 'Lead criado') return '📝'
    if (action === 'Lead editado') return '✏️'
    if (action === 'Lead perdido') return '❌'
    if (action === 'Lead reaberto') return '🔓'
    if (action === 'Status alterado') return '🔄'
    if (action === 'Visita agendada') return '📅'
    if (action === 'Ligação') return '📞'
    if (action === 'Email' || action === 'E-mail') return '📧'
    if (action === 'WhatsApp') return '💬'
    if (action === 'Presencial') return '🤝'
    return '📌'
  }
  const getEventColor = (action: string) => {
    if (action === 'Lead criado') return '#10B981'
    if (action === 'Lead editado') return '#3B82F6'
    if (action === 'Lead perdido') return '#EF4444'
    if (action === 'Lead reaberto') return '#3B82F6'
    if (action === 'Status alterado') return '#8B5CF6'
    if (action === 'Visita agendada') return '#F59E0B'
    if (action === 'Ligação') return '#06B6D4'
    if (action === 'WhatsApp') return '#25D366'
    if (action === 'Email' || action === 'E-mail') return '#3B82F6'
    if (action === 'Presencial') return '#F97316'
    return '#94A3B8'
  }
  const buildDesc = (item: AuditEntry): string => item.field_changed || item.new_value || ''

  const tabBtn = (tab: typeof activeTab, label: string) => (
    <button onClick={() => setActiveTab(tab)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid #00A896' : '2px solid transparent', color: activeTab === tab ? '#00A896' : '#64748B', background: 'transparent', transition: 'all 0.15s' }}>{label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #00A896 0%, #007A6E 100%)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: bgColor, border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.responsible_name || 'Novo Lead'}</div>
            {formData.student_name && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Aluno: {formData.student_name}
                {extraStudents.filter(s => s.student_name.trim()).length > 0 && ` + ${extraStudents.filter(s => s.student_name.trim()).length} irmão(s)`}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {formData.status && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.25)', color: '#fff' }}>{statusConfig[formData.status]?.label}</span>}
              {formData.lead_temperature && (() => {
                const t = LEAD_TEMPERATURES.find(x => x.value === formData.lead_temperature)!
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.25)', color: '#fff' }}><t.icon size={11} />{t.label}</span>
              })()}
              {formData.phone && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>📞 {formData.phone}</span>}
              {formData.email && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>✉ {formData.email}</span>}
            </div>
            {(activeCampaignLabel && (!editingLead || editingLead.campaign_cycle_id)) && (
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                <Megaphone size={11} /> {editingLead ? `Campanha ${activeCampaignLabel}` : `Será vinculado à campanha ${activeCampaignLabel}`}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 15, height: 15, color: '#fff' }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0, paddingLeft: 8 }}>
          {tabBtn('dados', 'Dados')}
          {editingLead && tabBtn('historico', 'Histórico')}
          {editingLead && tabBtn('anotacoes', 'Anotações')}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ABA DADOS */}
          {activeTab === 'dados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Dados do Responsável</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nome completo *</label>
                    <input value={formData.responsible_name} onChange={e => { setFormData(f => ({ ...f, responsible_name: e.target.value })); setFieldErrors(p => ({ ...p, responsible_name: '' })) }} placeholder="Nome do responsável"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: fieldErrors.responsible_name ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    {fieldErrors.responsible_name && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{fieldErrors.responsible_name}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Telefone / WhatsApp *</label>
                    <input value={formData.phone}
                      onChange={e => { setFormData(f => ({ ...f, phone: applyPhoneMask(e.target.value) })); setFieldErrors(p => ({ ...p, phone: '' })) }}
                      onBlur={checkFamilyByPhone}
                      placeholder="11 99999-9999"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: fieldErrors.phone ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    {fieldErrors.phone && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{fieldErrors.phone}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>E-mail</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Cidade</label>
                    <input value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} placeholder="Cidade da família"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                </div>

                {/* Item 3b — família já cadastrada com esse telefone */}
                {!editingLead && checkingFamily && (
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Verificando telefone...</p>
                )}
                {!editingLead && familyMatch && !familyMatchId && (
                  <div style={{ marginTop: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserPlus2 size={16} color="#1D4ED8" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1E40AF' }}>Já existe um cadastro com esse telefone: {familyMatch.responsible_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#3B82F6' }}>{familyMatch.childrenCount} aluno{familyMatch.childrenCount === 1 ? '' : 's'} já cadastrado{familyMatch.childrenCount === 1 ? '' : 's'} nessa família</p>
                    </div>
                    <button onClick={acceptFamilyMatch} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: '#1D4ED8', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Adicionar a essa família
                    </button>
                    <button onClick={() => setFamilyMatch(null)} title="Ignorar" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD' }}>
                      <X size={14} />
                    </button>
                  </div>
                )}
                {!editingLead && familyMatchId && (
                  <div style={{ marginTop: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserPlus2 size={14} color="#16A34A" />
                    <p style={{ margin: 0, flex: 1, fontSize: 12, fontWeight: 600, color: '#15803D' }}>Vinculado à família de {formData.responsible_name} — este será mais um aluno da mesma família</p>
                    <button onClick={dismissFamilyMatch} title="Desvincular" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ADE80' }}><X size={13} /></button>
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{editingLead ? 'Dados do Aluno' : 'Aluno(s)'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nome do aluno *</label>
                    <input value={formData.student_name} onChange={e => { setFormData(f => ({ ...f, student_name: e.target.value })); setFieldErrors(p => ({ ...p, student_name: '' })) }} placeholder="Nome completo do aluno"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: fieldErrors.student_name ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    {fieldErrors.student_name && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{fieldErrors.student_name}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Série de interesse</label>
                    <select value={formData.grade_interest} onChange={e => setFormData(f => ({ ...f, grade_interest: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Selecione</option>
                      {gradeNames.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Turno</label>
                    <select value={formData.shift_interest} onChange={e => setFormData(f => ({ ...f, shift_interest: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Selecione</option>
                      <option value="Manhã">Manhã</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Integral">Integral</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Escola de origem</label>
                    <input value={formData.origin_school} onChange={e => setFormData(f => ({ ...f, origin_school: e.target.value }))} placeholder="Escola onde o aluno estuda/estudou (opcional)"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                </div>

                {/* Filhos extras — cria tudo (família + N leads) na mesma tela,
                    sem depender de detecção retroativa por telefone. Funciona
                    tanto ao criar quanto ao editar um lead existente (nesse
                    caso, vincula à família do lead se já existir, ou cria
                    uma nova família na hora). */}
                {extraStudents.map((st, idx) => (
                  <div key={idx} style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px dashed #CBD5E1', background: '#F8FAFC', position: 'relative' }}>
                    <button onClick={() => removeStudent(idx)} title="Remover aluno" type="button"
                      style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                      <X size={13} />
                    </button>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>Filho {idx + 2}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nome do aluno</label>
                        <input value={st.student_name} onChange={e => updateStudent(idx, { student_name: e.target.value })} placeholder="Nome completo do aluno"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Série de interesse</label>
                        <select value={st.grade_interest} onChange={e => updateStudent(idx, { grade_interest: e.target.value })}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                          <option value="">Selecione</option>
                          {gradeNames.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Turno</label>
                        <select value={st.shift_interest} onChange={e => updateStudent(idx, { shift_interest: e.target.value })}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                          <option value="">Selecione</option>
                          <option value="Manhã">Manhã</option>
                          <option value="Tarde">Tarde</option>
                          <option value="Integral">Integral</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Escola de origem</label>
                        <input value={st.origin_school} onChange={e => updateStudent(idx, { origin_school: e.target.value })} placeholder="Escola onde o aluno estuda/estudou (opcional)"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addStudent} type="button"
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1.5px dashed #14b8a6', background: '#F0FDFB', color: '#0d9488', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <Plus size={14} /> Adicionar outro filho
                </button>
                {editingLead && (
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                    {editingLead.family_id
                      ? 'O(s) novo(s) filho(s) serão vinculados à mesma família deste lead.'
                      : 'Ao salvar, será criada uma família vinculando este lead ao(s) novo(s) filho(s) adicionado(s).'}
                  </p>
                )}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Informações do Lead</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Origem</label>
                    <select value={formData.source} onChange={e => setFormData(f => ({ ...f, source: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Selecione</option>
                      {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Responsável (atendente)</label>
                    <select value={formData.assigned_to} onChange={e => setFormData(f => ({ ...f, assigned_to: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Sem responsável</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                  {/* Item 11b — campos condicionais conforme a origem selecionada */}
                  {showReferral && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Quem indicou?</label>
                      <input value={formData.referral_source} onChange={e => setFormData(f => ({ ...f, referral_source: e.target.value }))} placeholder="Nome de quem indicou"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    </div>
                  )}
                  {showContest && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Qual concurso/bolsa?</label>
                      <input value={formData.contest_name} onChange={e => setFormData(f => ({ ...f, contest_name: e.target.value }))} placeholder="Ex: Concurso de Bolsas 2027"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Próximo follow-up</label>
                    <input type="date" value={formData.next_followup} onChange={e => setFormData(f => ({ ...f, next_followup: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Temperatura</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {LEAD_TEMPERATURES.map(t => {
                        const active = formData.lead_temperature === t.value
                        return (
                          <button key={t.value} type="button"
                            onClick={() => setFormData(f => ({ ...f, lead_temperature: active ? '' : t.value }))}
                            title={t.label}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 0', borderRadius: 9, border: `1.5px solid ${active ? t.color : '#E2E8F0'}`, background: active ? t.bg : '#fff', color: active ? t.color : '#94A3B8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            <t.icon size={13} />{t.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {editingLead && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Funil de Status</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {LEAD_STAGES.map((stage, idx) => {
                        const done = idx < curStageIdx; const active = idx === curStageIdx
                        return (
                          <React.Fragment key={stage.key}>
                            <div onClick={() => setFormData(f => ({ ...f, status: stage.key as Lead['status'] }))} title={stage.label}
                              style={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done || active ? '#00A896' : '#E2E8F0', border: active ? '2.5px solid #007A6E' : '2px solid transparent', boxShadow: active ? '0 0 0 3px rgba(0,168,150,0.2)' : 'none', transition: 'all 0.15s' }}>
                              {done && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>✓</span>}
                            </div>
                            {idx < LEAD_STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: done ? '#00A896' : '#E2E8F0', transition: 'background 0.2s' }} />}
                          </React.Fragment>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex' }}>
                      {LEAD_STAGES.map((stage, idx) => (
                        <div key={stage.key} style={{ flex: idx === 0 ? '0 0 22px' : 1, textAlign: idx === 0 ? 'left' : idx === LEAD_STAGES.length - 1 ? 'right' : 'center' }}>
                          <span style={{ fontSize: 10, color: idx === curStageIdx ? '#00A896' : '#94A3B8', fontWeight: idx === curStageIdx ? 700 : 400 }}>{stage.label}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setFormData(f => ({ ...f, status: 'lost' }))}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: formData.status === 'lost' ? '#EF4444' : '#FEF2F2', color: formData.status === 'lost' ? '#fff' : '#DC2626', transition: 'all 0.15s' }}>
                      {formData.status === 'lost' ? '🔴 Perdido' : 'Marcar como Perdido'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA HISTÓRICO */}
          {activeTab === 'historico' && editingLead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Registrar atividade */}
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', marginBottom: 10 }}>Registrar atividade</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select value={activityForm.tipo} onChange={e => setActivityForm(f => ({ ...f, tipo: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none', background: '#fff', color: '#1A2B4A' }}>
                    <option>Ligação</option><option>Email</option><option>WhatsApp</option><option>Presencial</option><option>Outro</option>
                  </select>
                  <input type="date" value={activityForm.data} onChange={e => setActivityForm(f => ({ ...f, data: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none', color: '#1A2B4A' }} />
                </div>
                <textarea value={activityForm.descricao} onChange={e => setActivityForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o contato..." rows={2}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box', color: '#1A2B4A', marginBottom: 8 }} />
                <button onClick={handleAddActivity} disabled={savingActivity || !activityForm.descricao.trim()}
                  style={{ padding: '6px 14px', borderRadius: 8, background: '#00A896', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingActivity || !activityForm.descricao.trim() ? 0.5 : 1 }}>
                  {savingActivity ? 'Salvando...' : 'Registrar'}
                </button>
              </div>

              {/* Timeline */}
              {loadingHistory
                ? <div style={{ textAlign: 'center', padding: 32 }}><div className="animate-spin rounded-full h-7 w-7 border-4 border-[#00A896] border-t-transparent mx-auto" /></div>
                : history.length === 0
                  ? <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 13 }}>Nenhuma atividade registrada</div>
                  : (
                    <div style={{ position: 'relative', paddingLeft: 28 }}>
                      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: '#E2E8F0', borderRadius: 1 }} />
                      {history.map((item, idx) => {
                        const color = getEventColor(item.action)
                        const desc = buildDesc(item)
                        return (
                          <div key={item.id} style={{ position: 'relative', marginBottom: idx < history.length - 1 ? 12 : 0 }}>
                            <div style={{
                              position: 'absolute', left: -25, top: 13,
                              width: 12, height: 12, borderRadius: '50%',
                              background: color, border: '2.5px solid #fff',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.18)', zIndex: 1,
                            }} />
                            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '10px 14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>
                                  {getEventIcon(item.action)} {item.action}
                                </span>
                                <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>{formatDT(item.created_at)}</span>
                              </div>
                              {desc && <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 4px', lineHeight: 1.5 }}>{desc}</p>}
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>por {item.user_name || 'Sistema'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
              }
            </div>
          )}

          {/* ABA ANOTAÇÕES */}
          {activeTab === 'anotacoes' && editingLead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={13} color="#6366F1" /> Etiquetas</h4>
                  {tagToast && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{tagToast}</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {leadTags.length === 0 && (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {availableTags.length === 0 ? 'Configure etiquetas em Configurações → Etiquetas' : 'Nenhuma etiqueta'}
                    </span>
                  )}
                  {leadTags.map(tag => {
                    const color = availableTags.find(t => t.name === tag)?.color || '#6366f1'
                    return (
                      <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: color, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                        {tag}
                        <button onClick={() => handleRemoveLeadTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    )
                  })}
                </div>
                {availableTags.length > 0 && (
                  <select value="" onChange={e => { if (e.target.value) handleAddLeadTag(e.target.value) }}
                    style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid #D1FAE5', background: '#F0FDFB', color: '#1A2B4A', outline: 'none', cursor: 'pointer', maxWidth: 280 }}>
                    <option value="">+ Adicionar etiqueta...</option>
                    {availableTags.filter(t => !leadTags.includes(t.name)).map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', marginBottom: 8 }}>Nota sobre este lead</p>
                <textarea value={quickNote || formData.notes} onChange={e => setQuickNote(e.target.value)} placeholder="Anotações importantes sobre este lead..." rows={6}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: '#1A2B4A', lineHeight: 1.6 }} />
                <button onClick={handleSaveNote} disabled={savingNote}
                  style={{ marginTop: 8, padding: '7px 16px', borderRadius: 9, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingNote ? 0.6 : 1 }}>
                  {savingNote ? 'Salvando...' : 'Salvar nota'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>A nota fica visível para toda a equipe.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#F8FAFC' }}>
          {editingLead && onDelete
            ? <button onClick={() => onDelete(editingLead.id)} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#DC2626' }}>Excluir lead</button>
            : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748B' }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 9, background: saving ? '#94A3B8' : '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
              {saving
                ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />Salvando...</>
                : <><Save style={{ width: 14, height: 14 }} />{editingLead ? 'Salvar alterações' : 'Criar Lead'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
