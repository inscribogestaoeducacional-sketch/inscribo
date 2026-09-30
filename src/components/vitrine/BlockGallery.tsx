// Galeria de blocos do editor da Vitrine: tipos agrupados por objetivo, cada
// um com uma miniatura desenhada (CSS puro, sem imagem) de como aparece na
// página. Novos tipos das próximas etapas entram aqui numa categoria.
import React from 'react'
import { Play, MapPin } from 'lucide-react'
import { type BlockType, BLOCK_TYPES } from '../../lib/vitrine'
import { BLOCK_ICONS } from './BlockList'

const GROUPS: { title: string; hint: string; types: BlockType[] }[] = [
  { title: 'Contato e matrícula', hint: 'O que mais gera conversa com as famílias', types: ['whatsapp', 'enroll'] },
  { title: 'Links e destaques',    hint: 'Leve pra site, redes e campanhas',          types: ['link', 'banner'] },
  { title: 'Conteúdo',             hint: 'Mostre a escola',                           types: ['text', 'gallery', 'video'] },
  { title: 'Confiança',            hint: 'Responda dúvidas e mostre quem faz a escola', types: ['stats', 'testimonials', 'faq', 'team'] },
  { title: 'Informações',          hint: 'Onde fica e quando atende',                 types: ['map', 'hours'] },
]

const T = 'all 0.18s cubic-bezier(0.4,0,0.2,1)'

// Miniatura de cada tipo (80 × 52), nas cores do próprio tipo.
function Mini({ type }: { type: BlockType }) {
  const c = BLOCK_TYPES[type].color
  const bar = (w: string, h = 5, o = 0.25) => <div style={{ width: w, height: h, borderRadius: 3, background: c, opacity: o }} />
  const box: React.CSSProperties = { width: 80, height: 52, borderRadius: 10, background: BLOCK_TYPES[type].bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, flex: 'none', overflow: 'hidden', position: 'relative' }
  switch (type) {
    case 'whatsapp': case 'link':
      return <div style={box}><div style={{ width: 58, height: 13, borderRadius: 999, background: c, opacity: type === 'link' ? 0.85 : 1 }} /><div style={{ width: 58, height: 13, borderRadius: 999, background: c, opacity: 0.3 }} /></div>
    case 'enroll':
      return <div style={box}><div style={{ width: 64, height: 20, borderRadius: 999, background: c, boxShadow: `0 0 0 4px ${c}33` }} /></div>
    case 'banner':
      return <div style={box}><div style={{ width: 66, height: 24, borderRadius: 6, background: `linear-gradient(120deg, ${c}, #FDBA74)` }} /></div>
    case 'text':
      return <div style={{ ...box, alignItems: 'flex-start', padding: '0 12px' }}>{bar('40px', 6, 0.7)}{bar('56px')}{bar('48px')}</div>
    case 'gallery':
      return <div style={{ ...box, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 3, padding: '8px 16px' }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ borderRadius: 3, background: c, opacity: 0.25 + i * 0.15 }} />)}</div>
    case 'video':
      return <div style={box}><div style={{ width: 58, height: 34, borderRadius: 6, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={13} color="#fff" fill="#fff" /></div></div>
    case 'map':
      return <div style={{ ...box, backgroundImage: `linear-gradient(90deg, ${c}22 1px, transparent 1px), linear-gradient(${c}22 1px, transparent 1px)`, backgroundSize: '10px 10px' }}><MapPin size={18} color={c} fill={`${c}55`} /></div>
    case 'hours':
      return <div style={{ ...box, alignItems: 'stretch', padding: '0 10px', gap: 4 }}>{[0, 1, 2].map(i => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>{bar('22px', 4, 0.45)}{bar('18px', 4, i === 0 ? 0.9 : 0.35)}</div>)}</div>
    case 'faq':
      return <div style={{ ...box, alignItems: 'stretch', padding: '0 10px', gap: 5 }}>{[0, 1, 2].map(i => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{bar(i === 0 ? '40px' : '34px', 4, 0.5)}<span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1, color: c }}>+</span></div>)}</div>
    case 'testimonials':
      return <div style={{ ...box, flexDirection: 'row', gap: 4, justifyContent: 'flex-start', paddingLeft: 8 }}>{[0, 1].map(i => (
        <div key={i} style={{ flex: 'none', width: 44, height: 38, borderRadius: 6, background: '#fff', opacity: i ? 0.6 : 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 7, lineHeight: 1, color: '#F59E0B', letterSpacing: 0.5 }}>★★★★★</span>{bar('30px', 3, 0.35)}{bar('22px', 3, 0.35)}
        </div>))}</div>
    case 'stats':
      return <div style={{ ...box, flexDirection: 'row', gap: 5 }}>{['20', '1k', '98'].map((n, i) => (
        <div key={n} style={{ width: 20, height: 30, borderRadius: 5, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, opacity: i === 1 ? 1 : 0.8 }}>
          <span style={{ fontSize: 8, fontWeight: 800, lineHeight: 1, color: c }}>{n}</span>{bar('12px', 2, 0.4)}
        </div>))}</div>
    case 'team':
      return <div style={{ ...box, flexDirection: 'row', gap: 6 }}>{[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: c, opacity: 0.35 + i * 0.2 }} />{bar('14px', 3, 0.5)}
        </div>))}</div>
  }
}

export default function BlockGallery({ onPick }: { onPick: (type: BlockType) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {GROUPS.map(g => (
        <section key={g.title} aria-labelledby={`bg-${g.title}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <h3 id={`bg-${g.title}`} style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e2d6b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.title}</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{g.hint}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
            {g.types.map(t => {
              const meta = BLOCK_TYPES[t]
              const Icon = BLOCK_ICONS[t]
              return (
                <button key={t} type="button" onClick={() => onPick(t)} className="vit-pick"
                  style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 14, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', textAlign: 'left', transition: T }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,168,150,0.10), 0 2px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
                  <span aria-hidden="true" style={{ display: 'contents' }}><Mini type={t} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      <Icon size={14} color={meta.color} /> {meta.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: '#64748b', lineHeight: 1.4, marginTop: 2 }}>{meta.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
