import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now()
  localStorage.clear()
  localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now - 86400000 * 12, lastSeen: now }] }))
  localStorage.setItem('sereneisle.auth.session', 'u1')
  const day = 86400000
  const recs = [2,3,3,2,4,3,4].map((s, i) => ({ id: 'r' + i, ts: now - (6 - i) * day + 3600000, score: s, tags: i % 2 ? ['学业压力'] : ['睡眠不足'], note: '', source: 'quick' }))
  localStorage.setItem('sereneisle.v1.u_u1.mood', JSON.stringify(recs))
  localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
  localStorage.setItem('sereneisle.v1.u_u1.settings', JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '', temperature: 0.7, voiceURI: '', rate: 0.92, pitch: 1 }))
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1600)
await p.screenshot({ path: '.shots/v9-home.png' })

// 地图：悬停注记
const label = await p.$('button[aria-label="藏书阁"]')
const spot = await p.$('g[aria-label="藏书阁"]')
const stage = await p.$('.atlas-stage')
const box = await stage.boundingBox()
const before = await p.evaluate(() => document.querySelector('.atlas-layer').style.transform)
await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
await p.mouse.down()
await p.mouse.move(box.x + box.width * 0.5 - 70, box.y + box.height * 0.5 - 30, { steps: 12 })
await p.mouse.up()
await p.waitForTimeout(300)
const after = await p.evaluate(() => document.querySelector('.atlas-layer').style.transform)
console.log('drag transform:', before, '->', after)

await p.click('button[aria-label="放大地图"]')
await p.waitForTimeout(700)
const zoomed = await p.evaluate(() => ({ t: document.querySelector('.atlas-layer').style.transform, label: document.querySelector('[aria-label="回到全景"]') !== null }))
console.log('zoom:', JSON.stringify(zoomed))
await p.screenshot({ path: '.shots/v9-map-zoom.png' })
await p.click('button[aria-label="回到全景"]')
await p.waitForTimeout(600)

// 点一个地点
if (label) {
  await label.click()
  await p.waitForTimeout(700)
  await p.screenshot({ path: '.shots/v9-map-picked.png' })
}

// 呼吸：吸气 / 屏息 / 呼气 三个时刻
await p.click('button:has-text("先做 1 分钟呼吸")')
await p.waitForTimeout(1600)
const readOrb = () => p.evaluate(() => {
  const el = document.querySelector('.breath-orb')
  return { t: el?.style.transform, label: document.querySelector('[role="dialog"] p.font-display')?.textContent }
})
await p.screenshot({ path: '.shots/v9-breath-inhale.png' })
console.log('inhale:', JSON.stringify(await readOrb()))
await p.waitForTimeout(6000)
await p.screenshot({ path: '.shots/v9-breath-hold.png' })
console.log('hold:', JSON.stringify(await readOrb()))
await p.waitForTimeout(6500)
await p.screenshot({ path: '.shots/v9-breath-exhale.png' })
console.log('exhale:', JSON.stringify(await readOrb()))
await p.waitForTimeout(4000)
const end = await readOrb()
console.log('later:', JSON.stringify(end))

console.log('errors:', errs)
await b.close()
