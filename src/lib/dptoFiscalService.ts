import * as XLSX from 'xlsx'
import { DptoFiscalRow, DptoFiscalImportResult } from '@/types/dptoFiscal'
import { EmpresaRow } from '@/types/empresa'
import { normalizeHeader, formatCNPJ, cleanCNPJ } from '@/lib/empresasService'
import pb from '@/lib/pocketbase/client'

export const DPTO_FISCAL_STORAGE_KEY = 'orbita_dpto_fiscal_pesos'
export const DPTO_FISCAL_PERSIST_KEY = 'orbita_dpto_fiscal_pesos_persistent'
export const DPTO_FISCAL_COLUMN_ORDER_KEY = 'orbita_dpto_fiscal_pesos_column_order'
const COLLECTION_NAME = 'dpto_fiscal'

let isPocketBaseAvailable: boolean | null = null

export function getDptoFiscalBackendStatus(): boolean | null {
  return isPocketBaseAvailable
}

/**
 * Carrega a lista de Dpto. Fiscal - Pesos síncrona do localStorage (com migração de sessionStorage)
 */
export function loadDptoFiscalFromStorage(): DptoFiscalRow[] {
  try {
    const persistent =
      localStorage.getItem(DPTO_FISCAL_PERSIST_KEY) || localStorage.getItem(DPTO_FISCAL_STORAGE_KEY)
    if (persistent) {
      const parsed = JSON.parse(persistent)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }

    const sessionRaw = sessionStorage.getItem(DPTO_FISCAL_STORAGE_KEY)
    if (sessionRaw) {
      const parsedSession = JSON.parse(sessionRaw)
      if (Array.isArray(parsedSession) && parsedSession.length > 0) {
        saveDptoFiscalToStorage(parsedSession)
        return parsedSession
      }
    }
    return []
  } catch {
    return []
  }
}

/**
 * Salva a lista de Dpto. Fiscal permanentemente no localStorage
 */
export function saveDptoFiscalToStorage(rows: DptoFiscalRow[]): void {
  try {
    localStorage.setItem(DPTO_FISCAL_PERSIST_KEY, JSON.stringify(rows))
    localStorage.setItem(DPTO_FISCAL_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // quota exceeded ou ambiente restrito
  }

  syncDptoFiscalToPocketBase(rows).catch(() => {})
}

/**
 * Limpa o armazenamento de Dpto. Fiscal
 */
export function clearDptoFiscalStorage(): void {
  try {
    localStorage.removeItem(DPTO_FISCAL_STORAGE_KEY)
    localStorage.removeItem(DPTO_FISCAL_PERSIST_KEY)
    sessionStorage.removeItem(DPTO_FISCAL_STORAGE_KEY)
  } catch {
    // ignore
  }

  clearDptoFiscalPocketBase().catch(() => {})
}

export function loadDptoFiscalColumnOrderFromStorage(): string[] {
  try {
    const raw =
      localStorage.getItem(DPTO_FISCAL_COLUMN_ORDER_KEY) ||
      sessionStorage.getItem(DPTO_FISCAL_COLUMN_ORDER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((k): k is string => typeof k === 'string')
      }
    }
  } catch {
    // ignore
  }
  return []
}

export function saveDptoFiscalColumnOrderToStorage(order: string[]): void {
  try {
    localStorage.setItem(DPTO_FISCAL_COLUMN_ORDER_KEY, JSON.stringify(order))
  } catch {
    // ignore
  }
}

export function clearDptoFiscalColumnOrderStorage(): void {
  try {
    localStorage.removeItem(DPTO_FISCAL_COLUMN_ORDER_KEY)
    sessionStorage.removeItem(DPTO_FISCAL_COLUMN_ORDER_KEY)
  } catch {
    // ignore
  }
}
/**
 * Busca registros no PocketBase com fallback para armazenamento local.
 * Se o backend estiver vazio e houver dados locais, migra automaticamente.
 */
export async function fetchDptoFiscal(): Promise<DptoFiscalRow[]> {
  const localData = loadDptoFiscalFromStorage()

  try {
    const records = await pb.collection(COLLECTION_NAME).getFullList<Record<string, unknown>>({
      sort: 'created',
      requestKey: null,
    })

    isPocketBaseAvailable = true

    if (records && records.length > 0) {
      const mapped: DptoFiscalRow[] = records.map((r) => ({
        id: String(r.id || ''),
        empresa: String(r.EMPRESAS ?? r.empresa ?? r.nome ?? ''),
        cnpj: String(r.CNPJ ?? r.cnpj ?? ''),
        zona: String(r.ZONA ?? r.zona ?? ''),
        peso: (r.PESO ?? r.peso ?? '') as number | string,
      }))
      try {
        localStorage.setItem(DPTO_FISCAL_PERSIST_KEY, JSON.stringify(mapped))
        localStorage.setItem(DPTO_FISCAL_STORAGE_KEY, JSON.stringify(mapped))
      } catch {
        /* intentionally ignored */
      }
      return mapped
    }

    if (localData.length > 0) {
      const alreadyMigrated = localStorage.getItem('orbita_dpto_fiscal_migrated_v1') === 'true'
      if (!alreadyMigrated) {
        localStorage.setItem('orbita_dpto_fiscal_migrated_v1', 'true')
        syncDptoFiscalToPocketBase(localData).catch(() => {})
      }
      return localData
    }
    return []
  } catch {
    isPocketBaseAvailable = false
  }

  return localData
}

export async function syncDptoFiscalToPocketBase(rows: DptoFiscalRow[]): Promise<void> {
  try {
    const existing = await pb.collection(COLLECTION_NAME).getFullList({ requestKey: null })
    const existingIds = new Set(existing.map((e) => e.id))
    const existingByCnpj = new Map<string, string>()
    const existingByName = new Map<string, string>()

    for (const item of existing) {
      const c = cleanCNPJ((item.cnpj || item.CNPJ || '') as string)
      if (c) existingByCnpj.set(c, item.id)
      const n = normalizeHeader((item.nome || item.empresa || item.EMPRESAS || '') as string)
      if (n) existingByName.set(n, item.id)
    }

    for (const row of rows) {
      const pesoNum =
        typeof row.peso === 'number'
          ? row.peso
          : row.peso
            ? parseFloat(String(row.peso).replace(',', '.')) || null
            : null
      const payload = {
        nome: row.empresa || '',
        cnpj: row.cnpj || '',
        zona: row.zona || '',
        peso: String(row.peso ?? ''),
        EMPRESAS: row.empresa || '',
        CNPJ: row.cnpj || '',
        ZONA: row.zona || '',
        PESO: pesoNum,
        empresa: row.empresa || '',
      }

      const isValidPbId = row.id && row.id.length === 15 && !row.id.includes('-')
      const targetId =
        (isValidPbId && existingIds.has(row.id) ? row.id : undefined) ||
        (cleanCNPJ(row.cnpj) ? existingByCnpj.get(cleanCNPJ(row.cnpj)) : undefined) ||
        (normalizeHeader(row.empresa)
          ? existingByName.get(normalizeHeader(row.empresa))
          : undefined)

      if (targetId) {
        await pb.collection(COLLECTION_NAME).update(targetId, payload, { requestKey: null })
      } else {
        const created = await pb.collection(COLLECTION_NAME).create(payload, { requestKey: null })
        const c = cleanCNPJ(row.cnpj)
        if (c) existingByCnpj.set(c, created.id)
        const n = normalizeHeader(row.empresa)
        if (n) existingByName.set(n, created.id)
        existingIds.add(created.id)
      }
    }
    isPocketBaseAvailable = true
  } catch {
    isPocketBaseAvailable = false
  }
}

export async function clearDptoFiscalPocketBase(): Promise<void> {
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
 * Cria ou atualiza registro individual no backend
 */
export async function saveDptoFiscalRecord(row: DptoFiscalRow): Promise<string | undefined> {
  try {
    const pesoNum =
      typeof row.peso === 'number'
        ? row.peso
        : row.peso
          ? parseFloat(String(row.peso).replace(',', '.')) || null
          : null
    const payload = {
      nome: row.empresa || '',
      cnpj: row.cnpj || '',
      zona: row.zona || '',
      peso: String(row.peso ?? ''),
      EMPRESAS: row.empresa || '',
      CNPJ: row.cnpj || '',
      ZONA: row.zona || '',
      PESO: pesoNum,
      empresa: row.empresa || '',
    }

    const isValidPbId = row.id && row.id.length === 15 && !row.id.includes('-')
    let targetId = isValidPbId ? row.id : undefined

    if (!targetId) {
      const clean = cleanCNPJ(row.cnpj)
      if (clean) {
        const match = await pb
          .collection(COLLECTION_NAME)
          .getFirstListItem(`cnpj ~ "${row.cnpj}"`, { requestKey: null })
          .catch(() => null)
        if (match) targetId = match.id
      }
    }

    if (targetId) {
      const updated = await pb
        .collection(COLLECTION_NAME)
        .update(targetId, payload, { requestKey: null })
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
 * Deleta registro individual no backend
 */
export async function deleteDptoFiscalRecord(id: string): Promise<boolean> {
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
 * Constrói lista a partir das Empresas existentes da aba Empresas.
 */
export function syncFiscalFromEmpresas(
  empresas: EmpresaRow[],
  existingRows: DptoFiscalRow[],
): DptoFiscalRow[] {
  const existingMapByCnpj = new Map<string, DptoFiscalRow>()
  const existingMapByName = new Map<string, DptoFiscalRow>()

  for (const row of existingRows) {
    if (row.cnpj) {
      const clean = cleanCNPJ(row.cnpj)
      if (clean) existingMapByCnpj.set(clean, row)
    }
    const key = row.empresa.trim().toLowerCase()
    if (key) {
      existingMapByName.set(key, row)
    }
  }

  return empresas
    .filter((emp) => emp.empresas && emp.empresas.trim() !== '')
    .map((emp, index) => {
      const cleanCnpjVal = emp.cnpj ? cleanCNPJ(emp.cnpj) : ''
      const nameKey = emp.empresas.trim().toLowerCase()

      const existing =
        (cleanCnpjVal ? existingMapByCnpj.get(cleanCnpjVal) : undefined) ||
        existingMapByName.get(nameKey)

      let pesoVal: number | string = ''
      if (existing) {
        pesoVal = existing.peso
      } else if (emp.peso1 !== '' && emp.peso1 !== null && emp.peso1 !== undefined) {
        pesoVal = emp.peso1
      } else if (emp.peso2 !== '' && emp.peso2 !== null && emp.peso2 !== undefined) {
        pesoVal = emp.peso2
      }

      let zonaVal = ''
      if (existing && existing.zona !== undefined && existing.zona !== '') {
        zonaVal = existing.zona
      } else if (emp.zona !== '' && emp.zona !== null && emp.zona !== undefined) {
        zonaVal = String(emp.zona).trim()
      }

      return {
        id: existing?.id || `fiscal-sync-${Date.now()}-${index}`,
        empresa: emp.empresas.trim(),
        cnpj: emp.cnpj ? formatCNPJ(emp.cnpj) : existing?.cnpj || '',
        zona: zonaVal,
        peso: pesoVal,
      }
    })
}

/**
 * Mapeia cabeçalhos para colunas de Dpto. Fiscal
 */
export function mapFiscalHeaders(headers: string[]): {
  empresaColIdx: number
  pesoColIdx: number
  cnpjColIdx: number
  zonaColIdx: number
  unrecognizedColumns: string[]
} {
  let empresaColIdx = -1
  let pesoColIdx = -1
  let cnpjColIdx = -1
  let zonaColIdx = -1
  const unrecognizedColumns: string[] = []

  headers.forEach((rawHeader, colIdx) => {
    const normalized = normalizeHeader(rawHeader)
    if (!normalized) return

    if (
      empresaColIdx === -1 &&
      (normalized === 'empresas' ||
        normalized === 'empresa' ||
        normalized === 'razao social' ||
        normalized === 'nome' ||
        normalized.startsWith('empresa'))
    ) {
      empresaColIdx = colIdx
    } else if (
      pesoColIdx === -1 &&
      (normalized === 'peso' ||
        normalized === 'peso fiscal' ||
        normalized === 'pesos' ||
        normalized === 'peso 1' ||
        normalized === 'peso1' ||
        normalized === 'peso (fiscal)')
    ) {
      pesoColIdx = colIdx
    } else if (
      cnpjColIdx === -1 &&
      (normalized === 'cnpj' || normalized === 'cnpj cpf' || normalized === 'cpf cnpj')
    ) {
      cnpjColIdx = colIdx
    } else if (
      zonaColIdx === -1 &&
      (normalized === 'zona' || normalized.startsWith('zona ') || normalized.startsWith('zona'))
    ) {
      zonaColIdx = colIdx
    } else {
      unrecognizedColumns.push(rawHeader)
    }
  })

  return { empresaColIdx, pesoColIdx, cnpjColIdx, zonaColIdx, unrecognizedColumns }
}

/**
 * Lê arquivo XLSX / XLS e extrai colunas de EMPRESA e PESO
 */
export async function parseDptoFiscalFile(file: File): Promise<{
  rows: DptoFiscalRow[]
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
  const { empresaColIdx, pesoColIdx, cnpjColIdx, zonaColIdx, unrecognizedColumns } =
    mapFiscalHeaders(headerRow)

  if (empresaColIdx === -1) {
    return { rows: [], ignoredRowsCount: 0, unrecognizedColumns }
  }

  const rows: DptoFiscalRow[] = []
  let ignoredRowsCount = 0

  for (let i = 1; i < rawData.length; i++) {
    const rawRow = rawData[i]
    if (!rawRow || !Array.isArray(rawRow)) {
      ignoredRowsCount++
      continue
    }

    const rawEmpresa = rawRow[empresaColIdx]
    const rawPeso = pesoColIdx !== -1 ? rawRow[pesoColIdx] : ''
    const rawCnpj = cnpjColIdx !== -1 ? rawRow[cnpjColIdx] : ''
    const rawZona = zonaColIdx !== -1 ? rawRow[zonaColIdx] : ''

    const empresaStr = (rawEmpresa ?? '').toString().trim()
    if (!empresaStr) {
      ignoredRowsCount++
      continue
    }

    let pesoVal: number | string = ''
    if (typeof rawPeso === 'number' && Number.isFinite(rawPeso)) {
      pesoVal = rawPeso
    } else if (rawPeso !== null && rawPeso !== undefined && String(rawPeso).trim() !== '') {
      const parsedNum = Number(String(rawPeso).trim().replace(',', '.'))
      pesoVal = !isNaN(parsedNum) ? parsedNum : String(rawPeso).trim()
    }

    const cnpjStr = rawCnpj ? formatCNPJ(String(rawCnpj).trim()) : ''
    const zonaStr = rawZona !== null && rawZona !== undefined ? String(rawZona).trim() : ''

    const id = `fiscal-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`
    rows.push({
      id,
      empresa: empresaStr,
      cnpj: cnpjStr,
      zona: zonaStr,
      peso: pesoVal,
    })
  }

  return { rows, ignoredRowsCount, unrecognizedColumns }
}

/**
 * Mescla novos registros de Dpto. Fiscal com existentes
 */
export function mergeDptoFiscalRows(
  existing: DptoFiscalRow[],
  incoming: DptoFiscalRow[],
  mode: 'replace' | 'append',
): DptoFiscalImportResult {
  if (mode === 'replace') {
    return {
      addedCount: incoming.length,
      updatedCount: 0,
      ignoredRowsCount: 0,
      unrecognizedColumns: [],
      totalRowsProcessed: incoming.length,
      rows: incoming,
    }
  }

  const nameMap = new Map<string, number>()
  const cnpjMap = new Map<string, number>()

  const result: DptoFiscalRow[] = existing.map((r, idx) => {
    const key = r.empresa.trim().toLowerCase()
    if (key) nameMap.set(key, idx)
    if (r.cnpj) {
      const clean = cleanCNPJ(r.cnpj)
      if (clean) cnpjMap.set(clean, idx)
    }
    return { ...r }
  })

  let addedCount = 0
  let updatedCount = 0

  for (const item of incoming) {
    const nameKey = item.empresa.trim().toLowerCase()
    const cleanCnpj = item.cnpj ? cleanCNPJ(item.cnpj) : ''

    let targetIdx: number | undefined
    if (cleanCnpj && cnpjMap.has(cleanCnpj)) {
      targetIdx = cnpjMap.get(cleanCnpj)
    } else if (nameKey && nameMap.has(nameKey)) {
      targetIdx = nameMap.get(nameKey)
    }

    if (targetIdx !== undefined) {
      result[targetIdx] = {
        ...result[targetIdx],
        peso: item.peso !== '' ? item.peso : result[targetIdx].peso,
        zona:
          item.zona !== undefined && item.zona !== '' ? item.zona : result[targetIdx].zona || '',
        cnpj: item.cnpj || result[targetIdx].cnpj || '',
      }
      updatedCount++
    } else {
      result.push(item)
      addedCount++
      const newIdx = result.length - 1
      if (nameKey) nameMap.set(nameKey, newIdx)
      if (cleanCnpj) cnpjMap.set(cleanCnpj, newIdx)
    }
  }

  return {
    addedCount,
    updatedCount,
    ignoredRowsCount: 0,
    unrecognizedColumns: [],
    totalRowsProcessed: incoming.length,
    rows: result,
  }
}
