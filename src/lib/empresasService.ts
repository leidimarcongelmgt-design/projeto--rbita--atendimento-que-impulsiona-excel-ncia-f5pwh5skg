import * as XLSX from 'xlsx'
import { EmpresaRow, ImportResult } from '@/types/empresa'

export const EMPRESAS_STORAGE_KEY = 'orbita_empresas'

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
 * Se tiver tamanho diferente ou não puder ser formatado, retorna a string limpa.
 */
export function formatCNPJ(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  const digits = str.replace(/\D/g, '')

  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  // Se veio número com zeros à esquerda cortados pelo Excel (ex: 12 ou 13 dígitos), completa com zeros à esquerda até 14
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
 * Carrega a lista de empresas persistida em sessionStorage
 */
export function loadEmpresasFromStorage(): EmpresaRow[] {
  try {
    const raw = sessionStorage.getItem(EMPRESAS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Salva a lista de empresas no sessionStorage
 */
export function saveEmpresasToStorage(empresas: EmpresaRow[]): void {
  try {
    sessionStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(empresas))
  } catch {
    // quota exceeded ou ambiente restrito
  }
}

/**
 * Limpa o sessionStorage de empresas
 */
export function clearEmpresasStorage(): void {
  try {
    sessionStorage.removeItem(EMPRESAS_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Mapeia cabeçalhos da planilha para as propriedades de EmpresaRow (9 colunas ativas).
 * Colunas de PESO e Nº FUNC. são explicitamente ignoradas na aba Empresas
 * (os pesos vivem na aba Dpto. Fiscal e o Nº FUNC. é gerenciado exclusivamente na aba Dpto. Pessoal - Pesos).
 */
export function mapHeadersToFields(headers: string[]): {
  mapping: Map<number, keyof Omit<EmpresaRow, 'id' | 'numFunc' | 'peso1' | 'peso2'>>
  unrecognizedColumns: string[]
} {
  const mapping = new Map<number, keyof Omit<EmpresaRow, 'id' | 'numFunc' | 'peso1' | 'peso2'>>()
  const unrecognizedColumns: string[] = []

  headers.forEach((rawHeader, colIdx) => {
    const normalized = normalizeHeader(rawHeader)
    if (!normalized) return

    // Reconhecimento tolerante
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
      // Coluna Nº FUNC. é ignorada na aba Empresas sem erro (gerenciada no Dpto. Pessoal)
      return
    } else if (
      normalized === 'peso' ||
      normalized === 'peso 1' ||
      normalized === 'peso1' ||
      normalized === 'peso 2' ||
      normalized === 'peso2' ||
      normalized === 'peso (2)'
    ) {
      // Colunas de PESO são ignoradas na aba Empresas sem erro
      return
    } else if (normalized === 'filial' || normalized.includes('filial')) {
      mapping.set(colIdx, 'filial')
    } else if (normalized === 'contabil' || normalized.includes('contabil')) {
      mapping.set(colIdx, 'contabil')
    } else if (normalized === 'entrada' || normalized.includes('entrada')) {
      mapping.set(colIdx, 'entrada')
    } else if (normalized === 'grupo' || normalized.includes('grupo')) {
      mapping.set(colIdx, 'grupo')
    } else {
      unrecognizedColumns.push(rawHeader)
    }
  })

  return { mapping, unrecognizedColumns }
}

/**
 * Normaliza o valor de uma célula para string/número limpo
 */
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

  // Primeira linha = cabeçalho
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

    const rowObj: Partial<Omit<EmpresaRow, 'numFunc' | 'peso1' | 'peso2'>> = {
      empresas: '',
      cnpj: '',
      regimeTrib: '',
      ramoAtividade: '',
      zona: '',
      filial: '',
      contabil: '',
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

    // Validação: linha sem EMPRESAS e sem CNPJ é descartada e contada como ignorada
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
      contabil: (rowObj.contabil || '').toString().trim(),
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

  // Append: registros com o MESMO CNPJ (quando preenchido) atualizam a linha existente; os demais são adicionados
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
        id: existingRow.id, // Preserva id existente
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
