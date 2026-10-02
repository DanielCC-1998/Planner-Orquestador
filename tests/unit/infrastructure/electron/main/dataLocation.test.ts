import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chooseDataLocation, type DataLocationInput } from '@infrastructure/electron/main/dataLocation'

const USER_DATA = resolve('/home/dana/.config/Planner')
const choose = (input: Partial<DataLocationInput>) =>
  chooseDataLocation({ env: {}, isPackaged: true, userData: USER_DATA, isWritable: () => true, ...input })

describe('data folder of the app', () => {
  it('PLANNER_DATA_DIR always wins', () => {
    expect(choose({ env: { PLANNER_DATA_DIR: 'data', APPIMAGE: '/apps/Planner.AppImage' } })).toEqual({ dir: resolve('data'), portable: false })
  })

  it('the portable .exe and the AppImage keep the data next to the file the user runs', () => {
    expect(choose({ env: { PORTABLE_EXECUTABLE_DIR: 'C:/Tools' } })).toEqual({ dir: join('C:/Tools', 'PlannerData'), portable: true })
    expect(choose({ env: { APPIMAGE: '/home/dana/Apps/Planner-1.0.0.AppImage' } })).toEqual({
      dir: join('/home/dana/Apps', 'PlannerData'),
      portable: true
    })
  })

  it('where that folder cannot be written, the data goes to the folder of the user', () => {
    const readOnly = choose({ env: { APPIMAGE: '/opt/Planner.AppImage' }, isWritable: () => false })
    expect(readOnly).toEqual({ dir: join(USER_DATA, 'data'), portable: false })
  })

  it('installed: the folder of the user; in development: .planner-data', () => {
    expect(choose({})).toEqual({ dir: join(USER_DATA, 'data'), portable: false })
    expect(choose({ isPackaged: false })).toEqual({ dir: resolve('.planner-data'), portable: false })
  })
})
