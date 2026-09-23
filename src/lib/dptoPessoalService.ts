import * as XLSX from 'xlsx'
import { DptoPessoalRow, DptoImportResult } from '@/types/dptoPessoal'
import { EmpresaRow } from '@/types/empresa'
import { normalizeHeader, formatCNPJ, cleanCNPJ } from '@/lib/empresasService'

export const DPTO_PESSOAL_STORAGE_KEY = 'orbita_dpto_pessoal'

/**
 * Carrega a lista de Dpto. Pessoal persistida em sessionStorage
 */
export function loadDptoPessoalFromStorage(): DptoPessoalRow[] {
  try {
    const raw = sessionStorage.getItem(DPTO_PESSOAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Salva a lista de Dpto. Pessoal no sessionStorage
 */
export function saveDptoPessoalToStorage(rows: DptoPessoalRow[]): void {
  try {
    sessionStorage.setItem(DPTO_PESSOAL_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // quota exceeded ou ambiente restrito
  }
}

/**
 * Limpa o sessionStorage de Dpto. Pessoal
 */
export function clearDptoPessoalStorage(): void {
  try {
    sessionStorage.removeItem(DPTO_PESSOAL_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Constrói lista inicial ou sincronizada a partir das Empresas existentes.
 * Copia nome, CNPJ e Zona das empresas. Preserva edições locais já feitas na aba Dpto. Pessoal.
 * Se não houver edição prévia, entra com numFunc vazio (ou numFunc legado se porventura presente no registro de empresa).
 */
export function syncFromEmpresas(
  empresas: EmpresaRow[],
  existingDpto: DptoPessoalRow[],
): DptoPessoalRow[] {
  const existingMapByCnpj = new Map<string, DptoPessoalRow>()
  const existingMapByName = new Map<string, DptoPessoalRow>()

  for (const row of existingDpto) {
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

      let numFuncVal: number | string = ''
      if (existing) {
        numFuncVal = existing.numFunc
      } else if (emp.numFunc !== '' && emp.numFunc !== null && emp.numFunc !== undefined) {
        numFuncVal = emp.numFunc
      }

      let zonaVal = ''
      if (existing && existing.zona !== undefined && existing.zona !== '') {
        zonaVal = existing.zona
      } else if (emp.zona !== '' && emp.zona !== null && emp.zona !== undefined) {
        zonaVal = String(emp.zona).trim()
      }

      return {
        id: existing?.id || `dpto-sync-${Date.now()}-${index}`,
        empresa: emp.empresas.trim(),
        cnpj: emp.cnpj ? formatCNPJ(emp.cnpj) : existing?.cnpj || '',
        zona: zonaVal,
        numFunc: numFuncVal,
      }
    })
}

/**
 * Mapeia cabeçalhos para colunas de Dpto. Pessoal:
 * - EMPRESAS (ou variações: empresa, razao social, nome)
 * - Nº FUNC. (ou variações: func, num func, numero de funcionarios, qtd func)
 * - CNPJ (opcional, para identificação e correspondência)
 * - ZONA (opcional, variações: zona, zona 2, etc.)
 */
export function mapDptoHeaders(headers: string[]): {
  empresaColIdx: number
  numFuncColIdx: number
  cnpjColIdx: number
  zonaColIdx: number
  unrecognizedColumns: string[]
} {
  let empresaColIdx = -1
  let numFuncColIdx = -1
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
      numFuncColIdx === -1 &&
      (normalized.includes('func') ||
        normalized === 'n func' ||
        normalized === 'num func' ||
        normalized === 'numero de funcionarios' ||
        normalized === 'qtd func' ||
        normalized === 'colaboradores' ||
        normalized === 'empregados')
    ) {
      numFuncColIdx = colIdx
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

  return { empresaColIdx, numFuncColIdx, cnpjColIdx, zonaColIdx, unrecognizedColumns }
}

/**
 * Lê arquivo XLSX / XLS e extrai APENAS colunas de EMPRESA e Nº FUNCIONÁRIOS
 */
export async function parseDptoPessoalFile(file: File): Promise<{
  rows: DptoPessoalRow[]
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
  const { empresaColIdx, numFuncColIdx, cnpjColIdx, zonaColIdx, unrecognizedColumns } =
    mapDptoHeaders(headerRow)

  // Se não identificou coluna de empresa, não é possível associar o número
  if (empresaColIdx === -1) {
    return { rows: [], ignoredRowsCount: 0, unrecognizedColumns }
  }

  const rows: DptoPessoalRow[] = []
  let ignoredRowsCount = 0

  for (let i = 1; i < rawData.length; i++) {
    const rawRow = rawData[i]
    if (!rawRow || !Array.isArray(rawRow)) {
      ignoredRowsCount++
      continue
    }

    const rawEmpresa = rawRow[empresaColIdx]
    const rawNumFunc = numFuncColIdx !== -1 ? rawRow[numFuncColIdx] : ''
    const rawCnpj = cnpjColIdx !== -1 ? rawRow[cnpjColIdx] : ''
    const rawZona = zonaColIdx !== -1 ? rawRow[zonaColIdx] : ''

    const empresaStr = (rawEmpresa ?? '').toString().trim()
    if (!empresaStr) {
      ignoredRowsCount++
      continue
    }

    let numFuncVal: number | string = ''
    if (typeof rawNumFunc === 'number' && Number.isFinite(rawNumFunc)) {
      numFuncVal = rawNumFunc
    } else if (
      rawNumFunc !== null &&
      rawNumFunc !== undefined &&
      String(rawNumFunc).trim() !== ''
    ) {
      const parsedNum = Number(String(rawNumFunc).trim().replace(',', '.'))
      numFuncVal = !isNaN(parsedNum) ? parsedNum : String(rawNumFunc).trim()
    }

    const cnpjStr = rawCnpj ? formatCNPJ(String(rawCnpj).trim()) : ''
    const zonaStr = rawZona !== null && rawZona !== undefined ? String(rawZona).trim() : ''

    const id = `dpto-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`
    rows.push({
      id,
      empresa: empresaStr,
      cnpj: cnpjStr,
      zona: zonaStr,
      numFunc: numFuncVal,
    })
  }

  return { rows, ignoredRowsCount, unrecognizedColumns }
}

/**
 * Mescla novos registros com existentes (replace ou append/merge por nome ou CNPJ da empresa)
 */
export function mergeDptoRows(
  existing: DptoPessoalRow[],
  incoming: DptoPessoalRow[],
  mode: 'replace' | 'append',
): DptoImportResult {
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

  const result: DptoPessoalRow[] = existing.map((r, idx) => {
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
        numFunc: item.numFunc !== '' ? item.numFunc : result[targetIdx].numFunc,
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
