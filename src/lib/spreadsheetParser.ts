import * as XLSX from 'xlsx'
import { CalculatorState } from '@/types/calculator'
import { formatPhoneBR } from './calculatorState'
import { formatCpfCnpj } from './clientDataParser'

export interface SpreadsheetExtractedField {
  key: keyof CalculatorState
  label: string
  category: 'emissor' | 'cliente' | 'contato'
  value: string
  currentValue: string
  sourceLocation: string
  isDifferent: boolean
}

export interface SpreadsheetWarning {
  message: string
  type: 'info' | 'warning'
}

export interface SpreadsheetParseResult {
  fields: SpreadsheetExtractedField[]
  warnings: SpreadsheetWarning[]
  totalSheets: number
  sheetNames: string[]
  detectedRows: number
  fileName: string
}

// Chaves permitidas para importação de planilha (abrangendo Emissor E Cliente)
export const ALLOWED_SPREADSHEET_KEYS = new Set<keyof CalculatorState>([
  // Emissor (Identificação)
  'empresaNome',
  'empresaCnpj',
  'empresaEndereco',
  'empresaCidade',
  'empresaUf',
  // Cliente (Cadastrais)
  'clienteNome',
  'clienteCnpj',
  'clienteIE',
  'clienteIM',
  'clienteRamo',
  'clienteEndereco',
  'clienteCidade',
  'clienteUf',
  // Contatos do Cliente
  'contFinNome',
  'contFinTelefone',
  'contFinEmail',
  'contEstoqueNome',
  'contEstoqueTelefone',
  'contEstoqueEmail',
  'contRhNome',
  'contRhTelefone',
  'contRhEmail',
  'contLegalNome',
  'contLegalTelefone',
  'contLegalEmail',
])

export const FIELD_LABELS: Record<
  keyof CalculatorState,
  { label: string; category: 'emissor' | 'cliente' | 'contato' }
> = {
  tab: { label: 'Aba', category: 'emissor' },
  logoWidth: { label: 'Largura da Logo', category: 'emissor' },
  logoHeight: { label: 'Altura da Logo', category: 'emissor' },
  logoRatio: { label: 'Proporção da Logo', category: 'emissor' },
  logoControls: { label: 'Controles da Logo', category: 'emissor' },
  clientLogoWidth: { label: 'Largura da Logo do Cliente', category: 'cliente' },
  clientLogoHeight: { label: 'Altura da Logo do Cliente', category: 'cliente' },
  clientLogoRatio: { label: 'Proporção da Logo do Cliente', category: 'cliente' },
  clientLogoControls: { label: 'Controles da Logo do Cliente', category: 'cliente' },
  logoData: { label: 'Logo do Emissor', category: 'emissor' },
  clientLogoData: { label: 'Logo do Cliente', category: 'cliente' },

  // Emissor
  empresaNome: { label: 'Razão Social / Nome do Emissor', category: 'emissor' },
  empresaCnpj: { label: 'CNPJ do Emissor', category: 'emissor' },
  empresaEndereco: { label: 'Endereço do Emissor', category: 'emissor' },
  empresaCidade: { label: 'Cidade do Emissor', category: 'emissor' },
  empresaUf: { label: 'UF do Emissor', category: 'emissor' },

  // Cliente
  clienteNome: { label: 'Nome / Razão Social do Cliente', category: 'cliente' },
  clienteCnpj: { label: 'CNPJ / CPF do Cliente', category: 'cliente' },
  clienteIE: { label: 'Inscrição Estadual (IE)', category: 'cliente' },
  clienteIM: { label: 'Inscrição Municipal (IM)', category: 'cliente' },
  clienteRamo: { label: 'Ramo de Atividade / CNAE', category: 'cliente' },
  clienteEndereco: { label: 'Endereço do Cliente', category: 'cliente' },
  clienteCidade: { label: 'Cidade do Cliente', category: 'cliente' },
  clienteUf: { label: 'UF do Cliente', category: 'cliente' },

  // Contatos
  contFinNome: { label: 'Contato Financeiro - Nome', category: 'contato' },
  contFinTelefone: { label: 'Contato Financeiro - Telefone', category: 'contato' },
  contFinEmail: { label: 'Contato Financeiro - E-mail', category: 'contato' },

  contEstoqueNome: { label: 'Contato Estoque - Nome', category: 'contato' },
  contEstoqueTelefone: { label: 'Contato Estoque - Telefone', category: 'contato' },
  contEstoqueEmail: { label: 'Contato Estoque - E-mail', category: 'contato' },

  contRhNome: { label: 'Contato RH - Nome', category: 'contato' },
  contRhTelefone: { label: 'Contato RH - Telefone', category: 'contato' },
  contRhEmail: { label: 'Contato RH - E-mail', category: 'contato' },

  contLegalNome: { label: 'Contato Representante Legal - Nome', category: 'contato' },
  contLegalTelefone: { label: 'Contato Representante Legal - Telefone', category: 'contato' },
  contLegalEmail: { label: 'Contato Representante Legal - E-mail', category: 'contato' },

  periodoInicio: { label: 'Período Início', category: 'emissor' },
  periodoFim: { label: 'Período Fim', category: 'emissor' },
  dataEmissao: { label: 'Data de Emissão', category: 'emissor' },
}

// Siglas de estados brasileiros
const BRAZILIAN_UFS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
])

const BRAZILIAN_STATE_NAMES_TO_UF: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amapá: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  ceará: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  'espírito santo': 'ES',
  goias: 'GO',
  goiás: 'GO',
  maranhao: 'MA',
  maranhão: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  pará: 'PA',
  paraiba: 'PB',
  paraíba: 'PB',
  parana: 'PR',
  paraná: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  piauí: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  rondônia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  'são paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
}

/**
 * Normaliza uma string de texto removendo acentos, caracteres especiais duplicados e espaços.
 */
export function normalizeLabel(text: string): string {
  if (!text) return ''
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normaliza UF para sigla de 2 letras
 */
export function normalizeUF(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim().toUpperCase()
  if (BRAZILIAN_UFS.has(trimmed)) {
    return trimmed
  }
  const norm = normalizeLabel(raw)
  if (BRAZILIAN_STATE_NAMES_TO_UF[norm]) {
    return BRAZILIAN_STATE_NAMES_TO_UF[norm]
  }
  // Se for algo como "SP - SAO PAULO" ou "SAO PAULO / SP"
  for (const uf of BRAZILIAN_UFS) {
    const rx = new RegExp(`\\b${uf}\\b`)
    if (rx.test(trimmed)) {
      return uf
    }
  }
  return trimmed.slice(0, 2)
}

/**
 * Formata ou limpa valores conforme a chave de destino
 */
export function formatFieldValue(key: keyof CalculatorState, rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) return ''
  let str = String(rawValue).trim()
  if (!str) return ''

  // Chaves de telefone
  if (
    key === 'contFinTelefone' ||
    key === 'contEstoqueTelefone' ||
    key === 'contRhTelefone' ||
    key === 'contLegalTelefone'
  ) {
    return formatPhoneBR(str)
  }

  // Chaves de CNPJ / CPF
  if (key === 'empresaCnpj' || key === 'clienteCnpj') {
    const digits = str.replace(/\D/g, '')
    if (digits.length === 11 || digits.length === 14) {
      return formatCpfCnpj(digits)
    }
    return str
  }

  // Chaves de UF
  if (key === 'empresaUf' || key === 'clienteUf') {
    return normalizeUF(str)
  }

  // Inscrição Estadual / Municipal
  if (key === 'clienteIE' || key === 'clienteIM') {
    return str
  }

  // E-mails
  if (
    key === 'contFinEmail' ||
    key === 'contEstoqueEmail' ||
    key === 'contRhEmail' ||
    key === 'contLegalEmail'
  ) {
    return str.toLowerCase().trim()
  }

  return str
}

/**
 * Identifica a qual chave do CalculatorState um rótulo de célula/coluna pertence.
 * Retorna null se não for reconhecido.
 */
export function matchHeaderToFieldKey(rawHeader: string): keyof CalculatorState | null {
  const norm = normalizeLabel(rawHeader)
  if (!norm) return null

  // 1. Descarte explícito de logos (não vêm de planilha)
  if (/^(logo|logotipo|imagem|icone|foto|brand|client\s*logo|logo\s*data)\b/.test(norm)) {
    return null
  }

  // 2. CONTATOS POR ÁREA (Financeiro, Estoque, RH, Representante Legal)
  // 2.1 Financeiro
  if (
    norm.includes('financeiro') ||
    norm.includes('finan') ||
    norm.includes('contas a pagar') ||
    norm.includes('tesouraria')
  ) {
    if (
      norm.includes('tel') ||
      norm.includes('cel') ||
      norm.includes('fone') ||
      norm.includes('whatsapp') ||
      norm.includes('whats')
    ) {
      return 'contFinTelefone'
    }
    if (norm.includes('email') || norm.includes('e mail') || norm.includes('mail')) {
      return 'contFinEmail'
    }
    if (
      norm.includes('nome') ||
      norm.includes('contato') ||
      norm.includes('responsavel') ||
      norm.includes('pessoa')
    ) {
      return 'contFinNome'
    }
    // Rótulo padrão "financeiro" sem subtítulo se não qualificado pode não bater
  }

  // 2.2 Estoque / Logística
  if (
    norm.includes('estoque') ||
    norm.includes('logistica') ||
    norm.includes('almoxarifado') ||
    norm.includes('suprimentos')
  ) {
    if (
      norm.includes('tel') ||
      norm.includes('cel') ||
      norm.includes('fone') ||
      norm.includes('whatsapp') ||
      norm.includes('whats')
    ) {
      return 'contEstoqueTelefone'
    }
    if (norm.includes('email') || norm.includes('e mail') || norm.includes('mail')) {
      return 'contEstoqueEmail'
    }
    if (
      norm.includes('nome') ||
      norm.includes('contato') ||
      norm.includes('responsavel') ||
      norm.includes('pessoa')
    ) {
      return 'contEstoqueNome'
    }
  }

  // 2.3 RH / Recursos Humanos
  if (
    norm.includes('rh') ||
    norm.includes('recursos humanos') ||
    norm.includes('dp') ||
    norm.includes('depto pessoal') ||
    norm.includes('departamento pessoal')
  ) {
    if (
      norm.includes('tel') ||
      norm.includes('cel') ||
      norm.includes('fone') ||
      norm.includes('whatsapp') ||
      norm.includes('whats')
    ) {
      return 'contRhTelefone'
    }
    if (norm.includes('email') || norm.includes('e mail') || norm.includes('mail')) {
      return 'contRhEmail'
    }
    if (
      norm.includes('nome') ||
      norm.includes('contato') ||
      norm.includes('responsavel') ||
      norm.includes('pessoa')
    ) {
      return 'contRhNome'
    }
  }

  // 2.4 Representante Legal / Diretoria / Sócio / Advogado
  if (
    norm.includes('representante legal') ||
    norm.includes('rep legal') ||
    norm.includes('representante') ||
    norm.includes('socio') ||
    norm.includes('diretoria') ||
    norm.includes('diretor') ||
    norm.includes('administrador') ||
    norm.includes('legal')
  ) {
    if (
      norm.includes('tel') ||
      norm.includes('cel') ||
      norm.includes('fone') ||
      norm.includes('whatsapp') ||
      norm.includes('whats')
    ) {
      return 'contLegalTelefone'
    }
    if (norm.includes('email') || norm.includes('e mail') || norm.includes('mail')) {
      return 'contLegalEmail'
    }
    if (
      norm.includes('nome') ||
      norm.includes('contato') ||
      norm.includes('responsavel') ||
      norm.includes('pessoa')
    ) {
      return 'contLegalNome'
    }
  }

  // 3. EMISSOR (Sua empresa / Identificação)
  // Prefixos comuns: emissor, emitente, prestador, minha empresa, empresa emissora
  const isExplicitIssuer =
    norm.startsWith('emissor') ||
    norm.startsWith('emitente') ||
    norm.startsWith('prestador') ||
    norm.includes('minha empresa') ||
    norm.includes('dados do emissor') ||
    norm.includes('empresa emissora')

  if (isExplicitIssuer) {
    if (norm.includes('cnpj')) return 'empresaCnpj'
    if (
      norm.includes('razao') ||
      norm.includes('nome') ||
      norm.includes('empresa') ||
      norm.includes('empresarial')
    )
      return 'empresaNome'
    if (norm.includes('endereco') || norm.includes('logradouro') || norm.includes('rua'))
      return 'empresaEndereco'
    if (norm.includes('cidade') || norm.includes('municipio')) return 'empresaCidade'
    if (norm.includes('uf') || norm.includes('estado')) return 'empresaUf'
  }

  // Outros padrões específicos do emissor
  if (
    norm === 'razao social emissor' ||
    norm === 'nome emissor' ||
    norm === 'empresa emissor' ||
    norm === 'prestador razao social' ||
    norm === 'prestador nome' ||
    norm === 'nome da empresa' ||
    norm === 'sua empresa' ||
    norm === 'empresa'
  ) {
    return 'empresaNome'
  }

  if (
    norm === 'cnpj emissor' ||
    norm === 'cnpj do emissor' ||
    norm === 'cnpj prestador' ||
    norm === 'cnpj emitente'
  ) {
    return 'empresaCnpj'
  }

  if (
    norm === 'endereco emissor' ||
    norm === 'logradouro emissor' ||
    norm === 'endereco da empresa'
  ) {
    return 'empresaEndereco'
  }

  if (norm === 'cidade emissor' || norm === 'municipio emissor') {
    return 'empresaCidade'
  }

  if (norm === 'uf emissor' || norm === 'estado emissor') {
    return 'empresaUf'
  }

  // 4. CLIENTE (Destinatário / Tomador)
  // Prefixos comuns de cliente
  const isExplicitClient =
    norm.startsWith('cliente') ||
    norm.startsWith('tomador') ||
    norm.startsWith('destinatario') ||
    norm.startsWith('sacado') ||
    norm.includes('dados do cliente')

  if (isExplicitClient) {
    if (norm.includes('cnpj') || norm.includes('cpf')) return 'clienteCnpj'
    if (
      norm.includes('inscricao estadual') ||
      norm.includes('ie') ||
      norm.includes('insc estadual')
    )
      return 'clienteIE'
    if (
      norm.includes('inscricao municipal') ||
      norm.includes('im') ||
      norm.includes('ccm') ||
      norm.includes('insc municipal')
    )
      return 'clienteIM'
    if (
      norm.includes('ramo') ||
      norm.includes('atividade') ||
      norm.includes('cnae') ||
      norm.includes('objeto')
    )
      return 'clienteRamo'
    if (norm.includes('razao') || norm.includes('nome') || norm.includes('empresarial'))
      return 'clienteNome'
    if (norm.includes('endereco') || norm.includes('logradouro') || norm.includes('rua'))
      return 'clienteEndereco'
    if (norm.includes('cidade') || norm.includes('municipio')) return 'clienteCidade'
    if (norm.includes('uf') || norm.includes('estado')) return 'clienteUf'
  }

  // Rótulos genéricos ou diretos de cliente
  // CNPJ / CPF
  if (
    norm === 'cnpj' ||
    norm === 'cpf' ||
    norm === 'cnpj cpf' ||
    norm === 'cnpj ou cpf' ||
    norm === 'cpf cnpj' ||
    norm === 'documento'
  ) {
    return 'clienteCnpj'
  }

  // Inscrição Estadual
  if (
    norm === 'inscricao estadual' ||
    norm === 'insc estadual' ||
    norm === 'ie' ||
    norm === 'i e' ||
    norm === 'inscr estadual'
  ) {
    return 'clienteIE'
  }

  // Inscrição Municipal
  if (
    norm === 'inscricao municipal' ||
    norm === 'insc municipal' ||
    norm === 'im' ||
    norm === 'i m' ||
    norm === 'ccm' ||
    norm === 'inscr municipal' ||
    norm === 'cadastro mobiliario'
  ) {
    return 'clienteIM'
  }

  // Ramo de Atividade / CNAE
  if (
    norm === 'ramo de atividade' ||
    norm === 'ramo' ||
    norm === 'atividade economica' ||
    norm === 'atividade' ||
    norm === 'cnae' ||
    norm === 'cnae principal' ||
    norm === 'atividade principal' ||
    norm === 'ramo atividade'
  ) {
    return 'clienteRamo'
  }

  // Nome do cliente
  if (
    norm === 'razao social' ||
    norm === 'nome empresarial' ||
    norm === 'nome do cliente' ||
    norm === 'razao social do cliente' ||
    norm === 'cliente' ||
    norm === 'tomador' ||
    norm === 'destinatario' ||
    norm === 'nome'
  ) {
    return 'clienteNome'
  }

  // Endereço
  if (
    norm === 'endereco' ||
    norm === 'logradouro' ||
    norm === 'rua' ||
    norm === 'endereco completo' ||
    norm === 'endereco cliente'
  ) {
    return 'clienteEndereco'
  }

  // Cidade
  if (norm === 'cidade' || norm === 'municipio' || norm === 'cidade cliente') {
    return 'clienteCidade'
  }

  // UF
  if (norm === 'uf' || norm === 'estado' || norm === 'uf cliente') {
    return 'clienteUf'
  }

  return null
}

/**
 * Lê uma planilha Excel (.xlsx, .xls) a partir de um ArrayBuffer e extrai
 * todos os dados cadastrais (Emissor, Cliente e Contatos) de forma flexível.
 */
export function parseSpreadsheetBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  currentState: CalculatorState,
): SpreadsheetParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetNames = workbook.SheetNames || []

  if (sheetNames.length === 0) {
    return {
      fields: [],
      warnings: [{ message: 'A planilha enviada não contém nenhuma aba.', type: 'warning' }],
      totalSheets: 0,
      sheetNames: [],
      detectedRows: 0,
      fileName,
    }
  }

  const warnings: SpreadsheetWarning[] = []
  // Mapa temporário para armazenar o valor extraído para cada chave
  // Estrutura: key -> { value, sourceLocation }
  const fieldCandidates = new Map<
    keyof CalculatorState,
    { value: string; sourceLocation: string }
  >()

  let totalDetectedRows = 0

  // Varre as abas. Se houver mais de uma, avisa o usuário
  if (sheetNames.length > 1) {
    warnings.push({
      message: `A planilha contém ${sheetNames.length} abas (${sheetNames.join(', ')}). Foram lidos os dados da primeira aba "${sheetNames[0]}".`,
      type: 'info',
    })
  }

  const primarySheet = workbook.Sheets[sheetNames[0]]
  if (!primarySheet) {
    return {
      fields: [],
      warnings: [{ message: 'A primeira aba da planilha está vazia.', type: 'warning' }],
      totalSheets: sheetNames.length,
      sheetNames,
      detectedRows: 0,
      fileName,
    }
  }

  // Converte a aba em matriz de células (linhas x colunas)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(primarySheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  totalDetectedRows = rows.length
  if (rows.length === 0) {
    return {
      fields: [],
      warnings: [{ message: 'Nenhuma linha com dados encontrada na planilha.', type: 'warning' }],
      totalSheets: sheetNames.length,
      sheetNames,
      detectedRows: 0,
      fileName,
    }
  }

  // ESTRATÉGIA DE DETECÇÃO:
  // 1. Testa se a planilha é HORIZONTAL (cabeçalhos na primeira linha válida com valores na linha 2)
  // 2. Testa se a planilha é VERTICAL (Rótulo na coluna A, Valor na coluna B ou C)
  // 3. Suporta também formato misto onde linhas verticais são escaneadas linha a linha

  // Vamos verificar primeiro formato vertical (muito comum em cadastros: Coluna A = campo, Coluna B = valor)
  let verticalMatches = 0
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (row && row.length >= 2) {
      const colA = String(row[0] || '').trim()
      const colB = String(row[1] || '').trim()
      if (colA && colB) {
        const matchedKey = matchHeaderToFieldKey(colA)
        if (matchedKey) {
          verticalMatches++
        }
      }
    }
  }

  // Testa formato horizontal: linha de cabeçalho com múltiplas colunas conhecidas
  let horizontalMatches = 0
  let headerRowIndex = -1
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const row = rows[r]
    if (!row || row.length < 2) continue
    let rowMatchCount = 0
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim()
      if (cellVal && matchHeaderToFieldKey(cellVal)) {
        rowMatchCount++
      }
    }
    if (rowMatchCount > horizontalMatches) {
      horizontalMatches = rowMatchCount
      headerRowIndex = r
    }
  }

  // Decide entre horizontal ou vertical baseado em correspondências
  if (horizontalMatches >= 2 && horizontalMatches >= verticalMatches) {
    // === MODO HORIZONTAL ===
    const headerRow = rows[headerRowIndex]
    // Procura a primeira linha subsequente que tenha algum valor
    let dataRowIndex = -1
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r]
      if (row && row.some((c) => String(c || '').trim() !== '')) {
        dataRowIndex = r
        break
      }
    }

    if (dataRowIndex !== -1) {
      const dataRow = rows[dataRowIndex]
      for (let c = 0; c < headerRow.length; c++) {
        const headerText = String(headerRow[c] || '').trim()
        if (!headerText) continue
        const matchedKey = matchHeaderToFieldKey(headerText)
        if (matchedKey && ALLOWED_SPREADSHEET_KEYS.has(matchedKey)) {
          const rawValue = dataRow[c]
          const formatted = formatFieldValue(matchedKey, rawValue)
          if (formatted) {
            const colLetter = XLSX.utils.encode_col(c)
            const cellRef = `${colLetter}${dataRowIndex + 1}`
            fieldCandidates.set(matchedKey, {
              value: formatted,
              sourceLocation: `Coluna "${headerText}" (${cellRef})`,
            })
          }
        }
      }
    }
  } else {
    // === MODO VERTICAL / LINHA A LINHA ===
    // Varre todas as linhas procurando [Rótulo, Valor] ou [Vazio, Rótulo, Valor]
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      if (!row || row.length === 0) continue

      // Tenta coluna 0 e 1, depois 1 e 2 caso a coluna A esteja vazia
      let labelCol = -1
      let valueCol = -1

      for (let c = 0; c < row.length - 1; c++) {
        const candidateLabel = String(row[c] || '').trim()
        if (candidateLabel && matchHeaderToFieldKey(candidateLabel)) {
          // Achou rótulo! Procura o próximo valor não vazio na mesma linha
          labelCol = c
          for (let vc = c + 1; vc < row.length; vc++) {
            const candidateValue = String(row[vc] || '').trim()
            if (candidateValue) {
              valueCol = vc
              break
            }
          }
          break
        }
      }

      if (labelCol !== -1 && valueCol !== -1) {
        const labelText = String(row[labelCol] || '').trim()
        const matchedKey = matchHeaderToFieldKey(labelText)
        if (matchedKey && ALLOWED_SPREADSHEET_KEYS.has(matchedKey)) {
          const rawValue = row[valueCol]
          const formatted = formatFieldValue(matchedKey, rawValue)
          if (formatted) {
            const cellRef = `${XLSX.utils.encode_col(valueCol)}${r + 1}`
            // Se já existir, avisa se houver substituição
            if (fieldCandidates.has(matchedKey)) {
              warnings.push({
                message: `Campo "${FIELD_LABELS[matchedKey]?.label || matchedKey}" encontrado em múltiplas linhas; foi considerado o valor da linha ${r + 1}.`,
                type: 'info',
              })
            }
            fieldCandidates.set(matchedKey, {
              value: formatted,
              sourceLocation: `Linha ${r + 1} (${cellRef}) • Rótulo: "${labelText}"`,
            })
          }
        }
      }
    }
  }

  // Converte os candidatos no formato ExtractedField
  const extractedFields: SpreadsheetExtractedField[] = []

  for (const [key, candidate] of fieldCandidates.entries()) {
    const meta = FIELD_LABELS[key] || { label: key, category: 'cliente' as const }
    const currentVal = String(currentState[key] || '')
    const isDifferent = candidate.value.trim().toLowerCase() !== currentVal.trim().toLowerCase()

    extractedFields.push({
      key,
      label: meta.label,
      category: meta.category,
      value: candidate.value,
      currentValue: currentVal,
      sourceLocation: candidate.sourceLocation,
      isDifferent,
    })
  }

  // Ordenação lógica amigável: Emissor primeiro, depois Cliente, depois Contatos
  const categoryOrder: Record<string, number> = {
    emissor: 1,
    cliente: 2,
    contato: 3,
  }

  extractedFields.sort((a, b) => {
    const catDiff = (categoryOrder[a.category] || 9) - (categoryOrder[b.category] || 9)
    if (catDiff !== 0) return catDiff
    return a.label.localeCompare(b.label)
  })

  return {
    fields: extractedFields,
    warnings,
    totalSheets: sheetNames.length,
    sheetNames,
    detectedRows: totalDetectedRows,
    fileName,
  }
}
