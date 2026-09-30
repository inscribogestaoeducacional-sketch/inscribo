// Edição de um bloco da Vitrine, no lugar da lista (não mais "sanfona"
// embaixo do cartão): "← Blocos" pra voltar, cabeçalho do bloco, campos em
// grupos (Conteúdo, Botão, Agenda) que surgem em cascata, e rodapé fixo com
// Duplicar/Excluir. Os campos em si são os mesmos de BlockForms.
import React from 'react'
import { ChevronLeft, Copy, Trash2, Eye, EyeOff, PenLine, Sparkles, CalendarClock, AlertCircle } from 'lucide-react'
import { BLOCK_TYPES, blockSummary, blockDetail, effectApplies, scheduleLabel } from '../../lib/vitrine'
import BlockForm, { type BlockFormContext, EffectField } from './BlockForms'
import { BLOCK_ICONS, blockTags, type EditorBlock } from './BlockList'
import { DS } from './ui'

interface Props {
  block: EditorBlock
  ctx: BlockFormContext
  onChange: (patch: Record<string, any>) => void
  onBack: () => void
  onToggleVisible: () => void
  onSchedule: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function Group({ title, icon: Icon, children, i }: { title: string; icon: React.ElementType; children: React.ReactNode; i: number }) {
  return (
    <section className="vit-group" style={{ animationDelay: `${i * 45}ms`, background: '#fff', border: '1px solid #E2E8F0', borderRadius: DS.r.xl, boxShadow: DS.shadowSm, padding: '20px 22px' }}>
      <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.005em' }}>
        <Icon size={16} color="#00A896" /> {title}
      </h3>
      {children}
    </section>
  )
}

export default function BlockEditor({ block: b, ctx, onChange, onBack, onToggleVisible, onSchedule, onDuplicate, onDelete }: Props) {
  const meta = BLOCK_TYPES[b.type]
  const Icon = BLOCK_ICONS[b.type]
  const sched = scheduleLabel(b.visible_from, b.visible_until)
  const secondary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: DS.r.md, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer', boxShadow: DS.shadowSm }
  let gi = 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <nav aria-label="Caminho" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#94A3B8' }}>
        <button type="button" onClick={onBack} className="vit-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 10px 5px 4px', borderRadius: DS.r.sm, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
          <ChevronLeft size={16} /> Blocos
        </button>
        <span aria-hidden="true">/</span>
        <span style={{ color: '#64748B', paddingLeft: 6 }}>{meta.label}</span>
      </nav>

      <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
        <span style={{ width: 48, height: 48, borderRadius: 14, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon size={22} color={meta.color} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.02em', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{blockSummary(b.type, b.config)}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 13, color: '#64748B', minWidth: 0, overflowWrap: 'anywhere' }}>{meta.label} · {blockDetail(b.type, b.config)}</span>
            {blockTags(b)}
          </div>
        </div>
        <button type="button" onClick={onToggleVisible} className="vit-btn" style={secondary}
          aria-label={b.is_visible ? 'Ocultar bloco' : 'Mostrar bloco'} title={b.is_visible ? 'Some da página, mas continua salvo' : 'Volta a aparecer na página'}>
          {b.is_visible ? <><EyeOff size={15} /> Ocultar</> : <><Eye size={15} /> Mostrar</>}
        </button>
      </header>

      {b.error && (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', borderRadius: DS.r.md, fontSize: 13, lineHeight: 1.5,
          ...(b.state === 'error' ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' } : { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }) }}>
          <AlertCircle size={15} style={{ flex: 'none', marginTop: 2 }} />
          <span><strong>{b.state === 'error' ? 'Não foi possível salvar: ' : b.id ? 'Alteração não salva: ' : 'Falta pouco: '}</strong>{b.error}</span>
        </div>
      )}

      <Group title="Conteúdo" icon={PenLine} i={gi++}>
        <BlockForm type={b.type} config={b.config} ctx={ctx} onChange={onChange} />
      </Group>

      {effectApplies(b.type, b.config) && (
        <Group title="Botão" icon={Sparkles} i={gi++}>
          <EffectField value={b.config.effect || 'none'} onChange={v => onChange({ effect: v === 'none' ? undefined : v })} />
        </Group>
      )}

      <Group title="Agenda" icon={CalendarClock} i={gi++}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 180, fontSize: 13, color: sched ? '#1e293b' : '#64748B', lineHeight: 1.5 }}>
            {sched || 'Sempre visível na página.'}
            {!b.id && <span style={{ display: 'block', color: '#94A3B8', fontSize: 12 }}>Complete o bloco pra poder agendar.</span>}
          </span>
          <button type="button" onClick={onSchedule} disabled={!b.id} aria-label="Agendar bloco" className="vit-btn"
            style={{ ...secondary, ...(!b.id ? { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' } : {}) }}>
            <CalendarClock size={15} /> {sched ? 'Alterar agenda' : 'Agendar'}
          </button>
        </div>
      </Group>

      <div className="vit-footbar" style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 4px', marginTop: 2 }}>
        <button type="button" onClick={onBack} className="vit-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 12px', borderRadius: DS.r.md, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
          <ChevronLeft size={16} /> Voltar para os blocos
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onDuplicate} className="vit-btn" style={secondary}><Copy size={15} /> Duplicar</button>
          <button type="button" onClick={onDelete} className="vit-btn" style={{ ...secondary, color: '#DC2626', border: '1px solid #FECACA' }}><Trash2 size={15} /> Excluir</button>
        </div>
      </div>
    </div>
  )
}
