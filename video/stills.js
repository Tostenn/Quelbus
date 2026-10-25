const { chromium } = require('playwright')
const [,, w, h, ...times] = process.argv
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage({ viewport: { width: +w, height: +h } })
  pg.on('pageerror', e => console.log('ERR', e.message))
  await pg.goto('file://' + __dirname + `/scene.html?w=${w}&h=${h}`)
  await pg.evaluate(() => document.fonts.ready)
  for (const t of times) {
    await pg.evaluate(t => render(+t), t)
    await pg.screenshot({ path: `${__dirname}/stills/${w}x${h}-${t}.png` })
  }
  await b.close()
})()
