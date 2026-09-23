import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Worker resolution configuration
// In Vite/browser environments, setting GlobalWorkerOptions.workerSrc with an explicit URL
// or using a fallback to cdnjs matching the exact pdfjs-dist version.
const PDFJS_VERSION = pdfjsLib.version || '4.10.38'

function setupPdfWorker() {
  if (typeof window === 'undefined' || !pdfjsLib.GlobalWorkerOptions) return

  try {
    if (pdfWorkerUrl) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return
    }
  } catch {
    // ignore
  }

  // Fallback to reliable CDN matching the exact version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`
}

setupPdfWorker()

export interface PdfTextExtractionOptions {
  password?: string
}

export interface PdfTextExtractionResult {
  fullText: string
  pageTexts: string[]
  totalPages: number
  hasTextLayer: boolean
  isPasswordProtected?: boolean
  error?: string
}

/**
 * Helper to get a configured document loading task with fallbacks
 */
function createDocumentTask(data: ArrayBuffer, password?: string) {
  return pdfjsLib.getDocument({
    data: data.slice(0), // copy buffer so retries don't fail if transferred
    password: password || undefined,
    useSystemFonts: true,
    isEvalSupported: false,
  })
}

/**
 * Extracts plain text from an ArrayBuffer of a PDF document page by page.
 * Safely handles password protection, empty text layers (scanned images), and corrupted files.
 * Includes worker fallback mechanism if the primary worker fails to load.
 */
export async function extractTextFromPdf(
  data: ArrayBuffer,
  options?: PdfTextExtractionOptions,
): Promise<PdfTextExtractionResult> {
  const password = options?.password

  const attemptExtraction = async (useFallbackWorker = false): Promise<PdfTextExtractionResult> => {
    if (useFallbackWorker) {
      // Switch worker to public CDN matching exact version
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`
      } catch {
        // ignore
      }
    }

    const loadingTask = createDocumentTask(data, password)
    const pdfDoc = await loadingTask.promise
    const totalPages = pdfDoc.numPages
    const pageTexts: string[] = []

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()

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
      isPasswordProtected: false,
    }
  }

  try {
    return await attemptExtraction(false)
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string; code?: number }
    const errMessage = (errorObj?.message || '').toLowerCase()

    // If it failed because of worker load issues, try fallback CDN worker once
    if (
      errMessage.includes('worker') ||
      errMessage.includes('failed to fetch') ||
      errMessage.includes('dynamically imported module') ||
      errMessage.includes('setting up fake worker failed')
    ) {
      try {
        return await attemptExtraction(true)
      } catch (fallbackErr: unknown) {
        const fallbackObj = fallbackErr as { name?: string; message?: string }
        if (
          fallbackObj?.name === 'PasswordException' ||
          (fallbackObj?.message || '').toLowerCase().includes('password')
        ) {
          return {
            fullText: '',
            pageTexts: [],
            totalPages: 0,
            hasTextLayer: false,
            isPasswordProtected: true,
            error: password
              ? 'Senha incorreta, tente novamente.'
              : 'Este arquivo PDF é protegido por senha.',
          }
        }
      }
    }

    let friendlyError = 'Não foi possível ler o arquivo PDF.'
    const isPassword =
      errorObj?.name === 'PasswordException' ||
      errMessage.includes('password') ||
      errorObj?.code === 1 || // PDFJS PasswordResponses.NEED_PASSWORD
      errorObj?.code === 2 // PDFJS PasswordResponses.INCORRECT_PASSWORD

    if (isPassword) {
      friendlyError = password
        ? 'Senha incorreta, tente novamente.'
        : 'Este arquivo PDF é protegido por senha.'
    } else if (errorObj?.name === 'InvalidPDFException') {
      friendlyError = 'O arquivo fornecido não é um PDF válido ou está corrompido.'
    } else if (
      errMessage.includes('fake worker') ||
      errMessage.includes('dynamically imported module') ||
      errMessage.includes('setting up fake worker')
    ) {
      friendlyError =
        'Não foi possível inicializar o leitor de PDF no navegador. Verifique sua conexão com a internet ou tente novamente.'
    } else if (errorObj?.message) {
      friendlyError = `Erro ao ler PDF: ${errorObj.message}`
    }

    return {
      fullText: '',
      pageTexts: [],
      totalPages: 0,
      hasTextLayer: false,
      isPasswordProtected: isPassword,
      error: friendlyError,
    }
  }
}
