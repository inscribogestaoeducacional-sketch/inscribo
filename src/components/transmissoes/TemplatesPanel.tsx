// Aba "Templates" de Transmissões: templates da própria escola (criar,
// editar rascunho, enviar pra aprovação da Meta) + os padrão da Áion
// liberados pra Transmissões. O rascunho é gravado direto pela RLS de
// template_definitions (a escola escreve no próprio template); o nome técnico
// é gerado no banco (esc_<escola>_<nome>). O envio pra Meta é server-side
// (submit_school_template). Depois de enviado, o conteúdo trava (trigger) —
// rejeitado vira "duplicar pra corrigir", porque a Meta não aceita reenviar
// o mesmo nome.
import React, { useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Send, Copy, Pencil, RefreshCw, Trash2, MessageSquareReply, Link as LinkIcon, Image as ImageIcon, Film, Upload, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TEMPLATE_STATUS, CATEGORY_LABEL, submitSchoolTemplate, BroadcastError } from '../../lib/broadcasts'
import { Badge, Btn, ErrorBox, Empty, Modal, cardStyle, hintStyle, inputStyle, labelStyle } from './ui'

export interface TemplateRow {
  id: string
  name: string
  display_name: string | null
  category: string
  language: string
  body_text: string
  header_config: { format?: string; text?: string; media?: HeaderMedia } | null
  buttons: { type: string; text: string; url_base?: string }[]
  variable_examples: Record<string, string> | null
  variable_labels: Record<string, string> | null
  institution_id: string | null
  available_contexts: string[] | null
  status: string            // da escola (template_institution_status), 'not_submitted' se não houver
  approved_category: string | null
  error_message: string | null
  visible: boolean
}

export async function loadTemplates(institutionId: string): Promise<TemplateRow[]> {
  // RLS já devolve só os da Áion + os desta escola.
  const [{ data: defs, error }, { data: sts }] = await Promise.all([
    supabase.from('template_definitions')
      .select('id, name, display_name, category, language, body_text, header_config, buttons, variable_examples, variable_labels, institution_id, available_contexts')
      .order('created_at', { ascending: false }),
    supabase.from('template_institution_status')
      .select('template_definition_id, status, approved_category, error_message, visible_to_school')
      .eq('institution_id', institutionId),
  ])
  if (error) throw error
  const byDef = new Map(((sts || []) as any[]).map(s => [s.template_definition_id, s]))
  return ((defs || []) as any[])
    .filter(d => d.institution_id === institutionId || (d.available_contexts || []).includes('broadcast'))
    .map(d => {
      const s = byDef.get(d.id)
      return {
        ...d,
        buttons: Array.isArray(d.buttons) ? d.buttons : [],
        status: s?.status || 'not_submitted',
        approved_category: s?.approved_category || null,
        error_message: s?.error_message || null,
        visible: s?.visible_to_school !== false,
      } as TemplateRow
    })
    // Template da Áion só aparece se estiver aprovado nesta escola.
    .filter(t => t.institution_id === institutionId || (t.status === 'approved' && t.visible))
}

// Mídia do cabeçalho: sobe direto do navegador pro bucket broadcast-media
// (pasta da escola, nome aleatório). O servidor revalida tipo/tamanho pelo
// conteúdo e sobe o exemplo pra Meta no envio pra aprovação.
export interface HeaderMedia { storage_path: string; public_url?: string; mime_type?: string; size_bytes?: number; file_name?: string }
type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO'
// Limites da Meta (Cloud API): imagem JPEG/PNG até 5 MB; vídeo MP4 até 16 MB.
const MEDIA_LIMITS: Record<'IMAGE' | 'VIDEO', { mimes: string[]; maxBytes: number; accept: string; label: string }> = {
  IMAGE: { mimes: ['image/jpeg', 'image/png'], maxBytes: 5 * 1024 * 1024,  accept: 'image/jpeg,image/png', label: 'JPG ou PNG, até 5 MB' },
  VIDEO: { mimes: ['video/mp4'],               maxBytes: 16 * 1024 * 1024, accept: 'video/mp4',           label: 'MP4, até 16 MB' },
}

const varNumbers = (text: string) => [...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]))].sort((a, b) => Number(a) - Number(b))

interface EditorState {
  id: string | null
  displayName: string
  baseName: string
  category: 'MARKETING' | 'UTILITY'
  headerType: HeaderType
  media: HeaderMedia | null
  headerText: string
  headerExample: string
  body: string
  examples: Record<string, string>
  labels: Record<string, string>
  buttons: { type: 'QUICK_REPLY' | 'URL'; text: string; url_base?: string }[]
  urlExample: string
}

const EMPTY: EditorState = {
  id: null, displayName: '', baseName: '', category: 'MARKETING', headerType: 'NONE', media: null, headerText: '', headerExample: '',
  body: '', examples: {}, labels: {}, buttons: [], urlExample: '',
}

export default function TemplatesPanel({ institutionId, onChanged }: { institutionId: string; onChanged?: () => void }) {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null)
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function reload() {
    setLoading(true)
    try { setRows(await loadTemplates(institutionId)) } catch (e) { console.error('[Transmissoes] templates:', e) }
    setLoading(false)
  }
  useEffect(() => { reload() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const own  = rows.filter(r => r.institution_id === institutionId)
  const aion = rows.filter(r => r.institution_id === null)

  function openNew() { setError(null); setEditor({ ...EMPTY }) }
  function openEdit(t: TemplateRow, duplicate = false) {
    setError(null)
    const btns = (t.buttons || []).map(b => ({ type: (b.type || '').toUpperCase() === 'URL' ? 'URL' as const : 'QUICK_REPLY' as const, text: b.text, url_base: b.url_base }))
    const baseName = t.name.replace(/^esc_[0-9a-f]{6}_/, '')
    const fmt = (t.header_config?.format || '').toUpperCase()
    const headerType: HeaderType = fmt === 'IMAGE' || fmt === 'VIDEO' ? fmt : t.header_config?.text ? 'TEXT' : 'NONE'
    setEditor({
      headerType,
      // Duplicar reaproveita o mesmo arquivo (não apaga nada do bucket).
      media: headerType === 'IMAGE' || headerType === 'VIDEO' ? (t.header_config?.media || null) : null,
      id: duplicate ? null : t.id,
      displayName: duplicate ? `${t.display_name || baseName} (v2)` : (t.display_name || ''),
      baseName: duplicate ? `${baseName}_v2` : baseName,
      category: t.category === 'UTILITY' ? 'UTILITY' : 'MARKETING',
      headerText: t.header_config?.text || '',
      headerExample: t.variable_examples?.header || '',
      body: t.body_text,
      examples: Object.fromEntries(Object.entries(t.variable_examples || {}).filter(([k]) => /^\d+$/.test(k))),
      labels: t.variable_labels || {},
      buttons: btns,
      urlExample: t.variable_examples?.button || '',
    })
  }

  const bodyVars = useMemo(() => editor ? varNumbers(editor.body) : [], [editor?.body]) // eslint-disable-line react-hooks/exhaustive-deps

  function localProblems(e: EditorState): string[] {
    const p: string[] = []
    if (!e.displayName.trim()) p.push('Dê um nome de exibição ao template')
    if (!e.baseName.trim() && !e.displayName.trim()) p.push('Informe o nome técnico')
    if (!e.body.trim()) p.push('Escreva o texto da mensagem')
    if (e.body.length > 1024) p.push('Texto com mais de 1024 caracteres')
    if (bodyVars.some((n, i) => Number(n) !== i + 1)) p.push('Use as variáveis em sequência: {{1}}, {{2}}, {{3}}…')
    bodyVars.forEach(n => { if (!e.examples[n]?.trim()) p.push(`Preencha o exemplo da variável {{${n}}} (a Meta exige)`) })
    if ((e.headerType === 'IMAGE' || e.headerType === 'VIDEO') && !e.media) p.push(`Envie o ${e.headerType === 'IMAGE' ? 'arquivo de imagem' : 'arquivo de vídeo'} do cabeçalho`)
    if (e.headerType === 'TEXT' && !e.headerText.trim()) p.push('Escreva o texto do cabeçalho (ou escolha "Nenhum")')
    if (e.headerText.length > 60) p.push('Cabeçalho com mais de 60 caracteres')
    if ((e.headerText.match(/\{\{\d+\}\}/g) || []).some(v => v !== '{{1}}')) p.push('O cabeçalho aceita só a variável {{1}}')
    if (/\{\{1\}\}/.test(e.headerText) && !e.headerExample.trim()) p.push('Preencha o exemplo da variável do cabeçalho')
    if (e.buttons.length > 10) p.push('No máximo 10 botões')
    if (e.buttons.filter(b => b.type === 'URL').length > 2) p.push('No máximo 2 botões de link')
    e.buttons.forEach((b, i) => {
      if (!b.text.trim() || b.text.length > 25) p.push(`Botão ${i + 1}: texto de 1 a 25 caracteres`)
      if (b.type === 'URL' && !/^https:\/\//.test(b.url_base || '')) p.push(`Botão ${i + 1}: o link precisa começar com https://`)
    })
    if (e.buttons.some(b => b.type === 'URL') && !e.urlExample.trim()) p.push('Preencha o exemplo do final do link')
    return p
  }

  async function save(submit: boolean) {
    if (!editor) return
    const problems = localProblems(editor)
    if (problems.length) { setError({ message: 'Revise o template', details: problems }); return }
    setSaving(submit ? 'submit' : 'draft'); setError(null)
    try {
      const examples: Record<string, string> = {}
      bodyVars.forEach(n => { examples[n] = editor.examples[n].trim() })
      if (editor.headerType === 'TEXT' && /\{\{1\}\}/.test(editor.headerText)) examples.header = editor.headerExample.trim()
      if (editor.buttons.some(b => b.type === 'URL')) examples.button = editor.urlExample.trim()
      const labels: Record<string, string> = {}
      bodyVars.forEach(n => { if (editor.labels[n]?.trim()) labels[n] = editor.labels[n].trim() })

      const payload = {
        display_name:      editor.displayName.trim(),
        category:          editor.category,
        body_text:         editor.body.trim(),
        header_config:     editor.headerType === 'TEXT' && editor.headerText.trim() ? { format: 'TEXT', text: editor.headerText.trim() }
                         : (editor.headerType === 'IMAGE' || editor.headerType === 'VIDEO') && editor.media ? { format: editor.headerType, media: editor.media }
                         : null,
        buttons:           editor.buttons.map(b => b.type === 'URL' ? { type: 'URL', text: b.text.trim(), url_base: (b.url_base || '').trim() } : { type: 'QUICK_REPLY', text: b.text.trim() }),
        variable_examples: examples,
        variable_labels:   labels,
        available_contexts: ['broadcast'],
      }
      let id = editor.id
      if (id) {
        const { error: upErr } = await supabase.from('template_definitions').update(payload).eq('id', id)
        if (upErr) throw new BroadcastError(upErr.message)
      } else {
        // Nome técnico final é gerado no banco (prefixo da escola + slug).
        const { data, error: insErr } = await supabase.from('template_definitions')
          .insert({ ...payload, institution_id: institutionId, name: editor.baseName.trim() || editor.displayName.trim(), language: 'pt_BR' })
          .select('id').single()
        if (insErr) throw new BroadcastError(insErr.message.includes('duplicate') ? 'Já existe um template da escola com esse nome técnico' : insErr.message)
        id = (data as any).id
      }
      if (submit && id) {
        const r = await submitSchoolTemplate(id)
        const st = r.results?.[0]
        setNotice(st?.status === 'rejected'
          ? `A Meta recusou o envio: ${st.error_message || 'motivo não informado'}`
          : 'Template enviado pra aprovação da Meta. O status atualiza sozinho quando ela responder.')
      } else {
        setNotice('Rascunho salvo.')
      }
      setEditor(null)
      await reload()
      onChanged?.()
    } catch (e: any) {
      setError({ message: e?.message || 'Erro ao salvar o template', details: e?.details })
    } finally {
      setSaving(null)
    }
  }

  async function uploadMedia(file: File | undefined) {
    if (!file || !editor || (editor.headerType !== 'IMAGE' && editor.headerType !== 'VIDEO')) return
    const lim = MEDIA_LIMITS[editor.headerType]
    if (!lim.mimes.includes(file.type)) { setError({ message: `Formato não aceito: use ${lim.label}` }); return }
    if (file.size > lim.maxBytes) { setError({ message: `Arquivo grande demais: ${(file.size / 1024 / 1024).toFixed(1)} MB (${lim.label})` }); return }
    setUploading(true); setError(null)
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'video/mp4' ? 'mp4' : 'jpg'
      const path = `${institutionId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('broadcast-media').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new BroadcastError(`Não foi possível enviar o arquivo: ${upErr.message}`)
      const publicUrl = supabase.storage.from('broadcast-media').getPublicUrl(path).data.publicUrl
      setEditor(s => s && ({ ...s, media: { storage_path: path, public_url: publicUrl, mime_type: file.type, size_bytes: file.size, file_name: file.name.slice(0, 120) } }))
    } catch (e: any) {
      setError({ message: e?.message || 'Erro ao enviar o arquivo' })
    }
    setUploading(false)
  }

  async function removeDraft(t: TemplateRow) {
    if (!confirm(`Excluir o rascunho "${t.display_name || t.name}"?`)) return
    // Sem policy de DELETE pra escola (exclusão de enviado passa pela Áion) —
    // rascunho nunca enviado some escondendo da lista via contexto vazio.
    const { error: e } = await supabase.from('template_definitions').update({ available_contexts: [] }).eq('id', t.id)
    if (e) setNotice('Não foi possível excluir: ' + e.message)
    await reload()
  }

  const locked = !!editor?.id && ['pending', 'approved', 'paused', 'disabled'].includes(rows.find(r => r.id === editor.id)?.status || '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {notice && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46' }}>ok</button>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Templates da escola</h3>
            <p style={{ ...hintStyle, marginTop: 4 }}>Toda campanha usa um template aprovado pela Meta. A aprovação costuma levar de minutos a 24 horas.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={reload}><RefreshCw size={14} /> Atualizar</Btn>
            <Btn onClick={openNew}><Plus size={14} /> Novo template</Btn>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 20 }}>{[...Array(2)].map((_, i) => <div key={i} style={{ height: 52, borderRadius: 10, background: '#f8fafc', marginBottom: 10 }} className="animate-pulse" />)}</div>
        ) : own.filter(t => (t.available_contexts || []).length > 0 || t.status !== 'not_submitted').length === 0 ? (
          <Empty icon={<FileText size={24} color="#0284C7" />} title="Nenhum template da escola ainda"
            text="Crie o texto da campanha, com variáveis (nome do responsável, turma…) e botões de resposta rápida. Depois é só enviar pra aprovação da Meta."
            action={<Btn onClick={openNew}><Plus size={14} /> Criar primeiro template</Btn>} />
        ) : (
          <TemplateTable rows={own.filter(t => (t.available_contexts || []).length > 0 || t.status !== 'not_submitted')}
            onEdit={t => openEdit(t)} onDuplicate={t => openEdit(t, true)} onRemove={removeDraft} onSubmit={async t => {
              setSaving('submit')
              try {
                const r = await submitSchoolTemplate(t.id)
                const st = r.results?.[0]
                setNotice(st?.status === 'rejected' ? `A Meta recusou o envio: ${st.error_message || 'motivo não informado'}` : 'Template enviado pra aprovação da Meta.')
              } catch (e: any) { setNotice(e?.message || 'Erro ao enviar') }
              setSaving(null); reload(); onChanged?.()
            }} />
        )}
      </div>

      {aion.length > 0 && (
        <div style={cardStyle}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Templates padrão da Áion</h3>
            <p style={{ ...hintStyle, marginTop: 4 }}>Já aprovados pra sua escola e liberados pra Transmissões.</p>
          </div>
          <TemplateTable rows={aion} readOnly />
        </div>
      )}

      {editor && (
        <Modal wide title={editor.id ? (locked ? 'Template (já enviado — só leitura)' : 'Editar template') : 'Novo template'} onClose={() => setEditor(null)}
          footer={locked ? <Btn variant="secondary" onClick={() => setEditor(null)}>Fechar</Btn> : <>
            <Btn variant="ghost" onClick={() => setEditor(null)}>Cancelar</Btn>
            <Btn variant="secondary" loading={saving === 'draft'} disabled={!!saving} onClick={() => save(false)}>Salvar rascunho</Btn>
            <Btn loading={saving === 'submit'} disabled={!!saving} onClick={() => save(true)}><Send size={14} /> Salvar e enviar pra Meta</Btn>
          </>}>
          <div style={{ display: 'grid', gap: 16 }}>
            <ErrorBox message={error?.message || null} details={error?.details} />
            <fieldset disabled={locked} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nome de exibição</label>
                  <input style={inputStyle} value={editor.displayName} maxLength={80} placeholder="Ex.: Rematrícula 2027"
                    onChange={e => setEditor(s => s && ({ ...s, displayName: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select style={inputStyle} value={editor.category} onChange={e => setEditor(s => s && ({ ...s, category: e.target.value as any }))}>
                    <option value="MARKETING">Marketing (divulgação, campanhas)</option>
                    <option value="UTILITY">Utilidade (aviso, lembrete)</option>
                  </select>
                  <p style={hintStyle}>A Meta pode reclassificar. O preço segue a categoria aprovada.</p>
                </div>
              </div>
              {!editor.id && (
                <div>
                  <label style={labelStyle}>Nome técnico (opcional)</label>
                  <input style={inputStyle} value={editor.baseName} maxLength={60} placeholder="gerado a partir do nome de exibição"
                    onChange={e => setEditor(s => s && ({ ...s, baseName: e.target.value }))} />
                  <p style={hintStyle}>É o nome que a Meta vê. O sistema adiciona o prefixo da escola.</p>
                </div>
              )}
              <div>
                <label style={labelStyle}>Cabeçalho (opcional)</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {([['NONE', 'Nenhum'], ['TEXT', 'Texto'], ['IMAGE', 'Imagem'], ['VIDEO', 'Vídeo']] as const).map(([k, l]) => (
                    <button key={k} type="button"
                      onClick={() => setEditor(s => s && ({ ...s, headerType: k, media: k === s.headerType ? s.media : null }))}
                      style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: editor.headerType === k ? '1.5px solid #00A896' : '1.5px solid #E2E8F0',
                        background: editor.headerType === k ? '#F0FDFA' : '#fff', color: editor.headerType === k ? '#047857' : '#475569' }}>
                      {k === 'IMAGE' ? <ImageIcon size={12} style={{ marginRight: 4, verticalAlign: -2 }} /> : k === 'VIDEO' ? <Film size={12} style={{ marginRight: 4, verticalAlign: -2 }} /> : null}{l}
                    </button>
                  ))}
                </div>
                {editor.headerType === 'TEXT' && <>
                  <input style={inputStyle} value={editor.headerText} maxLength={60} placeholder="Ex.: Rematrícula {{1}}"
                    onChange={e => setEditor(s => s && ({ ...s, headerText: e.target.value }))} />
                  {/\{\{1\}\}/.test(editor.headerText) && (
                    <input style={{ ...inputStyle, marginTop: 8 }} value={editor.headerExample} placeholder="Exemplo da variável do cabeçalho (ex.: 2027)"
                      onChange={e => setEditor(s => s && ({ ...s, headerExample: e.target.value }))} />
                  )}
                </>}
                {(editor.headerType === 'IMAGE' || editor.headerType === 'VIDEO') && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {editor.media?.public_url && (
                      editor.headerType === 'IMAGE'
                        ? <img src={editor.media.public_url} alt="Prévia do cabeçalho" style={{ maxWidth: 280, maxHeight: 200, borderRadius: 10, border: '1px solid #E2E8F0', objectFit: 'cover' }} />
                        : <video src={editor.media.public_url} controls style={{ maxWidth: 320, maxHeight: 220, borderRadius: 10, border: '1px solid #E2E8F0' }} />
                    )}
                    {!locked && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1.5px dashed #CBD5E1', cursor: uploading ? 'wait' : 'pointer', fontSize: 13, color: '#1e2d6b', width: 'fit-content' }}>
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {uploading ? 'Enviando…' : editor.media ? `Trocar arquivo (${editor.media.file_name || 'atual'})` : `Escolher ${editor.headerType === 'IMAGE' ? 'imagem' : 'vídeo'}`}
                        <input type="file" accept={MEDIA_LIMITS[editor.headerType].accept} style={{ display: 'none' }} disabled={uploading}
                          onChange={e => { uploadMedia(e.target.files?.[0]); e.target.value = '' }} />
                      </label>
                    )}
                    <p style={{ ...hintStyle, margin: 0 }}>
                      {MEDIA_LIMITS[editor.headerType].label}.{editor.headerType === 'VIDEO' && ' Use vídeo H.264 com áudio AAC (perfil Main ou Baseline) — é o que toca em todos os celulares.'}
                      {' '}A mesma mídia vai em todas as mensagens deste template.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Mensagem</label>
                <textarea style={{ ...inputStyle, minHeight: 130, resize: 'vertical', fontFamily: 'inherit' }} value={editor.body} maxLength={1024}
                  placeholder={'Olá, {{1}}! 💙\n\nAs rematrículas de 2027 estão abertas…'}
                  onChange={e => setEditor(s => s && ({ ...s, body: e.target.value }))} />
                <p style={hintStyle}>Use {'{{1}}'}, {'{{2}}'}… pras partes que mudam por pessoa (nome, turma). {editor.body.length}/1024</p>
              </div>
              {bodyVars.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={labelStyle}>Variáveis</label>
                  {bodyVars.map(n => (
                    <div key={n} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b' }}>{`{{${n}}}`}</span>
                      <input style={inputStyle} placeholder="O que é (ex.: nome do responsável)" value={editor.labels[n] || ''}
                        onChange={e => setEditor(s => s && ({ ...s, labels: { ...s.labels, [n]: e.target.value } }))} />
                      <input style={inputStyle} placeholder="Exemplo pra Meta (ex.: Maria)" value={editor.examples[n] || ''}
                        onChange={e => setEditor(s => s && ({ ...s, examples: { ...s.examples, [n]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={labelStyle}>Botões (opcional)</label>
                {editor.buttons.map((b, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: b.type === 'URL' ? '130px 1fr 1.4fr 36px' : '130px 1fr 36px', gap: 8, alignItems: 'center' }}>
                    <Badge label={b.type === 'URL' ? 'Link' : 'Resposta rápida'} color={b.type === 'URL' ? '#1D4ED8' : '#047857'} bg={b.type === 'URL' ? '#DBEAFE' : '#D1FAE5'}
                      icon={b.type === 'URL' ? <LinkIcon size={11} /> : <MessageSquareReply size={11} />} />
                    <input style={inputStyle} maxLength={25} placeholder="Texto do botão" value={b.text}
                      onChange={e => setEditor(s => s && ({ ...s, buttons: s.buttons.map((x, j) => j === i ? { ...x, text: e.target.value } : x) }))} />
                    {b.type === 'URL' && (
                      <input style={inputStyle} placeholder="https://site.com.br/pagina/" value={b.url_base || ''}
                        onChange={e => setEditor(s => s && ({ ...s, buttons: s.buttons.map((x, j) => j === i ? { ...x, url_base: e.target.value } : x) }))} />
                    )}
                    <button type="button" aria-label="Remover botão" onClick={() => setEditor(s => s && ({ ...s, buttons: s.buttons.filter((_, j) => j !== i) }))}
                      style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 8, height: 36, cursor: 'pointer', color: '#94a3b8' }}><Trash2 size={14} /></button>
                  </div>
                ))}
                {editor.buttons.some(b => b.type === 'URL') && (
                  <input style={inputStyle} placeholder="Exemplo do final do link (ex.: tabela-2027)" value={editor.urlExample}
                    onChange={e => setEditor(s => s && ({ ...s, urlExample: e.target.value }))} />
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn variant="secondary" disabled={editor.buttons.length >= 10} onClick={() => setEditor(s => s && ({ ...s, buttons: [...s.buttons, { type: 'QUICK_REPLY', text: '' }] }))}>
                    <MessageSquareReply size={14} /> Resposta rápida
                  </Btn>
                  <Btn variant="secondary" disabled={editor.buttons.length >= 10 || editor.buttons.filter(b => b.type === 'URL').length >= 2}
                    onClick={() => setEditor(s => s && ({ ...s, buttons: [...s.buttons, { type: 'URL', text: '', url_base: 'https://' }] }))}>
                    <LinkIcon size={14} /> Botão de link
                  </Btn>
                </div>
                <p style={hintStyle}>Botões de resposta rápida podem ter ação própria na campanha (etiqueta, pular o robô, atendente).</p>
              </div>
            </fieldset>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TemplateTable({ rows, readOnly, onEdit, onDuplicate, onRemove, onSubmit }: {
  rows: TemplateRow[]; readOnly?: boolean
  onEdit?: (t: TemplateRow) => void; onDuplicate?: (t: TemplateRow) => void
  onRemove?: (t: TemplateRow) => void; onSubmit?: (t: TemplateRow) => void
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Template', 'Mensagem', 'Categoria', 'Status', ''].map(c => (
              <th key={c} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(t => {
            const st = TEMPLATE_STATUS[t.status] || TEMPLATE_STATUS.not_submitted
            const cat = t.approved_category || t.category
            return (
              <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.display_name || t.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.name}</div>
                </td>
                <td style={{ padding: '12px 16px', maxWidth: 320 }}>
                  <div title={t.body_text} style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(t.header_config?.format || '').toUpperCase() === 'IMAGE' && <ImageIcon size={12} style={{ marginRight: 4, verticalAlign: -2, color: '#0284C7' }} />}
                    {(t.header_config?.format || '').toUpperCase() === 'VIDEO' && <Film size={12} style={{ marginRight: 4, verticalAlign: -2, color: '#0284C7' }} />}
                    {t.body_text}
                  </div>
                  {t.buttons.length > 0 && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.buttons.map(b => b.text).join(' · ')}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}><Badge label={CATEGORY_LABEL[cat] || cat} color="#475569" bg="#F1F5F9" /></td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge label={st.label} color={st.color} bg={st.bg} />
                  {t.status === 'rejected' && t.error_message && <div style={{ fontSize: 11, color: '#991B1B', marginTop: 4, maxWidth: 220 }}>{t.error_message}</div>}
                </td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {!readOnly && (
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {t.status === 'not_submitted' && <>
                        <Btn variant="secondary" onClick={() => onEdit?.(t)}><Pencil size={13} /> Editar</Btn>
                        <Btn onClick={() => onSubmit?.(t)}><Send size={13} /> Enviar</Btn>
                        <Btn variant="ghost" onClick={() => onRemove?.(t)}><Trash2 size={13} /></Btn>
                      </>}
                      {t.status === 'rejected' && <Btn variant="secondary" onClick={() => onDuplicate?.(t)}><Copy size={13} /> Duplicar pra corrigir</Btn>}
                      {['pending', 'approved', 'paused', 'disabled'].includes(t.status) && <Btn variant="ghost" onClick={() => onEdit?.(t)}>Ver</Btn>}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
