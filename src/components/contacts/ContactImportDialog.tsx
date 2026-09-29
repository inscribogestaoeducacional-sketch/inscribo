// Importação de contatos por planilha (CSV ou XLSX) com upsert por telefone —
// a mesma tela serve o módulo de Contatos e o import da campanha. Passos:
// 1. arquivo → 2. colunas reconhecidas (dá pra trocar) + prévia (novos,
// existentes, inválidos, duplicados) + o que fazer em cada coluna nos
// contatos que já existem → 3. confirmação com os números → 4. resultado.
// Prévia e gravação são a mesma função no banco (contacts_import).
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import {
  readSpreadsheet, detectMapping, buildRows, contactsImport, downloadContactsTemplate,
  FIELD_LABEL, UPDATABLE_FIELDS,
  type Sheet, type ContactField, type ColumnMode, type TagsMode, type ImportResult, type UpdatableField,
} from '../../lib/contactImport'

const C = { navy: '#1A2B4A', teal: '#00A896', muted: '#64748B', light: '#94A3B8', line: '#E2E8F0', soft: '#F8FAFC' }

// Padrões aprovados: nome só preenche vazio (preserva ajuste da atendente);
// o resto sobrescreve; etiquetas somam.
const DEFAULT_MODES: Record<UpdatableField, ColumnMode> = {
  name: 'fill', email: 'overwrite', address: 'overwrite', student: 'overwrite', grade: 'overwrite', relationship: 'overwrite',
}

const n = (v: number | undefined) => (v || 0).toLocaleString('pt-BR')

// Modo campanha (onUse presente): a planilha volta pro assistente pra montar a
// audiência e as variáveis; "salvar na base" (marcado por padrão) faz o
// mesmo upsert do módulo de Contatos antes de voltar. Desmarcado, a lista só
// vale pra campanha e nada é gravado em contatos.
export default function ContactImportDialog({ institutionId, source = 'contacts', onClose, onImported, onUse }: {
  institutionId: string
  source?: 'contacts' | 'broadcast'
  onClose: () => void
  onImported?: (result: ImportResult) => void
  onUse?: (sheet: Sheet, mapping: (ContactField | null)[], result: ImportResult | null) => void
}) {
  const campaign = !!onUse
  const [saveToBase, setSaveToBase] = useState(true)
  const usesBase = !campaign || saveToBase
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [mapping, setMapping] = useState<(ContactField | null)[]>([])
  const [modes, setModes] = useState<Record<UpdatableField, ColumnMode>>(DEFAULT_MODES)
  const [tagsMode, setTagsMode] = useState<TagsMode>('add')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [confirm, setConfirm] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState<'read' | 'preview' | 'confirm' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showInvalid, setShowInvalid] = useState(false)
  const req = useRef(0)

  const phoneCols = mapping.filter(f => f === 'phone').length
  const rows = useMemo(() => (sheet && phoneCols === 1 ? buildRows(sheet, mapping) : []), [sheet, mapping, phoneCols])
  const options = { columns: modes, tags: tagsMode, source, file_name: sheet?.fileName }

  // Prévia ao vivo quando a planilha ou as colunas mudam (o impacto de cada
  // modo vem pronto da função, então trocar a opção não precisa recalcular).
  useEffect(() => {
    if (!rows.length || !usesBase) { req.current++; setPreview(null); setBusy(b => (b === 'preview' ? null : b)); return }
    const id = ++req.current
    setBusy('preview'); setError(null)
    const t = setTimeout(async () => {
      try {
        const p = await contactsImport(institutionId, rows, { columns: DEFAULT_MODES, tags: 'add', source }, false)
        if (id === req.current) setPreview(p)
      } catch (e: any) { if (id === req.current) setError(e.message) }
      if (id === req.current) setBusy(null)
    }, 300)
    return () => clearTimeout(t)
  }, [rows, institutionId, source, usesBase])

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy('read'); setError(null); setPreview(null); setConfirm(null)
    try {
      const s = await readSpreadsheet(file)
      if (s.rows.length > 20000) throw new Error('Planilha acima de 20.000 linhas — divida em arquivos menores.')
      setSheet(s)
      setMapping(detectMapping(s.headers))
    } catch (e: any) {
      setError(e.message || 'Não foi possível ler o arquivo'); setSheet(null)
    }
    setBusy(null)
  }

  function setField(i: number, f: ContactField | null) {
    setMapping(m => m.map((x, j) => (j === i ? f : x === f && f ? null : x)))
    setConfirm(null)
  }

  async function review() {
    setBusy('confirm'); setError(null)
    try { setConfirm(await contactsImport(institutionId, rows, options, false)) }
    catch (e: any) { setError(e.message) }
    setBusy(null)
  }

  async function apply() {
    setBusy('apply'); setError(null)
    try {
      const r = await contactsImport(institutionId, rows, options, true)
      setResult(r); onImported?.(r)
    } catch (e: any) { setError(e.message) }
    setBusy(null)
  }

  const mappedFields = new Set(mapping.filter(Boolean) as ContactField[])
  const columnsShown = UPDATABLE_FIELDS.filter(f => mappedFields.has(f) && (preview?.columns[f]?.present || 0) > 0)
  const hasExisting = (preview?.existing_contacts || 0) > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget && busy !== 'apply') onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.navy }}>{campaign ? 'Importar lista da campanha' : 'Importar contatos'}</h2>
          <button onClick={onClose} disabled={busy === 'apply'} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.light }}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        {/* ── 4. Resultado ── */}
        {result ? (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <CheckCircle2 size={36} color="#059669" style={{ display: 'block', margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#065F46' }}>Importação concluída</p>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#065F46' }}>
              {n(result.created)} contato(s) criado(s) · {n(result.updated_contacts)} atualizado(s)
              {(result.tags_created || 0) > 0 && ` · ${n(result.tags_created)} etiqueta(s) nova(s)`}
            </p>
            {result.invalid > 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted }}>{n(result.invalid)} linha(s) com telefone inválido ficaram de fora.</p>}
            <button onClick={() => (campaign && sheet ? onUse!(sheet, mapping, result) : onClose())}
              style={{ marginTop: 16, padding: '9px 24px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {campaign ? 'Continuar na campanha' : 'Fechar'}
            </button>
          </div>

        /* ── 3. Confirmação ── */
        ) : confirm ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ border: `1.5px solid ${C.line}`, borderRadius: 12, padding: 18, display: 'grid', gap: 8, fontSize: 14, color: C.navy }}>
              <strong style={{ fontSize: 16 }}>Confirma a importação?</strong>
              <span>• Criar <strong>{n(confirm.new_contacts)}</strong> contato(s) novo(s)</span>
              <span>• Atualizar <strong>{n(confirm.contacts_to_update)}</strong> contato(s) que já existem
                {confirm.existing_contacts > confirm.contacts_to_update && <span style={{ color: C.muted }}> ({n(confirm.existing_contacts - confirm.contacts_to_update)} já estão iguais ou não serão mexidos)</span>}
              </span>
              {confirm.tags.new_in_catalog.length > 0 && <span>• Criar as etiquetas: {confirm.tags.new_in_catalog.join(', ')}</span>}
              {confirm.invalid > 0 && <span style={{ color: C.muted }}>• {n(confirm.invalid)} linha(s) com telefone inválido ficam de fora</span>}
              {confirm.duplicated_in_base > 0 && (
                <span style={{ fontSize: 12, color: '#92400E' }}>
                  {n(confirm.duplicated_in_base)} número(s) têm mais de um contato na base — todos serão atualizados. Dá pra juntar depois em Contatos → Duplicados.
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} disabled={busy === 'apply'} style={btn('ghost')}><ArrowLeft size={14} /> Voltar</button>
              <button onClick={apply} disabled={busy === 'apply'} style={btn('primary')}>
                {busy === 'apply' ? <><Loader2 size={14} className="animate-spin" /> Importando…</> : 'Confirmar importação'}
              </button>
            </div>
          </div>

        /* ── 1–2. Arquivo, colunas e prévia ── */
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 260px', cursor: 'pointer' }}>
                <div style={{ border: '2px dashed #CBD5E1', borderRadius: 10, padding: 18, textAlign: 'center', background: C.soft }}>
                  {busy === 'read' ? <Loader2 size={22} className="animate-spin" color={C.light} style={{ display: 'block', margin: '0 auto 6px' }} />
                    : <Upload size={22} color={C.light} style={{ display: 'block', margin: '0 auto 6px' }} />}
                  <p style={{ margin: 0, fontSize: 13, color: C.muted, fontWeight: 500 }}>{sheet ? `${sheet.fileName} · ${n(sheet.rows.length)} linha(s) — trocar arquivo` : 'Escolher planilha (CSV ou Excel)'}</p>
                </div>
                <input type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display: 'none' }}
                  onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              <button onClick={downloadContactsTemplate} style={{ ...btn('ghost'), border: `1.5px dashed ${C.line}`, alignSelf: 'stretch' }}>
                <FileText size={15} color="#3B82F6" /> Baixar modelo
              </button>
            </div>
            {campaign && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: C.navy, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={saveToBase} onChange={e => { setSaveToBase(e.target.checked); setConfirm(null) }} style={{ marginTop: 2 }} />
                <span>
                  <strong>Também salvar/atualizar esses contatos na base da escola</strong>
                  <span style={{ display: 'block', fontSize: 12, color: C.muted }}>Desmarcado, a lista vale só para esta campanha.</span>
                </span>
              </label>
            )}
            {usesBase && (
              <p style={{ margin: campaign ? 0 : '-8px 0 0', fontSize: 12, color: C.light }}>
                Se o telefone já existir na base (com ou sem o 9, com ou sem 55), o contato é atualizado; se não existir, é criado. Célula vazia nunca apaga o que já está no contato.
              </p>
            )}

            {sheet && (
              <div>
                <div style={sectionTitle}>Colunas da planilha</div>
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
                  {sheet.headers.map((h, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 180px', gap: 10, alignItems: 'center', padding: '7px 12px', borderTop: i ? `1px solid ${C.line}` : 'none', fontSize: 13 }}>
                      <strong style={{ color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</strong>
                      <span style={{ color: C.light, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sheet.rows.find(r => r[i])?.[i] || '—'}</span>
                      <select value={mapping[i] || ''} onChange={e => setField(i, (e.target.value || null) as ContactField | null)}
                        style={{ padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${mapping[i] ? C.teal : C.line}`, fontSize: 12, background: '#fff', color: C.navy }}>
                        <option value="">Ignorar</option>
                        {(Object.keys(FIELD_LABEL) as ContactField[]).map(f => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {phoneCols !== 1 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#DC2626' }}>Escolha qual coluna é o telefone.</p>}
                {phoneCols === 1 && mapping.some(f => !f) && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: C.light }}>
                    Colunas em "Ignorar" não são gravadas no contato{campaign ? ' — mas continuam disponíveis como variáveis da mensagem.' : '.'}
                  </p>
                )}
              </div>
            )}

            {/* Campanha sem salvar na base: só devolve a lista, sem prévia no banco. */}
            {campaign && !saveToBase && sheet && phoneCols === 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => onUse!(sheet, mapping, null)} style={btn('primary')}>Usar na campanha</button>
              </div>
            )}

            {usesBase && sheet && phoneCols === 1 && (busy === 'preview' && !preview
              ? <div style={{ height: 90, borderRadius: 10, background: C.soft }} className="animate-pulse" />
              : preview && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, opacity: busy === 'preview' ? 0.6 : 1 }}>
                    <Stat label="Novos" value={preview.new_contacts} color="#059669" />
                    <Stat label="Já existem" value={preview.existing_numbers} hint={preview.existing_contacts > preview.existing_numbers ? `${n(preview.existing_contacts)} contatos` : undefined} color="#2563EB" />
                    <Stat label="Inválidos" value={preview.invalid} color={preview.invalid ? '#DC2626' : C.light} />
                    <Stat label="Linhas repetidas" value={preview.merged_lines} hint={preview.merged_lines ? 'mesmo número — juntadas' : undefined} color={C.muted} />
                  </div>
                  {preview.invalid > 0 && (
                    <div style={{ fontSize: 12, color: C.muted }}>
                      <button onClick={() => setShowInvalid(s => !s)} style={{ background: 'none', border: 'none', padding: 0, color: '#DC2626', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
                        {showInvalid ? 'esconder' : 'ver'} linhas com telefone inválido
                      </button>
                      {showInvalid && <div style={{ marginTop: 6 }}>{preview.invalid_samples.map(s => `linha ${s.line + 1}: "${s.phone || 'vazio'}"`).join(' · ')}{preview.invalid > preview.invalid_samples.length && ' …'}</div>}
                    </div>
                  )}
                  {preview.merged_lines > 0 && (
                    <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Números repetidos na planilha viram um contato só: aluno e turma são juntados (ex.: "Ana / Pedro") e as etiquetas somadas.</p>
                  )}

                  {hasExisting && (columnsShown.length > 0 || mappedFields.has('tags')) && (
                    <div>
                      <div style={sectionTitle}>Nos {n(preview.existing_contacts)} contatos que já existem</div>
                      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
                        {columnsShown.map((f, i) => {
                          const c = preview.columns[f]
                          const choices: [ColumnMode, string][] = [
                            ['skip', 'Não atualizar'],
                            ['fill', `Só preencher vazios (${n(c.fill)})`],
                            ['overwrite', `Sobrescrever (${n(c.fill + c.overwrite)})`],
                          ]
                          return (
                            <ModeRow key={f} first={i === 0} label={FIELD_LABEL[f]} value={modes[f]} choices={choices}
                              hint={c.overwrite > 0 ? `${n(c.overwrite)} têm outro valor hoje` : undefined}
                              onChange={v => { setModes(m => ({ ...m, [f]: v as ColumnMode })); setConfirm(null) }} />
                          )
                        })}
                        {mappedFields.has('tags') && preview.tags.present > 0 && (
                          <ModeRow first={columnsShown.length === 0} label="Etiquetas" value={tagsMode}
                            choices={[['skip', 'Não mexer'], ['add', `Adicionar às atuais (${n(preview.tags.add)})`], ['replace', `Substituir (${n(preview.tags.replace)})`]]}
                            onChange={v => setTagsMode(v as TagsMode)} />
                        )}
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: C.light }}>Contatos novos recebem todas as colunas da planilha.</p>
                    </div>
                  )}
                  {preview.tags.new_in_catalog.length > 0 && (
                    <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Etiquetas novas que serão criadas: <strong>{preview.tags.new_in_catalog.join(', ')}</strong></p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={review} disabled={busy !== null || (preview.new_contacts === 0 && preview.existing_contacts === 0)} style={btn('primary')}>
                      {busy === 'confirm' ? <><Loader2 size={14} className="animate-spin" /> Calculando…</> : campaign ? 'Revisar e salvar na base' : 'Revisar e importar'}
                    </button>
                  </div>
                </>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }

function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  return kind === 'primary'
    ? { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.teal, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }
    : { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#fff', color: '#475569', border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}

function Stat({ label, value, hint, color }: { label: string; value: number; hint?: string; color: string }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{n(value)}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: C.light }}>{hint}</div>}
    </div>
  )
}

function ModeRow({ label, value, choices, onChange, hint, first }: {
  label: string; value: string; choices: [string, string][]; onChange: (v: string) => void; hint?: string; first?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, alignItems: 'center', padding: '10px 12px', borderTop: first ? 'none' : `1px solid ${C.line}` }}>
      <div>
        <strong style={{ fontSize: 13, color: C.navy }}>{label}</strong>
        {hint && <div style={{ fontSize: 11, color: C.light }}>{hint}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {choices.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: value === v ? `1.5px solid ${C.teal}` : `1.5px solid ${C.line}`, background: value === v ? '#F0FDFA' : '#fff', color: value === v ? '#047857' : '#475569' }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
