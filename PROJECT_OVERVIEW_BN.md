# লাইব্রেরি ম্যানেজমেন্ট সিস্টেম — প্রজেক্ট গাইড

এই নথিতে বর্তমান কোডে থাকা ফিচার, ব্যবহারকারীর কাজের ধাপ, প্রযুক্তি, local setup, deployment এবং এখনো বাকি থাকা সীমাবদ্ধতা সহজভাবে লেখা হলো।

## প্রজেক্টটি কী করে

এটি একটি web-based library management system। এখানে একই collection-এর বই লাইব্রেরিতে ধার দেওয়া যায়, আবার বিক্রিও করা যায়। Admin পরিচালনা ও ব্যবসার তথ্য দেখেন; Student অ্যাকাউন্ট খুলে বই খোঁজেন, ধার নেন এবং নিজের account ও loan history পরিচালনা করেন। বাংলা ও English interface আছে।

## ব্যবহারকারীর ধরন

### Visitor

- Home page এবং public book catalogue দেখতে পারেন।
- বইয়ের নাম, ISBN, লেখক, বিভাগ ও availability দিয়ে খুঁজতে পারেন।
- বইয়ের detail page-এ দাম, description, cover, publisher, প্রকাশের বছর এবং shelf location দেখা যায়।
- ধার নেওয়া বা নিজের account ব্যবহার করতে sign in/register করতে হয়।

### Student / Member

- নিজের account তৈরি করে login করেন; account-এর জন্য student ID তৈরি হয়।
- Available বই catalogue থেকে self-checkout করে ধার নিতে পারেন।
- নিজের চলতি ও আগের loan, due date এবং overdue status দেখেন।
- Profile-এ নাম/ফোন পরিবর্তন, password পরিবর্তন এবং email পরিবর্তনের request করতে পারেন।
- নিজের account-এর বাইরে অন্য student-এর ব্যক্তিগত তথ্য বা loan দেখার অনুমতি নেই।

### Admin / Library team

- Admin login করে catalogue, সদস্য, ধার-ফেরত, policy, report এবং ব্যবসার কাজ পরিচালনা করেন।
- Student account suspend/reactivate এবং loan history দেখতে পারেন।
- বই issue/return, fine policy, business transactions এবং stock summary পরিচালনা করেন।
- Admin-only API server-এও role check করে; শুধু page লুকানো দিয়ে access control করা হয়নি।

## লাইব্রেরির মূল কাজ

### বই, বিভাগ ও লেখক

- Category এবং Author যোগ, পরিবর্তন ও পরিচালনা।
- বইয়ের title, ISBN/catalog code, description, category, author, publisher, publication year, cover image URL, shelf, price ও copy count সংরক্ষণ।
- Public catalogue-এ search/filter; Admin page-এ inventory ও availability দেখা।
- বইয়ের cover public image URL দিয়ে দেখানো হয়; সরাসরি image upload/storage এখনো যুক্ত নয়।

### ধার, ফেরত ও জরিমানা

- Admin শিক্ষার্থীর নামে বই issue করতে পারেন; শিক্ষার্থীও available বই self-checkout করতে পারে।
- Due date এবং overdue হিসাব Asia/Dhaka calendar ধরে চলে।
- Default policy: ১৪ দিনের loan, overdue প্রতি calendar day-এ ৳৪ fine, একজন student-এর সর্বোচ্চ ৫টি active loan। Admin settings-এ policy পরিবর্তনযোগ্য।
- একই বই একজন student-এর কাছে একাধিক active loan হিসেবে যেতে পারে না। Stock শূন্যের নিচে নামতে পারে না। Return একবারই নথিভুক্ত হয়।
- MongoDB transaction concurrent checkout/return-এ stock ও loan record একসঙ্গে সামলাতে ব্যবহৃত হয়।

### সদস্য পরিচালনা

- Student তালিকা, search, status control এবং নির্দিষ্ট member-এর loan history।
- Student registration account তৈরি করে; Admin initial account seed script দিয়ে তৈরি হয়।

### Report ও audit

- Active, returned, overdue loan এবং fine report; সাম্প্রতিক কার্যকলাপ/chart।
- তারিখ বেছে loan data CSV export করা যায়। CSV-তে spreadsheet formula injection ঠেকানোর সুরক্ষা আছে এবং export সীমা ১০,০০০ record।
- Login, password/profile, settings, member status, catalogue এবং circulation-এর গুরুত্বপূর্ণ পরিবর্তন audit log-এ রাখা হয়।

## ব্যবসার কাজ: ধার + বই বিক্রি

নতুন Business menu-তে চারটি অংশ আছে।

### Sales / POS

1. Admin বই, quantity, unit selling price, optional customer name/phone এবং discount দেন।
2. এখন কত টাকা জমা হলো তা লিখে cash, mobile banking, card বা bank method নির্বাচন করেন।
3. Sale invoice number তৈরি হয় এবং সাম্প্রতিক বিক্রির তালিকায় দেখা যায়।
4. Sale হলে available stock ও total stock দুটোই কমে। কেবল available copy বিক্রি করা যায়।
5. Partial/due sale পরে বকেয়া থেকে payment collect করা যায়।

### Purchase ও stock receiving

1. Supplier এবং supplier invoice reference নির্বাচন করা হয়।
2. বইয়ের quantity ও unit cost লিখে discount/payment amount দেওয়া হয়।
3. Stock গ্রহণের সঙ্গে বইয়ের total/available copies বাড়ে।
4. Paid, partial বা due purchase এবং supplier payable তালিকায় থাকে; পরে payable payment entry করা যায়।

### Supplier

- Supplier-এর নাম, phone, email ও address সংরক্ষণ হয়।
- Inactive supplier নতুন purchase-এ ব্যবহার করা যায় না।
- API-তে supplier record update/status পরিবর্তনের endpoint আছে; বর্তমান screen-এ add/list workflow আছে।

### Expense ledger

- Rent, salary, utilities, transport, maintenance, supplies বা other খরচ category দিয়ে নথিভুক্ত করা যায়।
- Amount, payment method, date ও notes database-এ সংরক্ষণের schema/API আছে; বর্তমান form-এ description, category, amount ও payment method দেওয়া যায়।

### Business dashboard

- আজকের sales, purchase, expense, receivable, payable এবং low-stock title count দেখা যায়।
- Dashboard থেকে POS, stock receiving ও expense screen-এ দ্রুত যাওয়া যায়।

## গুরুত্বপূর্ণ business সীমা

বর্তমান business feature-গুলো মূল operational workflow-এর প্রথম সংস্করণ। নীচের কাজগুলো আলাদা করে যোগ/সম্পূর্ণ করা বাকি:

- Print/download করার formatted invoice/receipt এবং barcode scanner।
- Customer directory/account linkage (এখন sale-এ customer name/phone snapshot থাকে)।
- প্রতিটি payment-এর আলাদা transaction history/receipt; এখন balance ও সর্বশেষ payment method update হয়।
- Tax/VAT, refund/return, sale cancellation, discount approval rules এবং gross-profit/FIFO cost accounting।
- Full searchable/paginated business reports; sales/purchase/expense list বর্তমানে সর্বশেষ ১০০টি record আনে।
- Supplier edit/deactivate-এর user interface; server endpoint আছে, কিন্তু page-এ এখনও নেই।
- Expense edit/delete এবং recurring expense, payroll, cash drawer/opening-closing balance।
- Cover image upload-এর জন্য S3/Cloudinary-এর মতো storage integration।

এগুলো ছাড়া বর্তমান ledger-কে পূর্ণ accounting/ERP package বলা ঠিক হবে না; তবে library lending-এর সঙ্গে sales, stock purchases, dues ও expenses-এর দৈনন্দিন entry রাখা যায়।

## Interface ও navigation

- Brand palette: deep green/black header, lime highlight এবং light content cards।
- Admin navigation **Library**, **Circulation**, **Business**, **Reports**, **Settings** group-এ সাজানো; mobile-এ আলাদা expandable navigation।
- Student/public menu-তে catalogue, dashboard এবং নিজের issued books থাকে।
- English/Bangla locale switch আছে; নতুন Business page এবং dashboard business labels দুই ভাষাতেই দেখায়।

## প্রযুক্তির গঠন

- **Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS, React Query, Lucide icons, Recharts।
- **Backend:** Express + TypeScript; local-এ port 4000। API routes `/api` prefix-এ চলে।
- **Database:** MongoDB Atlas + Mongoose; user, book, category, author, loan, supplier, sale, purchase, expense, settings ও audit data।
- **Validation/security:** Zod validation, bcrypt password hash, signed HttpOnly/SameSite session cookie, server-side role check, Helmet, rate limit এবং no-store API response।
- **Deployment:** Vercel serverless API `api/index.ts`; frontend `dist`; `vercel.json` API rewrite ও SPA route rewrite সেট করে।

## Local চালানো

1. Node.js 22.12+ এবং npm install করুন।
2. Project root-এ environment file তৈরি করে প্রয়োজনীয় server variables বসান; `.env.local` Git-এ commit করবেন না। সাধারণত `.env.example` কপি করা হয়, তবে এই working copy-তে `.env.example` বর্তমানে deleted দেখাচ্ছে—তাই আগে committed template থেকে কপি নিন বা নিচের variable list দেখে `.env.local` নিজে তৈরি করুন।
3. Atlas database user ও network access ঠিক করুন; URI-তে username/password-এর reserved character percent-encode করুন।
4. Admin seed-এর environment variables সেট করে চালান:

```bash
npm run seed:admin
```

5. Local frontend ও API একসঙ্গে চালান:

```bash
npm run dev
```

6. Vite URL খুলুন—সাধারণত `http://localhost:5173`। Admin-এর Business menu দেখতে admin account দিয়ে login করুন।

### প্রয়োজনীয় environment variable

- `MONGODB_URI` — MongoDB connection string, server-side only।
- `JWT_SECRET` — কমপক্ষে ৩২ অক্ষরের random secret।
- `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — initial admin seed করতে।
- `APP_URL` — production-এ deployed HTTPS origin; email link তৈরি হলে সেটি ব্যবহার করে।
- `VITE_API_BASE_URL` — সাধারণত `/api`; প্রয়োজন না হলে সেট করতে হয় না।
- `PORT` — local API port; default `4000`।

### SMTP না দিলে কী হবে

SMTP optional। SMTP configure না থাকলে login, catalogue, loan, sales, purchases ও expense entry চলে; password recovery email এবং email-change verification পাঠানো যাবে না। ভুল/অকার্যকর SMTP দিলে mail feature ব্যর্থ হতে পারে, কিন্তু database authentication বা admin login error-এর কারণ SMTP নয়।

## Atlas ও Vercel

- Vercel Project Settings → Environment Variables-এ `MONGODB_URI`, `JWT_SECRET` এবং seed করা admin-এর account data বাইরে নিরাপদে রাখুন। Browser variable হিসেবে `VITE_` prefix দিয়ে DB/JWT secret দেবেন না।
- `APP_URL`-এ deployed site-এর সঠিক HTTPS origin দিন, কারণ mail links-এর base হিসেবে এটি ব্যবহৃত হয়। SMTP না চাইলে SMTP variables বাদ রাখা যায়।
- Atlas Network Access-এ Vercel function-এর egress allow করুন। Production-এ test-এর জন্য `0.0.0.0/0` স্থায়ীভাবে ব্যবহার করা নিরাপদ নয়।
- Vercel build config frontend ও API দুটো build করে; API path `/api/*` serverless function-এ যায়, SPA pages `index.html`-এ rewrite হয়।
- Admin seed production-এ চালালে production Atlas URI এবং `SEED_ADMIN_*` variables শুধু trusted local shell-এ দিন। Seed command database-এ admin record তৈরি/যাচাই করে।

## Build ও code checks

```bash
npm run build       # Frontend TypeScript check + Vite production build
npm run build:api   # Server/API TypeScript build check
npm run lint        # ESLint
npm test            # Vitest suite
```

বর্তমান business feature যোগ করার পরে `npm run build` এবং `npm run build:api` সফল হয়েছে। MongoDB Atlas credentials/network এবং live Vercel environment ছাড়া live database workflow যাচাই করা হয় না।

## Git/deploy অবস্থা

Business workflow-এর নতুন code এখন local project-এ আছে। এটি GitHub-এ push না করলে Vercel deploy-এ যাবে না। Push করার আগে `git status` দেখুন: আগে থেকে থাকা `.env.example` deletion এবং `package.json`/`package-lock.json` changes এই feature-এর অংশ নয়; সেগুলো না বুঝে commit করবেন না।
