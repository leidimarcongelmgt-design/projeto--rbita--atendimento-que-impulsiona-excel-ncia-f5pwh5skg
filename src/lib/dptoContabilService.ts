import * as XLSX from 'xlsx'
import { DptoContabilRow, DptoContabilImportResult } from '@/types/dptoContabil'
import { EmpresaRow } from '@/types/empresa'
import { normalizeHeader, formatCNPJ, cleanCNPJ } from '@/lib/empresasService'
import pb from '@/lib/pocketbase/client'

export const DPTO_CONTABIL_STORAGE_KEY = 'orbita_dpto_contabil'
export const DPTO_CONTABIL_PERSIST_KEY = 'orbita_dpto_contabil_persistent'
export const DPTO_CONTABIL_COLUMN_ORDER_KEY = 'orbita_dpto_contabil_column_order'
const COLLECTION_NAME = 'dpto_contabil'

let isPocketBaseAvailable: boolean | null = null

export function getDptoContabilBackendStatus(): boolean | null {
  return isPocketBaseAvailable
}

/**
 * Carrega a lista de Dpto. Contábil síncrona do localStorage (com migração de sessionStorage)
 */
export function loadDptoContabilFromStorage(): DptoContabilRow[] {
  try {
    const persistent =
      localStorage.getItem(DPTO_CONTABIL_PERSIST_KEY) ||
      localStorage.getItem(DPTO_CONTABIL_STORAGE_KEY)
    if (persistent) {
      const parsed = JSON.parse(persistent)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }

    const sessionRaw = sessionStorage.getItem(DPTO_CONTABIL_STORAGE_KEY)
    if (sessionRaw) {
      const parsedSession = JSON.parse(sessionRaw)
      if (Array.isArray(parsedSession) && parsedSession.length > 0) {
        saveDptoContabilToStorage(parsedSession)
        return parsedSession
      }
    }
    return []
  } catch {
    return []
  }
}

/**
 * Salva a lista de Dpto. Contábil permanentemente no localStorage
 */
export function saveDptoContabilToStorage(rows: DptoContabilRow[]): void {
  try {
    localStorage.setItem(DPTO_CONTABIL_PERSIST_KEY, JSON.stringify(rows))
    localStorage.setItem(DPTO_CONTABIL_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // quota exceeded ou ambiente restrito
  }

  syncDptoContabilToPocketBase(rows).catch(() => {})
}

/**
 * Limpa o armazenamento de Dpto. Contábil
 */
export function clearDptoContabilStorage(): void {
  try {
    localStorage.removeItem(DPTO_CONTABIL_STORAGE_KEY)
    localStorage.removeItem(DPTO_CONTABIL_PERSIST_KEY)
    sessionStorage.removeItem(DPTO_CONTABIL_STORAGE_KEY)
  } catch {
    // ignore
  }

  clearDptoContabilPocketBase().catch(() => {})
}

export function loadDptoContabilColumnOrderFromStorage(): string[] {
  try {
    const raw =
      localStorage.getItem(DPTO_CONTABIL_COLUMN_ORDER_KEY) ||
      sessionStorage.getItem(DPTO_CONTABIL_COLUMN_ORDER_KEY)
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

export function saveDptoContabilColumnOrderToStorage(order: string[]): void {
  try {
    localStorage.setItem(DPTO_CONTABIL_COLUMN_ORDER_KEY, JSON.stringify(order))
  } catch {
    // ignore
  }
}

export function clearDptoContabilColumnOrderStorage(): void {
  try {
    localStorage.removeItem(DPTO_CONTABIL_COLUMN_ORDER_KEY)
    sessionStorage.removeItem(DPTO_CONTABIL_COLUMN_ORDER_KEY)
  } catch {
    // ignore
  }
}
/**
 * Busca registros no PocketBase com fallback para armazenamento local.
 * Se o backend estiver vazio e houver dados locais, migra automaticamente.
 */
export async function fetchDptoContabil(): Promise<DptoContabilRow[]> {
  const localData = loadDptoContabilFromStorage()

  try {
    const records = await fetchAllPocketBaseRecords(COLLECTION_NAME)

    isPocketBaseAvailable = true

    if (records && records.length > 0) {
      const mapped: DptoContabilRow[] = records.map((r) => ({
        id: String(r.id || ''),
        empresa: String(r.EMPRESAS ?? r.empresa ?? r.nome ?? ''),
        cnpj: String(r.CNPJ ?? r.cnpj ?? ''),
        zona: String(r.ZONA ?? r.zona ?? ''),
        contabil: String(r.CONTABIL ?? r.contabil ?? ''),
      }))
      try {
        localStorage.setItem(DPTO_CONTABIL_PERSIST_KEY, JSON.stringify(mapped))
        localStorage.setItem(DPTO_CONTABIL_STORAGE_KEY, JSON.stringify(mapped))
      } catch {
        /* intentionally ignored */
      }
      return mapped
    }

    if (localData.length > 0) {
      const alreadyMigrated = localStorage.getItem('orbita_dpto_contabil_migrated_v1') === 'true'
      if (!alreadyMigrated) {
        localStorage.setItem('orbita_dpto_contabil_migrated_v1', 'true')
        syncDptoContabilToPocketBase(localData).catch(() => {})
      }
      return localData
    }
    return []
  } catch {
    isPocketBaseAvailable = false
  }

  return localData
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err: unknown) {
      attempt++
      const is429 =
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status: number }).status === 429
      if (attempt <= maxRetries && is429) {
        await sleep(300 * Math.pow(2, attempt - 1))
        continue
      }
      throw err
    }
  }
}

async function fetchAllPocketBaseRecords(
  collectionName: string,
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = []
  let page = 1
  const perPage = 200

  while (true) {
    const res = await retryWithBackoff(() =>
      pb.collection(collectionName).getList<Record<string, unknown>>(page, perPage, {
        sort: 'created',
        requestKey: null,
      }),
    )

    if (res.items && res.items.length > 0) {
      records.push(...res.items)
    }

    if (page >= res.totalPages || res.items.length === 0) {
      break
    }
    page++
  }

  return records
}

let syncContabilQueue = Promise.resolve()

export async function syncDptoContabilToPocketBase(rows: DptoContabilRow[]): Promise<void> {
  const runSync = async () => {
    try {
      const existing = await fetchAllPocketBaseRecords(COLLECTION_NAME)
      const existingIds = new Set(existing.map((e) => String(e.id || '')))
      const existingByCnpj = new Map<string, string>()
      const existingByName = new Map<string, string>()

      for (const item of existing) {
        const itemId = String(item.id || '')
        const c = cleanCNPJ((item.cnpj || item.CNPJ || '') as string)
        if (c && !existingByCnpj.has(c)) existingByCnpj.set(c, itemId)
        const n = normalizeHeader((item.nome || item.empresa || item.EMPRESAS || '') as string)
        if (n && !existingByName.has(n)) existingByName.set(n, itemId)
      }

      for (const row of rows) {
        const payload = {
          nome: row.empresa || '',
          cnpj: row.cnpj || '',
          zona: row.zona || '',
          contabil: row.contabil || '',
          EMPRESAS: row.empresa || '',
          CNPJ: row.cnpj || '',
          ZONA: row.zona || '',
          CONTABIL: row.contabil || '',
          empresa: row.empresa || '',
        }

        const cleanC = cleanCNPJ(row.cnpj)
        const normN = normalizeHeader(row.empresa)
        const isValidPbId = row.id && row.id.length === 15 && !row.id.includes('-')

        // Preferência por match existente: se já existir CNPJ ou nome no índice, sempre ATUALIZA
        const targetId =
          (cleanC ? existingByCnpj.get(cleanC) : undefined) ||
          (normN ? existingByName.get(normN) : undefined) ||
          (isValidPbId && existingIds.has(row.id) ? row.id : undefined)

        if (targetId) {
          await retryWithBackoff(() =>
            pb.collection(COLLECTION_NAME).update(targetId, payload, { requestKey: null }),
          )
          if (cleanC) existingByCnpj.set(cleanC, targetId)
          if (normN) existingByName.set(normN, targetId)
        } else {
          const created = await retryWithBackoff(() =>
            pb.collection(COLLECTION_NAME).create(payload, { requestKey: null }),
          )
          const newId = String(created.id)
          if (cleanC) existingByCnpj.set(cleanC, newId)
          if (normN) existingByName.set(normN, newId)
          existingIds.add(newId)
        }
        await sleep(40)
      }
      isPocketBaseAvailable = true
    } catch {
      isPocketBaseAvailable = false
    }
  }

  syncContabilQueue = syncContabilQueue.then(runSync, runSync)
  return syncContabilQueue
}

export async function clearDptoContabilPocketBase(): Promise<void> {
  try {
    const list = await fetchAllPocketBaseRecords(COLLECTION_NAME)
    for (const r of list) {
      if (r.id) {
        await retryWithBackoff(() =>
          pb.collection(COLLECTION_NAME).delete(String(r.id), { requestKey: null }),
        ).catch(() => {})
        await sleep(30)
      }
    }
    isPocketBaseAvailable = true
  } catch {
    isPocketBaseAvailable = false
  }
}

/**
 * Cria ou atualiza registro individual no backend
 */
export async function saveDptoContabilRecord(row: DptoContabilRow): Promise<string | undefined> {
  try {
    const payload = {
      nome: row.empresa || '',
      cnpj: row.cnpj || '',
      zona: row.zona || '',
      contabil: row.contabil || '',
      EMPRESAS: row.empresa || '',
      CNPJ: row.cnpj || '',
      ZONA: row.zona || '',
      CONTABIL: row.contabil || '',
      empresa: row.empresa || '',
    }

    const isValidPbId = row.id && row.id.length === 15 && !row.id.includes('-')
    let targetId = isValidPbId ? row.id : undefined

    if (!targetId) {
      const clean = cleanCNPJ(row.cnpj)
      if (clean) {
        const match = await retryWithBackoff(() =>
          pb
            .collection(COLLECTION_NAME)
            .getFirstListItem(`cnpj ~ "${clean}"`, { requestKey: null }),
        ).catch(() => null)
        if (match) targetId = match.id
      }
    }

    if (targetId) {
      const updated = await retryWithBackoff(() =>
        pb.collection(COLLECTION_NAME).update(targetId!, payload, { requestKey: null }),
      )
      isPocketBaseAvailable = true
      return updated.id
    } else {
      const created = await retryWithBackoff(() =>
        pb.collection(COLLECTION_NAME).create(payload, { requestKey: null }),
      )
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
export async function deleteDptoContabilRecord(id: string): Promise<boolean> {
  try {
    const isValidPbId = id && id.length === 15 && !id.includes('-')
    if (isValidPbId) {
      await retryWithBackoff(() => pb.collection(COLLECTION_NAME).delete(id, { requestKey: null }))
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
export function syncContabilFromEmpresas(
  empresas: EmpresaRow[],
  existingRows: DptoContabilRow[],
): DptoContabilRow[] {
  const existingMapByCnpj = new Map<string, DptoContabilRow>()
  const existingMapByName = new Map<string, DptoContabilRow>()

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

      let contabilVal = ''
      if (existing) {
        contabilVal = existing.contabil
      } else if (emp.contabil !== '' && emp.contabil !== null && emp.contabil !== undefined) {
        contabilVal = String(emp.contabil).trim()
      }

      let zonaVal = ''
      if (existing && existing.zona !== undefined && existing.zona !== '') {
        zonaVal = existing.zona
      } else if (emp.zona !== '' && emp.zona !== null && emp.zona !== undefined) {
        zonaVal = String(emp.zona).trim()
      }

      return {
        id: existing?.id || `contabil-sync-${Date.now()}-${index}`,
        empresa: emp.empresas.trim(),
        cnpj: emp.cnpj ? formatCNPJ(emp.cnpj) : existing?.cnpj || '',
        zona: zonaVal,
        contabil: contabilVal,
      }
    })
}

/**
 * Mapeia cabeçalhos para colunas de Dpto. Contábil
 */
export function mapContabilHeaders(headers: string[]): {
  empresaColIdx: number
  contabilColIdx: number
  cnpjColIdx: number
  zonaColIdx: number
  unrecognizedColumns: string[]
} {
  let empresaColIdx = -1
  let contabilColIdx = -1
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
      contabilColIdx === -1 &&
      (normalized === 'contabil' ||
        normalized.includes('contabil') ||
        normalized === 'dpto contabil' ||
        normalized === 'depto contabil')
    ) {
      contabilColIdx = colIdx
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

  return { empresaColIdx, contabilColIdx, cnpjColIdx, zonaColIdx, unrecognizedColumns }
}

/**
 * Lê arquivo XLSX / XLS e extrai colunas de EMPRESA e CONTÁBIL
 */
export async function parseDptoContabilFile(file: File): Promise<{
  rows: DptoContabilRow[]
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
  const { empresaColIdx, contabilColIdx, cnpjColIdx, zonaColIdx, unrecognizedColumns } =
    mapContabilHeaders(headerRow)

  if (empresaColIdx === -1) {
    return { rows: [], ignoredRowsCount: 0, unrecognizedColumns }
  }

  const rows: DptoContabilRow[] = []
  let ignoredRowsCount = 0

  for (let i = 1; i < rawData.length; i++) {
    const rawRow = rawData[i]
    if (!rawRow || !Array.isArray(rawRow)) {
      ignoredRowsCount++
      continue
    }

    const rawEmpresa = rawRow[empresaColIdx]
    const rawContabil = contabilColIdx !== -1 ? rawRow[contabilColIdx] : ''
    const rawCnpj = cnpjColIdx !== -1 ? rawRow[cnpjColIdx] : ''
    const rawZona = zonaColIdx !== -1 ? rawRow[zonaColIdx] : ''

    const empresaStr = (rawEmpresa ?? '').toString().trim()
    if (!empresaStr) {
      ignoredRowsCount++
      continue
    }

    const contabilStr =
      rawContabil !== null && rawContabil !== undefined ? String(rawContabil).trim() : ''

    const cnpjStr = rawCnpj ? formatCNPJ(String(rawCnpj).trim()) : ''
    const zonaStr = rawZona !== null && rawZona !== undefined ? String(rawZona).trim() : ''

    const id = `contabil-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`
    rows.push({
      id,
      empresa: empresaStr,
      cnpj: cnpjStr,
      zona: zonaStr,
      contabil: contabilStr,
    })
  }

  return { rows, ignoredRowsCount, unrecognizedColumns }
}

/**
 * Mescla novos registros de Dpto. Contábil com existentes
 */
export function mergeDptoContabilRows(
  existing: DptoContabilRow[],
  incoming: DptoContabilRow[],
  mode: 'replace' | 'append',
): DptoContabilImportResult {
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

  const result: DptoContabilRow[] = existing.map((r, idx) => {
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
        contabil: item.contabil !== '' ? item.contabil : result[targetIdx].contabil,
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
