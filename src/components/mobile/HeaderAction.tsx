import React from 'react'

// Botão de ação dentro do banner verde (PageHeader). Principal = branco; os demais = vidro.
export default function HeaderAction({ label, icon: Icon, onClick, primary, active, dot, title }: {
  label: string; icon?: React.ElementType; onClick: () => void; primary?: boolean; active?: boolean; dot?: boolean; title?: string
}) {
  return (
    <button type="button" onClick={onClick} title={title || label} className="aion-tap"
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', minHeight: 36,
        border: primary ? 'none' : '1px solid rgba(255,255,255,.35)',
        background: primary ? '#fff' : active ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.14)',
        color: primary ? '#00695F' : '#fff',
      }}>
      {Icon && <Icon size={14} />}{label}
      {dot && <span aria-hidden style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: 99, background: '#FDE047' }} />}
    </button>
  )
}
