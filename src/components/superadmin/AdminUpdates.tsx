import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'

type UpdateType = 'news' | 'feature' | 'alert' | 'maintenance'

interface SchoolUpdate {
  id: string
  title: string
  content: string
  type: UpdateType
  media_url: string | null
  created_at: string
  expires_at: string | null
}

const TYPE_LABELS: Record<UpdateType, { label: string; bg: string; color: string }> = {
  news:        { label: 'Novidade',     bg: '#DBEAFE', color: '#1D4ED8' },
  feature:     { label: 'Funcionalidade', bg: '#D1FAE5', color: '#065F46' },
  alert:       { label: 'Alerta',       bg: '#FEF3C7', color: '#92400E' },
  maintenance: { label: 'Manutenção',   bg: '#F1F5F9', color: '#475569' },
}

const EMPTY_FORM = { title: '', content: '', type: 'news' as UpdateType, media_url: '', expires_at: '' }

export default function AdminUpdates() {
  const [updates, setUpdates] = useState<SchoolUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('school_updates')
      .select('*')
      .order('created_at', { ascending: false })
    setUpdates(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { setError('Título e conteúdo são obrigatórios.'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        media_url: form.media_url.trim() || null,
        expires_at: form.expires_at || null,
      }
      const { data: inserted, error: insertErr } = await supabase
        .from('school_updates')
        .insert(payload)
        .select()
        .single()
      if (insertErr) throw insertErr

      // Broadcast notification to all institutions
      const { data: institutions, error: instError } = await supabase
        .from('institutions')
        .select('id, name')
      if (institutions && institutions.length > 0) {
        await Promise.all(institutions.map(inst =>
          supabase.from('system_notifications').insert({
            institution_id: inst.id,
            type: 'suggestion',
            title: form.title.trim(),
            message: form.content.trim().slice(0, 200),
            severity: form.type === 'alert' ? 'warning' : form.type === 'maintenance' ? 'danger' : 'info',
            action_url: null,
          })
        ))
      }
      setUpdates(prev => [inserted, ...prev])
      setModal(false)
      setForm(EMPTY_FORM)
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta atualização?')) return
    setDeletingId(id)
    await supabase.from('school_updates').delete().eq('id', id)
    setUpdates(prev => prev.filter(u => u.id !== id))
    setDeletingId(null)
  }

  return (
    <SuperAdminLayout>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Central de Atualizações</h1>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Publique atualizações visíveis para todas as escolas ativas.</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setError(''); setModal(true) }}
            style={{ padding: '10px 20px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Nova Atualização
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Carregando...</div>
        ) : updates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#94A3B8', fontSize: 14 }}>
            Nenhuma atualização publicada ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {updates.map(u => {
              const cfg = TYPE_LABELS[u.type as UpdateType] || TYPE_LABELS.news
              return (
                <div key={u.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                      {cfg.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 4 }}>{u.title}</div>
                      <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{u.content}</div>
                      {u.media_url && (
                        <a href={u.media_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#00A896', marginTop: 6, display: 'inline-block' }}>
                          Ver mídia →
                        </a>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: '#CBD5E1' }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
                      {u.expires_at && (
                        <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 2 }}>
                          Expira {new Date(u.expires_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        style={{ marginTop: 8, fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {deletingId === u.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1A2B4A' }}>Nova Atualização</span>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Título *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  maxLength={120}
                  placeholder="Título da atualização"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Tipo</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as UpdateType }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="news">Novidade</option>
                  <option value="feature">Funcionalidade</option>
                  <option value="alert">Alerta</option>
                  <option value="maintenance">Manutenção</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>
                  Conteúdo * <span style={{ fontWeight: 400, color: '#CBD5E1' }}>{form.content.length}/1000</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  maxLength={1000}
                  rows={5}
                  placeholder="Descreva a atualização..."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>URL de mídia (opcional)</label>
                <input
                  value={form.media_url}
                  onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Expira em (opcional)</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {error && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setModal(false)} style={{ padding: '10px 20px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Publicando...' : 'Publicar para todas as escolas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}
