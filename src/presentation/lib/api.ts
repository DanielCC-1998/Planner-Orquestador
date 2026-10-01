import type { ErrorParams } from '@domain'
import type { Channel, EventName, Events, Input, IpcError, IpcResult, Output, PlannerBridge } from '@shared/ipc/contract'
import { describeError } from '../i18n/errors'

declare global {
  interface Window {
    planner: PlannerBridge
  }
}

/** Error answered by main; it keeps `reason` and `params` so the UI can show it in any language. */
export class ApiError extends Error {
  readonly code: string
  readonly reason: string | undefined
  readonly params: ErrorParams | undefined

  constructor(error: IpcError) {
    super(error.message)
    this.code = error.code
    this.reason = error.reason
    this.params = error.params
  }
}

type Args<K extends Channel> = Input<K> extends void ? [] : [Input<K>]

/** Calls main and returns the data; if main answers with an error, throws an ApiError. */
export async function call<K extends Channel>(channel: K, ...args: Args<K>): Promise<Output<K>> {
  const result = await window.planner.invoke(channel, args[0] as Input<K>)
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}

/** Like `call`, but returns the result instead of throwing. */
export function tryCall<K extends Channel>(channel: K, ...args: Args<K>): Promise<IpcResult<Output<K>>> {
  return window.planner.invoke(channel, args[0] as Input<K>)
}

export function onEvent<E extends EventName>(event: E, listener: (payload: Events[E]) => void): () => void {
  return window.planner.on(event, listener)
}

/** Text of a caught error in the current language. */
export function errorMessage(e: unknown): string {
  return describeError(e)
}
