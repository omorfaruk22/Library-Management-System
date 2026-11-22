import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleDollarSign, Landmark, Pencil, Plus, Printer, Receipt, ShoppingCart, Trash2, TrendingDown, Truck, Wallet } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, IconButton, Input, Modal, PageTitle, Select, SkeletonRows, StatCard, Textarea } from '../ui/primitives'
import { api, currency, date, message } from '../lib/api'
import { useLocale } from '../i18n'

type Book = { _id: string; title: string; isbn: string; price: number; availableCopies: number }
type Supplier = { _id: string; name: string; phone?: string; email?: string; address?: string; notes?: string; status: string }
type Line = { book: string; quantity: number; unitPrice: number }
type Finance = {
  _id: string; invoiceNo: string; customerName?: string; customerPhone?: string; supplier?: Supplier | string; total: number
  paidAmount: number; balanceDue: number; paymentStatus: string; createdAt: string; receivedAt?: string
  subtotal?: number; discount?: number; paymentMethod?: string
  items: Array<{ title: string; quantity: number; unitPrice: number; lineTotal: number }>
}
type Expense = { _id: string; description: string; category: string; amount: number; paymentMethod: string; incurredAt: string; notes?: string }

const blank = (): Line => ({ book: '', quantity: 1, unitPrice: 0 })

function useBooks() {
  const [books, setBooks] = useState<Book[]>([])
  useEffect(() => { void api<{ books: Book[] }>('/admin/books?limit=100').then((result) => setBooks(result.books)).catch(() => {}) }, [])
  return books
}

function LineEditor({ lines, setLines, books, purchase = false }: { lines: Line[]; setLines: (value: Line[]) => void; books: Book[]; purchase?: boolean }) {
  const { locale } = useLocale()
  const bn = locale === 'bn'
  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => (
        <div key={index} className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-[1fr_96px_130px_auto] sm:items-end">
          <Select label={bn ? 'বই' : 'Book'} value={line.book} onChange={(event) => {
            const picked = books.find((book) => book._id === event.target.value)
            setLines(lines.map((item, position) => position === index ? { ...item, book: event.target.value, unitPrice: purchase ? item.unitPrice : picked?.price ?? 0 } : item))
          }}>
            <option value="">{bn ? 'বই নির্বাচন' : 'Select book'}</option>
            {books.map((book) => <option key={book._id} value={book._id}>{book.title} · {book.availableCopies} left</option>)}
          </Select>
          <Input label={bn ? 'পরিমাণ' : 'Qty'} type="number" min="1" value={line.quantity} onChange={(event) => setLines(lines.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item))} />
          <Input label={purchase ? (bn ? 'ক্রয়মূল্য' : 'Unit cost') : (bn ? 'একক দাম' : 'Unit price')} type="number" min="0" value={line.unitPrice} onChange={(event) => setLines(lines.map((item, position) => position === index ? { ...item, unitPrice: Number(event.target.value) } : item))} />
          <div className="flex items-center gap-2 pb-0.5">
            <span className="whitespace-nowrap text-[12px] font-semibold text-slate-600">{currency(line.quantity * line.unitPrice)}</span>
            <IconButton label="Remove line" icon={Trash2} onClick={() => setLines(lines.filter((_, position) => position !== index))} disabled={lines.length === 1} />
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => setLines([...lines, blank()])}><Plus size={14} />{bn ? 'বই যোগ করুন' : 'Add another book'}</Button>
    </div>
  )
}

function Method({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { locale } = useLocale()
  const bn = locale === 'bn'
  return (
    <Select label={bn ? 'পেমেন্ট মাধ্যম' : 'Payment method'} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="cash">{bn ? 'নগদ' : 'Cash'}</option>
      <option value="mobile">{bn ? 'মোবাইল ব্যাংকিং' : 'Mobile banking'}</option>
      <option value="card">{bn ? 'কার্ড' : 'Card'}</option>
      <option value="bank">{bn ? 'ব্যাংক' : 'Bank transfer'}</option>
    </Select>
  )
}

function FinanceTable({ rows, kind, reload }: { rows: Finance[]; kind: 'sales' | 'purchases'; reload: () => void }) {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const [printing, setPrinting] = useState<Finance | null>(null)
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[880px]">
        <thead>
          <tr>
            <th>{bn ? 'ইনভয়েস' : 'Invoice'}</th><th>{bn ? 'তারিখ' : 'Date'}</th><th>{bn ? 'আইটেম' : 'Items'}</th>
            <th className="text-right">{bn ? 'মোট' : 'Total'}</th><th className="text-right">{bn ? 'পরিশোধ' : 'Paid'}</th>
            <th className="text-right">{bn ? 'বাকি' : 'Due'}</th><th>{bn ? 'অবস্থা' : 'Status'}</th><th className="text-right">{bn ? 'আদায়' : 'Collect'}</th><th className="no-print text-right">{bn ? 'প্রিন্ট' : 'Print'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id}>
              <td>
                <span className="block font-semibold text-slate-900">{row.invoiceNo}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                  {kind === 'sales' ? row.customerName : typeof row.supplier === 'object' ? row.supplier?.name : 'Supplier'}
                </span>
              </td>
              <td className="whitespace-nowrap text-[12px] text-slate-500">{date(row.createdAt)}</td>
              <td className="max-w-[220px] truncate text-[12px] text-slate-600">{row.items.map((item) => `${item.title} ×${item.quantity}`).join(', ')}</td>
              <td className="text-right font-semibold text-slate-800">{currency(row.total)}</td>
              <td className="text-right text-slate-600">{currency(row.paidAmount)}</td>
              <td className={'text-right font-semibold ' + (row.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700')}>{currency(row.balanceDue)}</td>
              <td><Badge tone={row.paymentStatus === 'paid' ? 'green' : row.paymentStatus === 'partial' ? 'amber' : 'red'}>{row.paymentStatus}</Badge></td>
              <td className="text-right">{row.balanceDue > 0 ? <Collect id={row._id} kind={kind} reload={reload} /> : <span className="text-[11.5px] text-slate-400">Settled</span>}</td>
              <td className="no-print text-right"><IconButton label={bn ? 'ইনভয়েস প্রিন্ট' : 'Print invoice'} icon={Printer} onClick={() => setPrinting(row)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {printing && (
        <Modal
          title={`${kind === 'sales' ? t('invoice') : t('purchases')} · ${printing.invoiceNo}`}
          description={bn ? 'প্রিন্ট করুন অথবা PDF হিসেবে সেভ করুন।' : 'Print it, or save it as a PDF from the print dialog.'}
          onClose={() => setPrinting(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setPrinting(null)}>{t('cancel')}</Button>
            <Button onClick={() => window.print()}><Printer size={15} />{bn ? 'প্রিন্ট / PDF' : 'Print / save PDF'}</Button>
          </>}
        >
          <div id="invoice-print" className="rounded-xl border border-slate-200 p-4">
            <InvoiceDocument record={printing} kind={kind} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function Collect({ id, kind, reload }: { id: string; kind: 'sales' | 'purchases'; reload: () => void }) {
  const { locale } = useLocale()
  const [amount, setAmount] = useState('')
  return (
    <form className="inline-flex items-center gap-1" onSubmit={async (event) => {
      event.preventDefault()
      try {
        await api(`/admin/business/${kind}/${id}/payments`, { method: 'POST', body: JSON.stringify({ amount: Number(amount), paymentMethod: 'cash' }) })
        setAmount(''); reload()
      } catch (error) { window.alert(message(error)) }
    }}>
      <input aria-label="Payment amount" className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-[12px]" type="number" min="1" placeholder={locale === 'bn' ? 'টাকা' : 'Amount'} value={amount} onChange={(event) => setAmount(event.target.value)} required />
      <Button size="sm" className="h-8">{locale === 'bn' ? 'আদায়' : 'Collect'}</Button>
    </form>
  )
}

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', mobile: 'Mobile banking', card: 'Card', bank: 'Bank transfer' }

/** Printable invoice. Hidden on screen, shown by the print stylesheet. */
function InvoiceDocument({ record, kind }: { record: Finance; kind: 'sales' | 'purchases' }) {
  const { t } = useLocale()
  const supplierName = typeof record.supplier === 'object' ? record.supplier?.name : record.supplier
  const counterparty = kind === 'sales' ? record.customerName || 'Walk-in customer' : supplierName || 'Supplier'
  return (
    <div className="invoice-sheet space-y-5 text-[12.5px] text-slate-800">
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
        <div>
          <p className="font-display text-lg font-semibold text-brand-900">Leafline Library</p>
          <p className="mt-1 text-[11.5px] leading-5 text-slate-500">{t('brand')} · Chattogram, Bangladesh</p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-400">{kind === 'sales' ? 'Sales invoice' : 'Purchase record'}</p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{record.invoiceNo}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-500">{date(record.createdAt)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{kind === 'sales' ? 'Customer' : 'Supplier'}</p>
          <p className="mt-1 font-semibold text-slate-900">{counterparty}</p>
          {kind === 'sales' && record.customerPhone && <p className="text-[11.5px] text-slate-500">{record.customerPhone}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Payment</p>
          <p className="mt-1 font-semibold capitalize text-slate-900">{METHOD_LABEL[record.paymentMethod ?? ''] ?? record.paymentMethod ?? '—'}</p>
          <p className="text-[11.5px] capitalize text-slate-500">{record.paymentStatus}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-slate-200 text-left text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
            <th className="py-2 font-semibold">Item</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">{kind === 'sales' ? 'Price' : 'Cost'}</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {record.items.map((item, index) => (
            <tr key={`${item.title}-${index}`} className="border-b border-slate-100">
              <td className="py-2 pr-2">{item.title}</td>
              <td className="py-2 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">{currency(item.unitPrice)}</td>
              <td className="py-2 text-right font-medium tabular-nums">{currency(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ml-auto w-full max-w-[260px] space-y-1.5">
        <Row label="Subtotal" value={currency(record.subtotal ?? record.total + (record.discount ?? 0))} />
        {record.discount ? <Row label="Discount" value={`− ${currency(record.discount)}`} /> : null}
        <Row label="Total" value={currency(record.total)} strong />
        <Row label="Paid" value={currency(record.paidAmount)} />
        <Row label="Balance due" value={currency(record.balanceDue)} strong />
      </section>

      <p className="border-t border-slate-200 pt-3 text-[10.5px] leading-5 text-slate-400">
        Generated from the Leafline circulation ledger. Books sold are deducted from lendable stock; returns and exchanges follow the library refund policy.
      </p>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={'flex items-baseline justify-between gap-3 ' + (strong ? 'text-slate-900' : 'text-slate-600')}>
      <span className={strong ? 'font-semibold' : ''}>{label}</span>
      <span className={'tabular-nums ' + (strong ? 'font-display text-[13.5px] font-semibold' : '')}>{value}</span>
    </div>
  )
}

function PageAction({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{children}</Link>
}

export function SalesPage() {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const books = useBooks()
  const [rows, setRows] = useState<Finance[]>([])
  const [loading, setLoading] = useState(true)
  const [lines, setLines] = useState<Line[]>([blank()])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [discount, setDiscount] = useState('0')
  const [paid, setPaid] = useState('')
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    setLoading(true)
    api<{ sales: Finance[] }>('/admin/business/sales').then((result) => setRows(result.sales)).catch((err) => setError(message(err))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const total = Math.max(0, subtotal - Number(discount || 0))
  const paidNow = paid === '' ? total : Number(paid)
  const dues = rows.reduce((sum, row) => sum + row.balanceDue, 0)

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await api('/admin/business/sales', { method: 'POST', body: JSON.stringify({ items: lines, discount: Number(discount), paidAmount: paidNow, paymentMethod: method, customerName: name || 'Walk-in customer', customerPhone: phone }) })
      setLines([blank()]); setName(''); setPhone(''); setDiscount('0'); setPaid('')
      setNotice(bn ? 'বিক্রি নথিভুক্ত হয়েছে।' : 'Sale recorded and stock updated.')
      load()
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageTitle eyebrow={t('businessGroup')} title={bn ? 'বিক্রি / POS' : 'Sales / POS'} description={bn ? 'বিক্রি, ইনভয়েস ও বকেয়া আদায়।' : 'Sell from the same catalogue you lend from. Stock and dues update together.'} action={<PageAction to="/admin/analytics">{t('analytics')} →</PageAction>} />
      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label={bn ? 'আজকের বিক্রি' : 'Sales today'} value={currency(rows.filter((row) => new Date(row.createdAt).toDateString() === new Date().toDateString()).reduce((sum, row) => sum + row.total, 0))} icon={ShoppingCart} tone="lime" />
        <StatCard label={t('receivables')} value={currency(dues)} icon={CircleDollarSign} tone={dues ? 'amber' : 'brand'} />
        <StatCard label={bn ? 'ইনভয়েস' : 'Invoices'} value={rows.length} hint="Most recent 100" icon={Receipt} tone="teal" />
      </div>

      <form onSubmit={submit} className="mb-6">
        <Card>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Input label={bn ? 'ক্রেতার নাম' : 'Customer name'} value={name} onChange={(event) => setName(event.target.value)} placeholder="Walk-in customer" />
            <Input label={bn ? 'ফোন' : 'Phone'} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <LineEditor lines={lines} setLines={setLines} books={books} />
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <Input label={bn ? 'ডিসকাউন্ট' : 'Discount'} type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            <Input label={bn ? 'এখন পরিশোধ' : 'Paid now'} type="number" min="0" value={paid} placeholder={String(total)} onChange={(event) => setPaid(event.target.value)} />
            <Method value={method} onChange={setMethod} />
            <div className="flex flex-col justify-end gap-1.5">
              <div className="flex items-baseline justify-between text-[12px] text-slate-500"><span>Total</span><strong className="font-display text-lg text-brand-800">{currency(total)}</strong></div>
              <Button type="submit" loading={busy} disabled={lines.some((line) => !line.book)}><ShoppingCart size={15} />{bn ? 'বিক্রি রেকর্ড' : 'Record sale'}</Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Only available copies can be sold. A paid amount below the total books the balance as a receivable.</p>
        </Card>
      </form>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'সাম্প্রতিক বিক্রি' : 'Recent sales'}</h2>
          <Badge tone="slate">{rows.length} invoices</Badge>
        </div>
        {loading ? <SkeletonRows rows={4} /> : rows.length ? <FinanceTable rows={rows} kind="sales" reload={load} /> : <EmptyState icon={Receipt} title={bn ? 'এখনো কোনো বিক্রি নেই' : 'No sales yet'} description="Record the first sale above." />}
      </Card>
    </>
  )
}

export function PurchasesPage() {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const books = useBooks()
  const [rows, setRows] = useState<Finance[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState('')
  const [supplierInvoice, setSupplierInvoice] = useState('')
  const [lines, setLines] = useState<Line[]>([blank()])
  const [discount, setDiscount] = useState('0')
  const [paid, setPaid] = useState('')
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    setLoading(true)
    api<{ purchases: Finance[] }>('/admin/business/purchases').then((result) => setRows(result.purchases)).catch((err) => setError(message(err))).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
    void api<{ suppliers: Supplier[] }>('/admin/business/suppliers').then((result) => {
      const active = result.suppliers.filter((item) => item.status === 'active')
      setSuppliers(active); setSupplier((current) => current || active[0]?._id || '')
    }).catch((err) => setError(message(err)))
  }, [load])
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const total = Math.max(0, subtotal - Number(discount || 0))
  const payables = rows.reduce((sum, row) => sum + row.balanceDue, 0)

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await api('/admin/business/purchases', { method: 'POST', body: JSON.stringify({ supplier, supplierInvoice, items: lines, discount: Number(discount), paidAmount: paid === '' ? total : Number(paid), paymentMethod: method }) })
      setLines([blank()]); setSupplierInvoice(''); setDiscount('0'); setPaid('')
      setNotice(bn ? 'স্টক গ্রহণ নথিভুক্ত হয়েছে।' : 'Stock received and recorded.')
      load()
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageTitle eyebrow={t('businessGroup')} title={bn ? 'ক্রয় ও স্টক গ্রহণ' : 'Purchases & stock receiving'} description={bn ? 'সাপ্লায়ার ইনভয়েস ও স্টক যোগ করুন।' : 'Record supplier invoices; received copies increase total and available stock.'} action={<PageAction to="/admin/suppliers"><Landmark size={15} />{t('suppliers')}</PageAction>} />
      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label={t('payables')} value={currency(payables)} icon={Truck} tone={payables ? 'amber' : 'brand'} />
        <StatCard label={bn ? 'ক্রয় রেকর্ড' : 'Purchase records'} value={rows.length} hint="Most recent 100" icon={Receipt} tone="teal" />
        <StatCard label={t('suppliers')} value={suppliers.length} hint="Active vendors" icon={Landmark} tone="lime" />
      </div>

      {!suppliers.length && <div className="mb-4"><Alert tone="info" message={bn ? 'স্টক গ্রহণের আগে একজন সাপ্লায়ার যোগ করুন।' : 'Add a supplier before receiving stock.'} /></div>}

      <form onSubmit={submit} className="mb-6">
        <Card>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Select label={bn ? 'সাপ্লায়ার' : 'Supplier'} value={supplier} onChange={(event) => setSupplier(event.target.value)} required>
              <option value="">{bn ? 'সাপ্লায়ার নির্বাচন' : 'Select supplier'}</option>
              {suppliers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>
            <Input label={bn ? 'সাপ্লায়ারের ইনভয়েস' : 'Supplier invoice ref'} value={supplierInvoice} onChange={(event) => setSupplierInvoice(event.target.value)} placeholder="INV-2026-001" />
          </div>
          <LineEditor lines={lines} setLines={setLines} books={books} purchase />
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <Input label={bn ? 'ডিসকাউন্ট' : 'Discount'} type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            <Input label={bn ? 'এখন পরিশোধ' : 'Paid now'} type="number" min="0" value={paid} placeholder={String(total)} onChange={(event) => setPaid(event.target.value)} />
            <Method value={method} onChange={setMethod} />
            <div className="flex flex-col justify-end gap-1.5">
              <div className="flex items-baseline justify-between text-[12px] text-slate-500"><span>Total</span><strong className="font-display text-lg text-brand-800">{currency(total)}</strong></div>
              <Button type="submit" loading={busy} disabled={!supplier || lines.some((line) => !line.book)}><Truck size={15} />{bn ? 'স্টক গ্রহণ' : 'Receive stock'}</Button>
            </div>
          </div>
        </Card>
      </form>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'সাম্প্রতিক ক্রয়' : 'Recent purchases'}</h2>
          <Badge tone="slate">{rows.length} records</Badge>
        </div>
        {loading ? <SkeletonRows rows={4} /> : rows.length ? <FinanceTable rows={rows} kind="purchases" reload={load} /> : <EmptyState icon={Truck} title={bn ? 'এখনো ক্রয় নেই' : 'No purchases yet'} description="Receive your first supplier delivery above." />}
      </Card>
    </>
  )
}

export function SuppliersPage() {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' })
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    setLoading(true)
    api<{ suppliers: Supplier[] }>('/admin/business/suppliers').then((result) => setRows(result.suppliers)).catch((err) => setError(message(err))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <>
      <PageTitle eyebrow={t('businessGroup')} title={t('suppliers')} description={bn ? 'বই সরবরাহকারী ও যোগাযোগের তথ্য।' : 'Book vendors, contact details and receiving status.'} action={<PageAction to="/admin/purchases"><Truck size={15} />{t('purchases')}</PageAction>} />
      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}

      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <Card>
          <h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'নতুন সাপ্লায়ার' : 'Add a supplier'}</h2>
          <form className="mt-4 space-y-3" onSubmit={async (event) => {
            event.preventDefault(); setBusy(true); setError('')
            try {
              await api('/admin/business/suppliers', { method: 'POST', body: JSON.stringify(form) })
              setForm({ name: '', phone: '', email: '', address: '', notes: '' })
              setNotice(bn ? 'সাপ্লায়ার যোগ হয়েছে।' : 'Supplier added.')
              load()
            } catch (err) { setError(message(err)) } finally { setBusy(false) }
          }}>
            <Input label={t('name')} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={bn ? 'ফোন' : 'Phone'} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <Input label={bn ? 'ঠিকানা' : 'Address'} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            <Textarea label={bn ? 'নোট' : 'Notes'} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} />
            <Button type="submit" className="w-full" loading={busy}><Plus size={15} />{bn ? 'সাপ্লায়ার যোগ' : 'Add supplier'}</Button>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-[15px] font-semibold text-slate-900">{rows.length} {t('suppliers').toLowerCase()}</h2></div>
          {loading ? <SkeletonRows rows={4} /> : rows.length ? (
            <ul className="divide-y divide-slate-100">
              {rows.map((supplier) => (
                <li key={supplier._id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-[13px] font-bold text-brand-800">{supplier.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-[13.5px] font-semibold text-slate-900">{supplier.name}</p><Badge tone={supplier.status === 'active' ? 'green' : 'slate'}>{supplier.status === 'active' ? t('active') : t('inactive')}</Badge></div>
                    <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{[supplier.phone, supplier.email, supplier.address].filter(Boolean).join(' · ') || (bn ? 'যোগাযোগের তথ্য নেই' : 'No contact details')}</p>
                    {supplier.notes && <p className="mt-0.5 truncate text-[11.5px] italic text-slate-400">{supplier.notes}</p>}
                  </div>
                  <IconButton label={bn ? 'সাপ্লায়ার সম্পাদনা' : 'Edit supplier'} icon={Pencil} onClick={() => setEditing(supplier)} />
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Landmark} title={bn ? 'কোনো সাপ্লায়ার নেই' : 'No suppliers yet'} description="Add a vendor to start receiving stock." />}
        </Card>
      </div>

      {editing && (
        <Modal
          title={bn ? 'সাপ্লায়ার সম্পাদনা' : 'Edit supplier'}
          description={editing.name}
          onClose={() => { setEditing(null); setEditError('') }}
          footer={<>
            <Button variant="secondary" onClick={() => setEditing(null)}>{t('cancel')}</Button>
            <Button type="submit" form="supplier-edit" loading={editBusy}><Pencil size={14} />{t('save')}</Button>
          </>}
        >
          {editError && <div className="mb-3"><Alert message={editError} onClose={() => setEditError('')} /></div>}
          <form id="supplier-edit" className="space-y-3" onSubmit={async (event) => {
            event.preventDefault(); setEditBusy(true); setEditError('')
            try {
              await api(`/admin/business/suppliers/${editing._id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name, phone: editing.phone ?? '', email: editing.email ?? '', address: editing.address ?? '', notes: editing.notes ?? '', status: editing.status }) })
              setEditing(null)
              setNotice(bn ? 'সাপ্লায়ারের তথ্য হালনাগাদ হয়েছে।' : 'Supplier details updated.')
              load()
            } catch (err) { setEditError(message(err)) } finally { setEditBusy(false) }
          }}>
            <Input label={t('name')} required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={bn ? 'ফোন' : 'Phone'} value={editing.phone ?? ''} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} />
              <Input label="Email" type="email" value={editing.email ?? ''} onChange={(event) => setEditing({ ...editing, email: event.target.value })} />
            </div>
            <Input label={bn ? 'ঠিকানা' : 'Address'} value={editing.address ?? ''} onChange={(event) => setEditing({ ...editing, address: event.target.value })} />
            <Textarea label={bn ? 'নোট' : 'Notes'} rows={2} value={editing.notes ?? ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} />
            <Select label={t('status')} value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })}>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </Select>
          </form>
        </Modal>
      )}
    </>
  )
}

export function ExpensesPage() {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const [rows, setRows] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ description: '', category: 'utilities', amount: '', paymentMethod: 'cash', notes: '' })
  const [editing, setEditing] = useState<Expense | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    setLoading(true)
    api<{ expenses: Expense[] }>('/admin/business/expenses').then((result) => setRows(result.expenses)).catch((err) => setError(message(err))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  const categories = ['rent', 'salary', 'utilities', 'transport', 'maintenance', 'supplies', 'other']
  const monthTotal = rows.filter((row) => new Date(row.incurredAt).getMonth() === new Date().getMonth()).reduce((sum, row) => sum + row.amount, 0)

  return (
    <>
      <PageTitle eyebrow={t('businessGroup')} title={bn ? 'খরচের খাতা' : 'Expense ledger'} description={bn ? 'ভাড়া, বেতন, ইউটিলিটি ও পরিচালন খরচ নথিভুক্ত করুন।' : 'Rent, salaries, utilities and operating costs in one ledger.'} />
      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="This month" value={currency(monthTotal)} icon={Wallet} tone="rose" />
        <StatCard label="Entries" value={rows.length} hint="Most recent 100" icon={Receipt} tone="teal" />
        <StatCard label="Largest category" value={rows.length ? rows.reduce((best, row) => row.amount > best.amount ? row : best, rows[0]).category : '—'} icon={TrendingDown} tone="amber" />
      </div>

      <form className="mb-6" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError('')
        try {
          await api('/admin/business/expenses', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount) }) })
          setForm({ ...form, description: '', amount: '', notes: '' })
          setNotice(bn ? 'খরচ নথিভুক্ত হয়েছে।' : 'Expense recorded.')
          load()
        } catch (err) { setError(message(err)) } finally { setBusy(false) }
      }}>
        <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Input label={bn ? 'বিবরণ' : 'Description'} required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="lg:col-span-2" />
          <Select label={bn ? 'খরচের ধরন' : 'Category'} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </Select>
          <Input label={bn ? 'পরিমাণ (৳)' : 'Amount (BDT)'} type="number" min="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Method value={form.paymentMethod} onChange={(value) => setForm({ ...form, paymentMethod: value })} />
            <Button type="submit" className="mt-[26px]" loading={busy}>{bn ? 'যোগ' : 'Record'}</Button>
          </div>
        </Card>
      </form>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'সাম্প্রতিক খরচ' : 'Recent expenses'}</h2></div>
        {loading ? <SkeletonRows rows={4} /> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[660px]">
              <thead><tr><th>{bn ? 'তারিখ' : 'Date'}</th><th>{bn ? 'বিবরণ' : 'Description'}</th><th>{bn ? 'ধরন' : 'Category'}</th><th>{bn ? 'মাধ্যম' : 'Method'}</th><th className="text-right">{bn ? 'পরিমাণ' : 'Amount'}</th><th className="text-right">{t('actions')}</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="whitespace-nowrap text-[12px] text-slate-500">{date(row.incurredAt)}</td>
                    <td className="font-medium text-slate-800">{row.description}</td>
                    <td><Badge tone="slate">{row.category}</Badge></td>
                    <td className="text-[12px] capitalize text-slate-600">{row.paymentMethod}</td>
                    <td className="text-right font-semibold text-rose-700">−{currency(row.amount)}</td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <IconButton label={bn ? 'খরচ সম্পাদনা' : 'Edit expense'} icon={Pencil} onClick={() => setEditing(row)} />
                        <IconButton label={bn ? 'খরচ মুছুন' : 'Delete expense'} icon={Trash2} onClick={async () => {
                          if (!window.confirm(bn ? 'এই খরচটি মুছে ফেলবেন?' : `Delete “${row.description}”? This cannot be undone.`)) return
                          try { await api(`/admin/business/expenses/${row._id}`, { method: 'DELETE' }); setNotice(bn ? 'খরচ মুছে ফেলা হয়েছে।' : 'Expense deleted.'); load() }
                          catch (err) { setError(message(err)) }
                        }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Wallet} title={bn ? 'কোনো খরচ নেই' : 'No expenses recorded'} description="Add rent, salaries or utilities to keep the ledger complete." />}
      </Card>

      {editing && (
        <Modal
          title={bn ? 'খরচ সম্পাদনা' : 'Edit expense'}
          description={editing.description}
          onClose={() => { setEditing(null); setEditError('') }}
          footer={<>
            <Button variant="secondary" onClick={() => setEditing(null)}>{t('cancel')}</Button>
            <Button type="submit" form="expense-edit" loading={editBusy}><Pencil size={14} />{t('save')}</Button>
          </>}
        >
          {editError && <div className="mb-3"><Alert message={editError} onClose={() => setEditError('')} /></div>}
          <form id="expense-edit" className="space-y-3" onSubmit={async (event) => {
            event.preventDefault(); setEditBusy(true); setEditError('')
            try {
              await api(`/admin/business/expenses/${editing._id}`, { method: 'PUT', body: JSON.stringify({ ...editing, amount: Number(editing.amount) }) })
              setEditing(null)
              setNotice(bn ? 'খরচ হালনাগাদ হয়েছে।' : 'Expense updated.')
              load()
            } catch (err) { setEditError(message(err)) } finally { setEditBusy(false) }
          }}>
            <Input label={bn ? 'বিবরণ' : 'Description'} required value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label={bn ? 'খরচের ধরন' : 'Category'} value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </Select>
              <Input label={bn ? 'পরিমাণ (৳)' : 'Amount (BDT)'} type="number" min="1" required value={editing.amount} onChange={(event) => setEditing({ ...editing, amount: Number(event.target.value) })} />
            </div>
            <Method value={editing.paymentMethod} onChange={(value) => setEditing({ ...editing, paymentMethod: value })} />
            <Textarea label={bn ? 'নোট' : 'Notes'} rows={2} value={editing.notes ?? ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} />
          </form>
        </Modal>
      )}
    </>
  )
}
