import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { DatabaseService, supabase } from '../../lib/supabase'

interface DrawerConversation {
  id: string
  name: string
  phone: string
  avatarColor: string
  contact_type?: string
  lead_id?: string
  profile_picture_url?: string
  tags?: string[]
  status: string
  lastTime: Date
  lastMessage: string
}

interface ContactDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversation: DrawerConversation | null
  allConversations: DrawerConversation[]
  institutionId: string
  onUpdate: (jid: string, updates: Record<string, any>) => void
}

const GRADES = ['Educação Infantil','1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','6º Ano','7º Ano','8º Ano','9º Ano','1º EM','2º EM','3º EM']
const TURNS = ['Manhã','Tarde','Integral']
const ORIGINS = ['WhatsApp','Indicação','Instagram','Facebook','Site','Outros']

const CONTACT_TYPES = [
  { key: 'lead',     label: 'Nova Família',     icon: '👨‍👩‍👧' },
  { key: 'client',   label: 'Família da Casa',   icon: '🏠' },
  { key: 'supplier', label: 'Fornecedor',        icon: '🏢' },
  { key: 'other',    label: 'Outro',             icon: '👤' },
]

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function fmtConvTime(d: Date) {
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const STATUS_BADGE: Record<string, string> = {
  waiting: 'bg-[#FEF3C7] text-[#D97706]',
  open:    'bg-[#D1FAE5] text-[#059669]',
  closed:  'bg-[#E2E8F0] text-[#64748B]',
}
const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando',
  open:    'Em Atendimento',
  closed:  'Concluído',
}

type DrawerTab = 'dados' | 'historico' | 'conversas'

export default function ContactDrawer({ isOpen, onClose, conversation, allConversations, institutionId, onUpdate }: ContactDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('dados')
  const [form, setForm] = useState({
    contact_type: '',
    responsible_name: '',
    phone: '',
    email: '',
    student_name: '',
    grade_interest: '',
    shift: '',
    source: '',
  })
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Reset form when conversation changes
  useEffect(() => {
    if (!conversation) return
    setTab('dados')
    setSuccessMsg('')
    setSaving(false)
    setForm({
      contact_type: conversation.contact_type || '',
      responsible_name: conversation.name || '',
      phone: conversation.phone || '',
      email: '',
      student_name: '',
      grade_interest: '',
      shift: '',
      source: '',
    })
    // Try to prefill from existing lead
    if (conversation.lead_id && institutionId) {
      DatabaseService.getLeads(institutionId).then(leads => {
        const lead = leads.find(l => l.id === conversation.lead_id)
        if (lead) {
          setForm(f => ({
            ...f,
            responsible_name: lead.responsible_name || f.responsible_name,
            phone: lead.phone || f.phone,
            email: lead.email || '',
            student_name: lead.student_name || '',
            grade_interest: lead.grade_interest || '',
            source: lead.source || '',
          }))
        }
      }).catch(() => {})
    }
  }, [conversation?.id])

  if (!isOpen || !conversation) return null

  const otherConvs = allConversations.filter(c => c.phone === conversation.phone && c.id !== conversation.id)

  const handleSave = async () => {
    if (!institutionId || !conversation) return
    setSaving(true)
    try {
      let leadId = conversation.lead_id

      if (leadId) {
        // Update existing lead
        const leads = await DatabaseService.getLeads(institutionId)
        const lead = leads.find(l => l.id === leadId)
        if (lead) {
          await DatabaseService.updateLead(lead.id, {
            responsible_name: form.responsible_name,
            phone: form.phone,
            email: form.email,
            student_name: form.student_name,
            grade_interest: form.grade_interest,
            source: form.source,
          })
        }
      } else {
        // Create new lead
        const newLead = await DatabaseService.createLead({
          institution_id: institutionId,
          responsible_name: form.responsible_name,
          phone: form.phone,
          email: form.email,
          student_name: form.student_name,
          grade_interest: form.grade_interest,
          source: form.source,
          status: 'new',
        })
        leadId = newLead.id
        await DatabaseService.updateWhatsappMessageLead(conversation.id, institutionId, newLead.id)
        await DatabaseService.upsertConversationStatus(institutionId, conversation.id, conversation.status, newLead.id)
      }

      // Update contact type if changed
      if (form.contact_type && form.contact_type !== conversation.contact_type) {
        await DatabaseService.setConversationContactType(institutionId, conversation.id, form.contact_type)
      }

      // Update name if changed
      if (form.responsible_name && form.responsible_name !== conversation.name) {
        await supabase.from('whatsapp_conversations')
          .update({ contact_name: form.responsible_name })
          .eq('institution_id', institutionId)
          .eq('remote_jid', conversation.id)
      }

      onUpdate(conversation.id, {
        name: form.responsible_name,
        contact_type: form.contact_type,
        lead_id: leadId,
      })

      setSuccessMsg('Contato atualizado com sucesso')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.30)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 bg-white shadow-2xl flex flex-col"
        style={{ width: 480 }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-5 border-b border-[#E2E8F0]">
          {/* Avatar */}
          <div
            className={`w-[72px] h-[72px] rounded-full flex-shrink-0 flex items-center justify-center text-white text-2xl font-bold overflow-hidden ${conversation.avatarColor}`}
          >
            {conversation.profile_picture_url ? (
              <img src={conversation.profile_picture_url} alt={conversation.name} className="w-full h-full object-cover" />
            ) : (
              getInitials(conversation.name)
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A' }} className="truncate">{conversation.name}</p>
            <p style={{ fontSize: 13, color: '#64748B' }} className="mt-0.5">{conversation.phone}</p>
            {conversation.contact_type && (
              <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-[#E6F7F5] text-[#00A896]">
                {CONTACT_TYPES.find(t => t.key === conversation.contact_type)?.label || conversation.contact_type}
              </span>
            )}
          </div>
          {/* Close */}
          <button onClick={onClose} className="flex-shrink-0 p-2 text-[#64748B] hover:text-[#1A2B4A] hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex-shrink-0 flex border-b border-[#E2E8F0]">
          {(['dados', 'historico', 'conversas'] as DrawerTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-[#00A896] text-[#1A2B4A] font-semibold'
                  : 'border-transparent text-[#64748B] hover:text-[#1A2B4A]'
              }`}
            >
              {t === 'dados' ? 'Dados' : t === 'historico' ? 'Histórico CRM' : 'Conversas'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Dados tab ── */}
          {tab === 'dados' && (
            <div className="p-6 space-y-5">
              {/* Contact type grid */}
              <div>
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Tipo de Contato</p>
                <div className="grid grid-cols-2 gap-2">
                  {CONTACT_TYPES.map(ct => (
                    <button
                      key={ct.key}
                      onClick={() => setForm(f => ({ ...f, contact_type: ct.key }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                        form.contact_type === ct.key
                          ? 'border-2 border-[#00A896] bg-[#E6F7F5] text-[#00A896]'
                          : 'border border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#00A896] hover:text-[#00A896]'
                      }`}
                    >
                      <span className="text-base">{ct.icon}</span>
                      <span>{ct.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Responsável */}
              <div>
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Dados do Responsável</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">Nome completo</label>
                    <input
                      value={form.responsible_name}
                      onChange={e => setForm(f => ({ ...f, responsible_name: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">Telefone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Dados do Aluno</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              {/* Aluno */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Nome do aluno</label>
                  <input
                    value={form.student_name}
                    onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Série/Ano</label>
                  <select
                    value={form.grade_interest}
                    onChange={e => setForm(f => ({ ...f, grade_interest: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Turno</label>
                  <select
                    value={form.shift}
                    onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {TURNS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Origem</label>
                  <select
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Histórico CRM tab ── */}
          {tab === 'historico' && (
            <div className="p-6">
              {conversation.lead_id ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div style={{ fontSize: 36 }}>📋</div>
                  <p className="mt-3 text-sm text-[#64748B]">Histórico disponível via Lead vinculado</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div style={{ fontSize: 36 }}>📭</div>
                  <p className="mt-3 text-sm text-[#64748B]">Nenhum lead vinculado.</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">Salve os dados do aluno para criar um lead.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Conversas tab ── */}
          {tab === 'conversas' && (
            <div className="p-6">
              {otherConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div style={{ fontSize: 36 }}>💬</div>
                  <p className="mt-3 text-sm text-[#64748B]">Nenhuma outra conversa encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {otherConvs.map(c => (
                    <div key={c.id} className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFB]">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] || STATUS_BADGE.waiting}`}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                        <span className="text-xs text-[#94A3B8]">{fmtConvTime(c.lastTime)}</span>
                      </div>
                      <p className="text-xs text-[#64748B] truncate">{c.lastMessage || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — only in Dados tab */}
        {tab === 'dados' && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-[#E2E8F0] space-y-2">
            {successMsg && (
              <p className="text-sm text-[#059669] text-center font-medium">{successMsg}</p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#00A896] text-white font-semibold py-3 rounded-lg hover:bg-[#008f81] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button
              onClick={onClose}
              className="w-full border border-[#E2E8F0] text-[#64748B] py-3 rounded-lg hover:bg-[#F8FAFB] transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </>
  )
}
