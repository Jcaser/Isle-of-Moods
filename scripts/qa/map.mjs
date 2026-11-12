import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now()
  localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now, lastSeen: now }] }))
  localStorage.setItem('sereneisle.auth.session', 'u1')
  localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1400)
const stage = await p.$('.atlas-stage')
await stage.scrollIntoViewIfNeeded()
await p.waitForTimeout(500)
const box = await stage.boundingBox()
await p.screenshot({ path: '.shots/v10-map.png', clip: { x: box.x - 20, y: box.y - 70, width: box.width + 40, height: box.height + 90 } })

// 悬停注记
const lab = await p.$('button:has-text("藏书阁")')
if (lab) { await lab.hover(); await p.waitForTimeout(400) }
await p.screenshot({ path: '.shots/v10-map-hover.png', clip: { x: box.x - 20, y: box.y - 70, width: box.width + 40, height: box.height + 90 } })

// 点选
if (lab) { await lab.click(); await p.waitForTimeout(600) }
await p.screenshot({ path: '.shots/v10-map-picked.png' })

// 放大后拖动
await p.click('button[aria-label="放大地图"]')
await p.waitForTimeout(700)
await p.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4)
await p.mouse.down()
await p.mouse.move(box.x + box.width * 0.4 - 90, box.y + box.height * 0.4 - 50, { steps: 14 })
await p.mouse.up()
await p.waitForTimeout(400)
await p.screenshot({ path: '.shots/v10-map-drag.png', clip: { x: box.x - 20, y: box.y - 70, width: box.width + 40, height: box.height + 90 } })
console.log('errors:', errs)
await b.close()
