const endpoint = process.env.TRACE_API_URL ?? 'http://127.0.0.1:4173/api/fetch-url'

async function scan(url) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const payload = await response.json()
  return { response, payload }
}

const publicScan = await scan('https://example.com')
if (!publicScan.response.ok || publicScan.payload.status !== 200 || !publicScan.payload.html?.includes('Example Domain')) {
  throw new Error(`Public URL scan failed: ${JSON.stringify(publicScan.payload)}`)
}

const privateScan = await scan('http://127.0.0.1')
if (privateScan.response.ok || !/private|internal|local/i.test(privateScan.payload.error ?? '')) {
  throw new Error(`SSRF protection failed: ${JSON.stringify(privateScan.payload)}`)
}

console.log(`fetch-url integration passed: ${publicScan.payload.finalUrl} (${publicScan.payload.bytes} bytes); private target rejected`)
