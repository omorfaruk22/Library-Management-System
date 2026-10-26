import { describe, expect, it } from 'vitest'
import { HttpError } from './middleware.js'
import { calculateUpdatedBookInventory } from './catalog-inventory.js'

describe('book inventory edits', () => {
  it('preserves issued copies when the total inventory changes', () => {
    expect(calculateUpdatedBookInventory(8, 3, 12)).toEqual({ issuedCopies: 5, availableCopies: 7 })
    expect(calculateUpdatedBookInventory(8, 3, 5)).toEqual({ issuedCopies: 5, availableCopies: 0 })
  })

  it('refuses totals below issued copies or inconsistent inventory', () => {
    expect(() => calculateUpdatedBookInventory(8, 3, 4)).toThrow(HttpError)
    expect(() => calculateUpdatedBookInventory(3, 4, 6)).toThrow(HttpError)
  })
})
