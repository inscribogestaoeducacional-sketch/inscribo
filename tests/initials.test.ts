// Iniciais e nome do contato aceitam qualquer valor sem quebrar a tela.
// Caso real: contato do STJ com nome de perfil " " (um espaço) deixava o Hub
// em branco (21/10/2026).
// Rodar: npx tsx --test tests/initials.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getInitials, cleanName } from '../src/lib/initials.js'

// Função antiga, idêntica à que estava no Hub — só para provar a causa.
function getInitialsAntiga(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

test('a função antiga quebra com nome " " (causa da tela branca)', () => {
  assert.throws(() => getInitialsAntiga(' '), TypeError)
})

test('nomes sem palavras viram "?"', () => {
  for (const n of [' ', '', null, undefined, '  ', '\t\n', '😀', '😀 🎉', '...', '- -', '‎']) {
    assert.equal(getInitials(n as string | null | undefined), '?', JSON.stringify(n))
  }
})

test('nomes normais', () => {
  assert.equal(getInitials('José Maria'), 'JM')
  assert.equal(getInitials('  josé   maria  da silva '), 'JS')
  assert.equal(getInitials('Ana'), 'AN')
  assert.equal(getInitials('A'), 'A')
  assert.equal(getInitials('😀 Ana'), 'AN')
  assert.equal(getInitials('Ana 😀'), 'AN')
  assert.equal(getInitials('Élida Ávila'), 'ÉÁ')
  assert.equal(getInitials('5583999990000'), '55')
})

test('cleanName: espaços somem; vazio cai no telefone', () => {
  const telefone = '(88) 99999-0000'
  assert.equal(cleanName(' ') || telefone, telefone)
  assert.equal(cleanName('') || telefone, telefone)
  assert.equal(cleanName(null) || telefone, telefone)
  assert.equal(cleanName(undefined) || telefone, telefone)
  assert.equal(cleanName('  ') || telefone, telefone)
  assert.equal(cleanName(' José Maria ') || telefone, 'José Maria')
  assert.equal(cleanName('😀') || telefone, '😀')
})

test('lista com o contato do STJ de nome " " desenha todos os avatares', () => {
  // mesmo caminho do Hub: nome = cleanName(contact_name) || telefone; avatar = getInitials(nome)
  const linhas = [
    { contact_name: ' ', tel: '(88) 99999-0000' },
    { contact_name: 'Maria Souza', tel: '(88) 99999-0001' },
    { contact_name: null, tel: '(88) 99999-0002' },
    { contact_name: '', tel: '(88) 99999-0003' },
  ]
  const avatares = linhas.map(l => { const nome = cleanName(l.contact_name) || l.tel; return { nome, ini: getInitials(nome) } })
  assert.deepEqual(avatares[0], { nome: '(88) 99999-0000', ini: '89' })
  assert.equal(avatares[1].ini, 'MS')
  assert.ok(avatares.every(a => a.ini.length > 0))
})
