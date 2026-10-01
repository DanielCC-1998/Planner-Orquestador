import type { Clock } from '@application'
import { localDateOf } from '@shared/time'

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  // The local time zone of the machine.
  localDate: localDateOf
}
