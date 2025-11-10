// ========================================
// useTabVisibility - ZERO SIDE EFFECTS
// Apenas monitora, não causa reloads
// Arquivo: src/hooks/useTabVisibility.ts
// ========================================

import { useEffect, useRef } from 'react'

interface UseTabVisibilityOptions {
  onVisible?: () => void
  onHidden?: () => void
  preventReload?: boolean
}

export function useTabVisibility(options: UseTabVisibilityOptions = {}) {
  const {
    onVisible,
    onHidden,
    preventReload = true
  } = options

  const isFirstMount = useRef(true)
  const lastState = useRef<DocumentVisibilityState>('visible')

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }

    const handleVisibility = () => {
      const current = document.visibilityState
      const previous = lastState.current

      // Aba visível
      if (current === 'visible' && previous === 'hidden') {
        console.log('[TAB] 👁️ Visible')
        
        // Callback SE fornecido
        if (onVisible) {
          onVisible()
        }
        
        // Previne reload SE necessário
        if (preventReload) {
          window.onbeforeunload = null
        }
      }

      // Aba oculta
      if (current === 'hidden' && previous === 'visible') {
        console.log('[TAB] 😴 Hidden')
        
        // Callback SE fornecido
        if (onHidden) {
          onHidden()
        }
      }

      lastState.current = current
    }

    // Listener PASSIVO (não bloqueia)
    document.addEventListener('visibilitychange', handleVisibility, { passive: true })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [onVisible, onHidden, preventReload])
}

/**
 * Versão simplificada - APENAS previne reloads
 * NÃO executa callbacks, NÃO causa side effects
 */
export function usePreventTabReload() {
  useTabVisibility({ 
    preventReload: true
    // SEM callbacks!
  })
}
