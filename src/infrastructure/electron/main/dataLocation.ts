import { dirname, join, resolve } from 'node:path'

export interface DataLocation {
  readonly dir: string
  /** The data travels with the app file (portable .exe or AppImage). */
  readonly portable: boolean
}

/** What the choice depends on: the environment of the process and how the app was started. */
export interface DataLocationInput {
  readonly env: Readonly<Record<string, string | undefined>>
  readonly isPackaged: boolean
  /** Folder of the app's own data for this user (%APPDATA%\Planner, ~/.config/Planner…). */
  readonly userData: string
  /** Creates the folder if needed and tells whether the app can write in it. */
  readonly isWritable: (dir: string) => boolean
}

/**
 * Where the data lives, by priority:
 * 1. PLANNER_DATA_DIR (tests and advanced users).
 * 2. Portable .exe (Windows): a PlannerData folder next to the .exe, if it is writable.
 * 3. AppImage (Linux): a PlannerData folder next to the .AppImage file, if it is writable.
 * 4. In development: .planner-data in the project folder.
 * 5. The user's data folder: %APPDATA%\Planner\data on Windows, ~/.config/Planner/data on Linux.
 */
export function chooseDataLocation({ env, isPackaged, userData, isWritable }: DataLocationInput): DataLocation {
  const override = env['PLANNER_DATA_DIR']
  if (override) return { dir: resolve(override), portable: false }
  // Both portable formats keep the data next to the file the user runs.
  for (const appFolder of [env['PORTABLE_EXECUTABLE_DIR'], env['APPIMAGE'] && dirname(env['APPIMAGE'])]) {
    if (!appFolder) continue
    const dir = join(appFolder, 'PlannerData')
    if (isWritable(dir)) return { dir, portable: true }
  }
  if (!isPackaged) return { dir: resolve('.planner-data'), portable: false }
  return { dir: join(userData, 'data'), portable: false }
}
