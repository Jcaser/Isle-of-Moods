import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
await p.screenshot({ path: '.shots/v11-m-gate.png', fullPage: true })

await p.fill('input[aria-label="你的名字"]', '林小屿')
await p.fill('input[aria-label="暗号"]', '1234')
await p.click('button[type="submit"]')
await p.waitForTimeout(700)
await p.screenshot({ path: '.shots/v11-m-confirm.png' })
await p.click('button:has-text("开辟我的岛")')
await p.waitForTimeout(2000)
const intro = await p.$('button:has-text("进入岛屿")')
if (intro) await intro.click()
await p.waitForTimeout(800)
await p.screenshot({ path: '.shots/v11-m-home.png' })
const overflowHome = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const stage = await p.$('.atlas-stage')
await stage.scrollIntoViewIfNeeded()
await p.waitForTimeout(500)
const box = await stage.boundingBox()
await p.screenshot({ path: '.shots/v11-m-map.png', clip: { x: 0, y: box.y - 60, width: 390, height: box.height + 70 } })
const overflowMap = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

await p.click('button[aria-label="放大地图"]')
await p.waitForTimeout(800)
await p.screenshot({ path: '.shots/v11-m-map-zoom.png', clip: { x: 0, y: box.y - 60, width: 390, height: box.height + 70 } })

console.log('overflow home/map:', overflowHome, overflowMap)
console.log('errors:', errs)
await b.close()
