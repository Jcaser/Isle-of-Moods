import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('.shots/gallery', { recursive: true })
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto('http://127.0.0.1:4180/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now()
  localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now, lastSeen: now }] }))
  localStorage.setItem('sereneisle.auth.session', 'u1')
  localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
const stage = p.locator('[aria-label="明信片环形画廊，可拖动旋转，点击卡片放大"]')
await stage.scrollIntoViewIfNeeded()
await p.mouse.move(10, 10)
await p.waitForTimeout(300)

const read = () =>
  p.evaluate(() => {
    const cards = [...document.querySelectorAll('button[aria-label^="放大明信片"]')]
    return cards.map((c) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(c).transform)
      return { label: c.getAttribute('aria-label').slice(6, 14), x: Math.round(m.m41), z: Math.round(m.m43) }
    })
  })

const t0 = await read()
await p.waitForTimeout(1000)
const t1 = await read()
const autoMoved = t0.some((c, i) => Math.abs(c.x - t1[i].x) > 2)

// 悬停暂停
const box = await stage.boundingBox()
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await p.waitForTimeout(250)
const h0 = await read()
await p.waitForTimeout(900)
const h1 = await read()
const hoverPaused = h0.every((c, i) => Math.abs(c.x - h1[i].x) <= 2)

// 拖拽
const before = await read()
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await p.mouse.down()
await p.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 12 })
await p.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, { steps: 12 })
const midDrag = await read()
await p.mouse.up()
await p.waitForTimeout(120)
const afterDrag = await read()
const dragMoved = before.some((c, i) => Math.abs(c.x - midDrag[i].x) > 20)
await p.screenshot({ path: '.shots/gallery/03-dragged.png' })

// 拖完不该误开弹窗
const dialogAfterDrag = await p.evaluate(() => !!document.querySelector('[role="dialog"]'))

// 点第三张（侧边卡）→ 应转到正面并打开大图
await p.mouse.move(10, 10)
await p.waitForTimeout(300)
const cards = p.locator('button[aria-label^="放大明信片"]')
await cards.nth(3).click({ force: true })
await p.waitForTimeout(900)
const dialogOpen = await p.evaluate(() => {
  const d = document.querySelector('[role="dialog"]')
  return d ? { open: true, label: d.getAttribute('aria-label'), img: d.querySelector('img')?.getAttribute('src') } : { open: false }
})
const focused = await read()
const front = [...focused].sort((a, b) => b.z - a.z)[0]
await p.screenshot({ path: '.shots/gallery/04-lightbox.png' })

// 方向键切换
await p.keyboard.press('ArrowRight')
await p.waitForTimeout(400)
const afterNext = await p.evaluate(() => document.querySelector('[role="dialog"]')?.getAttribute('aria-label'))

// Esc 关闭
await p.keyboard.press('Escape')
await p.waitForTimeout(500)
const dialogClosed = await p.evaluate(() => !document.querySelector('[role="dialog"]'))
await p.screenshot({ path: '.shots/gallery/05-closed.png' })

console.log(JSON.stringify({ autoMoved, hoverPaused, dragMoved, dialogAfterDrag, dialogOpen, front, afterNext, dialogClosed, errs }, null, 1))
await b.close()
