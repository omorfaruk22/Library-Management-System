export const LOAN_DAYS = 14
export const FINE_PER_CALENDAR_DAY = 4
export const LOAN_TIME_ZONE = 'Asia/Dhaka'
const DAY_MS = 86_400_000

type CalendarParts = { year: number; month: number; day: number }
const calendarFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LOAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LOAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
function partsFor(date: Date): CalendarParts {
  const parts = calendarFormatter.formatToParts(date)
  const value = (key: string) => Number(parts.find((part) => part.type === key)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}
function calendarDayOrdinal(date: Date): number {
  const { year, month, day } = partsFor(date)
  return Date.UTC(year, month - 1, day)
}
function zoneOffsetAt(instant: Date): number {
  const parts = dateTimeFormatter.formatToParts(instant)
  const value = (key: string) => Number(parts.find((part) => part.type === key)?.value)
  const representedAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
  return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** Returns local midnight at the start of the date in Dhaka, represented as a UTC instant. */
export function startOfCalendarDay(at: Date): Date {
  const { year, month, day } = partsFor(at)
  const midnightAsUtc = Date.UTC(year, month - 1, day)
  return new Date(midnightAsUtc - zoneOffsetAt(new Date(midnightAsUtc)))
}

/** A due date is overdue only after its Dhaka calendar date has ended. */
export function isOverdue(dueAt: Date, at = new Date()): boolean {
  return calendarDayOrdinal(at) > calendarDayOrdinal(dueAt)
}

export function calculateFine(dueAt: Date, at = new Date(), finePerDay = FINE_PER_CALENDAR_DAY): number {
  const overdueDays = Math.max(0, (calendarDayOrdinal(at) - calendarDayOrdinal(dueAt)) / DAY_MS)
  return overdueDays * finePerDay
}

/** Adds fourteen calendar days while preserving the issue time. Dhaka has no DST offset changes. */
export function addLoanPeriod(from: Date, loanDays = LOAN_DAYS): Date {
  const due = new Date(from)
  due.setUTCDate(due.getUTCDate() + loanDays)
  return due
}