// src/lib/erpGuides.ts
//
// Guia "Como gerar o token" por sistema da escola (ERP). Cada ERP traz o seu
// passo a passo, as permissões que a escola marca e as que nunca marca, e qual
// permissão libera cada rota (para a tela do teste dizer o que marcar num 403).
// Próximo ERP = um objeto novo aqui; o componente ErpTokenGuide é o mesmo.

export type ErpPermission = { key: string; label: string }
export type ErpGuide = {
  id: string
  name: string
  /** caminho no menu até a página de tokens; null = ainda não informado */
  menuPath: string | null
  partnerName: string
  steps: string[]                                   // linguagem simples, numerados na tela
  required: ErpPermission[]                         // marcar APENAS estas
  never: string[]                                   // lista curta do que nunca marcar
  notes: string[]                                   // avisos (ex.: "Próximo período")
  /** rota do teste → permissão que a libera (+ observação opcional) */
  routePermission: Record<string, { permission: string; note?: string }>
}

const AION = 'Áion Soluções Tecnológicas'

export const ERP_GUIDES: Record<string, ErpGuide> = {
  activesoft: {
    id: 'activesoft',
    name: 'Activesoft',
    menuPath: 'Administrativo › Configurações › Controle de acesso › Acesso via API',
    partnerName: AION,
    steps: [
      'Entre no Activesoft com um usuário administrador e abra a página "Acesso via API"{menu}.',
      `Em "Parceiro", escolha "${AION}". Se não aparecer na lista, cadastre com esse nome.`,
      'Nas permissões, marque APENAS as 3 caixas da lista "Marque" abaixo.',
      'Não marque nenhuma outra caixa (veja a lista "Nunca marque").',
      'Em "Este token estará ativo até", escolha 1 ano a partir de hoje.',
      'Marque a concordância com o termo e clique para gerar o token.',
      'Copie o token gerado e cole no campo logo abaixo deste guia. Não envie o token por e-mail, WhatsApp ou chat.',
    ],
    required: [
      { key: 'cadastrais',    label: 'Acesso a dados cadastrais' },
      { key: 'enturmacao',    label: 'Acesso a dados do detalhe da enturmação' },
      { key: 'complementares', label: 'Acesso a dados complementares de alunos e responsáveis' },
    ],
    never: ['Alteração de dados', 'Frequência', 'Boletins', 'Notas', 'Ocorrências', 'Boleto', 'Usuários', 'Diários'],
    notes: [
      'A escola precisa ter preenchido o "Próximo período" no Activesoft. Sem ele, o sistema não sabe quem já está matriculado para o ano seguinte.',
    ],
    routePermission: {
      unidades:     { permission: 'cadastrais', note: 'Se essa caixa já estava marcada, a carga segue sem esta rota: as unidades vêm das turmas.' },
      cursos:       { permission: 'cadastrais' },
      turmas:       { permission: 'cadastrais' },
      alunos:       { permission: 'cadastrais' },
      enturmacao:   { permission: 'enturmacao' },
      responsaveis: { permission: 'complementares' },
      vinculos:     { permission: 'complementares' },
    },
  },
}

export function guideStepText(guide: ErpGuide, step: string): string {
  return step.replace('{menu}', guide.menuPath ? `, no menu ${guide.menuPath}` : '')
}

// Texto para um 403: "marque 'X' e gere um novo token"
export function permissionHint(guide: ErpGuide, route: string): string | null {
  const rp = guide.routePermission[route]
  if (!rp) return null
  const p = guide.required.find(x => x.key === rp.permission)
  if (!p) return null
  return `Marque "${p.label}" no ${guide.name} e gere um novo token.${rp.note ? ' ' + rp.note : ''}`
}
