import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CHANNELS, EVENTS, type PlannerBridge } from '@shared/ipc/contract'

const allowedChannels = new Set<string>(CHANNELS)
const allowedEvents = new Set<string>(EVENTS)

/** Minimal bridge: only the channels of the contract, never ipcRenderer itself. */
const bridge: PlannerBridge = {
  invoke(channel, input) {
    if (!allowedChannels.has(channel)) {
      return Promise.resolve({
        ok: false,
        error: { code: 'FORBIDDEN', message: `Channel not allowed: ${channel}`, reason: 'FORBIDDEN_CHANNEL', params: { channel } }
      })
    }
    return ipcRenderer.invoke(channel, input)
  },
  on(event, listener) {
    if (!allowedEvents.has(event)) return () => undefined
    const handler = (_e: IpcRendererEvent, payload: unknown) => listener(payload as never)
    ipcRenderer.on(event, handler)
    return () => {
      ipcRenderer.removeListener(event, handler)
    }
  }
}

contextBridge.exposeInMainWorld('planner', bridge)
