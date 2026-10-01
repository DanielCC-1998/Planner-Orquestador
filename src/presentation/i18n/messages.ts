import type { Language } from '@domain'
import { PRIORITY_LABELS, STATUS_LABELS } from '@shared/labels'
import * as app from './catalog/app'
import * as board from './catalog/board'
import * as common from './catalog/common'
import * as components from './catalog/components'
import * as detail from './catalog/detail'
import * as errorsApp from './catalog/errors.app'
import * as errorsCodes from './catalog/errors.codes'
import * as errorsDomain from './catalog/errors.domain'
import * as errorsInfra from './catalog/errors.infra'
import * as exportPdf from './catalog/export'
import * as projectSettings from './catalog/projectSettings'
import * as projects from './catalog/projects'
import * as settings from './catalog/settings'
import * as shortcuts from './catalog/shortcuts'
import * as summary from './catalog/summary'
import * as tags from './catalog/tags'
import * as taskDialogs from './catalog/taskDialogs'
import * as team from './catalog/team'
import * as toolbar from './catalog/toolbar'
import * as tree from './catalog/tree'
import * as workload from './catalog/workload'

/**
 * All interface texts, grouped by area. English is the reference shape: every Spanish
 * catalog is typed `typeof en`, so a missing translation does not compile.
 */
const en = {
  common: common.en,
  app: app.en,
  components: components.en,
  projects: projects.en,
  toolbar: toolbar.en,
  summary: summary.en,
  tree: tree.en,
  board: board.en,
  workload: workload.en,
  detail: detail.en,
  export: exportPdf.en,
  projectSettings: projectSettings.en,
  settings: settings.en,
  shortcuts: shortcuts.en,
  taskDialogs: taskDialogs.en,
  team: team.en,
  tags: tags.en,
  status: STATUS_LABELS.en,
  priority: PRIORITY_LABELS.en,
  errors: { codes: errorsCodes.en, domain: errorsDomain.en, app: errorsApp.en, infra: errorsInfra.en }
}

export type Messages = typeof en

const es: Messages = {
  common: common.es,
  app: app.es,
  components: components.es,
  projects: projects.es,
  toolbar: toolbar.es,
  summary: summary.es,
  tree: tree.es,
  board: board.es,
  workload: workload.es,
  detail: detail.es,
  export: exportPdf.es,
  projectSettings: projectSettings.es,
  settings: settings.es,
  shortcuts: shortcuts.es,
  taskDialogs: taskDialogs.es,
  team: team.es,
  tags: tags.es,
  status: STATUS_LABELS.es,
  priority: PRIORITY_LABELS.es,
  errors: { codes: errorsCodes.es, domain: errorsDomain.es, app: errorsApp.es, infra: errorsInfra.es }
}

export const MESSAGES: Readonly<Record<Language, Messages>> = { en, es }
