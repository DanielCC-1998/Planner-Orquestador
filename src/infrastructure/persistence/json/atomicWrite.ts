import { copyFile, open, rename } from 'node:fs/promises'

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES'])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function codeOf(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined
}

/**
 * On Windows the antivirus or the indexer may lock a file for a moment:
 * retry with a growing delay before giving up.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (!RETRYABLE.has(codeOf(e) ?? '') || i >= attempts - 1) throw e
      await sleep(15 * 2 ** i)
    }
  }
}

/**
 * Write that survives power cuts: writes `<file>.tmp`, forces it to disk (fsync),
 * copies the previous version to `<file>.bak` and renames the temporary file over the original.
 */
export async function atomicWrite(file: string, data: string, keepBackup = true): Promise<void> {
  const tmp = `${file}.tmp`
  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(data, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  if (keepBackup) {
    try {
      await withRetry(() => copyFile(file, `${file}.bak`))
    } catch (e) {
      if (codeOf(e) !== 'ENOENT') throw e
    }
  }
  await withRetry(() => rename(tmp, file))
}

export function isNotFound(e: unknown): boolean {
  return codeOf(e) === 'ENOENT'
}
