import fs from 'fs'
import { setBase } from '../src/lib/raiox/pdf/ui'
import { registerFonts } from '../src/lib/raiox/pdf/ui'
import { fetchRaioX } from '../src/lib/raiox/fetch'
import { Relatorio } from '../src/lib/raiox/pdf/Relatorio'
import { renderToFile } from '@react-pdf/renderer'
import React from 'react'
setBase('/home/claude/inscribo/public'); registerFonts()
const [co, out] = process.argv.slice(2)
fetchRaioX(co).then(async c => {
  if (!c) { console.log('sem dados', co); return }
  await renderToFile(<Relatorio c={c} ig={null} />, out)
  console.log('ok', co, c.nome, c.cid, 'bairros', c.B.length, 'esc', c.ESC.length)
}).catch(e => console.log('ERR', co, e.message))
