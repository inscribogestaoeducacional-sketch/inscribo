// Aba "Aparência" do editor da Vitrine: identidade (logo, capa, título,
// descrição) e tema (cores, botão, cantos, fonte). Só edita o rascunho da
// página (onChange); o editor salva sozinho.
import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { type VitrinePageRow, type VitrineTheme, FONTS, HEX_RE, contrastRatio, readTheme } from '../../lib/vitrine'
import { Field, TextInput, TextArea, Segmented, ImagePicker, cardStyle, hintStyle } from './ui'

interface Props {
  page: VitrinePageRow
  institution: { name: string; logo_url: string | null; primary_color: string | null }
  institutionId: string
  onChange: (patch: Partial<VitrinePageRow>) => void
  onError: (msg: string) => void
}

const PRIMARY_SWATCHES = ['#00A896', '#3B82F6', '#1A2B4A', '#7C3AED', '#DB2777', '#DC2626', '#F59E0B', '#16A34A']
const BG_SWATCHES = ['#FFFFFF', '#F8FAFC', '#FFF7ED', '#F0FDFA', '#EFF6FF', '#111827']
const TEXT_SWATCHES = ['#111827', '#1E293B', '#334155', '#FFFFFF']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...cardStyle, padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#1e2d6b' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </section>
  )
}

function ColorField({ label, value, swatches, onChange }: { label: string; value: string; swatches: string[]; onChange: (v: string) => void }) {
  const [text, setText] = React.useState(value)
  React.useEffect(() => setText(value), [value])
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())} aria-label={`${label}: escolher cor`}
          style={{ width: 38, height: 38, padding: 2, border: '1.5px solid #E2E8F0', borderRadius: 9, background: '#fff', cursor: 'pointer', flex: 'none' }} />
        <TextInput value={text} maxLength={7} aria-label={`${label}: código`} style={{ width: 96, fontFamily: 'ui-monospace, monospace', flex: 'none' }}
          onChange={e => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            setText(v)
            if (HEX_RE.test(v)) onChange(v.toUpperCase())
          }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {swatches.map(s => (
            <button key={s} type="button" onClick={() => onChange(s)} title={s} aria-label={`Usar ${s}`}
              style={{
                width: 26, height: 26, borderRadius: 7, background: s, cursor: 'pointer', padding: 0,
                border: s.toUpperCase() === value.toUpperCase() ? '2px solid #1e2d6b' : '1px solid #CBD5E1',
                boxShadow: s.toUpperCase() === value.toUpperCase() ? '0 0 0 2px #fff inset' : 'none',
              }} />
          ))}
        </div>
      </div>
    </Field>
  )
}

export default function AppearancePanel({ page, institution, institutionId, onChange, onError }: Props) {
  const theme = readTheme(page.theme)
  const setTheme = (patch: Partial<VitrineTheme>) => onChange({ theme: { ...theme, ...patch } })
  const primarySwatches = institution.primary_color && HEX_RE.test(institution.primary_color)
    ? [institution.primary_color.toUpperCase(), ...PRIMARY_SWATCHES.filter(s => s !== institution.primary_color!.toUpperCase())]
    : PRIMARY_SWATCHES
  const textContrast = contrastRatio(theme.text, theme.background)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Identidade">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
          <Field label="Logo">
            <ImagePicker institutionId={institutionId} value={page.logo_url} shape="circle" height={88}
              onError={onError} onChange={url => onChange({ logo_url: url })} />
            {institution.logo_url && page.logo_url !== institution.logo_url && (
              <button type="button" onClick={() => onChange({ logo_url: institution.logo_url })}
                style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: '#00A896', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Usar a logo da escola
              </button>
            )}
          </Field>
          <Field label="Capa (opcional)" hint="Imagem larga no topo da página. Sugestão: 1200 × 400 px.">
            <ImagePicker institutionId={institutionId} value={page.cover_url} height={88}
              emptyLabel="Enviar capa" onError={onError} onChange={url => onChange({ cover_url: url })} />
          </Field>
        </div>
        <Field label="Nome na página" counter={{ value: page.title || '', max: 80 }}>
          <TextInput value={page.title || ''} maxLength={80} placeholder={institution.name} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Descrição curta" counter={{ value: page.bio || '', max: 300 }} hint="Aparece abaixo do nome. Ex.: séries atendidas, cidade, matrículas abertas.">
          <TextArea rows={3} value={page.bio || ''} maxLength={300} onChange={e => onChange({ bio: e.target.value || null })} />
        </Field>
      </Section>

      <Section title="Cores">
        <ColorField label="Cor principal (botões)" value={theme.primary} swatches={primarySwatches} onChange={v => setTheme({ primary: v })} />
        <ColorField label="Fundo" value={theme.background} swatches={BG_SWATCHES} onChange={v => setTheme({ background: v })} />
        <ColorField label="Texto" value={theme.text} swatches={TEXT_SWATCHES} onChange={v => setTheme({ text: v })} />
        {textContrast < 4.5 && (
          <p style={{ margin: 0, fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 6, lineHeight: 1.5 }}>
            <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} />
            O texto está com pouco contraste sobre o fundo ({textContrast.toFixed(1).replace('.', ',')}:1) e pode ficar difícil de ler no celular. O recomendado é pelo menos 4,5:1.
          </p>
        )}
      </Section>

      <Section title="Botões e letras">
        <Field label="Estilo dos botões">
          <Segmented value={theme.button_style} onChange={v => setTheme({ button_style: v })}
            options={[{ value: 'filled', label: 'Preenchido' }, { value: 'soft', label: 'Suave' }, { value: 'outline', label: 'Contorno' }]} />
        </Field>
        <Field label="Cantos">
          <Segmented value={theme.radius} onChange={v => setTheme({ radius: v })}
            options={[{ value: 0, label: 'Retos' }, { value: 8, label: 'Leves' }, { value: 16, label: 'Arredondados' }, { value: 999, label: 'Pílula' }]} />
        </Field>
        <Field label="Fonte">
          <select value={theme.font} onChange={e => setTheme({ font: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#FAFAFA', fontSize: 13, color: '#1e293b', fontFamily: 'inherit' }}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <p style={hintStyle}>A prévia ao lado mostra a fonte escolhida.</p>
        </Field>
      </Section>
    </div>
  )
}
