import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('.shots/relief', { recursive: true })
const B = 'http://127.0.0.1:4180/harbor'
const b = await chromium.launch({ channel: 'msedge' })

const login = async (ctx) => {
  const p = await ctx.newPage()
  await p.goto(B, { waitUntil: 'networkidle' })
  await p.evaluate(() => {
    const now = Date.now()
    localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now, lastSeen: now }] }))
    localStorage.setItem('sereneisle.auth.session', 'u1')
    localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
  })
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(1000)
  return p
}

const report = {}
const errs = []

// ── 桌面：连抽八次 ──
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await login(ctx)
  p.on('pageerror', (e) => errs.push('desktop: ' + e.message))
  const sec = p.locator('section[aria-labelledby="relief-title"]')
  await sec.scrollIntoViewIfNeeded()
  await p.waitForTimeout(400)

  report.idleTiles = await p.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="relief-title"]')
    return s.querySelectorAll('.grid img').length
  })

  const titles = []
  for (let i = 0; i < 8; i++) {
    await sec.locator('button.btn-primary').click()
    await p.waitForTimeout(1550)
    const t = await p.evaluate(() => {
      const s = document.querySelector('section[aria-labelledby="relief-title"]')
      const h3 = s.querySelector('h3')
      const img = s.querySelector('article img')
      return { title: h3?.textContent ?? null, imgOk: img ? img.naturalWidth > 0 : false }
    })
    titles.push(t)
    if (i === 0) await sec.screenshot({ path: '.shots/relief/3-open.png' })
  }
  report.firstRound = titles.slice(0, 7).map((t) => t.title)
  report.uniqueFirstRound = new Set(report.firstRound).size
  report.allImagesLoaded = titles.every((t) => t.imgOk)
  report.eighth = titles[7].title

  // 收好 → 抽屉里已抽到的应解除模糊
  await p.getByRole('button', { name: '收好' }).click()
  await p.waitForTimeout(600)
  report.drawer = await p.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="relief-title"]')
    const imgs = [...s.querySelectorAll('.grid img')]
    return {
      tiles: imgs.length,
      clear: imgs.filter((i) => {
        const f = getComputedStyle(i).filter
        const m = f.match(/blur\(([\d.]+)px\)/)
        return !m || Number(m[1]) < 0.5
      }).length,
    }
  })
  await sec.screenshot({ path: '.shots/relief/5-drawer.png' })
  await ctx.close()
}

// ── 移动端 ──
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await login(ctx)
  const sec = p.locator('section[aria-labelledby="relief-title"]')
  await sec.scrollIntoViewIfNeeded()
  await p.waitForTimeout(600)
  await sec.screenshot({ path: '.shots/relief/m-idle.png' })
  await sec.locator('button.btn-primary').click()
  await p.waitForTimeout(950)
  await sec.screenshot({ path: '.shots/relief/m-open.png' })
  report.mobileOverflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await ctx.close()
}

// ── 减少动效 ──
{
  const ctx = await b.newContext({ viewport: { width: 1100, height: 800 }, reducedMotion: 'reduce' })
  const p = await login(ctx)
  const sec = p.locator('section[aria-labelledby="relief-title"]')
  await sec.scrollIntoViewIfNeeded()
  await p.waitForTimeout(400)
  await sec.locator('button.btn-primary').click()
  await p.waitForTimeout(500)
  report.reducedMotion = await p.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="relief-title"]')
    return { opened: !!s.querySelector('h3'), title: s.querySelector('h3')?.textContent }
  })
  await ctx.close()
}

report.errs = errs
console.log(JSON.stringify(report, null, 1))
await b.close()
