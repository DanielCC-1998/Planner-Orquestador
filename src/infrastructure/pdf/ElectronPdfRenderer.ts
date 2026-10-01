import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { PdfRenderer, ReportModel } from '@application'
import { footerTemplate, renderReportHtml } from './reportHtml'

/**
 * Renders the quote with Chromium's print engine: a hidden window, a temporary HTML file
 * (data: URLs have a size limit) and printToPDF.
 */
export class ElectronPdfRenderer implements PdfRenderer {
  constructor(private readonly tempDir: string) {}

  async render(model: ReportModel): Promise<Uint8Array> {
    const file = join(this.tempDir, `planner-report-${randomUUID()}.html`)
    await writeFile(file, renderReportHtml(model), 'utf8')
    const win = new BrowserWindow({
      show: false,
      width: 1240,
      height: 1754,
      webPreferences: {
        javascript: false,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    try {
      await win.loadFile(file)
      const pdf = await win.webContents.printToPDF({
        pageSize: model.options.pageSize,
        landscape: model.options.landscape,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate(model),
        margins: { top: 0.5, bottom: 0.65, left: 0.55, right: 0.55 },
        generateDocumentOutline: false
      })
      return new Uint8Array(pdf)
    } finally {
      win.destroy()
      await rm(file, { force: true })
    }
  }
}
