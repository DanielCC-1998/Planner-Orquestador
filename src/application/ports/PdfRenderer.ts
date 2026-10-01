import type { ReportModel } from '../reports/ReportModel'

/** Turns the report model into a PDF. */
export interface PdfRenderer {
  render(model: ReportModel): Promise<Uint8Array>
}
