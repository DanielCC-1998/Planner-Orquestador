import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { chooseDataLocation, type DataLocation } from './dataLocation'

export type { DataLocation } from './dataLocation'

function isWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    accessSync(dir, constants.W_OK)
    const probe = join(dir, '.write-test')
    writeFileSync(probe, '')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

/** Data folder of this run of the app (see `chooseDataLocation` for the order). */
export function resolveDataLocation(): DataLocation {
  return chooseDataLocation({ env: process.env, isPackaged: app.isPackaged, userData: app.getPath('userData'), isWritable })
}
