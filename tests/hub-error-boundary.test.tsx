// Proteção do Hub: erro ao desenhar vira aviso com botão de recarregar.
// Rodar: npx tsx --test tests/hub-error-boundary.test.tsx
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import HubErrorBoundary from '../src/components/whatsapp/HubErrorBoundary.js'

test('sem erro: mostra a tela normal', () => {
  const html = renderToStaticMarkup(<HubErrorBoundary><p>lista de conversas</p></HubErrorBoundary>)
  assert.equal(html, '<p>lista de conversas</p>')
})

test('com erro: aviso + botão Recarregar, e o erro vai para o console', () => {
  assert.deepEqual(HubErrorBoundary.getDerivedStateFromError(), { failed: true })
  const b = new HubErrorBoundary({ children: null })
  b.state = { failed: true }
  const html = renderToStaticMarkup(<>{b.render()}</>)
  assert.match(html, /Não foi possível mostrar esta conversa/)
  assert.match(html, /<button[^>]*>Recarregar<\/button>/)

  const logs: unknown[][] = []
  const orig = console.error
  console.error = (...a: unknown[]) => { logs.push(a) }
  try { b.componentDidCatch(new TypeError("Cannot read properties of undefined (reading '0')"), { componentStack: '\n at Hub' }) }
  finally { console.error = orig }
  assert.equal(logs.length, 1)
  assert.match(String(logs[0][0]), /HubErrorBoundary/)
  assert.ok(logs[0][1] instanceof TypeError)
})
