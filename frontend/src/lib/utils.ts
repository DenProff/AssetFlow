import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  return dateStr
}

export function formatDateTime(dateStr: string | null | undefined, withSeconds = false): string {
  if (!dateStr) return '–'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const base = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base
}
