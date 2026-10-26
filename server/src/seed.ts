import './env.js'
import bcrypt from 'bcryptjs'
import { connectDB } from './db.js'
import { User } from './models.js'

async function seed() {
  const name = process.env.SEED_ADMIN_NAME?.trim()
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!name || !email || !password) throw new Error('Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD before seeding.')
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.')
  await connectDB()
  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.role !== 'admin') throw new Error('The configured seed email belongs to a non-admin account.')
    console.log('Seed administrator already exists; no changes made.')
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await User.create({ name, email, passwordHash, role: 'admin', status: 'active' })
  console.log('Seed administrator created for ' + email + '.')
}
seed().catch((error: unknown) => { console.error(error); process.exitCode = 1 }).finally(() => import('mongoose').then(({ default: mongoose }) => mongoose.disconnect()))
