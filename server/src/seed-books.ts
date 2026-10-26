import './env.js'
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import { Author, Book, Category } from './models.js'

type SeedBook = {
  title: string
  isbn: string
  description: string
  category: string
  author: string
  totalCopies: number
  coverImage: string
}

async function seedBooks() {
  const books = JSON.parse(readFileSync(new URL('../../data/computer-books.json', import.meta.url), 'utf8')) as SeedBook[]
  if (books.length !== 30) throw new Error(`Expected 30 books; found ${books.length}.`)
  await connectDB()
  let added = 0
  let skipped = 0

  for (const item of books) {
    const category = await Category.findOneAndUpdate(
      { name: item.category },
      { $set: { status: 'active' }, $setOnInsert: { description: 'Computer and technology books' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
    const author = await Author.findOneAndUpdate(
      { name: item.author },
      { $set: { status: 'active' }, $setOnInsert: { biography: '' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
    const result = await Book.updateOne(
      { isbn: item.isbn },
      { $setOnInsert: {
        title: item.title,
        isbn: item.isbn,
        description: item.description,
        category: category._id,
        author: author._id,
        coverImage: item.coverImage,
        totalCopies: item.totalCopies,
        availableCopies: item.totalCopies,
        status: 'active',
      } },
      { upsert: true },
    )
    if (result.upsertedCount) added += 1
    else skipped += 1
  }

  console.log(`Book seed complete: ${added} added, ${skipped} already existed.`)
}

seedBooks()
  .catch((error: unknown) => {
    console.error('Could not seed books:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })