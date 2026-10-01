import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readStoredLanguage } from '@infrastructure/electron/main/language'

const dir = mkdtempSync(join(tmpdir(), 'planner-language-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const settingsWith = (content: string) => {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(file, content)
  return file
}

describe('readStoredLanguage', () => {
  it('returns an explicitly chosen language', () => {
    expect(readStoredLanguage(settingsWith('{"language":"es"}'))).toBe('es')
    expect(readStoredLanguage(settingsWith('{"theme":"dark","language":"en"}'))).toBe('en')
  })

  it("returns null for 'system', a missing file or invalid content", () => {
    expect(readStoredLanguage(settingsWith('{"language":"system"}'))).toBeNull()
    expect(readStoredLanguage(settingsWith('{"language":"fr"}'))).toBeNull()
    expect(readStoredLanguage(settingsWith('not json'))).toBeNull()
    expect(readStoredLanguage(join(dir, 'missing.json'))).toBeNull()
  })
})
