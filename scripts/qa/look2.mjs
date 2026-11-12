import { chromium } from 'playwright'

const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const errs = []
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.setItem('sereneisle.v1.intro-seen', 'true')
  localStorage.setItem('sereneisle.v1.moment', 'noon')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

const svg = await p.$('svg[aria-label*="全景地图"]')
if (svg) await svg.screenshot({ path: '.shots/v3-atlas.png' })

// 点乐园看看
const play = await p.$('g[aria-label="乐园沙滩"]')
if (play) {
  await play.click()
  await p.waitForTimeout(600)
  const panel = await p.$('text=04 / 07')
  await p.screenshot({ path: '.shots/v3-atlas-play.png' })
}

await p.goto(B + '/play', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
const shots = ['潮汐泡泡', '沙岸拾贝', '打水漂', '星光许愿']
for (const [i, name] of shots.entries()) {
  const btn = await p.$(`button:has-text("${name}")`)
  if (btn) await btn.click()
  await p.waitForTimeout(800)
  const canvas = await p.$('canvas')
  if (canvas) await canvas.screenshot({ path: `.shots/v3-game-${i}.png` })
}

console.log('errors:', errs)
await b.close()
