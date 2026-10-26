import mongoose, { type ClientSession } from 'mongoose'
import { AuditLog, PasswordReset, User } from './models.js'
import type { PasswordRecoveryRepository, PasswordResetTransaction, ResetUser } from './password-recovery.js'

function transactionMethods(session: ClientSession): PasswordResetTransaction {
  return {
    async consumeToken(tokenHash, now) {
      const reset = await PasswordReset.findOneAndDelete({ tokenHash, expiresAt: { $gt: now } }).session(session).lean().exec() as { user: unknown } | null
      return reset ? { userId: String(reset.user) } : null
    },
    async updatePasswordHash(userId, passwordHash) {
      const result = await User.updateOne({ _id: userId }, { $set: { passwordHash } }, { session })
      return result.matchedCount === 1
    },
    async deleteUserTokens(userId) {
      await PasswordReset.deleteMany({ user: userId }, { session })
    },
    async writeCompletedAudit(userId) {
      await AuditLog.create([{ actor: userId, action: 'password_reset_completed', entity: 'user', entityId: userId, details: {}, ip: '' }], { session })
    },
  }
}

export class MongoosePasswordRecoveryRepository implements PasswordRecoveryRepository {
  async findUserByEmail(email: string): Promise<ResetUser | null> {
    const user = await User.findOne({ email }).select('name email').lean().exec() as { _id: unknown; name: string; email: string } | null
    return user ? { id: String(user._id), name: user.name, email: user.email } : null
  }
  async wasRecentlyRequested(userId: string, since: Date): Promise<boolean> {
    return Boolean(await PasswordReset.exists({ user: userId, createdAt: { $gte: since } }))
  }
  async storeResetToken(userId: string, tokenHash: string, expiresAt: Date, createdAt: Date): Promise<void> {
    await PasswordReset.deleteMany({ user: userId })
    await PasswordReset.create({ user: userId, tokenHash, expiresAt, createdAt, updatedAt: createdAt })
  }
  async removeResetToken(tokenHash: string): Promise<void> {
    await PasswordReset.deleteOne({ tokenHash })
  }
  async writeRequestedAudit(userId: string): Promise<void> {
    await AuditLog.create({ actor: userId, action: 'password_reset_requested', entity: 'user', entityId: userId, details: {}, ip: '' })
  }
  async transaction<T>(work: (tx: PasswordResetTransaction) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession()
    let result!: T
    try {
      await session.withTransaction(async () => { result = await work(transactionMethods(session)) })
      return result
    } finally {
      await session.endSession()
    }
  }
}