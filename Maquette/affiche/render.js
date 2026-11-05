// node render.js — capture les deux affiches en PNG, à leur taille réelle
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  for (const [name, h] of [['story', 1920], ['post', 1350]]) {
    const p = await b.newPage({ viewport: { width: 1080, height: h } })
    await p.goto(`file://${__dirname}/correspondances-${name}.html`, { waitUntil: 'networkidle' })
    await p.evaluate(() => document.fonts.ready)
    const over = await p.evaluate(() => document.querySelector('.foot').getBoundingClientRect().bottom)
    console.log(name, 'bas du contenu :', Math.round(over), '/', h)
    await p.screenshot({ path: `${__dirname}/correspondances-${name}.png` })
  }
  await b.close()
})()
