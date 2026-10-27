// Harness local: gera o PDF de teste a partir dos JSON de amostra (rodar com tsx)
import React from 'react'
import fs from 'fs'
import { renderToFile } from '@react-pdf/renderer'
import { registerFonts, setBase } from '../src/lib/raiox/pdf/ui'
import { nome, limpaTexto, type RaioXCtx } from '../src/lib/raiox/data'
import { Relatorio } from '../src/lib/raiox/pdf/Relatorio'

const dir = process.argv[2], out = process.argv[3] || '/tmp/rx-test.pdf'
setBase('/home/claude/inscribo/public'); registerFonts()
const R = JSON.parse(fs.readFileSync(dir + '/agape.json', 'utf8')), B = JSON.parse(fs.readFileSync(dir + '/bairros.json', 'utf8')), ESC = JSON.parse(fs.readFileSync(dir + '/escolas.json', 'utf8'))
const c: RaioXCtx = { R, B, ESC, me: R.escola.co, nome: nome(R.escola.nome), cid: limpaTexto(R.escola.municipio), uf: R.escola.uf, ano: R.posicao.ano }
const ig = fs.existsSync(dir + '/ig_analise.json') ? JSON.parse(fs.readFileSync(dir + '/ig_analise.json', 'utf8')) : null
renderToFile(<Relatorio c={c} ig={ig} />, out).then(() => console.log('ok', out))
