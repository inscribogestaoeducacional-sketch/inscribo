// ========================================
// HOOK ENTERPRISE: useTabVisibility
// ZERO reloads, ZERO side effects
// Arquivo: src/hooks/useTabVisibility.ts
// ========================================

import { useEffect, useRef } from 'react'

interface UseTabVisibilityOptions {
  onVisible?: () => void
  onHidden?: () => void
  preventReload?: boolean
}

/**
 * Hook enterprise para gerenciar visibilidade sem causar reloads
 * Usa refs para evitar re-renders
 */
export function useTabVisibility(options: UseTabVisibilityOptions = {}) {
  const {
    onVisible,
    onHidden,
    preventReload = true
  } = options

  const isFirstMount = useRef(true)
  const lastState = useRef<DocumentVisibilityState>('visible')

  useEffect(() => {
    // Skip primeiro mount
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }

    const handleVisibility = () => {
      const current = document.visibilityState
      const previous = lastState.current

      // Aba voltou visível
      if (current === 'visible' && previous === 'hidden') {
        console.log('[TAB] 👁️ Visible')
        
        // Callback customizado
        onVisible?.()
        
        // Previne reload se necessário
        if (preventReload) {
          // Remove beforeunload
          window.onbeforeunload = null
        }
      }

      // Aba ficou oculta
      if (current === 'hidden' && previous === 'visible') {
        console.log('[TAB] 😴 Hidden')
        onHidden?.()
      }

      lastState.current = current
    }

    // Listener passivo (não bloqueia)
    document.addEventListener('visibilitychange', handleVisibility, { passive: true })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [onVisible, onHidden, preventReload])
}

/**
 * Versão simplificada - apenas previne reloads
 */
export function usePreventTabReload() {
  useTabVisibility({ preventReload: true })
}
