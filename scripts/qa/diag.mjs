import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge' })
const p = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage()
await p.goto('http://127.0.0.1:4173/play', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.setItem('sereneisle.v1.intro-seen', 'true'))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.click('button:has-text("沙岸拾贝")')
await p.waitForTimeout(900)
const info = await p.evaluate(() => {
  const c = document.querySelector('canvas[aria-label*="沙岸"]')
  const parent = c.parentElement
  return {
    canvas: c.getBoundingClientRect().toJSON(),
    parent: { w: parent.clientWidth, h: parent.clientHeight, cls: parent.className },
    kids: [...parent.children].map((el) => {
      const r = el.getBoundingClientRect()
      return { tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), cls: String(el.className).slice(0, 50) }
    }),
  }
})
console.log(JSON.stringify(info, null, 1))
// 刮一下再全页截图
const box = await (await p.$('canvas[aria-label*="沙岸"]')).boundingBox()
await p.mouse.move(box.x + 60, box.y + 90)
await p.mouse.down()
for (let i = 0; i < 30; i++) { await p.mouse.move(box.x + 60 + i * 20, box.y + 90 + Math.sin(i / 2) * 60); await p.waitForTimeout(8) }
await p.mouse.up()
await p.waitForTimeout(400)
await p.screenshot({ path: '.shots/diag.png' })
await b.close()
