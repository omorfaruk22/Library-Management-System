// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { handleDemoApi } from '../../demo-server/demoApi'
import { AuthProvider } from '../auth'
import { LocaleProvider } from '../i18n'
import { Layout } from '../ui/layout'
import App from '../App'

/**
 * Renders the real screens in jsdom against the preview dataset, so the shipped
 * UI can be verified without a browser. `fetch` is routed to the demo API.
 */

let cookie: string | null = null

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

beforeEach(() => {
  cookie = null
  window.localStorage.clear()
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const url = raw.replace(/^https?:\/\/[^/]+/, '')
    const result = await handleDemoApi({
      method: init?.method ?? 'GET',
      url: url.startsWith('/api') ? url : '/api' + url,
      body: init?.body ? JSON.parse(String(init.body)) : {},
      cookie,
    })
    if (result.setCookie) cookie = result.setCookie.split('=')[1]?.split(';')[0] ?? null
    return typeof result.body === 'string' ? jsonResponse(result.body, result.status) : jsonResponse(result.body, result.status)
  })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
  vi.stubGlobal('scrollTo', () => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: 0, gcTime: 0 }, mutations: { retry: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocaleProvider>
          <AuthProvider>
            <Layout>
              <App />
            </Layout>
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function signInAs(role: 'admin' | 'student') {
  const path = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/login'
  const email = role === 'admin' ? 'admin@leafline.example' : 'nusrat.jahan@example.com'
  const response = await fetch(path, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) })
  expect(response.ok).toBe(true)
}

const waitForText = (pattern: RegExp, timeout = 8000) =>
  waitFor(() => expect(document.body.textContent).toMatch(pattern), { timeout })

async function expectPage(path: string, pattern: RegExp) {
  const view = renderRoute(path)
  await waitForText(pattern)
  view.unmount()
}

describe('rendered screens', () => {
  it('renders the landing page with the new brand and a live catalogue', async () => {
    renderRoute('/')
    expect((await screen.findAllByText('Leafline Library')).length).toBeGreaterThan(0)
    await waitForText(/Clean Code|The Pragmatic Programmer|Sapiens/)
  })

  it('renders the catalogue and a book detail page', async () => {
    await expectPage('/books', /Clean Code/)
    await expectPage('/books/book_1', /LIB-0001/)
    await expectPage('/books/book_1', /A-1 · Programming/)
  })

  it('renders the student dashboard and member tools', async () => {
    await signInAs('student')
    await expectPage('/dashboard', /Nusrat Jahan|Issued|Active loans/i)
    await expectPage('/issued-books', /Clean Code|The God of Small Things/)
    await expectPage('/wishlist', /Designing Data-Intensive Applications/)
    await expectPage('/reservations', /Head First Java|Waiting|Queue/i)
    await expectPage('/profile', /Nusrat Jahan/)
    await expectPage('/change-password', /password/i)
  })

  it('renders the admin dashboard and library screens', async () => {
    await signInAs('admin')
    await expectPage('/dashboard', /Registered|Issued|Overdue/i)
    await expectPage('/admin/books', /The Phoenix Project|Building Microservices/)
    await expectPage('/admin/inventory', /Restock|Low stock|Movement/i)
    await expectPage('/admin/students', /Nusrat Jahan/)
    await expectPage('/admin/issued-books', /Clean Code|The God of Small Things/)
    await expectPage('/admin/reports', /Overdue|Fines|Active loans/i)
    await expectPage('/admin/settings', /Loan period|Fine|Active loan limit/i)
    await expectPage('/admin/categories', /Programming/)
    await expectPage('/admin/authors', /Robert C\. Martin/)
  })

  it('renders the business desk', async () => {
    await signInAs('admin')
    await expectPage('/admin/sales', /SL-100241|Record sale/i)
    await expectPage('/admin/purchases', /PR-100118|purchase/i)
    await expectPage('/admin/suppliers', /Boipath Distributors/)
    await expectPage('/admin/expenses', /Reading room electricity/)
    await expectPage('/admin/analytics', /Revenue|Top|Borrow/i)
  })

  it('shows the sample-data hint on the sign-in screens', async () => {
    renderRoute('/login')
    expect(await screen.findByText(/Preview mode — sample data/i)).toBeTruthy()
    await waitFor(() => expect(document.body.textContent).toMatch(/nusrat\.jahan@example\.com/))
    cleanup()
    renderRoute('/admin-login')
    await waitFor(() => expect(document.body.textContent).toMatch(/admin@leafline\.example/))
  })
})
