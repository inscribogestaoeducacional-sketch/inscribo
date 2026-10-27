// Raio-X · Presença digital: transforma a resposta pública do Instagram (Business Discovery)
// em números prontos para o relatório. Nada aqui chama a internet nem inventa dado:
// tudo vem do perfil e dos últimos posts públicos; o que faltar fica como null.

export type IgMedia = {
  caption?: string; comments_count?: number; like_count?: number
  media_type?: string; media_product_type?: string; timestamp?: string; permalink?: string
}
export type IgRaw = {
  username?: string; name?: string; biography?: string; website?: string
  followers_count?: number; media_count?: number; profile_picture_url?: string
  media?: { data?: IgMedia[] }
}
export type Tipo = 'reels' | 'carrossel' | 'foto'
export type Check = { id: string; titulo: string; ok: boolean; peso: number; detalhe: string }
export type IgAnalise = {
  perfil: { username: string; nome: string | null; bio: string; site: string | null; seguidores: number; posts_total: number }
  amostra: { n: number; dias: number | null; primeiro: string | null; ultimo: string | null }
  frequencia: { por_semana: number | null; dias_desde_ultimo: number | null; semanas: { inicio: string; qtd: number }[] }
  tipos: { tipo: Tipo; qtd: number; pct: number; engaj_medio: number | null }[]
  engajamento: {
    curtidas_ocultas: boolean; medio_por_post: number | null; taxa_pct: number | null
    curtidas_media: number | null; comentarios_media: number | null
    melhor: { permalink: string | null; tipo: Tipo; curtidas: number | null; comentarios: number; data: string; legenda: string } | null
    por_dia: { dia: string; qtd: number; engaj_medio: number | null }[]
    melhor_dia: string | null
  }
  conteudo: { fala_matricula: number; com_chamada: number; legenda_media: number | null; hashtags_media: number | null; recentes_matricula_30d: number; posts_30d: number }
  bio_checks: { site: boolean; contato: boolean; matricula: boolean; cidade: boolean | null }
  checks: Check[]
  nota: number
  faixa: 'forte' | 'medio' | 'fraco'
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const RE_MAT = /matricul|rematricul|vagas|ano letivo|inscri[cç]|garanta sua vaga|garanta a vaga/
const RE_CHAMADA = /link na bio|clique|chame|fale com|agende|visite|whatsapp|zap|saiba mais|garanta|inscreva|entre em contato|\(\d{2}\)\s?\d|wa\.me/
const RE_CONTATO = /whatsapp|zap|wa\.me|\(\d{2}\)\s?\d|\b\d{2}\s?9?\d{4}[-\s]?\d{4}\b|tel\b|fone|contato/

function tipoDe(m: IgMedia): Tipo {
  if (m.media_product_type === 'REELS' || m.media_type === 'VIDEO') return 'reels'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carrossel'
  return 'foto'
}
// Data/hora de Fortaleza (UTC-3, sem horário de verão) para o dia da semana
const local = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000)
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10)

export function analisar(raw: IgRaw, cidade?: string | null, agora = new Date()): IgAnalise {
  const posts = (raw.media?.data ?? []).filter(p => p.timestamp).sort((a, b) => +new Date(b.timestamp!) - +new Date(a.timestamp!))
  const seguidores = raw.followers_count ?? 0
  const bio = raw.biography ?? ''
  const bioN = norm(bio)

  // curtidas escondidas: o Instagram omite like_count quando o perfil oculta as curtidas
  const comLikes = posts.filter(p => typeof p.like_count === 'number')
  const ocultas = posts.length > 0 && comLikes.length < posts.length / 2
  const engaj = (p: IgMedia) => (p.comments_count ?? 0) + (ocultas ? 0 : p.like_count ?? 0)

  const primeiro = posts.length ? posts[posts.length - 1].timestamp! : null
  const ultimo = posts.length ? posts[0].timestamp! : null
  const dias = primeiro ? Math.max(1, Math.round((+agora - +new Date(primeiro)) / 86400_000)) : null
  const desdeUltimo = ultimo ? Math.max(0, Math.floor((+agora - +new Date(ultimo)) / 86400_000)) : null
  const porSemana = dias && posts.length >= 2 ? r1((posts.length / dias) * 7) : null

  // últimas 12 semanas (seg.-dom.), da mais antiga para a mais nova
  const semanas: { inicio: string; qtd: number }[] = []
  const ini0 = new Date(agora); ini0.setUTCHours(0, 0, 0, 0); ini0.setUTCDate(ini0.getUTCDate() - ((ini0.getUTCDay() + 6) % 7))
  for (let i = 11; i >= 0; i--) {
    const a = new Date(+ini0 - i * 7 * 86400_000), b = new Date(+a + 7 * 86400_000)
    semanas.push({ inicio: a.toISOString().slice(0, 10), qtd: posts.filter(p => { const t = +new Date(p.timestamp!); return t >= +a && t < +b }).length })
  }

  const tiposOrd: Tipo[] = ['reels', 'carrossel', 'foto']
  const tipos = tiposOrd.map(t => {
    const g = posts.filter(p => tipoDe(p) === t)
    return { tipo: t, qtd: g.length, pct: posts.length ? Math.round((100 * g.length) / posts.length) : 0, engaj_medio: r1(media(g.map(engaj))) }
  })

  const porDia = DIAS.map((d, i) => {
    const g = posts.filter(p => local(p.timestamp!).getUTCDay() === i)
    return { dia: d, qtd: g.length, engaj_medio: r1(media(g.map(engaj))) }
  })
  const comDados = porDia.filter(d => d.qtd >= 2 && d.engaj_medio !== null)
  const melhorDia = comDados.length ? comDados.reduce((a, b) => (b.engaj_medio! > a.engaj_medio! ? b : a)).dia : null

  const top = posts.length ? posts.reduce((a, b) => (engaj(b) > engaj(a) ? b : a)) : null
  const engMedio = r1(media(posts.map(engaj)))

  const legs = posts.map(p => p.caption ?? '')
  const falaMat = legs.filter(l => RE_MAT.test(norm(l))).length
  const comChamada = legs.filter(l => RE_CHAMADA.test(norm(l))).length
  const t30 = posts.filter(p => +agora - +new Date(p.timestamp!) <= 30 * 86400_000)
  const mat30 = t30.filter(p => RE_MAT.test(norm(p.caption ?? ''))).length

  const bio_checks = {
    site: !!raw.website,
    contato: RE_CONTATO.test(bioN) || /wa\.me|whatsapp/.test(norm(raw.website ?? '')),
    matricula: RE_MAT.test(bioN),
    cidade: cidade ? bioN.includes(norm(cidade)) : null,
  }

  const pctVideo = (tipos[0].pct)
  const checks: Check[] = [
    { id: 'site', titulo: 'Link na bio', ok: bio_checks.site, peso: 15, detalhe: bio_checks.site ? 'A bio tem um link para a família clicar.' : 'A bio não tem link. É o único lugar do Instagram onde o link é clicável.' },
    { id: 'contato', titulo: 'Contato na bio', ok: bio_checks.contato, peso: 10, detalhe: bio_checks.contato ? 'A bio mostra WhatsApp ou telefone.' : 'A bio não mostra WhatsApp nem telefone.' },
    { id: 'matricula', titulo: 'Matrícula na bio', ok: bio_checks.matricula, peso: 10, detalhe: bio_checks.matricula ? 'A bio fala de matrícula ou vagas.' : 'A bio não fala de matrícula nem de vagas.' },
    { id: 'frequencia', titulo: 'Posta toda semana', ok: (porSemana ?? 0) >= 2, peso: 20, detalhe: porSemana === null ? 'Poucos posts para medir.' : `${String(porSemana).replace('.', ',')} posts por semana (meta de referência: 2 ou mais).` },
    { id: 'recente', titulo: 'Postou nos últimos 7 dias', ok: desdeUltimo !== null && desdeUltimo <= 7, peso: 10, detalhe: desdeUltimo === null ? 'Sem posts para medir.' : desdeUltimo === 0 ? 'Postou hoje.' : `Último post há ${desdeUltimo} dia${desdeUltimo > 1 ? 's' : ''}.` },
    { id: 'campanha', titulo: 'Fala de matrícula nos posts', ok: mat30 >= 1 && t30.length > 0 && mat30 / t30.length >= 0.25, peso: 15, detalhe: t30.length === 0 ? 'Nenhum post nos últimos 30 dias.' : `${mat30} de ${t30.length} posts dos últimos 30 dias falam de matrícula (referência: 1 a cada 4).` },
    { id: 'chamada', titulo: 'Legendas chamam para uma ação', ok: posts.length > 0 && comChamada / posts.length >= 0.3, peso: 10, detalhe: posts.length ? `${comChamada} de ${posts.length} legendas convidam a família a agir (chamar, agendar, clicar).` : 'Sem posts para medir.' },
    { id: 'video', titulo: 'Usa vídeo e Reels', ok: pctVideo >= 25, peso: 10, detalhe: posts.length ? `${pctVideo}% dos posts são vídeo ou Reels (referência: 25% ou mais).` : 'Sem posts para medir.' },
  ]
  const nota = checks.reduce((s, c) => s + (c.ok ? c.peso : 0), 0)

  return {
    perfil: { username: raw.username ?? '', nome: raw.name ?? null, bio, site: raw.website ?? null, seguidores, posts_total: raw.media_count ?? 0 },
    amostra: { n: posts.length, dias, primeiro, ultimo },
    frequencia: { por_semana: porSemana, dias_desde_ultimo: desdeUltimo, semanas },
    tipos,
    engajamento: {
      curtidas_ocultas: ocultas,
      medio_por_post: engMedio,
      taxa_pct: seguidores > 0 && engMedio !== null ? Math.round((engMedio / seguidores) * 10000) / 100 : null,
      curtidas_media: ocultas ? null : r1(media(comLikes.map(p => p.like_count!))),
      comentarios_media: r1(media(posts.map(p => p.comments_count ?? 0))),
      melhor: top ? { permalink: top.permalink ?? null, tipo: tipoDe(top), curtidas: ocultas ? null : top.like_count ?? null, comentarios: top.comments_count ?? 0, data: top.timestamp!.slice(0, 10), legenda: (top.caption ?? '').slice(0, 140) } : null,
      por_dia: porDia, melhor_dia: melhorDia,
    },
    conteudo: {
      fala_matricula: falaMat, com_chamada: comChamada,
      legenda_media: r1(media(legs.map(l => l.length))),
      hashtags_media: r1(media(legs.map(l => (l.match(/#\w+/g) ?? []).length))),
      recentes_matricula_30d: mat30, posts_30d: t30.length,
    },
    bio_checks, checks, nota,
    faixa: nota >= 70 ? 'forte' : nota >= 40 ? 'medio' : 'fraco',
  }
}

/** Aceita @nome, nome ou link do perfil; devolve só o usuário em minúsculas, ou null se for inválido. */
export function limparUsuario(entrada: unknown): string | null {
  if (typeof entrada !== 'string') return null
  let s = entrada.trim().toLowerCase()
  const m = s.match(/instagram\.com\/([a-z0-9._]+)/)
  if (m) s = m[1]
  s = s.replace(/^@+/, '').replace(/[/?#].*$/, '')
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null
}
