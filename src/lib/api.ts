const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
function apiUrl(path: string) {
  const route = path.startsWith('/api') ? path.slice(4) : path.startsWith('/') ? path : '/' + path
  return configuredApiBase + route
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); this.name = 'ApiError' }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; details?: unknown }
  if (!response.ok) throw new ApiError(payload.error ?? payload.message ?? 'Request failed.', response.status, payload.details)
  return payload as T
}
export function message(error: unknown) {
  const value = error instanceof Error ? error.message : 'Something went wrong.'
  if (typeof localStorage === 'undefined' || localStorage.getItem('library-locale') !== 'bn') return value
  const translations: Record<string, string> = {
    'Please sign in to continue.': 'চালিয়ে যেতে লগইন করুন।',
    'Your session has expired. Please sign in again.': 'আপনার সেশনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।',
    'Email or password is incorrect.': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
    'Too many sign-in or registration attempts. Please wait and try again.': 'অনেকবার লগইন বা নিবন্ধনের চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
    'Current password is incorrect.': 'বর্তমান পাসওয়ার্ড সঠিক নয়।',
    'You do not have permission to access this resource.': 'এই তথ্য ব্যবহারের অনুমতি আপনার নেই।',
    'Please check the submitted information.': 'জমা দেওয়া তথ্যগুলো যাচাই করুন।',
    'A record with that value already exists.': 'এই মানের একটি রেকর্ড আগে থেকেই আছে।',
    'That email address is already in use.': 'এই ইমেইল ঠিকানাটি আগে থেকেই ব্যবহৃত হচ্ছে।',
    'Database is not configured. Add MONGODB_URI to .env.local.': 'ডেটাবেস কনফিগার করা নেই। .env.local ফাইলে MONGODB_URI যোগ করুন।',
    'Something went wrong. Please try again.': 'সমস্যা হয়েছে। আবার চেষ্টা করুন।',
    'Category not found.': 'বিভাগটি পাওয়া যায়নি।',
    'Author not found.': 'লেখক পাওয়া যায়নি।',
    'Book not found.': 'বইটি পাওয়া যায়নি।',
    'Active loan not found.': 'সক্রিয় ঋণ পাওয়া যায়নি।',
    'Active student not found. Check the student ID.': 'সক্রিয় শিক্ষার্থী পাওয়া যায়নি। শিক্ষার্থী আইডি যাচাই করুন।',
    'This student already has this book on loan.': 'এই শিক্ষার্থীর কাছে বইটি আগে থেকেই ইস্যু করা আছে।',
    'This book is unavailable.': 'বইটি এখন উপলব্ধ নেই।',
    'Invalid book ID.': 'বইয়ের আইডি সঠিক নয়।',
    'Invalid student ID.': 'শিক্ষার্থী আইডি সঠিক নয়।',
    'Invalid author ID.': 'লেখকের আইডি সঠিক নয়।',
    'Student not found.': 'শিক্ষার্থীকে পাওয়া যায়নি।',
    'Profile not found.': 'প্রোফাইল পাওয়া যায়নি।',
    'Choose a valid category and author.': 'সঠিক বিভাগ ও লেখক নির্বাচন করুন।',
    'This category is used by books. Reassign or delete those books first.': 'এই বিভাগে বই আছে। আগে বইগুলো অন্য বিভাগে নিন অথবা মুছুন।',
    'This author is used by books. Reassign or delete those books first.': 'এই লেখকের বই আছে। আগে বইগুলো অন্য লেখকের অধীনে নিন অথবা মুছুন।',
    'This book has loan history and cannot be deleted.': 'বইটির ঋণের ইতিহাস আছে, তাই মুছে ফেলা যাবে না।',
    'Total copies cannot be less than copies currently issued.': 'বর্তমানে ইস্যু করা কপির চেয়ে মোট কপি কম হতে পারবে না।',
    'Book inventory is inconsistent; return was not recorded.': 'বইয়ের মজুতের তথ্য মিলছে না; ফেরত নথিভুক্ত হয়নি।',
    'This book has already been returned.': 'বইটি ইতিমধ্যে ফেরত দেওয়া হয়েছে।',
    'This student account is suspended.': 'এই শিক্ষার্থীর অ্যাকাউন্ট স্থগিত আছে।',
    'Narrow the report filters before exporting more than 10,000 loans.': '১০,০০০-এর বেশি ঋণ এক্সপোর্ট করতে তারিখের সীমা আরও ছোট করুন।',
    'This student has reached the active loan limit.': 'এই শিক্ষার্থীর সক্রিয় ঋণের সর্বোচ্চ সীমা পূর্ণ হয়েছে।',
    'This verification link is invalid or has expired.': 'নিশ্চিতকরণ লিংকটি ভুল অথবা মেয়াদ শেষ হয়েছে।',
    'Could not send the verification email. Your current email address is unchanged; please try again later.': 'নিশ্চিতকরণ ইমেইল পাঠানো যায়নি। আপনার বর্তমান ইমেইল অপরিবর্তিত আছে; পরে আবার চেষ্টা করুন।',
    'Choose a valid issue-date range.': 'সঠিক ইস্যু তারিখের সীমা নির্বাচন করুন।',
    'This reset link is invalid or has expired.': 'রিসেট লিংকটি ভুল অথবা মেয়াদ শেষ হয়েছে।',
    'Password recovery email is not configured yet.': 'পাসওয়ার্ড পুনরুদ্ধারের ইমেইল এখনো কনফিগার করা হয়নি।',
    'New password must be different from the current password.': 'বর্তমান পাসওয়ার্ড থেকে আলাদা একটি পাসওয়ার্ড দিন।',
    'Book inventory changed while you were editing. Refresh and try again.': 'সম্পাদনার সময় বইয়ের মজুত বদলেছে। রিফ্রেশ করে আবার চেষ্টা করুন।',
    'Book inventory is inconsistent; refresh before editing.': 'বইয়ের মজুতের তথ্য মিলছে না। সম্পাদনার আগে রিফ্রেশ করুন।',
    'Too many password recovery requests. Please wait and try again.': 'অনেকবার পাসওয়ার্ড রিসেটের অনুরোধ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
    'Too many password reset attempts. Please wait and try again.': 'অনেকবার পাসওয়ার্ড রিসেটের চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
    'Too many password change attempts. Please wait and try again.': 'অনেকবার পাসওয়ার্ড পরিবর্তনের চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
    'Request failed.': 'অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।',
  }
  return translations[value] ?? value
}
export function date(value?: string | Date | null) {
  if (!value) return '—'
  const locale = typeof localStorage !== 'undefined' && localStorage.getItem('library-locale') === 'bn' ? 'bn-BD' : 'en-BD'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(new Date(value))
}
export function currency(value: number) {
  const locale = typeof localStorage !== 'undefined' && localStorage.getItem('library-locale') === 'bn' ? 'bn-BD' : 'en-BD'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(value)
}
