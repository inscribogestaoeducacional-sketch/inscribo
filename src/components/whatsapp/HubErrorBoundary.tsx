import React from 'react'

// Proteção em volta das telas do Hub (escola e Inbox Áion). Um dado inesperado
// numa única conversa (ex.: nome " " no STJ, 21/10) derrubava a página inteira
// e deixava a tela branca; agora aparece um aviso com botão para recarregar.
type Props = { children: React.ReactNode }
type State = { failed: boolean }

export default class HubErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[HubErrorBoundary] erro ao desenhar o Hub:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-base font-medium text-gray-800">Não foi possível mostrar esta conversa</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-[#00A896] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Recarregar
        </button>
      </div>
    )
  }
}
