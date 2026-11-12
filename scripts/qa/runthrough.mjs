import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const ROUTES = ['/', '/chat', '/library', '/calm', '/play', '/mood', '/harbor', '/about']
const b = await chromium.launch({ channel: 'msedge' })
const errs = []
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.setItem('sereneisle.v1.intro-seen', 'true'))

for (const r of ROUTES) {
  await p.goto(B + r, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  const h = await p.evaluate(() => {
    const el = document.querySelector('h1, h2')
    return el ? el.textContent.trim().slice(0, 30) : '(none)'
  })
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  console.log(`${r.padEnd(10)} h=${h}  vOverflow=${overflow}`)
}

// 移动端溢出检查
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const mp = await m.newPage()
mp.on('pageerror', (e) => errs.push('M ' + e.message))
await mp.goto(B + '/', { waitUntil: 'networkidle' })
await mp.evaluate(() => localStorage.setItem('sereneisle.v1.intro-seen', 'true'))
for (const r of ['/', '/play', '/library', '/mood', '/harbor']) {
  await mp.goto(B + r, { waitUntil: 'networkidle' })
  await mp.waitForTimeout(600)
  const of = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`M ${r.padEnd(8)} overflow=${of}px`)
}

console.log('errors:', errs.length ? errs : 'none')
await b.close()
