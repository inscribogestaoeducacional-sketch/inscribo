// ========================================
// HOOK PROFISSIONAL: useTabVisibility
// Arquivo: src/hooks/useTabVisibility.ts
// ========================================

import { useEffect, useRef } from 'react'

interface UseTabVisibilityOptions {
  onVisible?: () => void
  onHidden?: () => void
  preventReload?: boolean
}

/**
 * Hook profissional para gerenciar visibilidade de aba
 * Previne reloads não intencionais ao trocar de aba
 * 
 * @param options - Configurações do hook
 * @returns void
 */
export function useTabVisibility(options: UseTabVisibilityOptions = {}) {
  const {
    onVisible,
    onHidden,
    preventReload = true
  } = options

  const isFirstMount = useRef(true)
  const lastVisibilityState = useRef<DocumentVisibilityState>('visible')

  useEffect(() => {
    // Pula o primeiro mount
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }

    const handleVisibilityChange = () => {
      const currentState = document.visibilityState
      const previousState = lastVisibilityState.current

      // Aba voltou a ficar visível
      if (currentState === 'visible' && previousState === 'hidden') {
        console.log('[TAB VISIBILITY] Aba visível novamente')
        
        // Executa callback customizado
        onVisible?.()
        
        // Previne reload se configurado
        if (preventReload) {
          // Cancela qualquer beforeunload pendente
          window.onbeforeunload = null
        }
      }

      // Aba ficou oculta
      if (currentState === 'hidden' && previousState === 'visible') {
        console.log('[TAB VISIBILITY] Aba oculta')
        onHidden?.()
      }

      lastVisibilityState.current = currentState
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onVisible, onHidden, preventReload])
}

/**
 * Hook simplificado que apenas previne reloads
 */
export function usePreventTabReload() {
  useTabVisibility({ preventReload: true })
}
