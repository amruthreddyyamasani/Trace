import dns from 'node:dns/promises'
import net from 'node:net'

export const FETCH_LIMITS = {
  timeoutMs: 10000,
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 4,
}

function isBlockedIp(address) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224
  }
  if (net.isIPv6(normalized)) {
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')
  }
  return true
}

export async function validateRemoteUrl(input) {
  let url
  try { url = new URL(input) } catch { throw new Error('Enter a complete URL beginning with https:// or http://.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http:// and https:// URLs can be scanned.')
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed.')
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Only standard HTTP and HTTPS ports are allowed.')
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === 'metadata.google.internal') throw new Error('Local and internal hostnames are not allowed.')
  const records = await dns.lookup(hostname, { all: true, verbatim: true })
  if (!records.length || records.some(({ address }) => isBlockedIp(address))) throw new Error('The URL resolves to a private or internal network address, which TRACE will not fetch.')
  url.hostname = hostname
  return url
}

async function readLimited(response) {
  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > FETCH_LIMITS.maxBytes) throw new Error('The response is larger than TRACE’s 5 MB limit.')
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > FETCH_LIMITS.maxBytes) throw new Error('The response is larger than TRACE’s 5 MB limit.')
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))))
}

export async function fetchRemoteHtml(input) {
  let current = await validateRemoteUrl(input)
  for (let redirect = 0; redirect <= FETCH_LIMITS.maxRedirects; redirect += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_LIMITS.timeoutMs)
    let response
    try {
      response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5', 'user-agent': 'TRACE-evidence-fetcher/0.1' } })
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('The site did not respond within TRACE’s 10 second timeout.')
      throw new Error('The site could not be reached from the TRACE server.')
    } finally { clearTimeout(timer) }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error(`The site returned redirect ${response.status} without a destination.`)
      if (redirect === FETCH_LIMITS.maxRedirects) throw new Error('The site redirected too many times.')
      current = await validateRemoteUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) throw new Error(`The site returned HTTP ${response.status}.`)
    const contentType = response.headers.get('content-type') || ''
    if (contentType && !/(text\/html|application\/xhtml\+xml|text\/plain)/i.test(contentType)) throw new Error(`The site returned ${contentType}, not HTML.`)
    const html = await readLimited(response)
    return { html, finalUrl: current.toString(), status: response.status, contentType, bytes: Buffer.byteLength(html) }
  }
  throw new Error('The site could not be fetched safely.')
}
