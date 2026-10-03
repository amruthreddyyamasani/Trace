const endpoint = process.env.TRACE_RENDER_API_URL ?? 'http://127.0.0.1:4173/api/render-url'

async function render(url) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return { response, payload: await response.json() }
}

const publicRender = await render('https://example.com')
if (!publicRender.response.ok || !publicRender.payload.available || publicRender.payload.viewports?.length !== 3) {
  throw new Error(`Rendered viewport scan failed: ${JSON.stringify(publicRender.payload)}`)
}
const mobile = publicRender.payload.viewports.find((viewport) => viewport.id === 'mobile')
if (!mobile || mobile.width !== 390 || typeof mobile.metrics.bodyScrollWidth !== 'number' || !mobile.screenshot?.startsWith('data:image/jpeg;base64,')) {
  throw new Error(`Rendered evidence is incomplete: ${JSON.stringify(mobile)}`)
}

const privateRender = await render('http://127.0.0.1')
if (!privateRender.response.ok || privateRender.payload.available || !/private|internal|local/i.test(privateRender.payload.reason ?? '')) {
  throw new Error(`Renderer SSRF protection failed: ${JSON.stringify(privateRender.payload)}`)
}

console.log(`render-url integration passed: ${publicRender.payload.viewports.map((viewport) => `${viewport.id} ${viewport.width}x${viewport.height}`).join(', ')}; private target rejected`)
