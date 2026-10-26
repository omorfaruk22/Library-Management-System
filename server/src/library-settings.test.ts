import { describe, expect, it } from 'vitest'
import { DEFAULT_LIBRARY_POLICY, validateLibrarySettings } from './library-settings.js'

describe('library policy settings', () => {
  it('uses the documented defaults', () => {
    expect(DEFAULT_LIBRARY_POLICY).toEqual({ loanPeriodDays: 14, finePerDay: 4, maxActiveLoans: 5, timezone: 'Asia/Dhaka' })
  })
  it('validates configurable limits', () => {
    expect(validateLibrarySettings({ loanPeriodDays: '21', finePerDay: '6', maxActiveLoans: '3' })).toEqual({ loanPeriodDays: 21, finePerDay: 6, maxActiveLoans: 3 })
    expect(() => validateLibrarySettings({ loanPeriodDays: 0, finePerDay: -1, maxActiveLoans: 51 })).toThrow()
  })
})
