// Envio de mídia do editor da Vitrine: clique OU arraste o arquivo pra área.
// Mostra a prévia (com o corte na proporção pedida), estado de envio e as
// ações Trocar/Remover. Hoje só imagem (reduzida antes de subir — ver
// uploadVitrineImage); PDF e vídeo entram na etapa 6 pelo mesmo componente.
// Não apaga o arquivo antigo: quem usa decide (o editor apaga depois do save).
import React, { useRef, useState } from 'react'
import { ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { IMAGE_ACCEPT, uploadVitrineImage } from '../../lib/vitrine'

export interface MediaUploaderProps {
  institutionId: string
  value: string | null
  onChange: (url: string | null) => void
  onError: (msg: string) => void
  label: string                 // nome acessível ("Logo", "Imagem do banner"...)
  maxWidth?: number             // largura máxima depois da redução
  aspect?: number               // proporção da área (ex.: 3 = 3:1); sem = altura fixa
  height?: number               // altura quando não há aspect
  shape?: 'rect' | 'circle'
  recommended?: string          // "1200 × 400 px" — aparece na área vazia
  fit?: 'cover' | 'contain'     // cover = mostra o corte; contain = imagem inteira (logo)
  onNaturalRatio?: (ratio: number) => void
}

const T = 'all 0.18s cubic-bezier(0.4,0,0.2,1)'   // --transition do app

export default function MediaUploader({
  institutionId, value, onChange, onError, label, maxWidth, aspect, height = 96,
  shape = 'rect', recommended, fit = 'cover', onNaturalRatio,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  async function send(file: File | undefined | null) {
    if (!file || busy) return
    setBusy(true)
    try { onChange(await uploadVitrineImage(institutionId, file, maxWidth)) }
    catch (e: any) { onError(e?.message || 'Não foi possível enviar a imagem.') }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const circle = shape === 'circle'
  const box: React.CSSProperties = circle
    ? { width: height, height, borderRadius: '50%', flex: 'none' }
    : aspect ? { width: '100%', aspectRatio: String(aspect), borderRadius: 14 } : { width: '100%', height, borderRadius: 14 }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div
        onDragOver={e => { e.preventDefault(); if (!over) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]) }}
        style={{ ...box, position: 'relative', overflow: 'hidden', transition: T,
          border: over ? '2px dashed #00A896' : value ? '1px solid #E2E8F0' : '1.5px dashed #CBD5E1',
          background: over ? '#F0FDFA' : value ? '#F8FAFC' : '#FAFAFA',
          boxShadow: over ? '0 0 0 4px #CCFBF1' : 'none' }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          aria-label={value ? `Trocar: ${label}` : `Enviar: ${label}`}
          className="vit-upload"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', background: 'transparent',
            cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
            color: '#64748b', fontSize: 12, fontWeight: 600 }}>
          {value
            ? <img src={value} alt="" draggable={false}
                onLoad={e => onNaturalRatio?.(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
                style={{ width: '100%', height: '100%', objectFit: fit, display: 'block', padding: fit === 'contain' && !circle ? 8 : 0 }} />
            : circle
              ? <ImagePlus size={18} />
              : <>
                  {over ? <UploadCloud size={22} color="#00A896" /> : <ImagePlus size={20} />}
                  <span>{over ? 'Solte pra enviar' : 'Clique ou arraste uma imagem'}</span>
                  {recommended && !over && <span style={{ fontWeight: 500, color: '#94a3b8' }}>Recomendado: {recommended}</span>}
                </>}
        </button>
        {busy && (
          <div aria-live="polite" style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0F766E' }}>
            <Loader2 size={16} className="animate-spin" /> {circle ? '' : 'Enviando…'}
          </div>
        )}
      </div>
      {value && !busy && (
        <div style={{ display: 'flex', gap: 6, flexDirection: circle ? 'column' : 'row' }}>
          <button type="button" onClick={() => inputRef.current?.click()} title="Trocar imagem"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', color: '#475569', fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={12} /> Trocar
          </button>
          <button type="button" onClick={() => onChange(null)} title="Remover imagem" aria-label={`Remover: ${label}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', cursor: 'pointer', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
            <Trash2 size={12} /> Remover
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={e => send(e.target.files?.[0])} />
    </div>
  )
}
