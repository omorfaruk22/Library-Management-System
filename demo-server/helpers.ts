import type { Plugin } from 'vite'

/**
 * JSON helpers for the preview API.
 * Kept tiny on purpose: the demo server runs inside the Vite dev process so the
 * static preview needs no database, no extra ports and no cookies.
 */

export type Json = Record<string, unknown>

export function sendJson(res: import('http').ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

export function readBody(req: import('http').IncomingMessage): Promise<Json> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) req.destroy()
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        const parsed = JSON.parse(raw)
        resolve(parsed && typeof parsed === 'object' ? (parsed as Json) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export function paged<T>(items: T[], page: number, limit: number) {
  const safePage = Math.max(1, Math.min(10_000, Number(page) || 1))
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 12))
  const start = (safePage - 1) * safeLimit
  return {
    slice: items.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: items.length,
      pages: Math.max(1, Math.ceil(items.length / safeLimit)),
    },
  }
}

/** Deterministic pastel book cover: no external image host needed in preview. */
export function coverDataUri(title: string, author: string, seed: number) {
  const palettes = [
    ['#072319', '#1d7550', '#cdf06a'],
    ['#14231b', '#2b9164', '#e8f7cf'],
    ['#0d2b23', '#17604a', '#a8e6bd'],
    ['#1c2a1f', '#3f7a52', '#d8efa6'],
    ['#0a2521', '#12725d', '#bfeccd'],
    ['#231f14', '#6b5a2a', '#f0e3b0'],
  ]
  const palette = palettes[seed % palettes.length]
  const words = title.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 14) { if (current) lines.push(current.trim()); current = word }
    else current = (current + ' ' + word).trim()
  }
  if (current) lines.push(current.trim())
  const shown = lines.slice(0, 4)
  const fontSize = shown.length > 2 ? 26 : 30
  const text = shown.map((line, index) => `<text x="46" y="${128 + index * (fontSize + 8)}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="600" fill="${palette[2]}">${escapeXml(line)}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="440" viewBox="0 0 320 440">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs>
<rect width="320" height="440" fill="url(#g)"/>
<rect x="0" y="0" width="14" height="440" fill="rgba(0,0,0,.28)"/>
<circle cx="288" cy="52" r="60" fill="rgba(255,255,255,.06)"/>
<circle cx="288" cy="52" r="88" fill="none" stroke="rgba(255,255,255,.08)"/>
<rect x="40" y="48" width="34" height="3" rx="1.5" fill="${palette[2]}" opacity=".8"/>
${text}
<text x="46" y="392" font-family="Helvetica, Arial, sans-serif" font-size="13" letter-spacing="1.4" fill="rgba(255,255,255,.62)">${escapeXml(author.slice(0, 26).toUpperCase())}</text>
<text x="46" y="412" font-family="Helvetica, Arial, sans-serif" font-size="10" letter-spacing="2.6" fill="rgba(205,240,106,.55)">LEAFLINE LIBRARY</text>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character] ?? character))
}

/** Very small cookie jar for the demo session. */
export function readCookie(req: import('http').IncomingMessage, name: string) {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function sessionCookie(value: string, maxAgeSeconds = 60 * 60 * 8) {
  return `leafline_demo=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

export function clearedSessionCookie() {
  return 'leafline_demo=; Path=/; Max-Age=0; SameSite=Lax'
}

export type DemoPluginOptions = { enabled: boolean }

export function demoApiPlugin({ enabled }: DemoPluginOptions): Plugin {
  return {
    name: 'leafline-demo-api',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) return
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()
        void handleDemoRequest(req, res, url)
      })
    },
  }
}

async function handleDemoRequest(req: import('http').IncomingMessage, res: import('http').ServerResponse, url: string) {
  const { handleDemoApi } = await import('./demoApi.js')
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readBody(req)
    const result = await handleDemoApi({ method: req.method ?? 'GET', url, body, cookie: readCookie(req, 'leafline_demo') })
    if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
    sendJson(res, result.status, result.body)
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Demo API failed.' })
  }
}
