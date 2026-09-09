// src/components/reports/LinkLeadsToCampaignModal.tsx
//
// Vincula leads já existentes (cadastrados fora do fluxo normal de captação,
// ou de antes da campanha ter sido criada) ao ciclo de campanha atual.
//
// Aba "Por período": busca leads sem campanha (campaign_cycle_id IS NULL)
// dentro de um intervalo de datas e vincula em lote — nunca sobrescreve um
// vínculo já existente com outra campanha, por isso o filtro IS NULL tanto
// na contagem quanto no UPDATE final.
//
// Aba "Selecionar manualmente": busca por nome/telefone (mesmo padrão de
// debounce 350ms/min. 2 caracteres usado em ContactsModule) e permite
// selecionar leads específicos. Aqui a vinculação é uma ação deliberada do
// usuário sobre um lead específico, então pode sobrescrever um vínculo
// existente — mas o lead já vinculado a outra campanha é sinalizado
// visualmente antes de deixar selecionar, pra não ser um erro silencioso.
import React, { useState, useEffect, useCallback } from 'react'
import { X, Calendar, Search, Link2, Loader2, CheckCircle, AlertTriangle, Users } from 'lucide-react'
import { supabase, type Lead } from '../../lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  institutionId: string
  cycleId: string
  cycleLabel: string
}

type SearchLead = Pick<Lead, 'id' | 'student_name' | 'responsible_name' | 'phone' | 'status' | 'campaign_cycle_id'>

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', width: '100%'
}

export default function LinkLeadsToCampaignModal({ isOpen, onClose, institutionId, cycleId, cycleLabel }: Props) {
  const [activeTab, setActiveTab] = useState<'periodo' | 'manual'>('periodo')

  // ── Aba período ──────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [periodError, setPeriodError] = useState('')
  const [periodDone, setPeriodDone] = useState<number | null>(null)

  const resetPeriodTab = () => {
    setPreviewCount(null)
    setPeriodError('')
    setPeriodDone(null)
  }

  const handlePreview = async () => {
    setPeriodError('')
    setPeriodDone(null)
    if (!startDate || !endDate) {
      setPeriodError('Selecione a data inicial e a data final.')
      return
    }
    if (startDate > endDate) {
      setPeriodError('A data inicial não pode ser depois da data final.')
      return
    }
    setPreviewLoading(true)
    try {
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .is('campaign_cycle_id', null)
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59.999`)
      if (error) throw error
      setPreviewCount(count ?? 0)
    } catch (e) {
      console.error(e)
      setPeriodError('Erro ao buscar leads do período.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirmPeriod = async () => {
    setApplying(true)
    setPeriodError('')
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({ campaign_cycle_id: cycleId })
        .eq('institution_id', institutionId)
        .is('campaign_cycle_id', null)
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59.999`)
        .select('id')
      if (error) throw error
      setPeriodDone(data?.length ?? 0)
      setPreviewCount(null)
    } catch (e) {
      console.error(e)
      setPeriodError('Erro ao vincular os leads. Tente novamente.')
    } finally {
      setApplying(false)
    }
  }

  // ── Aba manual ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchLead[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [linking, setLinking] = useState(false)
  const [manualError, setManualError] = useState('')
  const [manualDone, setManualDone] = useState<number | null>(null)

  const runSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const s = term.trim()
      const { data, error } = await supabase
        .from('leads')
        .select('id, student_name, responsible_name, phone, status, campaign_cycle_id')
        .eq('institution_id', institutionId)
        .or(`student_name.ilike.%${s}%,responsible_name.ilike.%${s}%,phone.ilike.%${s}%`)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      setResults((data ?? []) as SearchLead[])
    } catch (e) {
      console.error(e)
    } finally {
      setSearching(false)
    }
  }, [institutionId])

  useEffect(() => {
    const t = setTimeout(() => runSearch(search), 350)
    return () => clearTimeout(t)
  }, [search, runSearch])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedElsewhere = results.filter(l => selected.has(l.id) && l.campaign_cycle_id && l.campaign_cycle_id !== cycleId)

  const handleLinkSelected = async () => {
    if (selected.size === 0) return
    if (selectedElsewhere.length > 0) {
      const ok = window.confirm(
        `${selectedElsewhere.length} dos leads selecionados já pertencem a outra campanha e terão o vínculo substituído. Deseja continuar?`
      )
      if (!ok) return
    }
    setLinking(true)
    setManualError('')
    try {
      const ids = Array.from(selected)
      const { data, error } = await supabase
        .from('leads')
        .update({ campaign_cycle_id: cycleId })
        .in('id', ids)
        .select('id')
      if (error) throw error
      setManualDone(data?.length ?? 0)
      setSelected(new Set())
      setResults(prev => prev.map(l => ids.includes(l.id) ? { ...l, campaign_cycle_id: cycleId } : l))
    } catch (e) {
      console.error(e)
      setManualError('Erro ao vincular os leads selecionados. Tente novamente.')
    } finally {
      setLinking(false)
    }
  }

  if (!isOpen) return null

  const tabBtn = (tab: typeof activeTab, label: string, icon: React.ReactNode) => (
    <button onClick={() => setActiveTab(tab)} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13, fontWeight: 600,
      border: 'none', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid #00A896' : '2px solid transparent',
      color: activeTab === tab ? '#00A896' : '#64748B', background: 'transparent', transition: 'all 0.15s'
    }}>{icon}{label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #00A896 0%, #007A6E 100%)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Link2 size={20} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Vincular leads a esta campanha</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cycleLabel}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 15, height: 15, color: '#fff' }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0, paddingLeft: 8 }}>
          {tabBtn('periodo', 'Por período', <Calendar size={14} />)}
          {tabBtn('manual', 'Selecionar manualmente', <Search size={14} />)}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'periodo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                Vincula a esta campanha todos os leads da instituição cadastrados no período abaixo que <strong>ainda não pertencem a nenhuma campanha</strong>. Leads já vinculados a outra campanha não são afetados.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Data inicial</label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); resetPeriodTab() }} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Data final</label>
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); resetPeriodTab() }} style={inputStyle} />
                </div>
              </div>

              {periodError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626' }}>
                  <AlertTriangle size={14} /> {periodError}
                </div>
              )}

              {periodDone !== null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '14px 16px' }}>
                  <CheckCircle size={18} color="#16A34A" />
                  <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
                    {periodDone} lead{periodDone === 1 ? '' : 's'} vinculado{periodDone === 1 ? '' : 's'} a esta campanha.
                  </span>
                </div>
              ) : previewCount !== null ? (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#1E40AF', fontWeight: 600 }}>
                    {previewCount === 0
                      ? 'Nenhum lead sem campanha encontrado nesse período.'
                      : `Isso vai vincular ${previewCount} lead${previewCount === 1 ? '' : 's'} a esta campanha — confirma?`}
                  </span>
                  {previewCount > 0 && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setPreviewCount(null)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer', fontWeight: 600 }}>
                        Cancelar
                      </button>
                      <button onClick={handleConfirmPeriod} disabled={applying} style={{ flex: 2, padding: '9px', borderRadius: 9, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: applying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: applying ? 0.7 : 1 }}>
                        {applying ? <><Loader2 size={14} className="animate-spin" /> Vinculando...</> : <><Link2 size={14} /> Confirmar vínculo</>}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={handlePreview} disabled={previewLoading} style={{
                  padding: '10px 16px', borderRadius: 10, background: '#1A2B4A', color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: previewLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: previewLoading ? 0.7 : 1
                }}>
                  {previewLoading ? <><Loader2 size={14} className="animate-spin" /> Buscando...</> : <><Search size={14} /> Buscar leads no período</>}
                </button>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nome do aluno, responsável ou telefone..."
                  style={{ ...inputStyle, paddingLeft: 34 }}
                />
              </div>

              {manualError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626' }}>
                  <AlertTriangle size={14} /> {manualError}
                </div>
              )}

              {manualDone !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 14px' }}>
                  <CheckCircle size={16} color="#16A34A" />
                  <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
                    {manualDone} lead{manualDone === 1 ? '' : 's'} vinculado{manualDone === 1 ? '' : 's'} a esta campanha.
                  </span>
                </div>
              )}

              <div style={{ minHeight: 180, maxHeight: 340, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 12 }}>
                {searching && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                    <Loader2 size={20} color="#00A896" className="animate-spin" />
                  </div>
                )}
                {!searching && search.trim().length < 2 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
                    <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p style={{ fontSize: 12, margin: 0 }}>Digite ao menos 2 caracteres para buscar</p>
                  </div>
                )}
                {!searching && search.trim().length >= 2 && results.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
                    <p style={{ fontSize: 12, margin: 0 }}>Nenhum lead encontrado</p>
                  </div>
                )}
                {!searching && results.map(l => {
                  const isChecked = selected.has(l.id)
                  const sameCycle = l.campaign_cycle_id === cycleId
                  const otherCycle = !!l.campaign_cycle_id && !sameCycle
                  return (
                    <label key={l.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                      background: isChecked ? '#F0FDFA' : '#fff'
                    }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(l.id)}
                        style={{ width: 16, height: 16, accentColor: '#00A896', cursor: 'pointer', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.responsible_name || l.student_name}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.student_name ? `Aluno: ${l.student_name}` : ''}{l.phone ? ` · ${l.phone}` : ''}
                        </div>
                      </div>
                      {sameCycle && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', color: '#64748B', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          Já nesta campanha
                        </span>
                      )}
                      {otherCycle && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#FEF3C7', color: '#B45309', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <AlertTriangle size={10} /> Outra campanha
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>

              <button onClick={handleLinkSelected} disabled={selected.size === 0 || linking} style={{
                padding: '11px', borderRadius: 10,
                background: selected.size === 0 ? '#E2E8F0' : '#00A896',
                color: selected.size === 0 ? '#94A3B8' : '#fff',
                border: 'none', fontSize: 13, fontWeight: 700,
                cursor: selected.size === 0 || linking ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: linking ? 0.7 : 1
              }}>
                {linking
                  ? <><Loader2 size={14} className="animate-spin" /> Vinculando...</>
                  : <><Link2 size={14} /> Vincular selecionados {selected.size > 0 ? `(${selected.size})` : ''}</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
