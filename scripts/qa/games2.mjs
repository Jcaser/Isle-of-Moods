import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
try {
  await p.goto(B + '/play', { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.setItem('sereneisle.v1.intro-seen', 'true'))
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  const btn = await p.$('button:has-text("沙岸拾贝")')
  if (btn) await btn.click()
  await p.waitForTimeout(900)
  const c3 = await p.$('canvas[aria-label*="沙岸"]')
  const box = await c3.boundingBox()
  await p.mouse.move(box.x + 60, box.y + 90)
  await p.mouse.down()
  for (let i = 0; i < 52; i++) {
    await p.mouse.move(box.x + 60 + i * (box.width / 56), box.y + 90 + Math.sin(i / 2.4) * 90)
    await p.waitForTimeout(9)
  }
  await p.mouse.up()
  await p.waitForTimeout(500)
  await p.screenshot({ path: '.shots/v8-shell.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } })
  console.log('shot ok')
} catch (e) {
  console.log('ERR', e.message)
}
await b.close()
