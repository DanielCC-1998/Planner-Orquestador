import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app } from 'electron'

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

export interface DataLocation {
  readonly dir: string
  readonly portable: boolean
}

/**
 * Where the data lives, by priority:
 * 1. PLANNER_DATA_DIR (tests and advanced users).
 * 2. Portable version: a PlannerData folder next to the .exe, if it is writable.
 * 3. In development: .planner-data in the project folder.
 * 4. %APPDATA%\Planner\data.
 */
export function resolveDataLocation(): DataLocation {
  const override = process.env['PLANNER_DATA_DIR']
  if (override) return { dir: resolve(override), portable: false }
  const portableDir = process.env['PORTABLE_EXECUTABLE_DIR']
  if (portableDir) {
    const dir = join(portableDir, 'PlannerData')
    if (isWritable(dir)) return { dir, portable: true }
  }
  if (!app.isPackaged) return { dir: resolve('.planner-data'), portable: false }
  return { dir: join(app.getPath('userData'), 'data'), portable: false }
}
