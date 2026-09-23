import * as XLSX from 'xlsx'
import { DptoFiscalRow, DptoFiscalImportResult } from '@/types/dptoFiscal'
import { EmpresaRow } from '@/types/empresa'
import { normalizeHeader, formatCNPJ, cleanCNPJ } from '@/lib/empresasService'

export const DPTO_FISCAL_STORAGE_KEY = 'orbita_dpto_fiscal_pesos'

/**
 * Carrega a lista de Dpto. Fiscal - Pesos persistida em sessionStorage
 */
export function loadDptoFiscalFromStorage(): DptoFiscalRow[] {
  try {
    const raw = sessionStorage.getItem(DPTO_FISCAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Salva a lista de Dpto. Fiscal - Pesos no sessionStorage
 */
export function saveDptoFiscalToStorage(rows: DptoFiscalRow[]): void {
  try {
    sessionStorage.setItem(DPTO_FISCAL_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // quota exceeded ou ambiente restrito
  }
}

/**
 * Limpa o sessionStorage de Dpto. Fiscal - Pesos
 */
export function clearDptoFiscalStorage(): void {
  try {
    sessionStorage.removeItem(DPTO_FISCAL_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Constrói lista a partir das Empresas existentes da aba Empresas.
 * Copia nome + CNPJ das empresas. Preserva pesos que o usuário já possa ter editado localmente.
 * Se não houver edição prévia, usa o peso1 (ou peso2) da empresa caso disponível.
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

      return {
        id: existing?.id || `fiscal-sync-${Date.now()}-${index}`,
        empresa: emp.empresas.trim(),
        cnpj: emp.cnpj ? formatCNPJ(emp.cnpj) : existing?.cnpj || '',
        peso: pesoVal,
      }
    })
}

/**
 * Mapeia cabeçalhos para colunas de Dpto. Fiscal:
 * - EMPRESAS (empresa, razao social, nome)
 * - PESO (peso fiscal, peso 1, peso1, peso)
 * - CNPJ (opcional, para mapeamento tolerante)
 */
export function mapFiscalHeaders(headers: string[]): {
  empresaColIdx: number
  pesoColIdx: number
  cnpjColIdx: number
  unrecognizedColumns: string[]
} {
  let empresaColIdx = -1
  let pesoColIdx = -1
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
    } else {
      unrecognizedColumns.push(rawHeader)
    }
  })

  return { empresaColIdx, pesoColIdx, cnpjColIdx, unrecognizedColumns }
}

/**
 * Lê arquivo XLSX / XLS e extrai colunas de EMPRESA e PESO (e CNPJ se presente)
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
  const { empresaColIdx, pesoColIdx, cnpjColIdx, unrecognizedColumns } = mapFiscalHeaders(headerRow)

  // Se não identificou coluna de empresa, não é possível associar
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

    const id = `fiscal-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`
    rows.push({
      id,
      empresa: empresaStr,
      cnpj: cnpjStr,
      peso: pesoVal,
    })
  }

  return { rows, ignoredRowsCount, unrecognizedColumns }
}

/**
 * Mescla novos registros de Dpto. Fiscal com existentes (replace ou append/merge por nome/CNPJ da empresa)
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
        peso: item.peso,
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
