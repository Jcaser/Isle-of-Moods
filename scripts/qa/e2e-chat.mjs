import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage({ viewport: { width: 1440, height: 940 } })
const errs = []
p.on('pageerror', e => errs.push(e.message))
p.on('console', m => m.type()==='error' && errs.push(m.text()))
await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.setItem('sereneisle.v1.settings', JSON.stringify({
    baseUrl: 'http://127.0.0.1:4180/v1',
    model: 'mock-model',
    apiKey: 'test-key',
    temperature: 0.7,
    voiceURI: '',
    rate: 0.92,
    pitch: 1,
  }))
  localStorage.setItem('sereneisle.v1.intro-seen', 'true')
})
await p.goto('http://127.0.0.1:4173/chat', { waitUntil: 'networkidle' })
await p.fill('textarea[aria-label="输入消息"]', '快考试了，我一想到就心慌，晚上也睡不着')
await p.keyboard.press('Enter')
await p.waitForTimeout(1500)
await p.screenshot({ path: '.shots/chat-tool-running.png' })
await p.waitForTimeout(5000)
await p.screenshot({ path: '.shots/chat-cloud.png' })
const trace = await p.$$eval('button', bs => bs.map(b => b.textContent).filter(t => t && t.includes('检索')))
console.log('trace buttons:', trace)
console.log('errors:', errs)
await b.close()
