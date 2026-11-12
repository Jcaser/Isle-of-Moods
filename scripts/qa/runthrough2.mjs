import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const errs = []
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 })
const p = await ctx.newPage()
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now()
  const day = 86400000
  localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now - day * 12, lastSeen: now }] }))
  localStorage.setItem('sereneisle.auth.session', 'u1')
  const recs = [2,3,3,2,4,3,4,3,2,3,4,5,4,3].map((s, i) => ({ id: 'r' + i, ts: now - (13 - i) * day + 3600000, score: s, tags: i % 2 ? ['学业压力'] : ['睡眠不足'], note: '', source: 'quick' }))
  localStorage.setItem('sereneisle.v1.u_u1.mood', JSON.stringify(recs))
  localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
  localStorage.setItem('sereneisle.v1.moment', 'dusk')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

for (const r of ['/', '/chat', '/library', '/calm', '/play', '/mood', '/harbor', '/about']) {
  await p.goto(B + r, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  const of = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${r.padEnd(9)} overflow=${of}`)
}

// GAD-7 从快捷面板打开
await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.keyboard.press('Control+k')
await p.waitForTimeout(300)
await p.keyboard.type('GAD')
await p.waitForTimeout(200)
await p.keyboard.press('Enter')
await p.waitForTimeout(800)
await p.screenshot({ path: '.shots/v14-gad.png' })

// 首页整页
await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.waitForTimeout(1400)
await p.screenshot({ path: '.shots/v14-home-full.png', fullPage: true })

// 移动端
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mp = await m.newPage()
mp.on('pageerror', (e) => errs.push('M ' + e.message))
await mp.goto(B + '/', { waitUntil: 'networkidle' })
await mp.waitForTimeout(1000)
await mp.screenshot({ path: '.shots/v14-m-gate.png' })

console.log('errors:', errs.length ? errs : 'none')
await b.close()
