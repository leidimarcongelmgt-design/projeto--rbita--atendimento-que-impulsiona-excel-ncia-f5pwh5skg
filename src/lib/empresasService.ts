import * as XLSX from 'xlsx'
import { EmpresaRow, ImportResult } from '@/types/empresa'
import pb from '@/lib/pocketbase/client'

export const EMPRESAS_STORAGE_KEY = 'orbita_empresas'
export const EMPRESAS_PERSIST_KEY = 'orbita_empresas_persistent'
const COLLECTION_NAME = 'empresas'

/**
 * Indicador de disponibilidade do backend
 */
let isPocketBaseAvailable: boolean | null = null
let hasWarnedOffline = false

export function getEmpresasBackendStatus(): { isAvailable: boolean | null; hasWarned: boolean } {
  return { isAvailable: isPocketBaseAvailable, hasWarned: hasWarnedOffline }
}

/**
 * Remove acentos, pontuação, múltiplos espaços e converte para minúsculas
 */
export function normalizeHeader(header: string): string {
  return (header || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/[º°.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Formata CNPJ: se tiver 14 dígitos (com ou sem máscara), formata como 00.000.000/0000-00.
 */
export function formatCNPJ(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  const digits = str.replace(/\D/g, '')

  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  if (digits.length >= 11 && digits.length < 14) {
    const padded = digits.padStart(14, '0')
    return padded.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }

  return str
}

/**
 * Extrai apenas dígitos para comparação de chave de duplicata
 */
export function cleanCNPJ(value: string | number | null | undefined): string {
  if (!value) return ''
  const digits = String(value).replace(/\D/g, '')
  if (digits.length >= 11 && digits.length <= 14) {
    return digits.padStart(14, '0')
  }
  return digits || String(value).trim().toLowerCase()
}

/**
 * Carrega a lista de empresas síncrona do localStorage (com migração de sessionStorage)
 */
export function loadEmpresasFromStorage(): EmpresaRow[] {
  try {
    const persistent = localStorage.getItem(EMPRESAS_PERSIST_KEY)
    if (persistent) {
      const parsed = JSON.parse(persistent)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }

    const sessionRaw = sessionStorage.getItem(EMPRESAS_STORAGE_KEY)
    if (sessionRaw) {
      const parsedSession = JSON.parse(sessionRaw)
      if (Array.isArray(parsedSession) && parsedSession.length > 0) {
        saveEmpresasToStorage(parsedSession)
        return parsedSession
      }
    }
    return []
  } catch {
    return []
  }
}

/**
 * Salva a lista de empresas localmente (localStorage + sessionStorage) e sincroniza assincronamente com o banco
 */
export function saveEmpresasToStorage(empresas: EmpresaRow[]): void {
  try {
    localStorage.setItem(EMPRESAS_PERSIST_KEY, JSON.stringify(empresas))
    sessionStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(empresas))
  } catch {
    // quota exceeded ou ambiente restrito
  }

  // Dispara sincronização em segundo plano
  syncEmpresasToPocketBase(empresas).catch(() => {})
}

/**
 * Limpa o armazenamento de empresas (local e no backend se disponível)
 */
export function clearEmpresasStorage(): void {
  try {
    localStorage.removeItem(EMPRESAS_PERSIST_KEY)
    sessionStorage.removeItem(EMPRESAS_STORAGE_KEY)
  } catch {
    // ignore
  }

  clearEmpresasPocketBase().catch(() => {})
}

/**
 * Busca empresas no PocketBase com fallback resiliente para armazenamento local.
 * Se o backend estiver vazio e houver dados no sessionStorage/localStorage, faz o envio inicial.
 */
export async function fetchEmpresas(): Promise<EmpresaRow[]> {
  const localData = loadEmpresasFromStorage()

  try {
    const records = await pb.collection(COLLECTION_NAME).getFullList<EmpresaRow>({
      sort: 'created',
      requestKey: null,
    })

    isPocketBaseAvailable = true

    if (records && records.length > 0) {
      const mapped: EmpresaRow[] = records.map((r) => ({
        id: r.id,
        empresas: r.empresas || '',
        cnpj: r.cnpj || '',
        regimeTrib: r.regimeTrib || '',
        ramoAtividade: r.ramoAtividade || '',
        zona: r.zona || '',
        filial: r.filial || '',
        entrada: r.entrada || '',
        grupo: r.grupo || '',
        contabil: r.contabil,
        numFunc: r.numFunc,
        peso1: r.peso1,
        peso2: r.peso2,
      }))
      try {
        localStorage.setItem(EMPRESAS_PERSIST_KEY, JSON.stringify(mapped))
        sessionStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(mapped))
      } catch {
        /* intentionally ignored */
      }
      return mapped
    }

    // Backend está vazio mas temos dados locais: migração inicial
    if (localData.length > 0) {
      syncEmpresasToPocketBase(localData).catch(() => {})
    }
  } catch {
    isPocketBaseAvailable = false
    // Backend indisponível: app continua funcionando sem interrupção usando dados locais
  }

  return localData
}

/**
 * Sincroniza conjunto de empresas no PocketBase (criação / atualização)
 */
export async function syncEmpresasToPocketBase(empresas: EmpresaRow[]): Promise<void> {
  try {
    const existing = await pb.collection(COLLECTION_NAME).getFullList({ requestKey: null })
    const existingIds = new Set(existing.map((e) => e.id))

    for (const emp of empresas) {
      const payload = {
        empresas: emp.empresas,
        cnpj: emp.cnpj,
        regimeTrib: emp.regimeTrib,
        ramoAtividade: emp.ramoAtividade,
        zona: emp.zona,
        filial: emp.filial,
        entrada: emp.entrada,
        grupo: emp.grupo,
        contabil: emp.contabil || '',
        numFunc: String(emp.numFunc ?? ''),
        peso1: String(emp.peso1 ?? ''),
        peso2: String(emp.peso2 ?? ''),
      }

      // PocketBase IDs têm 15 caracteres alfanuméricos
      const isValidPbId = emp.id && emp.id.length === 15 && !emp.id.includes('-')
      if (isValidPbId && existingIds.has(emp.id)) {
        await pb.collection(COLLECTION_NAME).update(emp.id, payload, { requestKey: null })
      } else {
        await pb.collection(COLLECTION_NAME).create(payload, { requestKey: null })
      }
    }
    isPocketBaseAvailable = true
  } catch {
    isPocketBaseAvailable = false
  }
}

/**
 * Remove todos os registros no backend
 */
export async function clearEmpresasPocketBase(): Promise<void> {
  try {
    const list = await pb.collection(COLLECTION_NAME).getFullList({ requestKey: null })
    for (const r of list) {
      await pb.collection(COLLECTION_NAME).delete(r.id, { requestKey: null })
    }
    isPocketBaseAvailable = true
  } catch {
    isPocketBaseAvailable = false
  }
}

/**
 * Cria ou atualiza uma empresa individual no backend
 */
export async function saveEmpresaRecord(empresa: EmpresaRow): Promise<string | undefined> {
  try {
    const payload = {
      empresas: empresa.empresas,
      cnpj: empresa.cnpj,
      regimeTrib: empresa.regimeTrib,
      ramoAtividade: empresa.ramoAtividade,
      zona: empresa.zona,
      filial: empresa.filial,
      entrada: empresa.entrada,
      grupo: empresa.grupo,
      contabil: empresa.contabil || '',
      numFunc: String(empresa.numFunc ?? ''),
      peso1: String(empresa.peso1 ?? ''),
      peso2: String(empresa.peso2 ?? ''),
    }

    const isValidPbId = empresa.id && empresa.id.length === 15 && !empresa.id.includes('-')
    if (isValidPbId) {
      const updated = await pb
        .collection(COLLECTION_NAME)
        .update(empresa.id, payload, { requestKey: null })
      isPocketBaseAvailable = true
      return updated.id
    } else {
      const created = await pb.collection(COLLECTION_NAME).create(payload, { requestKey: null })
      isPocketBaseAvailable = true
      return created.id
    }
  } catch {
    isPocketBaseAvailable = false
    return undefined
  }
}

/**
 * Deleta uma empresa no backend
 */
export async function deleteEmpresaRecord(id: string): Promise<boolean> {
  try {
    const isValidPbId = id && id.length === 15 && !id.includes('-')
    if (isValidPbId) {
      await pb.collection(COLLECTION_NAME).delete(id, { requestKey: null })
      isPocketBaseAvailable = true
      return true
    }
    return false
  } catch {
    isPocketBaseAvailable = false
    return false
  }
}

/**
 * Mapeia cabeçalhos da planilha para as propriedades de EmpresaRow (8 colunas ativas).
 */
export function mapHeadersToFields(headers: string[]): {
  mapping: Map<number, keyof Omit<EmpresaRow, 'id' | 'contabil' | 'numFunc' | 'peso1' | 'peso2'>>
  unrecognizedColumns: string[]
} {
  const mapping = new Map<
    number,
    keyof Omit<EmpresaRow, 'id' | 'contabil' | 'numFunc' | 'peso1' | 'peso2'>
  >()
  const unrecognizedColumns: string[] = []

  headers.forEach((rawHeader, colIdx) => {
    const normalized = normalizeHeader(rawHeader)
    if (!normalized) return

    if (
      normalized === 'empresas' ||
      normalized === 'empresa' ||
      normalized === 'razao social' ||
      normalized === 'nome'
    ) {
      mapping.set(colIdx, 'empresas')
    } else if (normalized === 'cnpj' || normalized === 'cnpj cpf' || normalized === 'cpf cnpj') {
      mapping.set(colIdx, 'cnpj')
    } else if (
      normalized.includes('regime') ||
      normalized === 'regime trib' ||
      normalized === 'regime tributario'
    ) {
      mapping.set(colIdx, 'regimeTrib')
    } else if (
      normalized.includes('ramo') ||
      normalized.includes('atividade') ||
      normalized === 'ramo de atividade 2' ||
      normalized === 'ramo de atividade'
    ) {
      mapping.set(colIdx, 'ramoAtividade')
    } else if (normalized === 'zona' || normalized.startsWith('zona ')) {
      mapping.set(colIdx, 'zona')
    } else if (
      normalized.includes('func') ||
      normalized === 'n func' ||
      normalized === 'num func' ||
      normalized === 'numero de funcionarios' ||
      normalized === 'qtd func' ||
      normalized === 'nº func' ||
      normalized === 'nº func.' ||
      normalized === 'colaboradores' ||
      normalized === 'empregados'
    ) {
      return
    } else if (
      normalized === 'peso' ||
      normalized === 'peso 1' ||
      normalized === 'peso1' ||
      normalized === 'peso 2' ||
      normalized === 'peso2' ||
      normalized === 'peso (2)'
    ) {
      return
    } else if (
      normalized === 'contabil' ||
      normalized.includes('contabil') ||
      normalized === 'contabilidade' ||
      normalized.includes('contabilidade') ||
      normalized === 'dpto contabil' ||
      normalized === 'depto contabil' ||
      normalized === 'setor contabil'
    ) {
      return
    } else if (normalized === 'filial' || normalized.includes('filial')) {
      mapping.set(colIdx, 'filial')
    } else if (
      normalized === 'entrada' ||
      normalized.includes('entrada') ||
      normalized === 'cliente desde' ||
      normalized.includes('cliente desde') ||
      normalized === 'desde'
    ) {
      mapping.set(colIdx, 'entrada')
    } else if (normalized === 'grupo' || normalized.includes('grupo')) {
      mapping.set(colIdx, 'grupo')
    } else {
      unrecognizedColumns.push(rawHeader)
    }
  })

  return { mapping, unrecognizedColumns }
}

function normalizeCellValue(val: unknown): string | number {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : ''
  }
  return String(val).trim()
}

/**
 * Lê arquivo XLSX / XLS e extrai registros de empresas
 */
export async function parseEmpresasFile(file: File): Promise<{
  rows: EmpresaRow[]
  ignoredRowsCount: number
  unrecognizedColumns: string[]
}> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    return { rows: [], ignoredRowsCount: 0, unrecognizedColumns: [] }
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (!rawData || rawData.length === 0) {
    return { rows: [], ignoredRowsCount: 0, unrecognizedColumns: [] }
  }

  const headerRow = (rawData[0] || []).map((c) => String(c ?? ''))
  const { mapping, unrecognizedColumns } = mapHeadersToFields(headerRow)

  const rows: EmpresaRow[] = []
  let ignoredRowsCount = 0

  for (let i = 1; i < rawData.length; i++) {
    const rawRow = rawData[i]
    if (!rawRow || !Array.isArray(rawRow)) {
      ignoredRowsCount++
      continue
    }

    const rowObj: Partial<Omit<EmpresaRow, 'contabil' | 'numFunc' | 'peso1' | 'peso2'>> = {
      empresas: '',
      cnpj: '',
      regimeTrib: '',
      ramoAtividade: '',
      zona: '',
      filial: '',
      entrada: '',
      grupo: '',
    }

    rawRow.forEach((cellVal, colIdx) => {
      const field = mapping.get(colIdx)
      if (field) {
        const val = normalizeCellValue(cellVal)
        if (field === 'cnpj') {
          rowObj.cnpj = formatCNPJ(val)
        } else {
          // @ts-expect-error dynamic assign to matching rowObj field
          rowObj[field] = val
        }
      }
    })

    const empresasVal = (rowObj.empresas || '').toString().trim()
    const cnpjVal = (rowObj.cnpj || '').toString().trim()

    if (!empresasVal && !cnpjVal) {
      ignoredRowsCount++
      continue
    }

    const id = `emp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`

    rows.push({
      id,
      empresas: empresasVal,
      cnpj: cnpjVal ? formatCNPJ(cnpjVal) : '',
      regimeTrib: (rowObj.regimeTrib || '').toString().trim(),
      ramoAtividade: (rowObj.ramoAtividade || '').toString().trim(),
      zona: (rowObj.zona || '').toString().trim(),
      filial: (rowObj.filial || '').toString().trim(),
      entrada: (rowObj.entrada || '').toString().trim(),
      grupo: (rowObj.grupo || '').toString().trim(),
    })
  }

  return {
    rows,
    ignoredRowsCount,
    unrecognizedColumns,
  }
}

/**
 * Combina novos registros com registros existentes (append ou merge por CNPJ)
 */
export function mergeEmpresas(
  existing: EmpresaRow[],
  incoming: EmpresaRow[],
  mode: 'replace' | 'append',
): ImportResult {
  if (mode === 'replace') {
    return {
      addedCount: incoming.length,
      updatedCount: 0,
      ignoredRowsCount: 0,
      unrecognizedColumns: [],
      totalRowsProcessed: incoming.length,
      newRecords: incoming,
    }
  }

  const cnpjMap = new Map<string, number>()
  const result: EmpresaRow[] = existing.map((r, idx) => {
    const clean = cleanCNPJ(r.cnpj)
    if (clean) cnpjMap.set(clean, idx)
    return { ...r }
  })

  let addedCount = 0
  let updatedCount = 0

  for (const item of incoming) {
    const clean = cleanCNPJ(item.cnpj)
    if (clean && cnpjMap.has(clean)) {
      const existingIdx = cnpjMap.get(clean)!
      const existingRow = result[existingIdx]
      result[existingIdx] = {
        ...item,
        id: existingRow.id,
      }
      updatedCount++
    } else {
      result.push(item)
      addedCount++
      if (clean) {
        cnpjMap.set(clean, result.length - 1)
      }
    }
  }

  return {
    addedCount,
    updatedCount,
    ignoredRowsCount: 0,
    unrecognizedColumns: [],
    totalRowsProcessed: incoming.length,
    newRecords: result,
  }
}
