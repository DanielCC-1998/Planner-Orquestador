import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The code base is written in English: comments, docstrings, string literals and JSX text.
 * Spanish may only appear inside `// i18n:es-start` … `// i18n:es-end` blocks (the Spanish
 * translations and the Spanish words the duration parser accepts).
 */
const ROOT = resolve(__dirname, '../../..')
const FOLDERS = ['src', 'tests', 'scripts']
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.cjs'])
const ROOT_FILES = ['electron.vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'eslint.config.mjs']

// i18n:es-start
/** Accents, ¿¡«» and frequent Spanish words that do not exist in English (lower case on purpose: "Del" is a key). */
const SPANISH = /[áéíóúñÁÉÍÓÚÑ¿¡«»]|\b(los|las|del|una|unas|para|con|sin|por|que|está|también|cada|aquí|tarea|tareas|proyecto|proyectos|subtarea|subtareas|añadir|guardar|horas|persona|personas|según)\b/
// i18n:es-end

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : files(path)
    return EXTENSIONS.has(extname(name)) ? [path] : []
  })
}

/** Line ranges (1-based, inclusive) between the Spanish markers. */
function spanishBlocks(text: string): Array<[number, number]> {
  const blocks: Array<[number, number]> = []
  let start: number | null = null
  text.split('\n').forEach((line, i) => {
    if (line.includes('i18n:es-start')) start = i + 1
    else if (line.includes('i18n:es-end') && start !== null) {
      blocks.push([start, i + 1])
      start = null
    }
  })
  return blocks
}

interface Finding {
  readonly line: number
  readonly text: string
}

/** Comments, string literals, template texts and JSX text of a file, with their line. */
function texts(path: string, source: string): Finding[] {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : /\.[mc]?js$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
  const out: Finding[] = []
  const seenComments = new Set<number>()
  const lineOf = (pos: number) => file.getLineAndCharacterOfPosition(pos).line + 1
  const addComments = (ranges: readonly ts.CommentRange[] | undefined) => {
    for (const r of ranges ?? []) {
      if (seenComments.has(r.pos)) continue
      seenComments.add(r.pos)
      out.push({ line: lineOf(r.pos), text: source.slice(r.pos, r.end) })
    }
  }
  const visit = (node: ts.Node) => {
    addComments(ts.getLeadingCommentRanges(source, node.getFullStart()))
    addComments(ts.getTrailingCommentRanges(source, node.getEnd()))
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      out.push({ line: lineOf(node.getStart(file)), text: node.getText(file) })
    }
    for (const child of node.getChildren(file)) visit(child)
  }
  visit(file)
  return out
}

describe('the code is written in English', () => {
  const paths = [...FOLDERS.flatMap((folder) => files(join(ROOT, folder))), ...ROOT_FILES.map((f) => join(ROOT, f))]

  it.each(paths.map((p) => [relative(ROOT, p).replace(/\\/g, '/'), p]))('%s', (_name, path) => {
    const source = readFileSync(path, 'utf8')
    const blocks = spanishBlocks(source)
    const inBlock = (line: number) => blocks.some(([from, to]) => line >= from && line <= to)
    const spanish = texts(path, source)
      .filter((f) => !inBlock(f.line) && SPANISH.test(f.text))
      .map((f) => `${f.line}: ${f.text.trim().slice(0, 120)}`)
    expect(spanish).toEqual([])
  })
})
