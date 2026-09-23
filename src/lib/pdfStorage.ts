export type PdfDocumentCategory = 'cnpj' | 'ie' | 'im'

export interface AttachedPdf {
  name: string
  size: number
  blobUrl: string
  uploadedAt: string
  category?: PdfDocumentCategory
}

// In-memory references for the current runtime
const memoryPdfs: Record<PdfDocumentCategory, AttachedPdf | null> = {
  cnpj: null,
  ie: null,
  im: null,
}

export function getMemoryPdf(category: PdfDocumentCategory): AttachedPdf | null {
  return memoryPdfs[category]
}

const getStorageKeys = (category: PdfDocumentCategory) => {
  return {
    meta: `dossie_attached_pdf_${category}_meta`,
    data: `dossie_attached_pdf_${category}_base64`,
  }
}

// 3MB limit for sessionStorage
const MAX_SESSION_STORAGE_BYTES = 3 * 1024 * 1024

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Load PDF from memory or restore from sessionStorage if available
 */
export function loadPersistedPdf(category: PdfDocumentCategory): AttachedPdf | null {
  if (memoryPdfs[category]) {
    return memoryPdfs[category]
  }

  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return null
  }

  const { meta: metaKey, data: dataKey } = getStorageKeys(category)

  try {
    const metaStr = sessionStorage.getItem(metaKey)
    const base64 = sessionStorage.getItem(dataKey)
    if (metaStr && base64) {
      const meta = JSON.parse(metaStr) as { name?: string; size?: number; uploadedAt?: string }
      if (!meta || !meta.name) {
        clearAttachedPdf(category)
        return null
      }

      // Convert base64 data url back to Blob safely
      const parts = base64.split(',')
      const base64Content = parts[1] || parts[0] || ''
      const byteCharacters = atob(base64Content)
      const byteNumbers = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([byteNumbers], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)

      const restored: AttachedPdf = {
        name: meta.name,
        size: typeof meta.size === 'number' ? meta.size : byteNumbers.length,
        blobUrl,
        uploadedAt: meta.uploadedAt || new Date().toISOString(),
        category,
      }
      memoryPdfs[category] = restored
      return restored
    }
  } catch (err) {
    console.warn(`Falha ao restaurar PDF (${category}) da sessão:`, err)
    try {
      sessionStorage.removeItem(metaKey)
      sessionStorage.removeItem(dataKey)
    } catch {
      // ignore
    }
  }

  return null
}

/**
 * Store a newly imported PDF file under specified category
 */
export async function savePdfFile(file: File, category: PdfDocumentCategory): Promise<AttachedPdf> {
  const current = memoryPdfs[category]
  if (current?.blobUrl) {
    URL.revokeObjectURL(current.blobUrl)
  }

  const blobUrl = URL.createObjectURL(file)
  const attached: AttachedPdf = {
    name: file.name,
    size: file.size,
    blobUrl,
    uploadedAt: new Date().toISOString(),
    category,
  }
  memoryPdfs[category] = attached

  const { meta: metaKey, data: dataKey } = getStorageKeys(category)

  // Attempt sessionStorage if under size threshold
  if (file.size <= MAX_SESSION_STORAGE_BYTES) {
    try {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const base64 = reader.result as string
          sessionStorage.setItem(dataKey, base64)
          sessionStorage.setItem(
            metaKey,
            JSON.stringify({
              name: attached.name,
              size: attached.size,
              uploadedAt: attached.uploadedAt,
              category,
            }),
          )
        } catch {
          // Exceeded storage quota, retain in memory
        }
      }
      reader.readAsDataURL(file)
    } catch {
      // Ignore sessionStorage errors
    }
  } else {
    // Clean old sessionStorage entry if file is larger
    try {
      sessionStorage.removeItem(metaKey)
      sessionStorage.removeItem(dataKey)
    } catch {
      // Ignore
    }
  }

  return attached
}

/**
 * Remove attached PDF of specific category and cleanup resources
 */
export function clearAttachedPdf(category: PdfDocumentCategory): void {
  const current = memoryPdfs[category]
  if (current?.blobUrl) {
    URL.revokeObjectURL(current.blobUrl)
  }
  memoryPdfs[category] = null

  const { meta: metaKey, data: dataKey } = getStorageKeys(category)
  try {
    sessionStorage.removeItem(metaKey)
    sessionStorage.removeItem(dataKey)
  } catch {
    // Ignore
  }
}

/**
 * Clear all attached PDFs (for reset / nova consulta)
 */
export function clearAllAttachedPdfs(): void {
  // Limpa também as chaves legadas do documento principal se existirem na sessão
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('dossie_attached_pdf_meta')
      sessionStorage.removeItem('dossie_attached_pdf_base64')
    } catch {
      // ignore
    }
  }

  const categories: PdfDocumentCategory[] = ['cnpj', 'ie', 'im']
  for (const cat of categories) {
    clearAttachedPdf(cat)
  }
}

/**
 * Retrieves the ArrayBuffer of the currently attached PDF (from memory or session)
 */
export async function getAttachedPdfArrayBuffer(
  attached: AttachedPdf,
  category: PdfDocumentCategory = attached.category || 'cnpj',
): Promise<ArrayBuffer | null> {
  // Try fetching from blobUrl first
  if (attached.blobUrl) {
    try {
      const res = await fetch(attached.blobUrl)
      if (res.ok) {
        return await res.arrayBuffer()
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback to sessionStorage base64 if available
  if (typeof sessionStorage !== 'undefined') {
    const { data: dataKey } = getStorageKeys(category)
    try {
      const base64 = sessionStorage.getItem(dataKey)
      if (base64) {
        const parts = base64.split(',')
        const base64Content = parts[1] || parts[0] || ''
        const byteCharacters = atob(base64Content)
        const byteNumbers = new Uint8Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        return byteNumbers.buffer as ArrayBuffer
      }
    } catch {
      // Ignore
    }
  }

  return null
}
