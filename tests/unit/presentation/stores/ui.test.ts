import { beforeEach, describe, expect, it } from 'vitest'
import { useUi } from '@presentation/stores/ui'

const ui = () => useUi.getState()
const type = (text: string) => {
  for (const char of text) ui().pushTypeAhead({ kind: 'char', char })
}

describe('type-ahead (keys pressed before the editor exists)', () => {
  beforeEach(() => ui().clearTypeAhead())

  it('only captures while it is active', () => {
    type('x')
    expect(ui().typeAhead).toBeNull()
    ui().beginTypeAhead()
    type('Hel')
    ui().pushTypeAhead({ kind: 'char', char: 'p' })
    ui().pushTypeAhead({ kind: 'backspace' })
    type('lo')
    expect(ui().takeTypeAhead()).toEqual({ text: 'Hello', action: null })
    expect(ui().typeAhead).toBeNull()
  })

  it('each editor consumes up to the first control key and leaves the rest in order', () => {
    ui().beginTypeAhead()
    type('Login form')
    ui().pushTypeAhead({ kind: 'key', key: 'enter' })
    ui().pushTypeAhead({ kind: 'key', key: 'shift-tab' })
    type('Sign-up')
    ui().pushTypeAhead({ kind: 'key', key: 'escape' })

    expect(ui().takeTypeAhead()).toEqual({ text: 'Login form', action: 'enter' })
    // The chained action does not reset the pending queue.
    ui().beginTypeAhead()
    expect(ui().takeTypeAhead()).toEqual({ text: '', action: 'shift-tab' })
    expect(ui().takeTypeAhead()).toEqual({ text: 'Sign-up', action: 'escape' })
    expect(ui().typeAhead).toBeNull()
  })

  it('clearTypeAhead discards what is pending', () => {
    ui().beginTypeAhead()
    type('abc')
    ui().clearTypeAhead()
    expect(ui().takeTypeAhead()).toEqual({ text: '', action: null })
  })
})
