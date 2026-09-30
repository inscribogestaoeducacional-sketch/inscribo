// Aba "Configurações" do editor da Vitrine: endereço (slug), texto de
// compartilhamento e link. O slug NÃO é salvo automaticamente: trocar o
// endereço é uma decisão (o antigo vira redirecionamento, até 5 por página
// — ver vitrine_pages_slug_redirect no banco).
import React, { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, AlertCircle, CornerDownRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  type VitrinePageRow, type SlugStatus, SLUG_RE, SLUG_STATUS_MSG, VITRINE_SITE_URL, publicUrl, slugify,
} from '../../lib/vitrine'
import { Field, TextArea, Toggle, cardStyle, hintStyle, inputStyle, sectionTitleStyle } from './ui'

interface Props {
  page: VitrinePageRow
  onChange: (patch: Partial<VitrinePageRow>) => void
  onSlugSaved: (slug: string) => void
  onToast: (msg: string) => void
  // Blocos salvos que podem virar WhatsApp flutuante (WhatsApp ou matrícula pelo WhatsApp).
  floatingOptions: { id: string; label: string }[]
}

export default function SettingsPanel({ page, onChange, onSlugSaved, onToast, floatingOptions }: Props) {
  const [draft, setDraft] = useState(page.slug)
  const [status, setStatus] = useState<SlugStatus | 'checking' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [redirects, setRedirects] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => { setDraft(page.slug) }, [page.slug])

  useEffect(() => {
    supabase.from('vitrine_slug_redirects').select('old_slug').eq('page_id', page.id).order('created_at', { ascending: false })
      .then(({ data }) => setRedirects((data || []).map((r: any) => r.old_slug)))
  }, [page.id, page.slug])

  // Disponibilidade enquanto digita (a regra de verdade é a do banco).
  useEffect(() => {
    setSaveError(null)
    if (draft === page.slug) { setStatus(null); return }
    if (!SLUG_RE.test(draft) || draft.includes('--')) { setStatus('invalid'); return }
    setStatus('checking')
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('vitrine_slug_status', { p_slug: draft, p_page_id: page.id })
      setStatus(error ? null : (data as SlugStatus))
    }, 400)
    return () => clearTimeout(t)
  }, [draft, page.slug, page.id])

  async function saveSlug() {
    setSaving(true); setSaveError(null)
    const { error } = await supabase.from('vitrine_pages').update({ slug: draft }).eq('id', page.id)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    onSlugSaved(draft)
    onToast('Endereço atualizado. O endereço antigo continua levando pra página.')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl(page.slug))
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { onToast('Não foi possível copiar. Selecione o link e copie manualmente.') }
  }

  const host = VITRINE_SITE_URL.replace(/^https?:\/\//, '')
  const canSave = draft !== page.slug && status === 'ok' && !saving

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={{ ...cardStyle, padding: 24 }}>
        <h3 style={{ ...sectionTitleStyle, margin: '0 0 6px' }}>Endereço da página</h3>
        <p style={{ ...hintStyle, margin: '0 0 14px', fontSize: 12 }}>É o link que vai na bio do Instagram, no Google e onde mais a escola divulgar.</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 12, background: '#FAFAFA', overflow: 'hidden' }}>
            <span style={{ padding: '9px 0 9px 12px', fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>{host}/</span>
            <input value={draft} aria-label="Endereço da página" maxLength={40}
              onChange={e => setDraft(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              onBlur={() => { const s = slugify(draft); if (s && s !== draft) setDraft(s) }}
              style={{ ...inputStyle, border: 'none', background: 'transparent', paddingLeft: 0, flex: 1, minWidth: 80 }} />
          </div>
          <button type="button" onClick={saveSlug} disabled={!canSave}
            style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: canSave ? '#00A896' : '#E2E8F0', color: canSave ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar endereço
          </button>
        </div>

        <div style={{ minHeight: 20, marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} aria-live="polite">
          {status === 'checking' && <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={12} className="animate-spin" /> Verificando…</span>}
          {status === 'ok' && <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={13} /> Disponível. Ao salvar, o endereço atual continua funcionando e leva pro novo.</span>}
          {status && status !== 'ok' && status !== 'checking' && <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={13} /> {SLUG_STATUS_MSG[status]}</span>}
          {saveError && <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={13} /> {saveError}</span>}
        </div>

        {redirects.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
            <span style={{ fontWeight: 600 }}>Endereços antigos que redirecionam pra cá:</span>
            <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {redirects.map(r => <li key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CornerDownRight size={12} /> {host}/{r}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section style={{ ...cardStyle, padding: 24 }}>
        <h3 style={{ ...sectionTitleStyle, margin: '0 0 16px' }}>Link da página</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <code style={{ flex: '1 1 240px', padding: '10px 14px', borderRadius: 12, background: '#f1f5f9', fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {publicUrl(page.slug)}
          </code>
          <button type="button" onClick={copy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 3px rgba(0,168,150,0.06), 0 1px 2px rgba(0,0,0,0.04)', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
            {copied ? <><Check size={14} color="#16A34A" /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
          <a href={publicUrl(page.slug)} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 3px rgba(0,168,150,0.06), 0 1px 2px rgba(0,0,0,0.04)', fontSize: 13, fontWeight: 600, color: '#475569', textDecoration: 'none' }}>
            <ExternalLink size={14} /> Abrir
          </a>
        </div>
        {!page.is_published && <p style={{ ...hintStyle, fontSize: 12 }}>A página ainda é um rascunho: quem abrir o link vê “Página não encontrada” até você publicar.</p>}
        {page.is_published && <p style={{ ...hintStyle, fontSize: 12 }}>Alterações aparecem na página publicada em até 1 minuto.</p>}
      </section>

      <section style={{ ...cardStyle, padding: 24 }}>
        <h3 style={{ ...sectionTitleStyle, margin: '0 0 16px' }}>Compartilhamento</h3>
        <Field label="Texto da prévia do link" counter={{ value: page.seo_description || '', max: 200 }}
          hint="Aparece embaixo do título quando o link é enviado no WhatsApp ou no Facebook, e no Google. Em branco, usa a descrição curta da aparência.">
          <TextArea rows={3} value={page.seo_description || ''} maxLength={200}
            onChange={e => onChange({ seo_description: e.target.value || null })} />
        </Field>
      </section>

      <section style={{ ...cardStyle, padding: 24 }}>
        <h3 style={{ ...sectionTitleStyle, margin: '0 0 16px' }}>Botões da página</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="WhatsApp flutuante"
            hint={floatingOptions.length
              ? 'Botão verde fixo no canto da tela, à mão enquanto a pessoa rola. Usa a mesma mensagem e o mesmo gatilho do Captação do bloco escolhido, e o clique conta nesse bloco. Some enquanto o próprio bloco está na tela.'
              : 'Crie um bloco de WhatsApp (ou de matrícula pelo WhatsApp) na aba Blocos para usar como botão flutuante.'}>
            <select value={page.floating_block_id || ''} disabled={!floatingOptions.length}
              onChange={e => onChange({ floating_block_id: e.target.value || null })}
              style={{ ...inputStyle, cursor: floatingOptions.length ? 'pointer' : 'not-allowed' }}>
              <option value="">Sem botão flutuante</option>
              {floatingOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Toggle checked={page.show_share !== false} onChange={v => onChange({ show_share: v })}
            label="Botão de compartilhar"
            description="Ícone no canto de cima: no celular abre o menu de compartilhar (WhatsApp, Instagram…); no computador copia o link. Quem chegar por ele aparece como “compartilhar” nas estatísticas." />
        </div>
      </section>
    </div>
  )
}
