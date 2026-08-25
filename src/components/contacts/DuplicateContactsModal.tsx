// src/components/contacts/DuplicateContactsModal.tsx
//
// Item 1 — mesclar duplicata pela UI. Reaproveita a mesma regra de
// prioridade das migrations de limpeza manual anteriores
// (has_conversation > mais tags > last_seen_at mais recente), agora
// generalizada pra grupos de qualquer tamanho e com a decisão exposta pro
// usuário poder trocar o sobrevivente antes de confirmar. Ver src/lib/contactMerge.ts.
import { useState, useEffect } from 'react'
import { X, GitMerge, EyeOff, Loader2, AlertCircle, MessageCircle, UserCheck, Tag as TagIcon } from 'lucide-react'
import {
  findDuplicateGroups, mergeDuplicateGroup, ignoreDuplicateGroup,
  type DupGroup, type DupContactRow,
} from '../../lib/contactMerge'

interface Props {
  institutionId: string
  currentUserId: string | null
  onClose: () => void
  onMerged: () => void
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DuplicateContactsModal({ institutionId, currentUserId, onClose, onMerged }: Props) {
  const [groups, setGroups] = useState<DupGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [survivorOverride, setSurvivorOverride] = useState<Record<string, string>>({})
  const [busyPhone, setBusyPhone] = useState<string | null>(null)
  const [conflictInfo, setConflictInfo] = useState<{ normPhone: string; leadIds: string[] } | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const found = await findDuplicateGroups(institutionId)
      setGroups(found)
    } catch (e: any) {
      setError(e?.message || 'Erro ao buscar duplicatas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  function survivorFor(group: DupGroup): string {
    return survivorOverride[group.normPhone] || group.suggestedSurvivorId
  }

  async function handleMerge(group: DupGroup) {
    const survivorId = survivorFor(group)
    const leadIds = Array.from(new Set(group.contacts.map(c => c.lead_id).filter(Boolean))) as string[]
    if (leadIds.length > 1) {
      setConflictInfo({ normPhone: group.normPhone, leadIds })
      return
    }
    setBusyPhone(group.normPhone)
    try {
      await mergeDuplicateGroup({
        institutionId,
        normPhone: group.normPhone,
        survivorId,
        contacts: group.contacts,
        mergedBy: currentUserId,
      })
      setGroups(prev => prev.filter(g => g.normPhone !== group.normPhone))
      onMerged()
    } catch (e: any) {
      setError(e?.message || 'Erro ao mesclar grupo.')
    } finally {
      setBusyPhone(null)
    }
  }

  async function handleIgnore(group: DupGroup) {
    setBusyPhone(group.normPhone)
    try {
      await ignoreDuplicateGroup(institutionId, group.normPhone, currentUserId)
      setGroups(prev => prev.filter(g => g.normPhone !== group.normPhone))
    } catch (e: any) {
      setError(e?.message || 'Erro ao ignorar grupo.')
    } finally {
      setBusyPhone(null)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitMerge size={18} color="#3B82F6" />
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Contatos duplicados</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>Mesmo telefone, mais de um cadastro</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#B91C1C' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#94A3B8' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p style={{ margin: 0, fontSize: 13 }}>Buscando duplicatas...</p>
            </div>
          ) : groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#94A3B8' }}>
              <UserCheck size={36} color="#BBF7D0" style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A2B4A' }}>Nenhuma duplicata encontrada</p>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>Todos os contatos têm telefones únicos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {groups.map(group => {
                const survivorId = survivorFor(group)
                const busy = busyPhone === group.normPhone
                return (
                  <div key={group.normPhone} style={{ border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{group.normPhone} · {group.contacts.length} cadastros</p>
                      {group.leadConflict && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', padding: '3px 9px', borderRadius: 999 }}>
                          <AlertCircle size={11} /> Conflito de lead
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(group.contacts.length, 3)}, 1fr)`, gap: 10, marginBottom: 12 }}>
                      {group.contacts.map((c: DupContactRow) => {
                        const isSuggested = c.id === group.suggestedSurvivorId
                        const isSelected  = c.id === survivorId
                        return (
                          <label key={c.id}
                            style={{
                              display: 'block', cursor: 'pointer', padding: 12, borderRadius: 10,
                              border: `1.5px solid ${isSelected ? '#00A896' : '#E2E8F0'}`,
                              background: isSelected ? '#F0FDFB' : '#F8FAFC',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <input type="radio" name={`survivor-${group.normPhone}`} checked={isSelected}
                                onChange={() => setSurvivorOverride(prev => ({ ...prev, [group.normPhone]: c.id }))} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</span>
                            </div>
                            {isSuggested && (
                              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#0F766E', background: '#CCFBF1', padding: '2px 7px', borderRadius: 999, marginBottom: 6 }}>Sugerido</span>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#64748B' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MessageCircle size={11} color={group.hasConversation[c.id] ? '#16A34A' : '#CBD5E1'} />
                                {group.hasConversation[c.id] ? 'Tem conversa' : 'Sem conversa'}
                              </span>
                              <span>{c.lead_id ? '👤 É lead' : 'Não é lead'}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <TagIcon size={11} />{c.tags?.length ? c.tags.join(', ') : 'sem etiquetas'}
                              </span>
                              <span>Última atividade: {fmtDate(c.last_seen_at)}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleMerge(group)} disabled={busy}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: '#00A896', color: '#fff', fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <GitMerge size={12} />}
                        Mesclar
                      </button>
                      <button onClick={() => handleIgnore(group)} disabled={busy}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                        <EyeOff size={12} /> Ignorar este grupo
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {conflictInfo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, maxWidth: 420, padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#DC2626' }}>Conflito de lead</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              Os contatos deste grupo apontam para leads diferentes — não dá pra mesclar automaticamente. Resolva manualmente antes:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {conflictInfo.leadIds.map(id => (
                <a key={id} href={`/leads?highlight=${id}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'underline' }}>
                  Ver lead {id.slice(0, 8)}…
                </a>
              ))}
            </div>
            <button onClick={() => setConflictInfo(null)}
              style={{ width: '100%', padding: '8px 0', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
