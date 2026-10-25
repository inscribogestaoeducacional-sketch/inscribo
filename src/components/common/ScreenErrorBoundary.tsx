import React from 'react'
import { useLocation } from 'react-router-dom'

// Se uma tela falhar ao desenhar, só ela mostra o aviso — menu, barra de cima e
// barra de baixo continuam funcionando. Trocar de página limpa o erro.
class Inner extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ScreenErrorBoundary] erro ao desenhar a tela:', error, info.componentStack)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Não foi possível abrir esta tela</p>
        <p style={{ margin: 0, fontSize: 13, color: '#5B6B86', maxWidth: 320 }}>Seus dados estão seguros. Tente recarregar; se continuar, avise a Áion.</p>
        <button type="button" onClick={() => window.location.reload()}
          style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: '#05907B', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Recarregar
        </button>
      </div>
    )
  }
}

export default function ScreenErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return <Inner key={pathname}>{children}</Inner>
}
