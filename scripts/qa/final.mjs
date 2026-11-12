import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const errs = []
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

for (const m of ['dawn', 'noon', 'dusk', 'night']) {
  await p.goto(B + '/', { waitUntil: 'networkidle' })
  await p.evaluate((mm) => {
    localStorage.setItem('sereneisle.v1.intro-seen', 'true')
    localStorage.setItem('sereneisle.v1.moment', mm)
  }, m)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  await p.screenshot({ path: `.shots/v6-moment-${m}.png`, clip: { x: 0, y: 0, width: 1440, height: 620 } })
}

// 泡泡点击
await p.goto(B + '/play', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
const cv = await p.$('canvas[aria-label*="泡泡"]')
if (cv) {
  const box = await cv.boundingBox()
  if (box) {
    for (let i = 0; i < 6; i++) {
      await p.mouse.click(box.x + 60 + i * 70, box.y + 120 + (i % 3) * 50)
      await p.waitForTimeout(120)
    }
  }
}
await p.waitForTimeout(500)
await p.screenshot({ path: '.shots/v6-bubble.png' })

// 打水漂
const skipBtn = await p.$('button:has-text("打水漂")')
if (skipBtn) await skipBtn.click()
await p.waitForTimeout(700)
const sk = await p.$('canvas[aria-label*="水漂"]')
if (sk) {
  const box = await sk.boundingBox()
  if (box) {
    await p.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5)
    await p.mouse.down()
    await p.waitForTimeout(520)
    await p.mouse.up()
    await p.waitForTimeout(1400)
  }
}
await p.screenshot({ path: '.shots/v6-skip.png' })

// 游戏后记录情绪
const moodBtn = await p.$('button[aria-label="记录心情：还不错"]')
if (moodBtn) { await moodBtn.click(); await p.waitForTimeout(600) }
await p.screenshot({ path: '.shots/v6-play-after.png' })

console.log('errors:', errs)
await b.close()
