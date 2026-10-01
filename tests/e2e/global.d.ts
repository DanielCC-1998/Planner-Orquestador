import type { PlannerBridge } from '@shared/ipc/contract'

declare global {
  interface Window {
    planner: PlannerBridge
  }
}

export {}
