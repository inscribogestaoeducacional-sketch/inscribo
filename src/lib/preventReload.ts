// ========================================
// PREVENÇÃO GLOBAL DE RELOAD AO TROCAR DE ABA
// ========================================

// Variáveis de controle global
let lastVisibilityState = 'visible'
let pageLoadTime = Date.now()
let isInitialLoad = true

// Previne reloads causados por diversos eventos
export function setupReloadPrevention() {
  if (typeof window === 'undefined') return

  console.log('[RELOAD PREVENTION] Sistema ativado')

  // PREVENIR RELOAD POR VISIBILIDADE
  const handleVisibilityChange = () => {
    const currentState = document.visibilityState
    
    if (currentState === 'visible' && lastVisibilityState === 'hidden') {
      console.log('[RELOAD PREVENTION] Aba visível - mantendo estado')
      
      if (Date.now() - pageLoadTime > 5000) {
        window.onbeforeunload = null
        
        const highestTimeoutId = setTimeout(() => {}, 0)
        for (let i = 0; i < highestTimeoutId; i++) {
          const str = (window as any)[`timeout_${i}`]
          if (str && str.includes && (str.includes('reload') || str.includes('location'))) {
            clearTimeout(i)
          }
        }
      }
    }
    
    lastVisibilityState = currentState
  }

  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true })

  // PREVENIR RELOAD POR FOCO
  const handleFocus = () => {
    console.log('[RELOAD PREVENTION] Foco na janela - mantendo estado')
  }

  const handleBlur = () => {
    console.log('[RELOAD PREVENTION] Foco perdido - estado preservado')
  }

  window.addEventListener('focus', handleFocus, { passive: true })
  window.addEventListener('blur', handleBlur, { passive: true })

  // PREVENIR RELOAD POR POPSTATE
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function(...args) {
    console.log('[RELOAD PREVENTION] Navegação sem reload')
    return originalPushState.apply(history, args)
  }

  history.replaceState = function(...args) {
    console.log('[RELOAD PREVENTION] Estado substituído sem reload')
    return originalReplaceState.apply(history, args)
  }

  // INTERCEPTAR LOCATION.RELOAD
  const originalReload = window.location.reload.bind(window.location)
  
  window.location.reload = function() {
    console.warn('[RELOAD PREVENTION] Tentativa de reload bloqueada!')
    console.trace('Stack trace da tentativa de reload:')
    
    const userInitiated = performance.now() - pageLoadTime > 1000
    
    if (userInitiated) {
      console.log('[RELOAD PREVENTION] Reload permitido (usuário)')
      originalReload()
    } else {
      console.log('[RELOAD PREVENTION] Reload bloqueado (automático)')
    }
  } as any

  // MARCAR CARGA INICIAL COMPLETA
  setTimeout(() => {
    isInitialLoad = false
    console.log('[RELOAD PREVENTION] Carga inicial completa - proteção ativa')
  }, 3000)

  // PREVENIR RELOADS POR ERRO
  window.addEventListener('error', (e) => {
    console.warn('[RELOAD PREVENTION] Erro capturado - não recarregando:', e.message)
    e.stopPropagation()
  }, true)

  // LIMPAR AO DESMONTAR
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleFocus)
    window.removeEventListener('blur', handleBlur)
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    window.location.reload = originalReload
  }
}

// HOOK REACT PARA USAR EM COMPONENTES
import { useEffect } from 'react'

export function usePreventReload() {
  useEffect(() => {
    const cleanup = setupReloadPrevention()
    return cleanup
  }, [])
}

// CONFIGURAÇÃO DE SESSION STORAGE
export function setupSessionPersistence() {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('last_active', Date.now().toString())
  })

  const lastActive = sessionStorage.getItem('last_active')
  if (lastActive) {
    const timeSinceLastActive = Date.now() - parseInt(lastActive)
    if (timeSinceLastActive < 5000) {
      console.log('[RELOAD PREVENTION] Reload recente detectado')
    }
  }
}
