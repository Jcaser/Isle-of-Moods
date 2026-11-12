import { chromium } from 'playwright'

const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const errs = []

// 1. 桌面：首页（带演示数据）
const ctx = await b.newContext({ viewport: { width: 1440, height: 940 } })
const p = await ctx.newPage()
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now()
  const day = 86400000
  const scores = [2,3,3,2,4,3,4]
  const recs = scores.map((s, i) => ({
    id: 'r' + i, ts: now - (6 - i) * day + 3600000, score: s,
    tags: i % 2 ? ['学业压力'] : ['睡眠不足'], note: '', source: 'quick'
  }))
  localStorage.setItem('sereneisle.v1.mood', JSON.stringify(recs))
  localStorage.setItem('sereneisle.v1.assessments', JSON.stringify([{ id: 'a1', ts: now - day, answers: [2,2,1,2,2,1,1], total: 11, level: 'moderate' }]))
  localStorage.setItem('sereneisle.v1.intro-seen', 'true')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.screenshot({ path: '.shots/final-home.png', fullPage: true })
await p.screenshot({ path: '.shots/final-home-fold.png' })

// 情绪页（有数据）
await p.goto(B + '/mood', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.screenshot({ path: '.shots/final-mood.png', fullPage: true })

// 呼吸
await p.goto(B + '/calm', { waitUntil: 'networkidle' })
await p.click('button:has-text("开始引导")')
await p.waitForTimeout(2600)
await p.screenshot({ path: '.shots/final-breathing.png' })

// 2. 移动端
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mp = await m.newPage()
await mp.goto(B + '/', { waitUntil: 'networkidle' })
await mp.evaluate(() => localStorage.setItem('sereneisle.v1.intro-seen', 'true'))
await mp.reload({ waitUntil: 'networkidle' })
await mp.waitForTimeout(900)
await mp.screenshot({ path: '.shots/final-m-home.png', fullPage: true })
await mp.goto(B + '/chat', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
await mp.screenshot({ path: '.shots/final-m-chat.png' })

console.log('errors:', errs)
await b.close()
