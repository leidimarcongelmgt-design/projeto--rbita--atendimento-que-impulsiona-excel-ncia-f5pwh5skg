import * as XLSX from 'xlsx'
import { EmpresaRow, ImportResult } from '@/types/empresa'
import pb from '@/lib/pocketbase/client'

export const EMPRESAS_STORAGE_KEY = 'orbita_empresas'
export const EMPRESAS_PERSIST_KEY = 'orbita_empresas_persistent'
const COLLECTION_NAME = 'empresas'

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
 * Carrega a lista de empresas síncrona (do localStorage permanente ou migração inicial do sessionStorage)
 */
export function loadEmpresasFromStorage(): EmpresaRow[] {
  try {
    // 1. Tenta carregar do localStorage permanente
    const persistent = localStorage.getItem(EMPRESAS_PERSIST_KEY)
    if (persistent) {
      const parsed = JSON.parse(persistent)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }

    // 2. Migração automática: se houver dados no sessionStorage da sessão anterior/atual, copia para permanente
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
 * Salva a lista de empresas de forma permanente (localStorage + sync assíncrono com PocketBase)
 */
export function saveEmpresasToStorage(empresas: EmpresaRow[]): void {
  try {
    // Persistência permanente no navegador
    localStorage.setItem(EMPRESAS_PERSIST_KEY, JSON.stringify(empresas))
    // Mantém sessionStorage espelhado para retrocompatibilidade
    sessionStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(empresas))
  } catch {
    // quota exceeded ou ambiente restrito
  }

  // Tenta sincronizar com o PocketBase em segundo plano (se disponível)
  syncEmpresasToPocketBase(empresas).catch(() => {
    // Falha silenciosa no backend — dados já estão garantidos no localStorage
  })
}

/**
 * Limpa o armazenamento de empresas (permanente e de sessão)
 */
export function clearEmpresasStorage(): void {
  try {
    localStorage.removeItem(EMPRESAS_PERSIST_KEY)
    sessionStorage.removeItem(EMPRESAS_STORAGE_KEY)
  } catch {
    // ignore
  }

  // Remove também no backend PocketBase se a coleção existir
  clearEmpresasPocketBase().catch(() => {})
}

/**
 * Busca empresas no PocketBase com fallback automático para o armazenamento local
 */
export async function fetchEmpresas(): Promise<EmpresaRow[]> {
  const localData = loadEmpresasFromStorage()

  try {
    // Tenta carregar até 1000 registros do backend
    const records = await pb.collection(COLLECTION_NAME).getFullList<EmpresaRow>({
      sort: 'created',
      requestKey: null,
    })

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
      // Atualiza o cache permanente
      localStorage.setItem(EMPRESAS_PERSIST_KEY, JSON.stringify(mapped))
      sessionStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(mapped))
      return mapped
    }

    // Se o backend estiver vazio mas houver dados locais, faz o seed para o backend
    if (localData.length > 0) {
      syncEmpresasToPocketBase(localData).catch(() => {})
    }
  } catch {
    // PocketBase indisponível ou coleção ainda não criada: usa dados locais com segurança
  }

  return localData
}

/**
 * Sincroniza dados com o PocketBase (se a coleção estiver configurada)
 */
async function syncEmpresasToPocketBase(empresas: EmpresaRow[]): Promise<void> {
  try {
    // Se a coleção não existir ou retornar 404, o catch captura
    const existing = await pb.collection(COLLECTION_NAME).getFullList({ requestKey: null })
    const existingIds = new Set(existing.map((e) => e.id))

    // Cria ou atualiza registros
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

      if (emp.id && existingIds.has(emp.id)) {
        await pb.collection(COLLECTION_NAME).update(emp.id, payload, { requestKey: null })
      } else {
        await pb.collection(COLLECTION_NAME).create(payload, { requestKey: null })
      }
    }
  } catch {
    // Silencioso se PocketBase não estiver respondendo
  }
}

/**
 * Limpa todos os registros de empresas no PocketBase
 */
async function clearEmpresasPocketBase(): Promise<void> {
  try {
    const list = await pb.collection(COLLECTION_NAME).getFullList({ requestKey: null })
    for (const r of list) {
      await pb.collection(COLLECTION_NAME).delete(r.id, { requestKey: null })
    }
  } catch {
    // ignore
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
