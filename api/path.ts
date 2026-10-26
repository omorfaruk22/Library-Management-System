export function normalizeVercelUrl(requestUrl: string | undefined): string | undefined {
  if (!requestUrl) return requestUrl
  const url = new URL(requestUrl, 'http://vercel.internal')
  const originalPath = url.searchParams.get('__vercel_path')
  if (!originalPath || !(originalPath === '/api' || originalPath.startsWith('/api/'))) return requestUrl
  url.searchParams.delete('__vercel_path')
  return originalPath + (url.search ? url.search : '')
}
