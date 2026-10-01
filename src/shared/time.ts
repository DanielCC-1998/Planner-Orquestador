/** Calendar date ('YYYY-MM-DD') of a moment in the local time zone of this computer. */
export function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Local calendar date of an ISO timestamp: a change at 00:30 belongs to that day, not to the UTC one.
 * A timestamp that cannot be read (a damaged file) counts as today rather than breaking the dates.
 */
export function localDateOf(at: string): string {
  const date = new Date(at)
  return localIsoDate(Number.isNaN(date.getTime()) ? new Date() : date)
}
