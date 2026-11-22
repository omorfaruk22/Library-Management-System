# Implementation progress — Smart Library ERP

This checklist separates verified existing functionality from work added during the current upgrade. It prevents treating planned or UI-only work as finished.

## Existing foundation (present before this upgrade)

- [x] React/Vite/TypeScript frontend, Express/Mongoose API, Atlas and Vercel setup
- [x] Public catalogue and book details; book/category/author administration
- [x] Student registration/profile, admin login, protected sessions, password reset flow
- [x] Issue/return, Dhaka due dates, fines, member administration and CSV loan reports
- [x] Business sales, purchases/receiving, suppliers and expense records (first operational version)
- [x] Audit log, bilingual interface, Zod validation, server-side roles and MongoDB transactions for circulation

## Current upgrade

- [x] Added a separate `src/components/pages/BusinessAnalytics.tsx` page.
- [x] Added protected `/api/admin/business/analytics` with actual monthly sale revenue, expense totals, most borrowed books, recent sales and recent audit activity.
- [x] Added date range selection (up to one year), responsive chart and Business navigation link.
- [x] Shows sales and expenses but deliberately does not claim profit: reliable unit-cost/COGS accounting is not implemented yet.
- [x] `npm run build:api` passes. Frontend build passed immediately before the API route line-break correction; rerun both builds after this phase.

## Remaining requested modules

- [ ] **Advanced dashboard:** monthly/date filters are partly covered by analytics; total copies/members/loans/fines exist in current dashboard. Add monthly revenue/expense cards and activity feed integration.
- [~] **Inventory:** admin stock adjustment page/API, low-stock view and transactional restock/damaged/lost/stocktake movement history added. Copy-level accession IDs, QR/barcode scanning, condition fields, transfers and stock audit remain.
- [ ] **Circulation extensions:** wait queue/reservations, renewals, expiry/availability notifications, lost/damaged charges and return receipt.
- [~] **Member portal:** private DB-backed wishlist and reservation queue pages/API added; student ownership checks in place. Automatic queue promotion, expiry, fine/payment history, digital membership card and notification preferences remain.
- [ ] **Storefront:** cart, customer records, online order lifecycle, promotions/coupons and reviews/ratings.
- [ ] **POS completion:** printed/PDF receipt, barcode checkout, separate payment ledger, return/refund/cancel with stock reversal and idempotency.
- [ ] **Accounting:** audited cashbook, opening/closing cash, supplier/customer ledger, tax/VAT and P&L. Choose a cost-flow policy before gross profit is reported.
- [ ] **Digital library:** private file storage, PDF reader/progress/permission and authorized downloads.
- [ ] **Notifications:** in-app read/unread/preferences and scheduled email/background jobs. SMTP is optional for current core app; notification email needs configuration.
- [ ] **Reports:** paginated/filterable sales, purchase, inventory, supplier due, expense and financial exports.
- [ ] **Staff/security:** staff roles and granular permissions, login/session history, optional 2FA, CSRF review and backup/restore process.
- [ ] **Settings:** library branding/contact/logo, receipt/tax/notification settings and backup configuration.
- [ ] **Architecture request:** existing pages already have one file per page under `src/pages`; newly added analytics is under `src/components/pages`. Migrate the remaining page files only with import-path-safe, build-verified refactoring.
- [ ] Add focused API tests for analytics/wishlist/reservations and additional transaction modules. Current regression suite: 42 existing tests pass; lint/build pass. Update deployment guide as external storage/jobs are selected.

## External services and decisions

No credentials or payment provider has been invented. Private eBook storage, email delivery, scheduled jobs, PDF generation and payment processing need providers/configuration before production activation. VAT/tax rules and refund accounting need the library's actual policy. Those should be configuration-backed rather than hard-coded.


