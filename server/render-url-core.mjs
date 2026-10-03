import fs from 'node:fs'
import process from 'node:process'
import { chromium } from 'playwright-core'
import { fetchRemoteHtml } from './fetch-url-core.mjs'

export const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'laptop', width: 1280, height: 800 },
  { id: 'mobile', width: 390, height: 844 },
]

function chromiumPath() {
  const candidates = [process.env.TRACE_CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate))
}

const measurementScript = () => {
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const rect = (element) => {
    const box = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
      text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(),
      x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height),
      right: Math.round(box.right), bottom: Math.round(box.bottom),
      position: style.position, fontSize: style.fontSize, lineHeight: style.lineHeight,
      visible: box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
    }
  }
  const all = [...document.querySelectorAll('body *')].filter((element) => {
    const box = element.getBoundingClientRect()
    return box.width > 0 && box.height > 0
  })
  const elements = all.map(rect)
  const overflow = elements.filter((item) => item.right > viewport.width + 1 || item.x < -1).sort((a, b) => b.right - a.right).slice(0, 12)
  const fixed = elements.filter((item) => item.position === 'fixed').slice(0, 12)
  const headings = elements.filter((item) => /^h[1-6]$/.test(item.tag)).slice(0, 12)
  const bodyText = document.body?.innerText || ''
  const bodyScrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0)
  const bodyScrollHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0)
  const images = [...document.images].map(rect)
  const controls = [...document.querySelectorAll('button, a, input, select, textarea')].map(rect)
  return {
    viewport, bodyScrollWidth, bodyScrollHeight,
    horizontalOverflow: bodyScrollWidth > viewport.width + 1,
    verticalOverflow: bodyScrollHeight > viewport.height + 1,
    overflow, fixed, headings, images, controls,
    textLength: bodyText.trim().length,
  }
}

function evidenceScreenshot(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

export async function renderRemotePage(url) {
  const executablePath = chromiumPath()
  if (!executablePath) return { available: false, reason: 'No supported Chromium executable is available in the TRACE runtime.' }
  const safeUrl = (await fetchRemoteHtml(url)).finalUrl

  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    const results = []
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
      try {
        await page.goto(safeUrl, { waitUntil: 'networkidle', timeout: 12000 })
      } catch (error) {
        if (!page.url()) throw error
      }
      await page.waitForTimeout(500)
      const metrics = await page.evaluate(measurementScript)
      const screenshot = await page.screenshot({ type: 'png', fullPage: false })
      results.push({ ...viewport, metrics, screenshot: evidenceScreenshot(screenshot) })
      await page.close()
    }
    return { available: true, url: safeUrl, viewports: results }
  } finally {
    await browser.close()
  }
}
