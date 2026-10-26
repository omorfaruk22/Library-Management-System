import { HttpError } from './middleware.js'

export function calculateUpdatedBookInventory(currentTotal: number, currentAvailable: number, newTotal: number) {
  if (!Number.isInteger(currentTotal) || !Number.isInteger(currentAvailable) || currentTotal < 0 || currentAvailable < 0 || currentAvailable > currentTotal) {
    throw new HttpError(409, 'Book inventory is inconsistent; refresh before editing.')
  }
  const issuedCopies = currentTotal - currentAvailable
  if (newTotal < issuedCopies) throw new HttpError(409, 'Total copies cannot be less than copies currently issued.')
  return { issuedCopies, availableCopies: newTotal - issuedCopies }
}
