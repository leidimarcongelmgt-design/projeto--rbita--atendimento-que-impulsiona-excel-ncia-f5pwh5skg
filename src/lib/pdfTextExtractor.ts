import * as pdfjsLib from 'pdfjs-dist'
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'

let workerPortOrOptionsConfigured = false

/**
 * Configuração definitiva e auto-contida do worker do PDF.js para Vite / navegador:
 * Ao invés de depender de `GlobalWorkerOptions.workerSrc` com URL que força fetch de módulo externo,
 * instanciamos diretamente o Web Worker empacotado pelo Vite com `?worker`:
 * `import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'`
 * e configuramos `GlobalWorkerOptions.workerPort = new PdfjsWorker()`.
 *
 * Benefícios:
 * 1. O Vite empacota o worker como um script dedicado garantido pelo bundle da aplicação.
 * 2. NUNCA há chamada a `import()` dinâmico não resolvido em runtime no navegador.
 * 3. Se por alguma razão Web Workers estiverem restritos no ambiente, há fallback ordenado.
 */
export function ensurePdfWorker(): void {
  if (
    typeof window === 'undefined' ||
    !pdfjsLib.GlobalWorkerOptions ||
    workerPortOrOptionsConfigured
  ) {
    return
  }

  try {
    if (typeof Worker !== 'undefined') {
      const workerInstance = new PdfjsWorker()
      pdfjsLib.GlobalWorkerOptions.workerPort = workerInstance
      workerPortOrOptionsConfigured = true
      return
    }
  } catch (err) {
    console.warn('Aviso ao inicializar Worker via workerPort:', err)
  }

  // Fallback caso instanciar workerPort lance erro no ambiente
  try {
    const fallbackUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    pdfjsLib.GlobalWorkerOptions.workerSrc = fallbackUrl
    workerPortOrOptionsConfigured = true
  } catch (err) {
    console.warn('Aviso ao inicializar workerSrc de fallback:', err)
  }
}

// Inicializa o worker no carregamento do módulo
ensurePdfWorker()

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
    stopAtErrors: false,
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
    ensurePdfWorker()

    if (useFallbackWorker && pdfjsLib.GlobalWorkerOptions) {
      // Se o worker principal falhou, tentamos o CDN compatível como último recurso
      try {
        const fallbackCdn = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`
        pdfjsLib.GlobalWorkerOptions.workerPort = null
        pdfjsLib.GlobalWorkerOptions.workerSrc = fallbackCdn
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
