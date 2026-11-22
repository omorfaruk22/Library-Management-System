import type { Request, Response } from 'express'
import app from '../server/src/app.js'
import { normalizeVercelUrl } from './path.js'
import { validateServerEnvironment } from '../server/src/env.js'
import { handleDemoApi } from '../demo-server/demoApi.js'

/** Preview deployments have no Atlas database; serve the sample dataset instead. */
function previewMode() {
  return process.env.VERCEL_ENV === 'preview' && !process.env.MONGODB_URI
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function servePreview(req: Request, res: Response) {
  const url = normalizeVercelUrl(req.url) ?? req.url ?? '/api'
  const body = req.method === 'GET' || req.method === 'HEAD' ? {} : (req.body ?? {})
  const result = await handleDemoApi({ method: req.method ?? 'GET', url, body, cookie: readCookie(req.headers.cookie, 'leafline_demo') })
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
  res.setHeader('Cache-Control', 'no-store')
  if (typeof result.body === 'string') return res.status(result.status).send(result.body)
  return res.status(result.status).json(result.body)
}

export default async function handler(req: Request, res: Response) {
  if (previewMode()) {
    try { return await servePreview(req, res) }
    catch { return res.status(500).json({ error: 'Preview data service failed.' }) }
  }
  try { validateServerEnvironment() }
  catch { return res.status(500).json({ error: 'Server environment configuration is incomplete.' }) }
  req.url = normalizeVercelUrl(req.url) ?? req.url
  return app(req, res)
}
