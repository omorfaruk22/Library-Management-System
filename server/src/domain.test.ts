import { describe, expect, it } from 'vitest'
import { addLoanPeriod, calculateFine, FINE_PER_CALENDAR_DAY, isOverdue, LOAN_DAYS, startOfCalendarDay } from './domain.js'

describe('library loan rules in the Dhaka calendar', () => {
  it('sets a due date fourteen calendar days after issue and preserves issue time', () => {
    const issuedAt = new Date('2024-02-20T15:45:00.000Z')
    expect(addLoanPeriod(issuedAt).toISOString()).toBe('2024-03-05T15:45:00.000Z')
    expect(LOAN_DAYS).toBe(14)
  })
  it('starts overdue at midnight after the due date in Bangladesh', () => {
    const due = new Date('2024-04-30T17:00:00.000Z') // Apr 30, 11:00 PM in Dhaka
    expect(isOverdue(due, new Date('2024-04-30T17:59:59.000Z'))).toBe(false)
    expect(isOverdue(due, new Date('2024-04-30T18:00:00.000Z'))).toBe(true)
    expect(calculateFine(due, new Date('2024-04-30T18:00:00.000Z'))).toBe(FINE_PER_CALENDAR_DAY)
  })
  it('charges ৳4 for each completed overdue calendar date', () => {
    const due = new Date('2024-04-30T10:00:00.000Z')
    expect(calculateFine(due, new Date('2024-04-30T17:59:00.000Z'))).toBe(0)
    expect(calculateFine(due, new Date('2024-05-01T18:01:00.000Z'))).toBe(8)
  })
  it('finds the start of the current Dhaka calendar day for database overdue queries', () => {
    expect(startOfCalendarDay(new Date('2024-04-30T17:59:59.000Z')).toISOString()).toBe('2024-04-29T18:00:00.000Z')
    expect(startOfCalendarDay(new Date('2024-04-30T18:00:00.000Z')).toISOString()).toBe('2024-04-30T18:00:00.000Z')
  })
  it('handles year boundaries and never charges a negative fine', () => {
    expect(calculateFine(new Date('2024-12-31T18:30:00.000Z'), new Date('2025-01-02T18:00:00.000Z'))).toBe(8)
    expect(calculateFine(new Date('2025-01-03T00:00:00.000Z'), new Date('2025-01-01T00:00:00.000Z'))).toBe(0)
  })
})