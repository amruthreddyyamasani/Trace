import fs from 'node:fs'
import process from 'node:process'
import { chromium } from 'playwright-core'
import { fetchRemoteHtml } from './fetch-url-core.mjs'

export const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'laptop', width: 1280, height: 800 },
  { id: 'mobile', width: 390, height: 844 },
]
const MAX_ROUTES = 3

function chromiumPath() {
  const candidates = [process.env.TRACE_CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate))
}

const measurementScript = () => {
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const selectorFor = (element) => {
    if (element.id) return `#${CSS.escape(element.id)}`
    const parts = []
    let current = element
    while (current && current.nodeType === 1 && current !== document.body && parts.length < 5) {
      let part = current.tagName.toLowerCase()
      const classes = typeof current.className === 'string' ? current.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : []
      if (classes.length) part += `.${classes.map((name) => CSS.escape(name)).join('.')}`
      const siblings = current.parentElement ? [...current.parentElement.children].filter((item) => item.tagName === current.tagName) : []
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`
      parts.unshift(part)
      current = current.parentElement
    }
    return parts.join(' > ')
  }
  const rect = (element) => {
    const box = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return {
      tag: element.tagName.toLowerCase(), id: element.id || '',
      className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
      text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      selector: selectorFor(element), x: Math.round(box.x), y: Math.round(box.y),
      width: Math.round(box.width), height: Math.round(box.height), right: Math.round(box.right), bottom: Math.round(box.bottom),
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
  const fixed = elements.filter((item) => item.position === 'fixed' || item.position === 'sticky').slice(0, 12)
  const headings = elements.filter((item) => /^h[1-6]$/.test(item.tag)).slice(0, 12)
  const textBlocks = elements.filter((item) => /^(p|li|label|button|a)$/.test(item.tag) && item.text.length > 0).slice(0, 80)
  const regions = elements.filter((item) => /^(header|nav|main|section|article|aside|footer|form)$/.test(item.tag)).slice(0, 40)
  const bodyText = document.body?.innerText || ''
  const bodyScrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0)
  const bodyScrollHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0)
  const images = [...document.images].map(rect)
  const controls = [...document.querySelectorAll('button, a, input, select, textarea')].map(rect)
  return { viewport, bodyScrollWidth, bodyScrollHeight, horizontalOverflow: bodyScrollWidth > viewport.width + 1, verticalOverflow: bodyScrollHeight > viewport.height + 1, overflow, fixed, headings, images, controls, regions, textBlocks, textLength: bodyText.trim().length }
}

const routeDiscoveryScript = (origin) => [...document.querySelectorAll('a[href]')].map((anchor) => {
  try {
    const link = new URL(anchor.href, origin)
    return link.origin === origin ? `${link.pathname}${link.search}` : null
  } catch { return null }
}).filter(Boolean)

function evidenceScreenshot(buffer) {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

async function renderViewport(browser, url, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
  } catch (error) {
    if (!page.url()) throw error
  }
  await page.waitForTimeout(500)
  const metrics = await page.evaluate(measurementScript)
  const screenshot = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false })
  const targets = [...new Set([
    ...metrics.overflow.slice(0, 2),
    ...metrics.fixed.filter((item) => item.right > viewport.width + 1 || item.x < -1).slice(0, 1),
    ...metrics.controls.filter((item) => item.width < 44 && item.height < 44).slice(0, 1),
  ].map((item) => item.selector).filter(Boolean))]
  const highlights = []
  for (const selector of targets) {
    try {
      await page.evaluate((value) => {
        const element = document.querySelector(value)
        if (element) {
          element.setAttribute('data-trace-highlight', 'true')
          const style = document.createElement('style')
          style.textContent = '[data-trace-highlight="true"]{outline:2px solid #ff6b5e!important;outline-offset:3px!important;background-color:rgba(255,107,94,.08)!important}'
          document.head.appendChild(style)
        }
      }, selector)
      const highlighted = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false })
      highlights.push({ selector, screenshot: evidenceScreenshot(highlighted) })
      await page.evaluate(() => document.querySelectorAll('[data-trace-highlight]').forEach((element) => element.removeAttribute('data-trace-highlight')))
    } catch { /* an unstable selector must not block the rest of the scan */ }
  }
  await page.close()
  return { ...viewport, metrics, screenshot: evidenceScreenshot(screenshot), highlights }
}

export async function renderRemotePage(url) {
  const executablePath = chromiumPath()
  if (!executablePath) return { available: false, reason: 'No supported Chromium executable is available in the TRACE runtime.' }
  const safeUrl = (await fetchRemoteHtml(url)).finalUrl
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    const origin = new URL(safeUrl).origin
    const discoveryPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    let routes = ['/']
    try {
      await discoveryPage.goto(safeUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      const discovered = await discoveryPage.evaluate(routeDiscoveryScript, origin)
      routes = [...new Set(['/', ...discovered])].slice(0, MAX_ROUTES)
    } finally { await discoveryPage.close() }
    const routeEvidence = []
    for (const route of routes) {
      const routeUrl = new URL(route, safeUrl).toString()
      const viewports = []
      for (const viewport of VIEWPORTS) viewports.push(await renderViewport(browser, routeUrl, viewport))
      routeEvidence.push({ route, viewports })
    }
    return { available: true, url: safeUrl, routes: routeEvidence, viewports: routeEvidence[0]?.viewports ?? [] }
  } finally {
    await browser.close()
  }
}
