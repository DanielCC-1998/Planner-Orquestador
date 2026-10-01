import type { SettingsRepository } from '../ports'
import { mergeSettings, type Settings, type SettingsPatch } from './Settings'

export class SettingsService {
  private cache: Settings | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly repo: SettingsRepository) {}

  async get(): Promise<Settings> {
    if (!this.cache) this.cache = await this.repo.load()
    return this.cache
  }

  /** Updates are serialized so that two changes in a row do not overwrite each other. */
  update(patch: SettingsPatch): Promise<Settings> {
    const run = this.queue.then(async () => {
      const next = mergeSettings(await this.get(), patch)
      this.cache = next
      await this.repo.save(next)
      return next
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}
