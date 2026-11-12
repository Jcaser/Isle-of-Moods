import { chromium } from 'playwright'
import fs from 'fs'
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage({ viewport: { width: 1440, height: 940 } })
await p.goto('http://127.0.0.1:4173/calm', { waitUntil: 'networkidle' })
const enter = await p.$('button:has-text("进入岛屿")')
if (enter) await enter.click()
await p.waitForTimeout(400)
await p.click('button:has-text("海岛壁纸")')
await p.waitForTimeout(900)
const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
fs.writeFileSync('.shots/wallpaper-full.png', Buffer.from(data.split(',')[1], 'base64'))
await p.screenshot({ path: '.shots/wallpaper-page.png' })
await b.close()
