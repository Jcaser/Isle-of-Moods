import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(B + '/play', { waitUntil: 'networkidle' })
await p.waitForTimeout(1600)
const c1 = await p.$('canvas[aria-label*="泡泡"]')
if (c1) {
  const box = await c1.boundingBox()
  if (box) for (let i = 0; i < 5; i++) { await p.mouse.click(box.x + 90 + i * 95, box.y + 200 + (i % 2) * 90); await p.waitForTimeout(150) }
  await p.waitForTimeout(400)
  await c1.screenshot({ path: '.shots/v7-bubble.png' })
}
const btn = await p.$('button:has-text("打水漂")')
if (btn) await btn.click()
await p.waitForTimeout(600)
const c2 = await p.$('canvas[aria-label*="水漂"]')
if (c2) {
  const box = await c2.boundingBox()
  if (box) {
    await p.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5)
    await p.mouse.down(); await p.waitForTimeout(480); await p.mouse.up()
    await p.waitForTimeout(900)
    await c2.screenshot({ path: '.shots/v7-skip.png' })
  }
}
const btn2 = await p.$('button:has-text("沙岸拾贝")')
if (btn2) await btn2.click()
await p.waitForTimeout(700)
const c3 = await p.$('canvas[aria-label*="沙岸"]')
if (c3) {
  const box = await c3.boundingBox()
  if (box) {
    await p.mouse.move(box.x + 50, box.y + 70); await p.mouse.down()
    for (let i = 0; i < 46; i++) { await p.mouse.move(box.x + 50 + i * (box.width / 50), box.y + 70 + Math.sin(i / 2.6) * 80); await p.waitForTimeout(10) }
    await p.mouse.up(); await p.waitForTimeout(500)
    await c3.screenshot({ path: '.shots/v7-shell.png' })
  }
}
console.log('errors:', errs)
await b.close()
