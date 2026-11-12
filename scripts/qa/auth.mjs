import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1400)
await p.screenshot({ path: '.shots/v8-gate.png' })

await p.fill('input[aria-label="你的名字"]', '林小屿')
await p.fill('input[aria-label="暗号"]', '1234')
await p.waitForTimeout(400)
await p.screenshot({ path: '.shots/v8-gate-filled.png' })
await p.click('button[type="submit"]')
await p.waitForTimeout(900)
await p.screenshot({ path: '.shots/v8-gate-confirm.png' })
await p.click('button:has-text("开辟我的岛")')
await p.waitForTimeout(1800)
await p.screenshot({ path: '.shots/v8-after-enter.png' })
console.log('url after enter:', p.url())
console.log('errors:', errs)
await b.close()
