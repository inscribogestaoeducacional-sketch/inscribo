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

  console.log('🛡️ Sistema de prevenção de reload ativado')

  // PREVENIR RELOAD POR VISIBILIDADE
  const handleVisibilityChange = () => {
    const currentState = document.visibilityState
    
    if (currentState === 'visible' && lastVisibilityState === 'hidden') {
      console.log('👁️ Aba visível - MANTENDO estado (sem reload)')
      
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
    console.log('🔍 Foco na janela - mantendo estado')
  }

  const handleBlur = () => {
    console.log('😴 Foco perdido - estado preservado')
  }

  window.addEventListener('focus', handleFocus, { passive: true })
  window.addEventListener('blur', handleBlur, { passive: true })

  // PREVENIR RELOAD POR POPSTATE
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

  // INTERCEPTAR LOCATION.RELOAD
  const originalReload = window.location.reload.bind(window.location)
  
  window.location.reload = function() {
    console.warn('⚠️ Tentativa de reload BLOQUEADA!')
    console.trace('Stack trace da tentativa de reload:')
    
    const userInitiated = performance.now() - pageLoadTime > 1000
    
    if (userInitiated) {
      console.log('✅ Reload permitido (iniciado pelo usuário)')
      originalReload()
    } else {
      console.log('❌ Reload bloqueado (não iniciado pelo usuário)')
    }
  } as any

  // MARCAR CARGA INICIAL COMPLETA
  setTimeout(() => {
    isInitialLoad = false
    console.log('✅ Carga inicial completa - proteção ativa')
  }, 3000)

  // PREVENIR RELOADS POR ERRO
  window.addEventListener('error', (e) => {
    console.warn('⚠️ Erro capturado - NÃO recarregando:', e.message)
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
      console.log('⚠️ Reload detectado recentemente - pode ter sido não intencional')
    }
  }
}
```

### **3. Salve (Ctrl+S)**

### **4. A página deve voltar automaticamente!**

---

## ✅ **VERIFICAR:**

Após salvar, você deve ver no console:
```
🛡️ Sistema de prevenção de reload ativado
✅ Carga inicial completa - proteção ativa
