import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeVercelUrl } from './path.js'

describe('Vercel API path adapter', () => {
  it('restores the incoming API path and keeps client query parameters', () => {
    expect(normalizeVercelUrl('/api/index?__vercel_path=%2Fapi%2Fbooks&q=typescript&page=2'))
      .toBe('/api/books?q=typescript&page=2')
  })
  it('does not accept paths outside the API prefix', () => {
    expect(normalizeVercelUrl('/api/index?__vercel_path=%2Fdashboard'))
      .toBe('/api/index?__vercel_path=%2Fdashboard')
  })
  it('leaves ordinary local or direct function URLs untouched', () => {
    expect(normalizeVercelUrl('/api/auth/login')).toBe('/api/auth/login')
  })

  it('keeps the Vercel rewrite pointed at the extensionless function route', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { outputDirectory: string; functions: Record<string, { maxDuration: number }>; rewrites: Array<{ source: string; destination: string }> }
    expect(config.outputDirectory).toBe('dist')
    expect(config.functions['api/index.ts']?.maxDuration).toBeGreaterThan(0)
    expect(config.rewrites[0]).toEqual({ source: '/api/:path*', destination: '/api/index?__vercel_path=/api/:path*' })
  })
})
