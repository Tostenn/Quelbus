// node stills.js 1.5 7 12 …  — images fixes dans stills/ pour vérifier une scène sans tout rendre
const { chromium } = require('playwright')
const times = process.argv.slice(2).map(Number)
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  pg.on('pageerror', (e) => console.log('ERR', e.message))
  await pg.goto('file://' + __dirname + '/scene.html')
  await pg.evaluate(() => document.fonts.ready)
  for (const t of times) {
    await pg.evaluate((x) => render(x), t)
    await pg.screenshot({ path: `${__dirname}/stills/t${String(t).replace('.', '_')}.png` })
  }
  await b.close()
})()
