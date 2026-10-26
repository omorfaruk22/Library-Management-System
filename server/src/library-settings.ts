import { z } from 'zod'
import { SystemSettings } from './models.js'

export const DEFAULT_LIBRARY_POLICY = {
  loanPeriodDays: 14,
  finePerDay: 4,
  maxActiveLoans: 5,
  timezone: 'Asia/Dhaka' as const,
}
export const librarySettingsSchema = z.object({
  loanPeriodDays: z.coerce.number().int().min(1).max(90),
  finePerDay: z.coerce.number().int().min(0).max(10000),
  maxActiveLoans: z.coerce.number().int().min(1).max(50),
})
export type LibraryPolicy = typeof DEFAULT_LIBRARY_POLICY

export function validateLibrarySettings(input: unknown) {
  return librarySettingsSchema.parse(input)
}

export async function getLibraryPolicy(): Promise<LibraryPolicy> {
  const settings = await SystemSettings.findOneAndUpdate(
    { key: 'library' },
    { $setOnInsert: { ...DEFAULT_LIBRARY_POLICY, key: 'library' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean().exec() as any
  return {
    loanPeriodDays: settings.loanPeriodDays,
    finePerDay: settings.finePerDay,
    maxActiveLoans: settings.maxActiveLoans,
    timezone: 'Asia/Dhaka',
  }
}
