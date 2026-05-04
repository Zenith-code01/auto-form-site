import { PDFDocument, type PDFRef } from 'pdf-lib'
import { supabase } from '@/src/lib/supabase'

export type PdfFieldInfo = {
  name: string
  type: string
  pageIndex?: number
  x?: number
  y?: number
  width?: number
  height?: number
  pdfOrder?: number
}

function getFieldPosition(
  pdfDoc: PDFDocument,
  field: ReturnType<ReturnType<PDFDocument['getForm']>['getFields']>[number]
) {
  const pages = pdfDoc.getPages()
  const widgets = field.acroField.getWidgets()
  const positions = widgets
    .map((widget) => {
      const rect = widget.getRectangle()
      const pageRef = widget.P()
      let page = pages.find((item) => item.ref === pageRef)

      if (!page) {
        const widgetRef = pdfDoc.context.getObjectRef(widget.dict) as PDFRef | undefined
        page = widgetRef ? pdfDoc.findPageForAnnotationRef(widgetRef) : undefined
      }

      const pageIndex = page ? pages.indexOf(page) : Number.MAX_SAFE_INTEGER
      return {
        pageIndex,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }
    })
    .sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
      const topA = a.y + a.height
      const topB = b.y + b.height
      if (Math.abs(topA - topB) > 2) return topB - topA
      if (Math.abs(a.x - b.x) > 2) return a.x - b.x
      return 0
    })

  return positions[0]
}

export async function getPdfFields(fileName: string): Promise<PdfFieldInfo[]> {
  const { data, error } = await supabase.storage
    .from('pdf-forms')
    .download(fileName)

  if (error || !data) {
    throw new Error('无法下载原始 PDF 文件')
  }

  const bytes = await data.arrayBuffer()
  const pdfDoc = await PDFDocument.load(bytes)
  const form = pdfDoc.getForm()

  const fields = form.getFields()

  return fields
    .map((field, index) => {
      const name = field.getName()
      const type = field.constructor.name
      const position = getFieldPosition(pdfDoc, field)
      return { name, type, ...position, pdfOrder: index }
    })
    .sort((a, b) => {
      if ((a.pageIndex ?? Number.MAX_SAFE_INTEGER) !== (b.pageIndex ?? Number.MAX_SAFE_INTEGER)) {
        return (a.pageIndex ?? Number.MAX_SAFE_INTEGER) - (b.pageIndex ?? Number.MAX_SAFE_INTEGER)
      }

      const topA = (a.y ?? 0) + (a.height ?? 0)
      const topB = (b.y ?? 0) + (b.height ?? 0)
      if (Math.abs(topA - topB) > 2) return topB - topA

      if (Math.abs((a.x ?? 0) - (b.x ?? 0)) > 2) {
        return (a.x ?? 0) - (b.x ?? 0)
      }

      return a.pdfOrder - b.pdfOrder
    })
}
