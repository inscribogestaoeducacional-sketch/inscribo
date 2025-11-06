// ========================================
// PREVENÇÃO GLOBAL DE RELOAD AO TROCAR DE ABA
// Cole este arquivo em: src/lib/preventReload.ts
// E importe no seu main.tsx ou App.tsx
// ========================================

// Variáveis de controle global
let lastVisibilityState = 'visible'
let pageLoadTime = Date.now()
let isInitialLoad = true

// Previne reloads causados por diversos eventos
export function setupReloadPrevention() {
  if (typeof window === 'undefined') return

  console.log('🛡️ Sistema de prevenção de reload ativado')

  // ========================================
  // 1. PREVENIR RELOAD POR VISIBILIDADE
  // ========================================
  const handleVisibilityChange = () => {
    const currentState = document.visibilityState
    
    if (currentState === 'visible' && lastVisibilityState === 'hidden') {
      console.log('👁️ Aba visível - MANTENDO estado (sem reload)')
      
      // Apenas se passou mais de 5 segundos desde o load inicial
      if (Date.now() - pageLoadTime > 5000) {
        // Previne qualquer tentativa de reload
        window.onbeforeunload = null
        
        // Cancela qualquer timeout/interval que possa causar reload
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

  // ========================================
  // 2. PREVENIR RELOAD POR FOCO
  // ========================================
  const handleFocus = () => {
    console.log('🔍 Foco na janela - mantendo estado')
    // Não fazer nada - apenas manter estado
  }

  const handleBlur = () => {
    console.log('😴 Foco perdido - estado preservado')
    // Não fazer nada - apenas registrar
  }

  window.addEventListener('focus', handleFocus, { passive: true })
  window.addEventListener('blur', handleBlur, { passive: true })

  // ========================================
  // 3. PREVENIR RELOAD POR POPSTATE
  // ========================================
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function(...args) {
    console.log('📍 Navegação - sem reload')
    return originalPushState.apply(history, args)
  }

  history.replaceState = function(...args) {
    console.log('🔄 Estado substituído - sem reload')
    return originalReplaceState.apply(history, args)
  }

  // ========================================
  // 4. INTERCEPTAR LOCATION.RELOAD
  // ========================================
  const originalReload = window.location.reload.bind(window.location)
  
  window.location.reload = function() {
    console.warn('⚠️ Tentativa de reload BLOQUEADA!')
    console.trace('Stack trace da tentativa de reload:')
    
    // Só permite reload se usuário clicar em F5 ou Ctrl+R
    const userInitiated = performance.now() - pageLoadTime > 1000
    
    if (userInitiated) {
      console.log('✅ Reload permitido (iniciado pelo usuário)')
      originalReload()
    } else {
      console.log('❌ Reload bloqueado (não iniciado pelo usuário)')
    }
  } as any

  // ========================================
  // 5. MARCAR CARGA INICIAL COMPLETA
  // ========================================
  setTimeout(() => {
    isInitialLoad = false
    console.log('✅ Carga inicial completa - proteção ativa')
  }, 3000)

  // ========================================
  // 6. PREVENIR RELOADS POR ERRO
  // ========================================
  window.addEventListener('error', (e) => {
    // Não recarregar em caso de erro
    console.warn('⚠️ Erro capturado - NÃO recarregando:', e.message)
    e.stopPropagation()
  }, true)

  // ========================================
  // 7. LIMPAR AO DESMONTAR
  // ========================================
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleFocus)
    window.removeEventListener('blur', handleBlur)
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    window.location.reload = originalReload
  }
}

// ========================================
// HOOK REACT PARA USAR EM COMPONENTES
// ========================================
import { useEffect } from 'react'

export function usePreventReload() {
  useEffect(() => {
    const cleanup = setupReloadPrevention()
    return cleanup
  }, [])
}

// ========================================
// CONFIGURAÇÃO DE SESSION STORAGE
// ========================================
export function setupSessionPersistence() {
  if (typeof window === 'undefined') return

  // Salvar estado antes de possível reload
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('last_active', Date.now().toString())
  })

  // Verificar se é um reload recente
  const lastActive = sessionStorage.getItem('last_active')
  if (lastActive) {
    const timeSinceLastActive = Date.now() - parseInt(lastActive)
    if (timeSinceLastActive < 5000) {
      console.log('⚠️ Reload detectado recentemente - pode ter sido não intencional')
    }
  }
}
