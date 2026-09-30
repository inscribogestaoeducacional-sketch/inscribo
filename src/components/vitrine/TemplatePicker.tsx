// Modelos prontos (Entrega 2), no topo da aba Aparência: os 4 modelos com a
// página DA ESCOLA renderizada em cada um (mesmo renderizador da página
// pública, em miniatura), o atual marcado e "Usar este modelo". Trocar muda
// só o visual; a confirmação diz o que fica. Página vazia pode receber os
// blocos sugeridos do modelo junto.
import React, { useMemo, useState } from 'react'
import { Check, LayoutTemplate } from 'lucide-react'
import {
  type TemplateKey, type VitrinePageRow, TEMPLATES, templateTheme, buildPreviewData, VITRINE_SITE_URL, BLOCK_TYPES,
} from '../../lib/vitrine'
import { renderVitrinePage } from '../../../api/_lib/vitrineRender'
import type { EditorBlock } from './BlockList'
import { DS, cardStyle, sectionTitleStyle, hintStyle } from './ui'

interface Props {
  page: VitrinePageRow
  blocks: EditorBlock[]
  schoolPhone: string | null
  institutionName: string
  onApply: (key: TemplateKey, withStarter: boolean) => void
}

const W = 380, H = 640, SCALE = 0.42   // miniatura: página de 380 px reduzida

export default function TemplatePicker({ page, blocks, schoolPhone, institutionName, onApply }: Props) {
  const [confirm, setConfirm] = useState<TemplateKey | null>(null)
  const [withStarter, setWithStarter] = useState(true)
  const current = (page.theme as any)?.template as TemplateKey | undefined
  const empty = blocks.length === 0

  // Uma prévia por modelo, com o conteúdo atual (ou, sem blocos, os sugeridos
  // do modelo só pra mostrar o jeito).
  const docs = useMemo(() => Object.fromEntries(TEMPLATES.map(t => {
    const theme = templateTheme(t.key, page.theme)
    const list = blocks.length
      ? blocks.map(b => ({ id: b.id || b.key, type: b.type, config: b.config, is_visible: b.is_visible }))
      : [{ id: 'm1', type: 'enroll' as const, config: { label: 'Quero matricular', mode: 'whatsapp', message: 'Olá! Quero fazer a matrícula.', effect: t.key === 'matriculas' || t.key === 'vibrante' ? 'pulse' : undefined }, is_visible: true },
         { id: 'm2', type: 'whatsapp' as const, config: { label: 'Fale com a escola', message: 'Olá!', phone_source: 'school' }, is_visible: true },
         { id: 'm3', type: 'link' as const, config: { label: 'Nosso Instagram', url: 'https://instagram.com/escola' }, is_visible: true }]
    const data = buildPreviewData({ ...page, theme: theme as any }, list, { schoolPhone: schoolPhone || '5583999999999', institutionName })
    // Sem animação e sem clique na miniatura; mapa/vídeo embutidos viram um
    // quadro neutro (4 miniaturas carregando o Google Maps seria peso à toa).
    const html = renderVitrinePage(data, { siteUrl: VITRINE_SITE_URL, preview: true })
      .replace(/<iframe\b[^>]*><\/iframe>/g, '<div style="position:absolute;inset:0;background:#E2E8F0"></div>')
    return [t.key, html + '<style>html,body{pointer-events:none;overflow:hidden}</style>']
  })), [page, blocks, schoolPhone, institutionName])

  const pick = TEMPLATES.find(t => t.key === confirm)
  return (
    <section style={{ ...cardStyle, padding: 24 }} aria-labelledby="vit-tpl-title">
      <h3 id="vit-tpl-title" style={{ ...sectionTitleStyle, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <LayoutTemplate size={16} color="#00A896" /> Modelos
      </h3>
      <p style={{ ...hintStyle, margin: '0 0 18px' }}>
        Um visual pronto com a cor da escola. Trocar de modelo muda cores, fundo, fontes e botões; os blocos, textos e imagens continuam.
        Depois dá pra ajustar tudo aqui embaixo.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {TEMPLATES.map(t => {
          const on = current === t.key
          return (
            <div key={t.key} className="vit-tpl" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" onClick={() => setConfirm(t.key)} aria-label={`Ver o modelo ${t.name}`}
                className="vit-tpl-thumb"
                style={{ position: 'relative', padding: 0, border: on ? '2px solid #00A896' : '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: '#fff',
                  height: Math.round(H * SCALE) + 2, boxShadow: on ? '0 0 0 3px #D1FAE5' : DS.shadowSm }}>
                <iframe title={`Prévia do modelo ${t.name}`} srcDoc={docs[t.key]} sandbox="" tabIndex={-1} aria-hidden="true"
                  style={{ width: W, height: H, border: 0, transform: `scale(${SCALE})`, transformOrigin: 'top left', pointerEvents: 'none', display: 'block' }} />
                {on && (
                  <span style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#00A896', color: '#fff' }}>
                    <Check size={11} /> Atual
                  </span>
                )}
              </button>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45, marginTop: 2 }}>{t.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      {pick && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setConfirm(null) }}>
          <div role="dialog" aria-modal="true" aria-label={`Usar o modelo ${pick.name}`}
            style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'slideUp 0.2s ease', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 20, padding: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 'none', width: Math.round(W * 0.5), height: Math.round(H * 0.5), borderRadius: 14, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: DS.shadowMd }}>
                <iframe title={`Prévia ampliada do modelo ${pick.name}`} srcDoc={docs[pick.key]} sandbox="" tabIndex={-1} aria-hidden="true"
                  style={{ width: W, height: H, border: 0, transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none', display: 'block' }} />
              </div>
              <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.01em' }}>Usar o modelo {pick.name}?</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{pick.description}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
                  <strong style={{ color: '#1e293b' }}>Muda:</strong> cores, fundo, fontes, botões e acabamento.<br />
                  <strong style={{ color: '#1e293b' }}>Continua:</strong> blocos, textos, imagens, logo, capa e redes sociais.
                </p>
                {empty && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#1e293b', cursor: 'pointer', lineHeight: 1.45 }}>
                    <input type="checkbox" checked={withStarter} onChange={e => setWithStarter(e.target.checked)} style={{ marginTop: 2, accentColor: '#00A896' }} />
                    <span>Adicionar também os blocos sugeridos: {pick.starter.map(s => BLOCK_TYPES[s].label).join(', ')}.</span>
                  </label>
                )}
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Dá pra desfazer logo depois de aplicar.</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <button type="button" onClick={() => setConfirm(null)} className="vit-btn"
                style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" className="vit-btn" onClick={() => { onApply(pick.key, empty && withStarter); setConfirm(null) }}
                style={{ padding: '9px 18px', borderRadius: 12, border: 'none', background: '#00A896', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,168,150,0.25)' }}>
                {current === pick.key ? 'Reaplicar modelo' : 'Usar este modelo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
