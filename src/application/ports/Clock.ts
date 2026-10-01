export interface Clock {
  /** ISO 8601 timestamp. */
  now(): string
  /** Calendar date ('YYYY-MM-DD') of a timestamp in the user's time zone. */
  localDate(at: string): string
}
