// Configurações > WhatsApp > Modelos da Meta.
// Lista os modelos de mensagem da própria escola (nunca de outra) e os modelos
// padrão que toda escola recebe. Usa os mesmos dados de Transmissões > Templates
// (loadTemplates), só com o visual das Configurações.
import { useEffect, useState } from 'react'
import { FileText, Plus, RefreshCw, Copy, Pencil, Send, Loader2, Lock } from 'lucide-react'
import { loadTemplates, type TemplateRow } from '../../transmissoes/TemplatesPanel'
import { TEMPLATE_STATUS, CATEGORY_LABEL } from '../../../lib/broadcasts'
import { BRAND, GRAD } from '../../../lib/brand'
import { Card, Title, GhostButton, NowNote } from './ui'

const bubble = { background: '#D9FDD3', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, color: '#111B21', whiteSpace: 'pre-wrap' as const, lineHeight: 1.45, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }

function Tag({ padrao }: { padrao: boolean }) {
  return <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 10px', color: padrao ? BRAND.primaryDark : '#475569', background: padrao ? BRAND.soft : '#F1F5F9' }}>{padrao ? 'Padrão' : 'Da escola'}</span>
}

export default function TemplatesSettings({ institutionId, onNew, onEdit }: {
  institutionId: string
  onNew?: () => void
  onEdit?: (t: TemplateRow, duplicate: boolean) => void
}) {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const reload = async () => { setLoading(true); try { setRows(await loadTemplates(institutionId)) } catch (e) { console.error('[Modelos]', e) } setLoading(false) }
  useEffect(() => { reload() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = rows.filter(t => t.institution_id === null || (t.available_contexts || []).length > 0 || t.status !== 'not_submitted')
  const sorted = visible
  const padrao = sorted.filter(t => t.institution_id === null)
  const own = sorted.filter(t => t.institution_id !== null)

  const item = (t: TemplateRow) => {
    const st = TEMPLATE_STATUS[t.status] || TEMPLATE_STATUS.not_submitted
    const isOwn = t.institution_id !== null
    return (
      <div key={t.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16, background: '#fff', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{t.display_name || t.name}</span>
            <Tag padrao={!isOwn} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 999, padding: '3px 10px' }}>{st.label}</span>
          </div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>{CATEGORY_LABEL[t.approved_category || t.category] || t.category} · {t.language === 'pt_BR' ? 'Português' : t.language}</div>
          {t.status === 'rejected' && t.error_message && <div style={{ fontSize: 12, color: '#991B1B', marginTop: 6 }}>Motivo da Meta: {t.error_message}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {isOwn && t.status === 'not_submitted' && <GhostButton onClick={() => onEdit?.(t, false)}><Pencil size={14} /> Editar rascunho</GhostButton>}
            {isOwn && t.status === 'rejected' && <GhostButton onClick={() => onEdit?.(t, true)}><Copy size={14} /> Duplicar para corrigir</GhostButton>}
            {isOwn && !['not_submitted', 'rejected'].includes(t.status) && <span style={{ fontSize: 12, color: BRAND.muted, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Lock size={13} /> Já enviado: o texto não muda</span>}
            {!isOwn && <span style={{ fontSize: 12, color: BRAND.muted, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Lock size={13} /> Modelo padrão: só uso, sem edição</span>}
          </div>
        </div>
        <div style={{ flex: '0 1 280px', minWidth: 220, background: '#E7F0E8', borderRadius: 14, padding: 10 }}>
          <div style={bubble}>{t.body_text}</div>
          {t.buttons.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>{t.buttons.map((b, i) => <div key={i} style={{ background: '#fff', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0B6E99', padding: '6px 0' }}>{b.text}</div>)}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Modelos de mensagem da sua escola</div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>A Meta exige um modelo aprovado para a escola puxar conversa com o cliente. A aprovação leva de minutos a 24 horas.</div>
          </div>
          <GhostButton onClick={reload}><RefreshCw size={14} /> Atualizar</GhostButton>
          <button type="button" onClick={onNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={16} /> Novo modelo</button>
        </div>
      </Card>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={24} color={BRAND.primary} className="animate-spin" /></div>
      ) : (
        <>
          <Card>
            <Title Icon={FileText} title="Modelos da escola" help="Criados por vocês. Só esta escola enxerga." />
            {own.length === 0
              ? <NowNote>Nenhum modelo próprio ainda. Toque em “Novo modelo” para criar o primeiro.</NowNote>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{own.map(item)}</div>}
          </Card>
          <Card>
            <Title Icon={Lock} title="Modelos padrão" help="Já vêm prontos e aprovados para toda escola. Servem como ponto de partida." />
            {padrao.length === 0
              ? <NowNote>Nenhum modelo padrão liberado para esta escola ainda.</NowNote>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{padrao.map(item)}</div>}
          </Card>
        </>
      )}
    </div>
  )
}
