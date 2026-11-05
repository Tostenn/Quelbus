// node render.js out/video-muet.mp4 [fps]  — rend scene.html image par image et encode en H.264
const { chromium } = require('playwright')
const { spawn } = require('child_process')
const [,, out, fps = 30] = process.argv
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  pg.on('pageerror', (e) => console.log('ERR', e.message))
  await pg.goto('file://' + __dirname + '/scene.html')
  await pg.evaluate(() => document.fonts.ready)
  const n = Math.round((await pg.evaluate(() => window.DURATION)) * fps)
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] })
  for (let i = 0; i < n; i++) {
    await pg.evaluate((t) => render(t), i / fps)
    const buf = await pg.screenshot({ type: 'png' })
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  await b.close()
  console.log('ok', out, n, 'images')
})()
