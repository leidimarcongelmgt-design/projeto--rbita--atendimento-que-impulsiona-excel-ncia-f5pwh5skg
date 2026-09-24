import * as XLSX from 'xlsx'
import { EmpresaRow, ImportResult, CustomColumnDef } from '@/types/empresa'
import pb from '@/lib/pocketbase/client'

export const EMPRESAS_STORAGE_KEY = 'orbita_empresas'
export const EMPRESAS_PERSIST_KEY = 'orbita_empresas_persistent'
export const EMPRESAS_CUSTOM_COLUMNS_KEY = 'orbita_empresas_custom_columns'
export const EMPRESAS_COLUMN_ORDER_KEY = 'orbita_empresas_column_order'
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
 * Ordena permanentemente um array de EmpresaRow pelo nome da empresa (coluna EMPRESAS)
 * ignorando acentuação, maiúsculas/minúsculas e pontuação (ex: 'Água' ao lado de 'Agua').
 */
export function sortEmpresasAlphabetically(
  empresas: EmpresaRow[],
  direction: 'asc' | 'desc' = 'asc',
): EmpresaRow[] {
  return [...empresas].sort((a, b) => {
    const nomeA = (a.empresas || '').trim()
    const nomeB = (b.empresas || '').trim()

    // Se ambos estiverem vazios, usa CNPJ como desempate
    if (!nomeA && !nomeB) {
      return (a.cnpj || '').localeCompare(b.cnpj || '', 'pt-BR')
    }
    if (!nomeA) return 1
    if (!nomeB) return -1

    // Compara em pt-BR com sensibilidade base (ignora acentos e caixa)
    const cmp = nomeA.localeCompare(nomeB, 'pt-BR', {
      sensitivity: 'base',
      numeric: true,
    })

    // Em caso de empate na forma base, desempata pela string exata com case/acentos
    const finalCmp = cmp !== 0 ? cmp : nomeA.localeCompare(nomeB, 'pt-BR', { numeric: true })

    return direction === 'asc' ? finalCmp : -finalCmp
  })
}

/**
 * Carrega a lista de empresas síncrona do localStorage (com migração de sessionStorage para localStorage)
 */
export function loadEmpresasFromStorage(): EmpresaRow[] {
  try {
    const persistent =
      localStorage.getItem(EMPRESAS_PERSIST_KEY) || localStorage.getItem(EMPRESAS_STORAGE_KEY)
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
 * Carrega a lista de colunas personalizadas cadastradas pelo usuário permanentemente do localStorage
 */
export function loadCustomColumnsFromStorage(): CustomColumnDef[] {
  try {
    const raw =
      localStorage.getItem(EMPRESAS_CUSTOM_COLUMNS_KEY) ||
      sessionStorage.getItem(EMPRESAS_CUSTOM_COLUMNS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
    return []
  } catch {
    return []
  }
}

/**
 * Salva a lista de colunas personalizadas no localStorage (persistência permanente)
 */
export function saveCustomColumnsToStorage(columns: CustomColumnDef[]): void {
  try {
    localStorage.setItem(EMPRESAS_CUSTOM_COLUMNS_KEY, JSON.stringify(columns))
  } catch {
    // quota exceeded ou ambiente restrito
  }
}

/**
 * Carrega a ordem salva das colunas da aba Empresas (localStorage com fallback para migração)
 */
export function loadEmpresasColumnOrderFromStorage(): string[] {
  try {
    const raw =
      localStorage.getItem(EMPRESAS_COLUMN_ORDER_KEY) ||
      sessionStorage.getItem(EMPRESAS_COLUMN_ORDER_KEY)
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

/**
 * Salva a ordem das colunas da aba Empresas no localStorage (persistência permanente)
 */
export function saveEmpresasColumnOrderToStorage(columnOrder: string[]): void {
  try {
    localStorage.setItem(EMPRESAS_COLUMN_ORDER_KEY, JSON.stringify(columnOrder))
  } catch {
    // quota exceeded ou ambiente restrito
  }
}

/**
 * Remove a ordem customizada das colunas, restaurando a ordem original
 */
export function clearEmpresasColumnOrderStorage(): void {
  try {
    localStorage.removeItem(EMPRESAS_COLUMN_ORDER_KEY)
    sessionStorage.removeItem(EMPRESAS_COLUMN_ORDER_KEY)
  } catch {
    // ignore
  }
}

/**
 * Salva a lista de empresas localmente de forma permanente no localStorage
 */
export function saveEmpresasToStorage(empresas: EmpresaRow[]): void {
  try {
    localStorage.setItem(EMPRESAS_PERSIST_KEY, JSON.stringify(empresas))
    localStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(empresas))
  } catch {
    // quota exceeded ou ambiente restrito
  }

  // Dispara sincronização em segundo plano se configurado
  syncEmpresasToPocketBase(empresas).catch(() => {})
}

/**
 * Limpa o armazenamento de empresas (localStorage e backend se disponível)
 */
export function clearEmpresasStorage(): void {
  try {
    localStorage.removeItem(EMPRESAS_PERSIST_KEY)
    localStorage.removeItem(EMPRESAS_STORAGE_KEY)
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
    const records = await pb.collection(COLLECTION_NAME).getFullList<Record<string, unknown>>({
      sort: 'created',
      requestKey: null,
    })

    isPocketBaseAvailable = true

    if (records && records.length > 0) {
      const mapped: EmpresaRow[] = records.map((r) => ({
        id: String(r.id || ''),
        empresas: String(r.EMPRESAS ?? r.empresas ?? r.nome ?? ''),
        cnpj: String(r.CNPJ ?? r.cnpj ?? ''),
        regimeTrib: String(r.REGIME_TRIB ?? r.regimeTrib ?? r.regime_trib ?? ''),
        ramoAtividade: String(r.RAMO_ATIVIDADE_2 ?? r.ramoAtividade ?? r.ramo_atividade ?? ''),
        filial: String(r.FILIAL ?? r.filial ?? ''),
        grupo: String(r.GRUPO ?? r.grupo ?? ''),
        entrada: String(r.CLIENTE_DESDE ?? r.entrada ?? r.cliente_desde ?? ''),
        zona: String(r.ZONA ?? r.zona ?? ''),
        contabil: String(r.CONTABIL ?? r.contabil ?? ''),
        numFunc: (r.NUM_FUNC ?? r.numFunc ?? r.num_func ?? '') as number | string,
        pesoFolha: (r.PESO_FOLHA ?? r.pesoFolha ?? r.peso_folha ?? r.peso1 ?? '') as
          | number
          | string,
        pesoFiscal: (r.PESO_FISCAL ?? r.pesoFiscal ?? r.peso_fiscal ?? r.peso2 ?? '') as
          | number
          | string,
        receitas: (r.RECEITAS ?? r.receitas ?? '') as number | string,
        despCustos: (r.DESP_CUSTOS ?? r.despCustos ?? r.desp_custos ?? '') as number | string,
        enviaSped: String(r.ENVIA_SPED ?? r.enviaSped ?? r.envia_sped ?? ''),
        observacoes: String(r.OBSERVACOES ?? r.observacoes ?? ''),
        lnk: String(r.LNK ?? r.lnk ?? r.lkn ?? ''),
        peso1: (r.PESO_FOLHA ?? r.pesoFolha ?? r.peso_folha ?? r.peso1 ?? '') as number | string,
        peso2: (r.PESO_FISCAL ?? r.pesoFiscal ?? r.peso_fiscal ?? r.peso2 ?? '') as number | string,
        isManual: Boolean(r.isManual),
        customFields:
          r.customFields && typeof r.customFields === 'object'
            ? (r.customFields as Record<string, string>)
            : r.custom_columns && typeof r.custom_columns === 'object'
              ? (r.custom_columns as Record<string, string>)
              : {},
      }))
      try {
        localStorage.setItem(EMPRESAS_PERSIST_KEY, JSON.stringify(mapped))
        localStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(mapped))
      } catch {
        /* intentionally ignored */
      }
      return mapped
    }

    // Backend está vazio mas temos dados locais: migração inicial
    if (localData.length > 0) {
      const alreadyMigrated = localStorage.getItem('orbita_empresas_migrated_v1') === 'true'
      if (!alreadyMigrated) {
        localStorage.setItem('orbita_empresas_migrated_v1', 'true')
        syncEmpresasToPocketBase(localData).catch(() => {})
      }
      return localData
    }
    return []
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
    const existingByCnpj = new Map<string, string>()
    const existingByName = new Map<string, string>()

    for (const item of existing) {
      const c = cleanCNPJ((item.cnpj || item.CNPJ || '') as string)
      if (c) existingByCnpj.set(c, item.id)
      const n = normalizeHeader((item.nome || item.empresas || item.EMPRESAS || '') as string)
      if (n) existingByName.set(n, item.id)
    }

    for (const emp of empresas) {
      const numFuncNum =
        typeof emp.numFunc === 'number'
          ? emp.numFunc
          : emp.numFunc
            ? parseFloat(String(emp.numFunc).replace(',', '.')) || null
            : null
      const pesoFolhaNum =
        typeof emp.pesoFolha === 'number'
          ? emp.pesoFolha
          : emp.pesoFolha
            ? parseFloat(String(emp.pesoFolha).replace(',', '.')) || null
            : null
      const pesoFiscalNum =
        typeof emp.pesoFiscal === 'number'
          ? emp.pesoFiscal
          : emp.pesoFiscal
            ? parseFloat(String(emp.pesoFiscal).replace(',', '.')) || null
            : null
      const receitasNum =
        typeof emp.receitas === 'number'
          ? emp.receitas
          : emp.receitas
            ? parseFloat(String(emp.receitas).replace(',', '.')) || null
            : null
      const despCustosNum =
        typeof emp.despCustos === 'number'
          ? emp.despCustos
          : emp.despCustos
            ? parseFloat(String(emp.despCustos).replace(',', '.')) || null
            : null

      const payload = {
        nome: emp.empresas || '',
        cnpj: emp.cnpj || '',
        regime_trib: emp.regimeTrib || '',
        ramo_atividade: emp.ramoAtividade || '',
        filial: emp.filial || '',
        grupo: emp.grupo || '',
        cliente_desde: emp.entrada || '',
        zona: emp.zona || '',
        contabil: emp.contabil || '',
        num_func: String(emp.numFunc ?? ''),
        peso_folha: String(emp.pesoFolha ?? ''),
        peso_fiscal: String(emp.pesoFiscal ?? ''),
        receitas: String(emp.receitas ?? ''),
        desp_custos: String(emp.despCustos ?? ''),
        envia_sped: emp.enviaSped || '',
        observacoes: emp.observacoes || '',
        lkn: emp.lnk || '',
        EMPRESAS: emp.empresas || '',
        CNPJ: emp.cnpj || '',
        REGIME_TRIB: emp.regimeTrib || '',
        RAMO_ATIVIDADE_2: emp.ramoAtividade || '',
        FILIAL: emp.filial || '',
        GRUPO: emp.grupo || '',
        CLIENTE_DESDE: emp.entrada || '',
        ZONA: emp.zona || '',
        CONTABIL: emp.contabil || '',
        NUM_FUNC: numFuncNum,
        PESO_FOLHA: pesoFolhaNum,
        PESO_FISCAL: pesoFiscalNum,
        RECEITAS: receitasNum,
        DESP_CUSTOS: despCustosNum,
        ENVIA_SPED: emp.enviaSped || '',
        OBSERVACOES: emp.observacoes || '',
        LNK: emp.lnk || '',
        // Legados para máxima compatibilidade
        empresas: emp.empresas || '',
        regimeTrib: emp.regimeTrib || '',
        ramoAtividade: emp.ramoAtividade || '',
        entrada: emp.entrada || '',
        numFunc: numFuncNum,
        pesoFolha: pesoFolhaNum,
        pesoFiscal: pesoFiscalNum,
        despCustos: despCustosNum,
        enviaSped: emp.enviaSped || '',
        isManual: emp.isManual ?? false,
        customFields: emp.customFields ?? {},
        custom_columns: emp.customFields ?? {},
      }

      // PocketBase IDs têm 15 caracteres alfanuméricos
      const isValidPbId = emp.id && emp.id.length === 15 && !emp.id.includes('-')
      const targetId =
        (isValidPbId && existingIds.has(emp.id) ? emp.id : undefined) ||
        (cleanCNPJ(emp.cnpj) ? existingByCnpj.get(cleanCNPJ(emp.cnpj)) : undefined) ||
        (normalizeHeader(emp.empresas)
          ? existingByName.get(normalizeHeader(emp.empresas))
          : undefined)

      if (targetId) {
        await pb.collection(COLLECTION_NAME).update(targetId, payload, { requestKey: null })
      } else {
        const created = await pb.collection(COLLECTION_NAME).create(payload, { requestKey: null })
        const c = cleanCNPJ(emp.cnpj)
        if (c) existingByCnpj.set(c, created.id)
        const n = normalizeHeader(emp.empresas)
        if (n) existingByName.set(n, created.id)
        existingIds.add(created.id)
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
    const numFuncNum =
      typeof empresa.numFunc === 'number'
        ? empresa.numFunc
        : empresa.numFunc
          ? parseFloat(String(empresa.numFunc).replace(',', '.')) || null
          : null
    const pesoFolhaNum =
      typeof empresa.pesoFolha === 'number'
        ? empresa.pesoFolha
        : empresa.pesoFolha
          ? parseFloat(String(empresa.pesoFolha).replace(',', '.')) || null
          : null
    const pesoFiscalNum =
      typeof empresa.pesoFiscal === 'number'
        ? empresa.pesoFiscal
        : empresa.pesoFiscal
          ? parseFloat(String(empresa.pesoFiscal).replace(',', '.')) || null
          : null
    const receitasNum =
      typeof empresa.receitas === 'number'
        ? empresa.receitas
        : empresa.receitas
          ? parseFloat(String(empresa.receitas).replace(',', '.')) || null
          : null
    const despCustosNum =
      typeof empresa.despCustos === 'number'
        ? empresa.despCustos
        : empresa.despCustos
          ? parseFloat(String(empresa.despCustos).replace(',', '.')) || null
          : null

    const payload = {
      nome: empresa.empresas || '',
      cnpj: empresa.cnpj || '',
      regime_trib: empresa.regimeTrib || '',
      ramo_atividade: empresa.ramoAtividade || '',
      filial: empresa.filial || '',
      grupo: empresa.grupo || '',
      cliente_desde: empresa.entrada || '',
      zona: empresa.zona || '',
      contabil: empresa.contabil || '',
      num_func: String(empresa.numFunc ?? ''),
      peso_folha: String(empresa.pesoFolha ?? ''),
      peso_fiscal: String(empresa.pesoFiscal ?? ''),
      receitas: String(empresa.receitas ?? ''),
      desp_custos: String(empresa.despCustos ?? ''),
      envia_sped: empresa.enviaSped || '',
      observacoes: empresa.observacoes || '',
      lkn: empresa.lnk || '',
      EMPRESAS: empresa.empresas || '',
      CNPJ: empresa.cnpj || '',
      REGIME_TRIB: empresa.regimeTrib || '',
      RAMO_ATIVIDADE_2: empresa.ramoAtividade || '',
      FILIAL: empresa.filial || '',
      GRUPO: empresa.grupo || '',
      CLIENTE_DESDE: empresa.entrada || '',
      ZONA: empresa.zona || '',
      CONTABIL: empresa.contabil || '',
      NUM_FUNC: numFuncNum,
      PESO_FOLHA: pesoFolhaNum,
      PESO_FISCAL: pesoFiscalNum,
      RECEITAS: receitasNum,
      DESP_CUSTOS: despCustosNum,
      ENVIA_SPED: empresa.enviaSped || '',
      OBSERVACOES: empresa.observacoes || '',
      LNK: empresa.lnk || '',
      // Legados
      empresas: empresa.empresas || '',
      regimeTrib: empresa.regimeTrib || '',
      ramoAtividade: empresa.ramoAtividade || '',
      entrada: empresa.entrada || '',
      numFunc: numFuncNum,
      pesoFolha: pesoFolhaNum,
      pesoFiscal: pesoFiscalNum,
      despCustos: despCustosNum,
      enviaSped: empresa.enviaSped || '',
      isManual: empresa.isManual ?? false,
      customFields: empresa.customFields ?? {},
      custom_columns: empresa.customFields ?? {},
    }

    const isValidPbId = empresa.id && empresa.id.length === 15 && !empresa.id.includes('-')
    let targetId = isValidPbId ? empresa.id : undefined

    if (!targetId) {
      // Checa duplicidade por CNPJ ou nome antes de criar novo
      const clean = cleanCNPJ(empresa.cnpj)
      if (clean) {
        const match = await pb
          .collection(COLLECTION_NAME)
          .getFirstListItem(`cnpj ~ "${empresa.cnpj}"`, { requestKey: null })
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
 * Mapeia cabeçalhos da planilha para as propriedades de EmpresaRow.
 * Reconhece todas as colunas solicitadas da planilha:
 * EMPRESAS | CNPJ | REGIME TRIB. | RAMO DE ATIVIDADE 2 | FILIAL | GRUPO | CLIENTE DESDE | ZONA |
 * CONTÁBIL | Nº FUNC. | PESO FOLHA | PESO FISCAL | RECEITAS | DESP./CUSTOS | ENVIA SPED | OBSERVAÇÕES | LNK
 */
export type EmpresaFieldKey = keyof Omit<
  EmpresaRow,
  'id' | 'isManual' | 'customFields' | 'peso1' | 'peso2'
>

export function mapHeadersToFields(headers: string[]): {
  mapping: Map<number, EmpresaFieldKey>
  unrecognizedColumns: string[]
} {
  const mapping = new Map<number, EmpresaFieldKey>()
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
    } else if (normalized === 'filial' || normalized.includes('filial')) {
      mapping.set(colIdx, 'filial')
    } else if (normalized === 'grupo' || normalized.includes('grupo')) {
      mapping.set(colIdx, 'grupo')
    } else if (
      normalized === 'entrada' ||
      normalized.includes('entrada') ||
      normalized === 'cliente desde' ||
      normalized.includes('cliente desde') ||
      normalized === 'desde'
    ) {
      mapping.set(colIdx, 'entrada')
    } else if (normalized === 'zona' || normalized.startsWith('zona ')) {
      mapping.set(colIdx, 'zona')
    } else if (
      normalized === 'contabil' ||
      normalized.includes('contabil') ||
      normalized === 'contabilidade' ||
      normalized.includes('contabilidade') ||
      normalized === 'dpto contabil' ||
      normalized === 'depto contabil' ||
      normalized === 'setor contabil'
    ) {
      mapping.set(colIdx, 'contabil')
    } else if (
      normalized === 'n func' ||
      normalized === 'n func.' ||
      normalized === 'no func' ||
      normalized === 'no func.' ||
      normalized === 'num func' ||
      normalized === 'numero func' ||
      normalized === 'numero funcionarios' ||
      normalized === 'numero de funcionarios' ||
      normalized === 'qtd func' ||
      normalized === 'colaboradores' ||
      normalized === 'empregados' ||
      (normalized.includes('func') && !normalized.includes('peso'))
    ) {
      mapping.set(colIdx, 'numFunc')
    } else if (
      normalized === 'peso folha' ||
      normalized === 'peso fol' ||
      normalized === 'peso folh' ||
      normalized.startsWith('peso fol') ||
      normalized === 'peso folha de pagamento' ||
      normalized === 'peso dp' ||
      normalized === 'peso dpto pessoal'
    ) {
      mapping.set(colIdx, 'pesoFolha')
    } else if (
      normalized === 'peso fiscal' ||
      normalized === 'peso fisc' ||
      normalized.startsWith('peso fisc') ||
      normalized === 'peso escrita' ||
      normalized === 'peso dpto fiscal'
    ) {
      mapping.set(colIdx, 'pesoFiscal')
    } else if (
      normalized === 'receitas' ||
      normalized === 'receita' ||
      normalized === 'faturamento' ||
      normalized.startsWith('receita')
    ) {
      mapping.set(colIdx, 'receitas')
    } else if (
      normalized === 'desp custos' ||
      normalized === 'despcustos' ||
      normalized === 'desp custos' ||
      normalized === 'despesas custos' ||
      normalized === 'despesa custo' ||
      normalized === 'despesas e custos' ||
      normalized === 'custos e despesas' ||
      normalized === 'custos despesas' ||
      normalized === 'desp' ||
      normalized === 'despesas' ||
      normalized === 'custos'
    ) {
      mapping.set(colIdx, 'despCustos')
    } else if (
      normalized === 'envia sped' ||
      normalized === 'envio sped' ||
      normalized === 'sped' ||
      normalized.includes('sped')
    ) {
      mapping.set(colIdx, 'enviaSped')
    } else if (
      normalized === 'observacoes' ||
      normalized === 'observacao' ||
      normalized === 'obs' ||
      normalized === 'observacoe' ||
      normalized.startsWith('obs')
    ) {
      mapping.set(colIdx, 'observacoes')
    } else if (
      normalized === 'lnk' ||
      normalized === 'link' ||
      normalized === 'links' ||
      normalized === 'url'
    ) {
      mapping.set(colIdx, 'lnk')
    } else if (normalized === 'peso' || normalized === 'peso 1' || normalized === 'peso1') {
      // Fallback genérico caso a planilha venha com apenas "PESO" ou "PESO 1"
      mapping.set(colIdx, 'pesoFolha')
    } else if (normalized === 'peso 2' || normalized === 'peso2' || normalized === 'peso (2)') {
      mapping.set(colIdx, 'pesoFiscal')
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
 * Lê arquivo XLSX / XLS e extrai registros de empresas com todas as colunas
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

    const rowObj: Record<string, string | number> = {
      empresas: '',
      cnpj: '',
      regimeTrib: '',
      ramoAtividade: '',
      filial: '',
      grupo: '',
      entrada: '',
      zona: '',
      contabil: '',
      numFunc: '',
      pesoFolha: '',
      pesoFiscal: '',
      receitas: '',
      despCustos: '',
      enviaSped: '',
      observacoes: '',
      lnk: '',
    }

    rawRow.forEach((cellVal, colIdx) => {
      const field = mapping.get(colIdx)
      if (field) {
        const val = normalizeCellValue(cellVal)
        if (field === 'cnpj') {
          rowObj.cnpj = formatCNPJ(val)
        } else {
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
      filial: (rowObj.filial || '').toString().trim(),
      grupo: (rowObj.grupo || '').toString().trim(),
      entrada: (rowObj.entrada || '').toString().trim(),
      zona: (rowObj.zona || '').toString().trim(),
      contabil: (rowObj.contabil || '').toString().trim(),
      numFunc: rowObj.numFunc ?? '',
      pesoFolha: rowObj.pesoFolha ?? '',
      pesoFiscal: rowObj.pesoFiscal ?? '',
      receitas: rowObj.receitas ?? '',
      despCustos: rowObj.despCustos ?? '',
      enviaSped: (rowObj.enviaSped || '').toString().trim(),
      observacoes: (rowObj.observacoes || '').toString().trim(),
      lnk: (rowObj.lnk || '').toString().trim(),
      peso1: rowObj.pesoFolha ?? '',
      peso2: rowObj.pesoFiscal ?? '',
    })
  }

  return {
    rows,
    ignoredRowsCount,
    unrecognizedColumns,
  }
}

/**
 * Combina novos registros com registros existentes (append ou merge por CNPJ/Nome).
 * REQUISITOS:
 * 1. Linhas manuais (isManual: true) sobrevivem a reimportações/mesclagens mesmo que não estejam na planilha.
 * 2. Valores de colunas personalizadas (customFields) devem ser preservados por linha
 *    quando a planilha é importada / atualizada.
 * 3. Se mode === 'replace', substitui as empresas que vieram de importações anteriores,
 *    porém MANTÉM as linhas manuais intactas com seus respectivos customFields.
 */
export function mergeEmpresas(
  existing: EmpresaRow[],
  incoming: EmpresaRow[],
  mode: 'replace' | 'append',
): ImportResult {
  // Separamos as linhas criadas manualmente
  const manualRows = existing.filter((r) => r.isManual)

  // Mapas para busca rápida em existing por CNPJ e por Nome
  const existingByCnpj = new Map<string, EmpresaRow>()
  const existingByName = new Map<string, EmpresaRow>()

  for (const r of existing) {
    const c = cleanCNPJ(r.cnpj)
    if (c) existingByCnpj.set(c, r)
    const n = normalizeHeader(r.empresas)
    if (n) existingByName.set(n, r)
  }

  if (mode === 'replace') {
    // Ao substituir: criamos o conjunto com os incoming rows,
    // mas recuperamos customFields se houver correspondência com existing,
    // e preservamos as linhas manuais que não foram sobrescritas pela planilha.
    const incomingCnpjs = new Set<string>()
    const incomingNames = new Set<string>()

    const newRecords: EmpresaRow[] = incoming.map((item) => {
      const c = cleanCNPJ(item.cnpj)
      const n = normalizeHeader(item.empresas)
      if (c) incomingCnpjs.add(c)
      if (n) incomingNames.add(n)

      // Procura se já existia para preservar id e customFields
      const prev = (c ? existingByCnpj.get(c) : null) || (n ? existingByName.get(n) : null)
      if (prev) {
        return {
          ...item,
          id: prev.id,
          // Preserva campos customizados já preenchidos
          customFields: { ...(prev.customFields || {}), ...(item.customFields || {}) },
          // Preserva flag manual se o usuário tiver criado e vier complementando
          isManual: prev.isManual,
        }
      }
      return item
    })

    // Adiciona linhas manuais que NÃO estavam na planilha importada
    for (const manual of manualRows) {
      const c = cleanCNPJ(manual.cnpj)
      const n = normalizeHeader(manual.empresas)
      const inPlanilha = (c && incomingCnpjs.has(c)) || (n && incomingNames.has(n))
      if (!inPlanilha) {
        newRecords.push(manual)
      }
    }

    return {
      addedCount: incoming.length,
      updatedCount: 0,
      ignoredRowsCount: 0,
      unrecognizedColumns: [],
      totalRowsProcessed: incoming.length,
      newRecords,
    }
  }

  // mode === 'append' (mesclagem / adição)
  const cnpjMap = new Map<string, number>()
  const nameMap = new Map<string, number>()

  const result: EmpresaRow[] = existing.map((r, idx) => {
    const c = cleanCNPJ(r.cnpj)
    if (c) cnpjMap.set(c, idx)
    const n = normalizeHeader(r.empresas)
    if (n) nameMap.set(n, idx)
    return { ...r }
  })

  let addedCount = 0
  let updatedCount = 0

  for (const item of incoming) {
    const c = cleanCNPJ(item.cnpj)
    const n = normalizeHeader(item.empresas)

    let matchIdx: number | undefined
    if (c && cnpjMap.has(c)) {
      matchIdx = cnpjMap.get(c)
    } else if (n && nameMap.has(n)) {
      matchIdx = nameMap.get(n)
    }

    if (matchIdx !== undefined) {
      const existingRow = result[matchIdx]
      result[matchIdx] = {
        ...item,
        id: existingRow.id,
        // Preserva valores de colunas personalizadas
        customFields: { ...(existingRow.customFields || {}), ...(item.customFields || {}) },
        // Preserva flag se era manual
        isManual: existingRow.isManual,
      }
      updatedCount++
    } else {
      result.push(item)
      addedCount++
      const newIdx = result.length - 1
      if (c) cnpjMap.set(c, newIdx)
      if (n) nameMap.set(n, newIdx)
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
