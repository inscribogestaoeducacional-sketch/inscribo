// ETAPA 3B — mapa das Configurações e links antigos (?tab=&sec=).
// Rodar: npx tsx --test tests/settings-map.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SETTINGS_MAP, SETTINGS_GROUPS, resolveSettingsRoute, visibleGroups, visibleGroupItems, searchSettings, isVisibleItem, groupForTab,
  type SettingsCtx,
} from '../src/lib/settingsMap.js'
import { SETTINGS_ITEMS, settingsHref, canSeeSettingsTab, visibleWhatsAppSections, type SettingsItemId } from '../src/lib/settingsAccess.js'

const admin: SettingsCtx = { role: 'admin', broadcast: true }
const gestor: SettingsCtx = { role: 'manager', broadcast: true }
const semModulo: SettingsCtx = { role: 'admin', broadcast: false }

function route(url: string, ctx: SettingsCtx) {
  const u = new URL(url, 'https://x')
  const m = u.pathname.match(/^\/settings\/([^/]+)$/)
  return resolveSettingsRoute({ grupo: m?.[1] ?? null, tab: u.searchParams.get('tab'), sec: u.searchParams.get('sec') }, ctx)
}

test('os 51 itens da auditoria estão no mapa', () => {
  const nums = new Set(SETTINGS_MAP.flatMap(it => it.n))
  for (let i = 1; i <= 51; i++) assert.ok(nums.has(i), `item #${i} fora do mapa`)
  assert.equal(SETTINGS_GROUPS.length, 5) // 3B-2: WhatsApp e robô juntos; sem Plano, IA e LGPD
})

test('links antigos usados no código e nos alertas continuam abrindo', () => {
  // alertas da central de notificações (migration 20261022100000) e Hub
  assert.deepEqual(route('/settings?tab=whatsapp', admin), { kind: 'redirect', to: '/settings/whatsapp' })
  assert.deepEqual(route('/settings?tab=whatsapp', gestor), { kind: 'redirect', to: '/settings/whatsapp' })
  // IntegrationsTab e BaseAlunos
  assert.deepEqual(route('/settings?tab=escola', admin), { kind: 'tab', tab: 'escola', sec: null })
  assert.deepEqual(route('/settings?tab=escola', gestor), { kind: 'tab', tab: 'escola', sec: null })
  assert.deepEqual(route('/settings?tab=integracoes', gestor), { kind: 'tab', tab: 'integracoes', sec: null })
  // GestorHome, menu, TopBar
  assert.deepEqual(route('/settings', admin), { kind: 'home' })
})

test('todo settingsHref() abre a mesma tela para quem tem acesso', () => {
  for (const id of Object.keys(SETTINGS_ITEMS) as SettingsItemId[]) {
    for (const ctx of [admin, gestor]) {
      const roles = SETTINGS_ITEMS[id].roles as readonly string[]
      const r = route(settingsHref(id), ctx)
      if (roles.includes(ctx.role as string)) {
        const it = SETTINGS_ITEMS[id] as { tab: string; section?: string }
        assert.deepEqual(r, { kind: 'tab', tab: it.tab, sec: it.section ?? null }, `${id} (${ctx.role})`)
      } else if (!canSeeSettingsTab(SETTINGS_ITEMS[id].tab, ctx.role) || ((SETTINGS_ITEMS[id] as { section?: string }).section && !visibleWhatsAppSections(ctx.role).includes((SETTINGS_ITEMS[id] as { section: string }).section))) {
        // aba ou seção do WhatsApp que o perfil não abre
        assert.equal(r.kind, 'redirect', `${id} não deveria abrir para ${ctx.role}`)
      } else {
        // aba/seção com blocos (Escola; Equipe → horário dos atendentes): abre como hoje, o bloco proibido fica escondido
        assert.equal(r.kind, 'tab', `${id} (${ctx.role})`)
      }
    }
  }
})

test('perfil sem acesso, aba inexistente e grupo inexistente voltam ao Início', () => {
  assert.deepEqual(route('/settings?tab=geral', gestor), { kind: 'redirect', to: '/settings' })
  assert.deepEqual(route('/settings?tab=pagamentos', gestor), { kind: 'redirect', to: '/settings' })
  assert.deepEqual(route('/settings?tab=whatsapp&sec=horario', gestor), { kind: 'redirect', to: '/settings/whatsapp' })
  assert.deepEqual(route('/settings?tab=nada', admin), { kind: 'redirect', to: '/settings' })
  assert.deepEqual(route('/settings/nada', admin), { kind: 'redirect', to: '/settings' })
  assert.deepEqual(route('/settings/plano', admin), { kind: 'redirect', to: '/settings' })
  assert.deepEqual(route('/settings?tab=pagamentos', admin), { kind: 'tab', tab: 'pagamentos', sec: null })
  assert.deepEqual(route('/settings/whatsapp', gestor), { kind: 'group', group: 'whatsapp' })
})

test('créditos de Transmissões esperam o módulo carregar e somem sem ele', () => {
  assert.deepEqual(route('/settings?tab=transmissoes', { role: 'admin', broadcast: null }), { kind: 'wait' })
  assert.deepEqual(route('/settings?tab=transmissoes', semModulo), { kind: 'redirect', to: '/settings' })
  assert.deepEqual(route('/settings?tab=transmissoes', admin), { kind: 'tab', tab: 'transmissoes', sec: null })
  assert.ok(!isVisibleItem(SETTINGS_MAP.find(i => i.id === 'bloq-campanhas')!, semModulo))
})

test('nenhuma opção visível leva a uma tela que o perfil não abre', () => {
  for (const ctx of [admin, gestor]) {
    for (const it of SETTINGS_MAP.filter(i => isVisibleItem(i, ctx) && i.href?.startsWith('/settings'))) {
      assert.equal(route(it.href!, ctx).kind, 'tab', `${it.id} (${ctx.role})`)
    }
  }
})

test('cada perfil só vê os cartões que já abre hoje', () => {
  const ids = (ctx: SettingsCtx) => visibleGroups(ctx).map(g => g.id)
  assert.deepEqual(ids(admin), ['whatsapp', 'escola', 'equipe', 'funil', 'bloqueios'])
  assert.deepEqual(ids(gestor), ['whatsapp', 'escola', 'equipe', 'funil', 'bloqueios'])
  assert.ok(!SETTINGS_MAP.some(i => i.status === 'nova' && isVisibleItem(i, admin))) // sem "em breve"
  assert.deepEqual(ids({ role: 'user', broadcast: true }), [])
  // gestor não vê Horário/Conexão/Usuários
  const g = visibleGroupItems('whatsapp', gestor).map(i => i.id)
  assert.ok(!g.includes('wa-horario') && !g.includes('wa-conexao') && g.includes('wa-respostas'))
  assert.ok(!visibleGroupItems('equipe', gestor).some(i => i.href === '/users'))
  // itens sem efeito não aparecem
  assert.ok(!SETTINGS_MAP.filter(i => i.status === 'remover').some(i => isVisibleItem(i, admin)))
})

test('busca acha pelo nome sem acento e respeita o perfil', () => {
  assert.equal(searchSettings('horario', admin)[0].id, 'wa-horario')
  assert.ok(searchSettings('series', gestor).some(i => i.id === 'escola-series'))
  assert.ok(searchSettings('bloqueio', gestor).some(i => i.id === 'bloq-numeros'))
  assert.deepEqual(searchSettings('pagamentos', gestor), [])
  assert.deepEqual(searchSettings('   ', admin), [])
})

test('tela antiga sabe para qual grupo voltar', () => {
  assert.equal(groupForTab('whatsapp', 'bloqueios'), 'bloqueios')
  assert.equal(groupForTab('whatsapp', 'respostas'), 'whatsapp')
  assert.equal(groupForTab('identidade', null), 'escola')
  assert.equal(groupForTab('pagamentos', null), null) // fora do menu, link antigo continua
})
