import { chromium } from 'playwright'

const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const errs = []
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 } })
const p = await ctx.newPage()
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.setItem('sereneisle.v1.intro-seen', 'true')
  localStorage.setItem('sereneisle.v1.moment', 'noon')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1800)
await p.screenshot({ path: '.shots/v2-home-fold.png' })
await p.screenshot({ path: '.shots/v2-home-full.png', fullPage: true })

// 地图区域单独截
const atlas = await p.$('svg[aria-label*="全景地图"]')
if (atlas) {
  const box = await atlas.boundingBox()
  if (box) {
    await p.screenshot({
      path: '.shots/v2-atlas.png',
      clip: { x: Math.max(0, box.x - 16), y: Math.max(0, box.y - 60), width: box.width + 32, height: box.height + 80 },
    })
  }
}

// 点藏书阁看看面板
const lib = await p.$('g[aria-label="藏书阁"]')
if (lib) {
  await lib.click()
  await p.waitForTimeout(700)
  await p.screenshot({ path: '.shots/v2-atlas-lib.png' })
}

// 乐园
await p.goto(B + '/play', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.screenshot({ path: '.shots/v2-play-bubble.png', fullPage: true })

const tabs = ['沙岸拾贝', '打水漂', '星光许愿']
for (const [i, name] of tabs.entries()) {
  const btn = await p.$(`button:has-text("${name}")`)
  if (btn) {
    await btn.click()
    await p.waitForTimeout(700)
  }
  await p.screenshot({ path: `.shots/v2-play-${i + 1}.png` })
}

// 沙岸刮一下
await p.goto(B + '/play', { waitUntil: 'networkidle' })
const shell = await p.$('button:has-text("沙岸拾贝")')
if (shell) await shell.click()
await p.waitForTimeout(900)
const canvas = await p.$('canvas[aria-label*="沙岸"]')
if (canvas) {
  const box = await canvas.boundingBox()
  if (box) {
    await p.mouse.move(box.x + 60, box.y + 60)
    await p.mouse.down()
    for (let i = 0; i < 40; i++) {
      await p.mouse.move(box.x + 60 + i * (box.width / 44), box.y + 60 + Math.sin(i / 3) * 70)
      await p.waitForTimeout(12)
    }
    await p.mouse.up()
    await p.waitForTimeout(600)
  }
}
await p.screenshot({ path: '.shots/v2-play-shell.png' })

console.log('errors:', errs)
await b.close()
