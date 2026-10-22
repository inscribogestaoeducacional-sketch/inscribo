// ETAPA 3B-2 — as telas novas de WhatsApp gravam as MESMAS colunas de antes,
// só as da própria seção, e cada coluna gravada continua sendo lida pelo robô
// / webhook / rotinas do banco. Lê o código-fonte; não toca no banco.
// Rodar: npx tsx --test tests/settings-columns.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/components/management/SystemSettings.tsx', 'utf8')
const readers = [
  'api/whatsapp/webhook.ts',
  'api/_lib/workingHours.ts',
  'supabase/functions/transfer-conversation/index.ts',
  'supabase/migrations/20261007100000_bot_timeout_ignora_conversa_com_dono.sql', // process_bot_timeouts atual
].map(f => readFileSync(f, 'utf8')).join('\n')

// corpo de handleSaveFlowPart: as chaves dos objetos gravados
const start = src.indexOf('const handleSaveFlowPart = async')
const end = src.indexOf("const { error } = await supabase.from('whatsapp_flows')", start)
const body = src.slice(start, end)
const parts = ['horario', 'robo_timeout', 'parada', 'equipe', 'pesquisa']
const written = [...new Set([...body.matchAll(/(?:^\s+|\{ )([a-z_]+):/gm)].map(m => m[1]))]

test('a tela não grava mais a linha inteira de whatsapp_flows', () => {
  assert.ok(start > 0 && end > start)
  assert.ok(!src.includes('const handleSaveFlow = async'), 'handleSaveFlow (linha inteira) voltou')
  for (const p of parts) assert.ok(body.includes(`'${p}'`), `parte ${p}`)
})

test('nenhum salvamento regrava colunas sem efeito', () => {
  for (const dead of ['welcome_message', 'menu_enabled', 'menu_message', 'menu_options', 'reactivation_enabled', 'bot_enabled'])
    assert.ok(!written.includes(dead), `${dead} não deveria ser gravado aqui`)
})

test('toda coluna gravada é lida pelo robô, webhook ou rotinas do banco', () => {
  assert.ok(written.includes('stale_conversation_hours') && written.includes('off_hours_message') && written.length >= 17, `poucas colunas achadas: ${written.join(', ')}`)
  for (const col of written) assert.ok(readers.includes(col), `${col} não é lida por ninguém`)
})
