import express from 'express'
import mongoose from 'mongoose'
import { startOfCalendarDay } from './domain.js'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { AuditLog, Book, Expense, Loan, Purchase, Sale, Supplier } from './models.js'
import { asyncRoute, audit, HttpError, requireAuth, requireRole, validate } from './middleware.js'

const method = z.enum(['cash', 'mobile', 'card', 'bank']).default('cash')
const router = express.Router()
router.use(requireAuth, requireRole('admin'))
const supplierInput = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).optional().default(''), email: z.string().trim().email().or(z.literal('')).optional().default(''), address: z.string().trim().max(400).optional().default(''), notes: z.string().trim().max(1000).optional().default(''), status: z.enum(['active','inactive']).optional().default('active') })
const itemInput = z.object({ book: z.string().min(1), quantity: z.coerce.number().int().min(1).max(10000), unitPrice: z.coerce.number().min(0).max(10000000) })
const financialInput = z.object({ items: z.array(itemInput).min(1).max(100), discount: z.coerce.number().min(0).default(0), paidAmount: z.coerce.number().min(0).default(0), paymentMethod: method })
const invoice = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomBytes(3).toString('hex').toUpperCase()}`

router.get('/suppliers', asyncRoute(async (_req,res) => res.json({ suppliers: await Supplier.find().sort({ name: 1 }).lean() })))
router.post('/suppliers', asyncRoute(async (req,res) => { const data=validate(supplierInput,req.body); const item=await Supplier.create(data); await audit(req,'create','supplier',String(item._id)); res.status(201).json({ supplier:item }) }))
router.put('/suppliers/:id', asyncRoute(async (req,res) => { const data=validate(supplierInput,req.body); const item=await Supplier.findByIdAndUpdate(req.params.id,data,{new:true,runValidators:true}); if(!item) throw new HttpError(404,'Supplier not found.'); await audit(req,'update','supplier',String(item._id)); res.json({supplier:item}) }))
router.get('/sales', asyncRoute(async (_req,res) => res.json({sales:await Sale.find().sort({createdAt:-1}).limit(100).lean()})))
router.post('/sales', asyncRoute(async (req,res) => {
 const data=validate(financialInput.extend({customerName:z.string().trim().max(120).optional().default('Walk-in customer'),customerPhone:z.string().trim().max(30).optional().default('')}),req.body)
 const ids=[...new Set(data.items.map(i=>i.book))]; const books=await Book.find({_id:{$in:ids},status:'active'}); if(books.length!==ids.length) throw new HttpError(400,'One or more books are unavailable.')
 const lines=data.items.map(i=>{const b=books.find(x=>String(x._id)===i.book)!; if(b.availableCopies<i.quantity) throw new HttpError(409,`Not enough stock for ${b.title}.`); return {book:b._id,title:b.title,isbn:b.isbn,quantity:i.quantity,unitPrice:i.unitPrice,lineTotal:i.quantity*i.unitPrice} })
 const subtotal=lines.reduce((s,i)=>s+i.lineTotal,0); if(data.discount>subtotal) throw new HttpError(400,'Discount cannot exceed the subtotal.')
 const total=subtotal-data.discount; if(data.paidAmount>total) throw new HttpError(400,'Paid amount cannot exceed the total.')
 const session=await mongoose.startSession(); let sale:any; try { await session.withTransaction(async()=>{ for(const line of lines){const changed=await Book.updateOne({_id:line.book,availableCopies:{$gte:line.quantity},totalCopies:{$gte:line.quantity}},{$inc:{availableCopies:-line.quantity,totalCopies:-line.quantity}},{session}); if(!changed.modifiedCount) throw new HttpError(409,'Book stock changed. Refresh and try again.')}
 const paid=data.paidAmount; [sale]=await Sale.create([{invoiceNo:invoice('S'),customerName:data.customerName||'Walk-in customer',customerPhone:data.customerPhone,items:lines,subtotal,discount:data.discount,total,paidAmount:paid,balanceDue:total-paid,paymentMethod:data.paymentMethod,paymentStatus:paid===total?'paid':paid?'partial':'due',createdBy:req.user!.id}],{session}) }) } finally { await session.endSession() }
 await audit(req,'create','sale',String(sale._id),{invoiceNo:sale.invoiceNo,total}); res.status(201).json({sale})
}))
router.post('/sales/:id/payments', asyncRoute(async (req,res)=>{const amount=z.coerce.number().positive().max(10000000).parse(req.body.amount); const pm=method.parse(req.body.paymentMethod); const item=await Sale.findById(req.params.id); if(!item) throw new HttpError(404,'Sale not found.'); if(amount>item.balanceDue) throw new HttpError(400,'Payment cannot exceed balance due.'); item.paidAmount+=amount; item.balanceDue-=amount; item.paymentMethod=pm; item.paymentStatus=item.balanceDue===0?'paid':'partial'; await item.save(); await audit(req,'payment','sale',String(item._id),{amount}); res.json({sale:item})}))
router.get('/purchases', asyncRoute(async (_req,res)=>res.json({purchases:await Purchase.find().populate('supplier','name').sort({createdAt:-1}).limit(100).lean()})))
router.post('/purchases', asyncRoute(async (req,res)=>{
 const data=validate(financialInput.extend({supplier:z.string().min(1),supplierInvoice:z.string().trim().max(100).optional().default('')}),req.body); const supplier=await Supplier.findById(data.supplier); if(!supplier||supplier.status!=='active') throw new HttpError(400,'Choose an active supplier.')
 const ids=[...new Set(data.items.map(i=>i.book))]; const books=await Book.find({_id:{$in:ids}}); if(books.length!==ids.length) throw new HttpError(400,'One or more books were not found.')
 const lines=data.items.map(i=>{const b=books.find(x=>String(x._id)===i.book)!; return {book:b._id,title:b.title,isbn:b.isbn,quantity:i.quantity,unitPrice:i.unitPrice,lineTotal:i.quantity*i.unitPrice} }); const subtotal=lines.reduce((s,i)=>s+i.lineTotal,0); if(data.discount>subtotal) throw new HttpError(400,'Discount cannot exceed the subtotal.'); const total=subtotal-data.discount; if(data.paidAmount>total) throw new HttpError(400,'Paid amount cannot exceed the total.')
 const session=await mongoose.startSession(); let purchase:any; try { await session.withTransaction(async()=>{ for(const line of lines) await Book.updateOne({_id:line.book},{$inc:{availableCopies:line.quantity,totalCopies:line.quantity}},{session}); [purchase]=await Purchase.create([{invoiceNo:invoice('P'),supplier:supplier._id,supplierInvoice:data.supplierInvoice,items:lines,subtotal,discount:data.discount,total,paidAmount:data.paidAmount,balanceDue:total-data.paidAmount,paymentMethod:data.paymentMethod,paymentStatus:data.paidAmount===total?'paid':data.paidAmount?'partial':'due',createdBy:req.user!.id}],{session}) }) } finally { await session.endSession() } await audit(req,'create','purchase',String(purchase._id),{invoiceNo:purchase.invoiceNo,total}); res.status(201).json({purchase})
}))
router.post('/purchases/:id/payments', asyncRoute(async(req,res)=>{const amount=z.coerce.number().positive().max(10000000).parse(req.body.amount); const pm=method.parse(req.body.paymentMethod); const item=await Purchase.findById(req.params.id); if(!item) throw new HttpError(404,'Purchase not found.'); if(amount>item.balanceDue) throw new HttpError(400,'Payment cannot exceed balance due.'); item.paidAmount+=amount; item.balanceDue-=amount; item.paymentMethod=pm; item.paymentStatus=item.balanceDue===0?'paid':'partial'; await item.save(); await audit(req,'payment','purchase',String(item._id),{amount}); res.json({purchase:item})}))
router.get('/expenses', asyncRoute(async (_req,res)=>res.json({expenses:await Expense.find().sort({incurredAt:-1}).limit(100).lean()})))
const expenseInput=z.object({description:z.string().trim().min(2).max(180),category:z.string().trim().min(2).max(80),amount:z.coerce.number().positive().max(10000000),paymentMethod:method,incurredAt:z.coerce.date().optional(),notes:z.string().trim().max(1000).optional().default('')})
router.put('/expenses/:id', asyncRoute(async(req,res)=>{const data=validate(expenseInput,req.body); const expense=await Expense.findByIdAndUpdate(req.params.id,data,{new:true,runValidators:true}); if(!expense) throw new HttpError(404,'Expense not found.'); await audit(req,'update','expense',String(expense._id),{amount:data.amount}); res.json({expense})}))
router.delete('/expenses/:id', asyncRoute(async(req,res)=>{const expense=await Expense.findByIdAndDelete(req.params.id); if(!expense) throw new HttpError(404,'Expense not found.'); await audit(req,'delete','expense',String(expense._id),{amount:expense.amount}); res.json({ok:true})}))
router.post('/expenses', asyncRoute(async(req,res)=>{const data=validate(expenseInput,req.body); const expense=await Expense.create({...data,createdBy:req.user!.id}); await audit(req,'create','expense',String(expense._id),{amount:data.amount,category:data.category}); res.status(201).json({expense})}))
router.get('/analytics', asyncRoute(async (req,res)=>{
 const fromText=typeof req.query.from==='string'?req.query.from:''; const toText=typeof req.query.to==='string'?req.query.to:'';
 const from=fromText?new Date(`${fromText}T00:00:00+06:00`):new Date(Date.now()-365*86_400_000); const to=toText?new Date(new Date(`${toText}T00:00:00+06:00`).getTime()+86_400_000):new Date();
 if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||from>to||to.getTime()-from.getTime()>366*86_400_000) throw new HttpError(400,'Choose a valid date range within one year.')
 const range={createdAt:{$gte:from,$lt:to}}; const [monthlySales,monthlyExpenses,topBooks,recentSales,recentActivity]=await Promise.all([
  Sale.aggregate([{$match:range},{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$createdAt',timezone:'Asia/Dhaka'}},revenue:{$sum:'$total'},orders:{$sum:1}}},{$sort:{_id:1}}]),
  Expense.aggregate([{$match:{incurredAt:{$gte:from,$lt:to}}},{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$incurredAt',timezone:'Asia/Dhaka'}},expenses:{$sum:'$amount'}}},{$sort:{_id:1}}]),
  Loan.aggregate([{$match:{createdAt:{$gte:from,$lt:to}}},{$group:{_id:'$book',borrowCount:{$sum:1}}},{$sort:{borrowCount:-1}},{$limit:5},{$lookup:{from:'books',localField:'_id',foreignField:'_id',as:'book'}},{$unwind:'$book'},{$project:{title:'$book.title',borrowCount:1}}]),
  Sale.find(range).sort({createdAt:-1}).limit(8).select('invoiceNo customerName total paymentStatus createdAt').lean(),
  AuditLog.find({createdAt:{$gte:from,$lt:to}}).sort({createdAt:-1}).limit(8).select('action entity details createdAt').lean(),
 ]);
 const months=new Map<string,{month:string;revenue:number;expenses:number;orders:number}>(); for(const x of monthlySales) months.set(x._id,{month:x._id,revenue:x.revenue,expenses:0,orders:x.orders}); for(const x of monthlyExpenses){const row=months.get(x._id)??{month:x._id,revenue:0,expenses:0,orders:0};row.expenses=x.expenses;months.set(x._id,row)}
 res.json({from,to,monthly:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)),topBooks,recentSales,recentActivity})
}))
router.get('/summary',asyncRoute(async(_req,res)=>{const start=startOfCalendarDay(new Date()); const [sales,purchases,expenses,receivables,payables,lowStock]=await Promise.all([Sale.aggregate([{$match:{createdAt:{$gte:start}}},{$group:{_id:null,total:{$sum:'$total'},count:{$sum:1}}}]),Purchase.aggregate([{$match:{createdAt:{$gte:start}}},{$group:{_id:null,total:{$sum:'$total'},count:{$sum:1}}}]),Expense.aggregate([{$match:{incurredAt:{$gte:start}}},{$group:{_id:null,total:{$sum:'$amount'}}}]),Sale.aggregate([{$group:{_id:null,total:{$sum:'$balanceDue'}}}]),Purchase.aggregate([{$group:{_id:null,total:{$sum:'$balanceDue'}}}]),Book.countDocuments({status:'active',availableCopies:{$lte:3}})]); res.json({todaySales:sales[0]?.total??0,todaySaleCount:sales[0]?.count??0,todayPurchases:purchases[0]?.total??0,todayExpenses:expenses[0]?.total??0,receivables:receivables[0]?.total??0,payables:payables[0]?.total??0,lowStock})}))
export function businessRoutes(){return router}





