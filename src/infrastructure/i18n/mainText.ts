import type { Language } from '@domain'

/** Texts the main process writes itself: native dialog filters and names of copies and files. */
export interface MainText {
  readonly projectFileFilter: string
  readonly imageFileFilter: string
  readonly pdfFileFilter: string
  /** Name of a duplicated project. */
  readonly copyName: (name: string) => string
  /** Name of an imported project whose id already exists. */
  readonly importedName: (name: string) => string
  /** File name used when the project name has no usable characters. */
  readonly defaultFileName: string
}

export const MAIN_TEXT: Readonly<Record<Language, MainText>> = {
  en: {
    projectFileFilter: 'Planner project',
    imageFileFilter: 'Image',
    pdfFileFilter: 'PDF',
    copyName: (name) => `${name} (copy)`,
    importedName: (name) => `${name} (imported)`,
    defaultFileName: 'project'
  },
  // i18n:es-start
  es: {
    projectFileFilter: 'Proyecto de Planner',
    imageFileFilter: 'Imagen',
    pdfFileFilter: 'PDF',
    copyName: (name) => `${name} (copia)`,
    importedName: (name) => `${name} (importado)`,
    defaultFileName: 'proyecto'
  }
  // i18n:es-end
}
