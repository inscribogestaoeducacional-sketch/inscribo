import type { Lesson } from '../academy'
import { go, info, click, fill, done } from './helpers'

export const LESSONS_D: Lesson[] = [
  // ───────── CAMPANHA DE MATRÍCULAS ─────────
  {
    key: 'cm_visao', module: 'campanha', title: 'Entender a Campanha de Matrículas', minutes: 4, managerOnly: true, to: '/campanha', routes: ['/campanha'],
    summary: 'Ler a meta, o andamento e o que falta, em cada aba da campanha.',
    steps: [
      'Abra Campanha de Matrículas. Em "Visão geral" você vê a meta do ano, o quanto já foi feito, o "Esperado hoje" e a "Projeção final".',
      'Em "Funil", veja quantos leads, visitas e matrículas existem na campanha.',
      'Em "Novatos", acompanhe os alunos novos mês a mês. Em "Rematrícula", os veteranos que voltaram e os que faltam.',
      'Em "Investimento", veja quanto foi gasto em divulgação e o custo por lead, por visita e por aluno novo.',
      'Em "Séries e turmas", veja onde faltam vagas ou sobram. Em "Matriculômetro", a rematrícula por série e turma.',
      'Em "Saídas", entenda quem saiu e por quê. Em "Relatório", leia a análise da IA.',
      'No celular, deslize pelas abas no alto da tela.',
    ],
    tip: 'Se "Esperado hoje" está acima do que foi feito, a escola está atrasada: olhe o Funil e as Visitas para ver onde está o gargalo.',
    tour: [
      go('/campanha', 'Esta é a Campanha de Matrículas do ano.', undefined, 'Se a Áion ainda não liberou a campanha, a tela avisa que não há campanha.'),
      info('Estas abas organizam a campanha: Visão geral, Funil, Novatos, Rematrícula, Investimento e mais.', { button: 'Funil' }),
      click('Toque em "Funil" para ver leads, visitas e matrículas.', { button: 'Funil' }),
      click('Agora toque em "Investimento".', { button: 'Investimento' }),
      click('Volte para a "Visão geral".', { button: 'Visão geral' }),
      done('Você já conhece as abas da campanha.'),
    ],
  },
  {
    key: 'cm_vincular', module: 'campanha', title: 'Vincular leads à campanha', minutes: 3, managerOnly: true, to: '/campanha', routes: ['/campanha'],
    summary: 'Incluir na campanha os leads antigos que ainda não pertencem a nenhuma.',
    steps: [
      'Abra Campanha de Matrículas e toque em "Vincular leads" no banner.',
      'Escolha a "Data inicial" e a "Data final" e, se quiser, o "Ano de interesse".',
      'Toque em "Buscar leads no período".',
      'Marque os leads que fazem parte desta campanha e toque em "Confirmar vínculo".',
    ],
    tip: 'Vincule os leads logo no começo da campanha para o funil refletir tudo o que a escola já trabalhou.',
    tour: [
      go('/campanha', 'Vincular leads fica no banner da campanha.', undefined, 'Se a Áion ainda não liberou a campanha, a tela avisa que não há campanha.'),
      click('Toque em "Vincular leads".', { button: 'Vincular leads' }, 'Este botão só aparece quando há uma campanha.', true),
      info('Escolha as datas e toque em "Buscar leads no período". Marque os leads e confirme.', { text: 'Buscar leads no período', in: 'modal' }),
      done('Nesta aula eu não vinculo nenhum lead.'),
    ],
  },
  {
    key: 'cm_invest', module: 'campanha', title: 'Lançar o investimento da campanha', minutes: 3, managerOnly: true, to: '/campanha', routes: ['/campanha'],
    summary: 'Registrar o que a escola investiu em divulgação para saber quanto custa cada aluno novo.',
    steps: [
      'Abra Campanha de Matrículas e toque na aba "Investimento".',
      'Em "Lançar investimento", escolha a "Categoria" e, se quiser, escreva "O que foi (opcional)".',
      'Digite o "Valor (R$)" e escolha o "Mês".',
      'Se foi tráfego pago, escolha o "Canal de origem (opcional)" para ligar o custo aos leads daquele canal.',
      'Toque em "Salvar investimento".',
      'Veja o custo por lead, por visita e o CPA (custo por aluno novo) na parte de cima.',
    ],
    tip: 'Lance o investimento todo mês. Sem isso, o CPA não existe.',
    tour: [
      go('/campanha', 'O investimento fica em uma aba da campanha.', undefined, 'Se a Áion ainda não liberou a campanha, a tela avisa que não há campanha.'),
      click('Toque em "Investimento".', { button: 'Investimento' }, 'As abas só aparecem quando há uma campanha.', true),
      info('Aqui você vê o investimento total, o custo por lead, por visita e por aluno novo.', { text: 'INVESTIMENTO TOTAL' }, 'Os números aparecem quando a campanha tem dados.'),
      info('Em "Lançar investimento" você registra cada gasto de divulgação.', { text: 'Lançar investimento' }),
      fill('Digite o valor em reais.', { label: 'Valor (R$)' }),
      info('Para registrar, você toca em "Salvar investimento". Nesta aula eu não registro nada.', { button: 'Salvar investimento' }),
      done('Agora você sabe lançar investimentos.'),
    ],
  },
  {
    key: 'cm_matriculometro', module: 'campanha', title: 'Acompanhar o Matriculômetro', minutes: 3, managerOnly: true, to: '/campanha', routes: ['/campanha'],
    summary: 'Ver a rematrícula por segmento, série e turma, e achar as turmas em perigo.',
    steps: [
      'Abra Campanha de Matrículas e toque na aba "Matriculômetro".',
      'Escolha o segmento (por exemplo "Educação Infantil" ou "Ensino Médio") para ver as barras de matriculados, pré-matriculados e quem falta.',
      'Em "Turmas correndo perigo", veja as turmas com mais risco de ficar abaixo do esperado.',
      'Toque numa série ou turma para ver os alunos que faltam rematricular.',
    ],
    tour: [
      go('/campanha', 'O Matriculômetro mostra a rematrícula por série e turma.', undefined, 'Se a Áion ainda não liberou a campanha, a tela avisa que não há campanha.'),
      click('Toque em "Matriculômetro".', { button: 'Matriculômetro' }, 'As abas só aparecem quando há uma campanha.', true),
      info('Aqui estão as barras de matriculados, pré-matriculados e quem ainda falta.', { text: 'Matriculômetro' }),
      done('Acompanhe as turmas em perigo toda semana.'),
    ],
  },
  {
    key: 'cm_config', module: 'campanha', title: 'Ajustar metas e datas da campanha', minutes: 4, managerOnly: true, to: '/campanha', routes: ['/campanha'],
    summary: 'Conferir as datas, as metas e o mês a mês e ativar a campanha.',
    steps: [
      'Abra Campanha de Matrículas e toque em "Configuração da campanha".',
      'Passo "Datas da campanha": confira o início e o fim.',
      'Passo "Plano inicial da campanha (IA)": a IA lê o histórico e sugere um plano.',
      'Passo "Metas da campanha": ajuste o total de alunos, de rematrículas e de novos.',
      'Passos "Mês a mês" e "Funil": ajuste a meta de cada mês e as taxas de conversão.',
      'Passo final: revise e ative a campanha (ou salve, se ela já está ativa).',
    ],
    tip: 'A Áion já deixa a campanha preenchida com o histórico da escola. Confira e ajuste, não precisa começar do zero.',
    tour: [
      go('/campanha', 'A configuração fica no banner da campanha.', undefined, 'Se a Áion ainda não liberou a campanha, a tela avisa que não há campanha.'),
      click('Toque em "Configuração da campanha".', { button: 'Configuração da campanha' }, 'Este botão só aparece quando há uma campanha.', true),
      info('O passo a passo começa nas datas da campanha.', { text: 'Datas da campanha' }),
      info('Em "Metas da campanha" você ajusta quantos alunos a escola quer matricular.', { text: 'Metas da campanha' }),
      done('Nesta aula eu não mudo nenhuma meta.'),
    ],
  },

  // ───────── BASE DE ALUNOS ─────────
  {
    key: 'ba_visao', module: 'base_alunos', title: 'Ver quem já rematriculou', minutes: 3, to: '/base-alunos', routes: ['/base-alunos'],
    summary: 'Entender, na Visão geral, quantos alunos voltaram, quantos faltam e quantos saíram.',
    steps: [
      'Abra Base de alunos. O banner mostra o ano da rematrícula e de onde vêm os dados.',
      'Na aba "Visão geral", veja os totais de Matriculados, Pré-matriculados, quem ainda falta rematricular e quem saiu.',
      'Escolha o período: "Todo o período", "Este mês", "Mês passado" ou "Escolher datas".',
      'Toque em "Ver quem falta" para ir direto à lista dos alunos que ainda não rematricularam.',
      'Use a chave "Pré-matrícula conta como matriculado?" para decidir como contar quem reservou a vaga.',
    ],
    tip: 'Quem só reservou a vaga (pré-matrícula) ainda precisa efetivar. Acompanhe essa lista de perto.',
    tour: [
      go('/base-alunos', 'A Base de alunos mostra a rematrícula do ano.', undefined, 'Se você não vê Base de alunos no menu, o módulo ainda não foi liberado para a sua escola.'),
      info('Estas abas mostram a Visão geral, a lista de Alunos, os números Por série e a Conferência.', { button: 'Alunos' }),
      info('Aqui estão os totais do período: matriculados, pré-matriculados e quem ainda falta.', { text: 'Matriculados' }, 'Os totais aparecem quando a escola já enviou os dados dos alunos.'),
      info('Toque em "Ver quem falta" para abrir a lista dos alunos que ainda não rematricularam.', { button: 'Ver quem falta' }, 'Este botão aparece quando existem alunos que faltam rematricular.'),
      done('Você já sabe ler a rematrícula.'),
    ],
  },
  {
    key: 'ba_alunos', module: 'base_alunos', title: 'Achar um aluno e abrir a ficha', minutes: 3, to: '/base-alunos', routes: ['/base-alunos'],
    summary: 'Buscar o aluno, filtrar por situação e série e chamar a família no WhatsApp.',
    steps: [
      'Abra Base de alunos e toque na aba "Alunos".',
      'No banner, toque em "Buscar aluno" (ou escreva em "Buscar por nome, responsável ou matrícula").',
      'Filtre por situação: Matriculados, Pré-matriculados, Ainda faltam, Saíram, Concluintes ou Todos. Filtre também por "Série".',
      'Toque no aluno para abrir a ficha com matrícula, origem, responsável e telefone.',
      'Toque no ícone do WhatsApp para chamar a família.',
      'Quem tem permissão pode marcar na ficha a "Rematrícula marcada pela escola", quando a família confirmou fora do sistema.',
    ],
    tip: 'Filtre "Ainda faltam" e chame as famílias uma a uma. É a lista mais valiosa da escola em época de rematrícula.',
    tour: [
      go('/base-alunos', 'Aqui você acha um aluno e abre a ficha.', undefined, 'Se você não vê Base de alunos no menu, o módulo ainda não foi liberado para a sua escola.'),
      click('Toque na aba "Alunos".', { button: 'Alunos' }),
      fill('Escreva o nome do aluno, do responsável ou a matrícula.', { css: 'input[placeholder="Buscar por nome, responsável ou matrícula"]' }, 'A busca aparece quando a escola já enviou os dados dos alunos.'),
      info('Estes botões filtram por situação: Matriculados, Pré-matriculados, Ainda faltam, Saíram e mais.', { button: 'Ainda faltam' }, 'Os filtros aparecem quando há alunos na lista.'),
      done('Agora ficou fácil achar qualquer aluno.'),
    ],
  },
  {
    key: 'ba_serie', module: 'base_alunos', title: 'Acompanhar por série e vagas', minutes: 3, to: '/base-alunos', routes: ['/base-alunos'],
    summary: 'Ver, série por série, as vagas livres e quem ainda falta.',
    steps: [
      'Abra Base de alunos e toque na aba "Por série".',
      'Cada série mostra as "Vagas" e as vagas "Livres", os "Pré-matric." e quem "Ainda faltam".',
      'Toque em "Ver alunos" para abrir a lista daquela série.',
      'Quem tem permissão ajusta a capacidade (vagas) de cada série ali mesmo.',
    ],
    tour: [
      go('/base-alunos', 'Por série mostra as vagas e a rematrícula de cada turma.', undefined, 'Se você não vê Base de alunos no menu, o módulo ainda não foi liberado para a sua escola.'),
      click('Toque na aba "Por série".', { button: 'Por série' }),
      info('Cada cartão é uma série, com vagas livres e quem ainda falta.', { text: 'Vagas' }, 'Os cartões aparecem quando a escola já enviou os dados dos alunos.'),
      done('Veja as vagas antes de abrir campanhas de captação.'),
    ],
  },
  {
    key: 'ba_conferencia', module: 'base_alunos', title: 'Conferir os números com a secretaria', minutes: 3, to: '/base-alunos', routes: ['/base-alunos'], managerOnly: true,
    summary: 'Comparar o que o sistema da escola mostra com o que a secretaria conta.',
    steps: [
      'Abra Base de alunos e toque na aba "Conferência".',
      'Veja, por série, "Cursando no sistema" e "Secretaria diz" lado a lado, com a "Diferença".',
      'Se a secretaria contar diferente, digite o número dela no campo da série. Quem tem permissão salva.',
      'Compare também "Saíram no ano" e "Saíram no ano passado".',
    ],
    tour: [
      go('/base-alunos', 'A Conferência compara o sistema com a contagem da secretaria.', undefined, 'Se você não vê Base de alunos no menu, o módulo ainda não foi liberado para a sua escola.'),
      click('Toque na aba "Conferência".', { button: 'Conferência' }),
      info('"Cursando no sistema" é o que o sistema da escola mostra. "Secretaria diz" é a contagem manual.', { text: 'Cursando no sistema' }, 'A conferência aparece quando a escola já enviou os dados dos alunos.'),
      done('Quando os números batem, você pode confiar nos relatórios.'),
    ],
  },

  // ───────── TRANSFERÊNCIAS ─────────
  {
    key: 'tf_registrar', module: 'transferencias', title: 'Registrar uma transferência', minutes: 3, to: '/transferencias', routes: ['/transferencias'],
    summary: 'Anotar a saída de um aluno e enviar a pesquisa para descobrir o motivo real.',
    steps: [
      'Abra Transferências e toque em "Nova transferência" (só administradores veem este botão).',
      'Escolha se o aluno é "Novo" registro ou um aluno que já existe, e busque pelo nome em "Buscar aluno ou responsável".',
      'Escolha a "Série" e, se quiser, escreva o "Motivo informado pela família" e as "Observações internas".',
      'Informe o "WhatsApp da família" se quiser enviar a "pesquisa de saída".',
      'Toque em "Registrar".',
      'No cartão do aluno, toque em "Gerar link", "Copiar link" ou "Enviar WhatsApp" para mandar a pesquisa. Quando a família responde, "Ver diagnóstico" mostra o motivo real, com análise da IA.',
    ],
    tip: 'O motivo que a família diz na secretaria nem sempre é o motivo real. A pesquisa de saída ajuda a descobrir.',
    tour: [
      go('/transferencias', 'Aqui ficam as saídas e transferências da escola.'),
      click('Toque em "Nova transferência" para registrar uma.', { button: 'Nova transferência' }, 'Só administradores veem este botão.', true),
      fill('Escreva o nome do aluno.', { label: 'Nome do aluno', in: 'modal' }),
      info('Escolha a série do aluno.', { label: 'Série', in: 'modal' }),
      info('Para salvar, você toca em "Registrar". Nesta aula eu não registro nada.', { button: 'Registrar', in: 'modal' }),
      done('Agora você sabe registrar uma transferência.'),
    ],
  },
  {
    key: 'tf_relatorio', module: 'transferencias', title: 'Entender os motivos das saídas', minutes: 3, to: '/transferencias', routes: ['/transferencias'],
    summary: 'Ver o relatório de saídas e o diagnóstico de cada aluno.',
    steps: [
      'Abra Transferências. Os cartões mostram o Total, o que foi registrado Este mês, as que estão aguardando pesquisa e as Com diagnóstico IA.',
      'Toque em "Ver diagnóstico" no cartão de um aluno para ler o motivo principal, os fatores de risco e a oportunidade de retenção.',
      'Toque na aba "Relatório" para ver as saídas por ano, onde mais se perde aluno e os motivos registrados.',
      'No relatório, a IA monta um relatório estratégico que você pode baixar em PDF.',
      'Na aba "Excluídos" ficam as transferências apagadas, que podem ser restauradas.',
    ],
    tour: [
      go('/transferencias', 'Aqui você entende por que os alunos saem.'),
      info('Estes números resumem as transferências registradas.', { text: 'Aguardando pesquisa' }, 'Os números aparecem quando a escola tem transferências.'),
      click('Toque em "Relatório" para ver as saídas por ano e os motivos.', { button: 'Relatório' }),
      done('Conhecer o motivo real é o primeiro passo para reter alunos.'),
    ],
  },
]
