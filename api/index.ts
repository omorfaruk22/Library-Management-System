import type { Request, Response } from 'express'
import app from '../server/src/app.js'
import { normalizeVercelUrl } from './path.js'
import { validateServerEnvironment } from '../server/src/env.js'

export default function handler(req: Request, res: Response) {
  try { validateServerEnvironment() }
  catch { return res.status(500).json({ error: 'Server environment configuration is incomplete.' }) }
  req.url = normalizeVercelUrl(req.url) ?? req.url
  return app(req, res)
}
