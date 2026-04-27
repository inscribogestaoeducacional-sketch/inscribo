// src/pages/gestor/AttendantHome.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users, Calendar, MessageCircle, ArrowRightLeft,
  Plus, Phone, CheckCircle, Clock, AlertCircle,
  ExternalLink, ChevronRight
} from 'lucide-react'

// ── Status configs ────────────────────────────────────────────
const leadStatusCfg: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'Novo',         color: '#3b82f6', bg: '#eff6ff' },
  contact:   { label: 'Em contato',   color: '#f59e0b', bg: '#fffbeb' },
  scheduled: { label: 'Agendado',     color: '#8b5cf6', bg: '#f5f3ff' },
  visit:     { label: 'Em visita',    color: '#06b6d4', bg: '#ecfeff' },
  proposal:  { label: 'Proposta',     color: '#f97316', bg: '#fff7ed' },
  enrolled:  { label: 'Matriculado',  color: '#0F6E56', bg: '#f0fdf4' },
  lost:      { label: 'Perdido',      color: '#ef4444', bg: '#fef2f2' },
}

const visitStatusCfg: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:  { label: 'Agendada',   color: '#8b5cf6', bg: '#f5f3ff' },
  completed:  { label: 'Realizada',  color: '#0F6E56', bg: '#f0fdf4' },
  cancelled:  { label: 'Cancelada',  color: '#ef4444', bg: '#fef2f2' },
  no_show:    { label: 'Não veio',   color: '#f97316', bg: '#fff7ed' },
}

// ── Helpers ──────────────────────────────────────────────────
function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

function fmtTime(dateStr: string) {
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  d.setHours(0,0,0,0)
  if (d.getTime() === today.getTime()) return 'Hoje'
  if (d.getTime() === tomorrow.getTime()) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Main component ───────────────────────────────────────────
export default function AttendantHome() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [leads,     setLeads]     = useState<any[]>([])
  const [visits,    setVisits]    = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [waMessages, setWaMessages] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  const institutionId = user?.institution_id

  useEffect(() => {
    if (!institutionId) return
    loadAll()
  }, [institutionId])

  const loadAll = async () => {
    if (!institutionId) return
    setLoading(true)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)

    const [lRes, vRes, tRes, wRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, student_name, responsible_name, status, created_at, phone')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('visits')
        .select('id, lead_id, status, scheduled_date, created_at, student_name')
        .eq('institution_id', institutionId)
        .gte('scheduled_date', todayStart.toISOString().substring(0, 10))
        .order('scheduled_date', { ascending: true })
        .limit(10),
      supabase
        .from('student_transfers')
        .select('id, student_name, course_grade, status, created_at, survey_token, ai_diagnosis')
        .eq('institution_id', institutionId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('whatsapp_messages')
        .select('id, from_me, created_at')
        .eq('institution_id', institutionId)
        .gte('created_at', since24h),
    ])

    setLeads(lRes.data || [])
    setVisits(vRes.data || [])
    setTransfers(tRes.data || [])
    setWaMessages(wRes.data || [])
    setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const leadsToday      = leads.filter(l => new Date(l.created_at) >= todayStart).length
  const visitsScheduled = visits.filter(v => v.status === 'scheduled').length
  const waSent          = waMessages.filter(m => m.from_me).length
  const waReceived      = waMessages.filter(m => !m.from_me).length
  const transfersPending = transfers.filter(t => !t.ai_diagnosis && !t.survey_completed_at).length

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>
            {greeting()}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            {user?.institution_name || 'Escola'} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0F6E56', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '4px 12px' }}>
          Atendente
        </span>
      </div>

      {/* ── KPIs ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
              <Skeleton h="h-3" w="w-24 mb-3" /><Skeleton h="h-8" w="w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            { label: 'Leads hoje',             value: leadsToday,       icon: Users,         color: '#8b5cf6', bg: '#f5f3ff' },
            { label: 'Visitas agendadas',       value: visitsScheduled,  icon: Calendar,      color: '#0F6E56', bg: '#f0fdf4' },
            { label: 'WhatsApp 24h',            value: waReceived,       icon: MessageCircle, color: '#10B981', bg: '#d1fae5' },
            { label: 'Transferências pendentes',value: transfersPending, icon: ArrowRightLeft, color: transfersPending > 0 ? '#dc2626' : '#64748b', bg: transfersPending > 0 ? '#fef2f2' : '#f1f5f9' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <kpi.icon size={20} color={kpi.color} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Leads recentes | Visitas do dia ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Leads recentes */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Leads recentes</span>
            <button onClick={() => navigate('/leads')} style={{ fontSize: 11, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
            </div>
          ) : leads.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 12 }}>Nenhum lead ainda</p>
            </div>
          ) : (
            <div>
              {leads.slice(0, 6).map(lead => {
                const cfg = leadStatusCfg[lead.status] || leadStatusCfg.new
                return (
                  <div key={lead.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.student_name || lead.responsible_name || '—'}
                      </div>
                      {lead.phone && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{lead.phone}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: cfg.color, background: cfg.bg, flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => navigate('/leads')}
                      style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', background: '#f5f3ff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
                      Atender
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Visitas do dia */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Visitas do dia</span>
            <button onClick={() => navigate('/visits')} style={{ fontSize: 11, color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              Ver agenda <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
            </div>
          ) : visits.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 12 }}>Nenhuma visita agendada para hoje</p>
            </div>
          ) : (
            <div>
              {visits.slice(0, 6).map(visit => {
                const cfg = visitStatusCfg[visit.status] || visitStatusCfg.scheduled
                return (
                  <div key={visit.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Clock size={14} color="#8b5cf6" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {visit.student_name || `Lead #${visit.lead_id?.slice(0, 6)}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        {fmtDate(visit.scheduled_date)} · {fmtTime(visit.scheduled_date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                      {visit.status === 'scheduled' && (
                        <button
                          onClick={() => navigate('/visits')}
                          style={{ fontSize: 10, fontWeight: 600, color: '#0F6E56', background: '#f0fdf4', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                          Confirmar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── WhatsApp 24h | Transferências pendentes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* WhatsApp 24h */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>WhatsApp últimas 24h</span>
            <button
              onClick={() => navigate('/whatsapp')}
              style={{ fontSize: 11, color: '#10B981', background: '#d1fae5', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <ExternalLink size={11} /> Abrir
            </button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton h="h-12" /><Skeleton h="h-12" />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0F6E56' }}>{waReceived}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Recebidas</div>
              </div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#64748B' }}>{waSent}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Enviadas</div>
              </div>
            </div>
          )}
          {!loading && waReceived === 0 && waSent === 0 && (
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 12 }}>Nenhuma mensagem nas últimas 24h</p>
          )}
        </div>

        {/* Transferências pendentes */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Transferências recentes</span>
            <button onClick={() => navigate('/transferencias')} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              Ver todas <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
            </div>
          ) : transfers.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <CheckCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.4, color: '#0F6E56' }} />
              <p style={{ fontSize: 12 }}>Nenhuma transferência pendente</p>
            </div>
          ) : (
            <div>
              {transfers.slice(0, 4).map(t => {
                const pending = !t.ai_diagnosis
                return (
                  <div key={t.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: pending ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {pending
                        ? <AlertCircle size={13} color="#dc2626" />
                        : <CheckCircle size={13} color="#0F6E56" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.student_name}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{t.course_grade}</div>
                    </div>
                    {pending && (
                      <button
                        onClick={() => navigate('/transferencias')}
                        style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        Gerar link
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Ações rápidas ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Ações rápidas
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '+ Novo lead',              path: '/leads',          color: '#8b5cf6', bg: '#f5f3ff', icon: Plus         },
            { label: '+ Agendar visita',         path: '/visits',         color: '#0F6E56', bg: '#f0fdf4', icon: Calendar     },
            { label: 'Registrar transferência',  path: '/transferencias', color: '#dc2626', bg: '#fef2f2', icon: ArrowRightLeft },
            { label: 'Abrir WhatsApp',           path: '/whatsapp',       color: '#10B981', bg: '#d1fae5', icon: MessageCircle },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: a.bg, color: a.color,
                border: `1px solid ${a.color}30`,
                borderRadius: 10, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              <a.icon size={14} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
