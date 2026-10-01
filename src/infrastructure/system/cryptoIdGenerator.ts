import { randomUUID } from 'node:crypto'
import type { IdGenerator } from '@application'

export const cryptoIdGenerator: IdGenerator = {
  next: () => randomUUID()
}
