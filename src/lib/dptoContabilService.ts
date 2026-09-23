import * as XLSX from 'xlsx'
import { DptoContabilRow, DptoContabilImportResult } from '@/types/dptoContabil'
import { EmpresaRow } from '@/types/empresa'
import { normalizeHeader, formatCNPJ, cleanCNPJ } from '@/lib/empresasService'

export const DPTO_CONTABIL_STORAGE_KEY = 'orbita_dpto_contabil'

/**
 * Carrega a lista de Dpto. Contábil persistida em sessionStorage
 */
export function loadDptoContabilFromStorage(): DptoContabilRow[] {
  try {
    const raw = sessionStorage.getItem(DPTO_CONTABIL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Salva a lista de Dpto. Contábil no sessionStorage
 */
export function saveDptoContabilToStorage(rows: DptoContabilRow[]): void {
  try {
    sessionStorage.setItem(DPTO_CONTABIL_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // quota exceeded ou ambiente restrito
  }
}

/**
 * Limpa o sessionStorage de Dpto. Contábil
 */
export function clearDptoContabilStorage(): void {
  try {
    sessionStorage.removeItem(DPTO_CONTABIL_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Constrói lista a partir das Empresas existentes da aba Empresas.
 * Copia nome + CNPJ das empresas e o valor atual da coluna CONTÁBIL.
 * Preserva edições que o usuário já possa ter feito localmente na aba Contábil.
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

      return {
        id: existing?.id || `contabil-sync-${Date.now()}-${index}`,
        empresa: emp.empresas.trim(),
        cnpj: emp.cnpj ? formatCNPJ(emp.cnpj) : existing?.cnpj || '',
        contabil: contabilVal,
      }
    })
}

/**
 * Mapeia cabeçalhos para colunas de Dpto. Contábil:
 * - EMPRESAS (empresa, razao social, nome)
 * - CONTÁBIL (contabil, dpto contabil, depto contabil, setor contabil)
 * - CNPJ (opcional, para identificação e correspondência)
 */
export function mapContabilHeaders(headers: string[]): {
  empresaColIdx: number
  contabilColIdx: number
  cnpjColIdx: number
  unrecognizedColumns: string[]
} {
  let empresaColIdx = -1
  let contabilColIdx = -1
  let cnpjColIdx = -1
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
    } else {
      unrecognizedColumns.push(rawHeader)
    }
  })

  return { empresaColIdx, contabilColIdx, cnpjColIdx, unrecognizedColumns }
}

/**
 * Lê arquivo XLSX / XLS e extrai colunas de EMPRESA e CONTÁBIL (e CNPJ se presente)
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
  const { empresaColIdx, contabilColIdx, cnpjColIdx, unrecognizedColumns } =
    mapContabilHeaders(headerRow)

  // Se não identificou coluna de empresa, não é possível associar
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

    const empresaStr = (rawEmpresa ?? '').toString().trim()
    if (!empresaStr) {
      ignoredRowsCount++
      continue
    }

    const contabilStr =
      rawContabil !== null && rawContabil !== undefined ? String(rawContabil).trim() : ''

    const cnpjStr = rawCnpj ? formatCNPJ(String(rawCnpj).trim()) : ''

    const id = `contabil-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`
    rows.push({
      id,
      empresa: empresaStr,
      cnpj: cnpjStr,
      contabil: contabilStr,
    })
  }

  return { rows, ignoredRowsCount, unrecognizedColumns }
}

/**
 * Mescla novos registros de Dpto. Contábil com existentes (replace ou append/merge por nome/CNPJ da empresa)
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
