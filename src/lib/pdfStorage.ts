export interface AttachedPdf {
  name: string
  size: number
  blobUrl: string
  uploadedAt: string
}

export function getMemoryPdf(): AttachedPdf | null {
  return memoryPdf
}

const STORAGE_KEY = 'dossie_attached_pdf_meta'
const STORAGE_DATA_KEY = 'dossie_attached_pdf_base64'
// 3MB limit for sessionStorage
const MAX_SESSION_STORAGE_BYTES = 3 * 1024 * 1024

// In-memory reference for the current runtime
let memoryPdf: AttachedPdf | null = null

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
export function loadPersistedPdf(): AttachedPdf | null {
  if (memoryPdf) {
    return memoryPdf
  }

  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return null
  }

  try {
    const metaStr = sessionStorage.getItem(STORAGE_KEY)
    const base64 = sessionStorage.getItem(STORAGE_DATA_KEY)
    if (metaStr && base64) {
      const meta = JSON.parse(metaStr) as { name?: string; size?: number; uploadedAt?: string }
      if (!meta || !meta.name) {
        clearAttachedPdf()
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

      memoryPdf = {
        name: meta.name,
        size: typeof meta.size === 'number' ? meta.size : byteNumbers.length,
        blobUrl,
        uploadedAt: meta.uploadedAt || new Date().toISOString(),
      }
      return memoryPdf
    }
  } catch (err) {
    // sessionStorage failed, corrupted data, or quota issue - clean up smoothly
    console.warn('Falha ao restaurar PDF anexado da sessão:', err)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_DATA_KEY)
    } catch {
      // ignore
    }
  }

  return null
}

/**
 * Store a newly imported PDF file
 */
export async function savePdfFile(file: File): Promise<AttachedPdf> {
  // If there was an old blobUrl, revoke it
  if (memoryPdf?.blobUrl) {
    URL.revokeObjectURL(memoryPdf.blobUrl)
  }

  const blobUrl = URL.createObjectURL(file)
  const attached: AttachedPdf = {
    name: file.name,
    size: file.size,
    blobUrl,
    uploadedAt: new Date().toISOString(),
  }
  memoryPdf = attached

  // Attempt sessionStorage if under size threshold
  if (file.size <= MAX_SESSION_STORAGE_BYTES) {
    try {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const base64 = reader.result as string
          sessionStorage.setItem(STORAGE_DATA_KEY, base64)
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              name: attached.name,
              size: attached.size,
              uploadedAt: attached.uploadedAt,
            }),
          )
        } catch {
          // Exceeded storage quota, just retain in memory
        }
      }
      reader.readAsDataURL(file)
    } catch {
      // Ignore sessionStorage errors
    }
  } else {
    // Clean old sessionStorage entry if file is larger
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_DATA_KEY)
    } catch {
      // Ignore
    }
  }

  return attached
}

/**
 * Remove attached PDF and cleanup resources
 */
export function clearAttachedPdf(): void {
  if (memoryPdf?.blobUrl) {
    URL.revokeObjectURL(memoryPdf.blobUrl)
  }
  memoryPdf = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_DATA_KEY)
  } catch {
    // Ignore
  }
}

/**
 * Retrieves the ArrayBuffer of the currently attached PDF (from memory or session)
 */
export async function getAttachedPdfArrayBuffer(
  attached: AttachedPdf,
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
    try {
      const base64 = sessionStorage.getItem(STORAGE_DATA_KEY)
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
