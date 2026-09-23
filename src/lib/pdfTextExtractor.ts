import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Configure worker src with Vite url resolution
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
}

export interface PdfTextExtractionResult {
  fullText: string
  pageTexts: string[]
  totalPages: number
  hasTextLayer: boolean
  error?: string
}

/**
 * Extracts plain text from an ArrayBuffer of a PDF document page by page.
 * Safely handles password protection, empty text layers (scanned images), and corrupted files.
 */
export async function extractTextFromPdf(data: ArrayBuffer): Promise<PdfTextExtractionResult> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      isEvalSupported: false,
    })

    const pdfDoc = await loadingTask.promise
    const totalPages = pdfDoc.numPages
    const pageTexts: string[] = []

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Combine text items preserving spaces and newlines where appropriate
      let lastY: number | null = null
      let pageStr = ''

      for (const item of textContent.items) {
        if ('str' in item) {
          const textItem = item as { str: string; transform?: number[] }
          const currentY = textItem.transform ? textItem.transform[5] : null

          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
            pageStr += '\n'
          } else if (pageStr.length > 0 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
            pageStr += ' '
          }

          pageStr += textItem.str
          if (currentY !== null) {
            lastY = currentY
          }
        }
      }

      pageTexts.push(pageStr.trim())
    }

    const fullText = pageTexts.join('\n\n')
    const hasTextLayer = fullText.replace(/\s+/g, '').length > 20

    return {
      fullText,
      pageTexts,
      totalPages,
      hasTextLayer,
    }
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string }
    let friendlyError = 'Não foi possível ler o arquivo PDF.'

    if (errorObj?.name === 'PasswordException') {
      friendlyError = 'Este arquivo PDF é protegido por senha e não pôde ser lido.'
    } else if (errorObj?.name === 'InvalidPDFException') {
      friendlyError = 'O arquivo fornecido não é um PDF válido ou está corrompido.'
    } else if (errorObj?.message) {
      friendlyError = `Erro ao ler PDF: ${errorObj.message}`
    }

    return {
      fullText: '',
      pageTexts: [],
      totalPages: 0,
      hasTextLayer: false,
      error: friendlyError,
    }
  }
}
