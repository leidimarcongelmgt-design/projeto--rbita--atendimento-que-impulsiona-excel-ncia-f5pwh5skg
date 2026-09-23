import * as XLSX from 'xlsx'
import { CalculatorState } from '@/types/calculator'

export interface FieldMappingDefinition {
  key: keyof CalculatorState
  label: string
  aliases: string[]
  format: 'currency' | 'percent' | 'text'
  category: 'Cálculo (DRE)' | 'Tributos' | 'Folha de Pagamento' | 'Identificação'
}

export const IMPORTABLE_FIELDS: FieldMappingDefinition[] = [
  // Receita e DRE
  {
    key: 'receita',
    label: 'Receita Bruta',
    aliases: [
      'receita',
      'receita bruta',
      'faturamento',
      'faturamento bruto',
      'receita total',
      'receita operacional bruta',
      'vendas',
      'vendas brutas',
      'total receitas',
      'receita de vendas',
    ],
    format: 'currency',
    category: 'Cálculo (DRE)',
  },
  {
    key: 'deducoes',
    label: 'Deduções da Receita',
    aliases: [
      'deducoes',
      'deducoes da receita',
      'deducoes da receita bruta',
      'deducoes brutas',
      'abatimentos',
      'devolucoes',
      'impostos sobre vendas',
      'tributos sobre vendas',
      'descontos comerciais',
      'deducao',
    ],
    format: 'currency',
    category: 'Cálculo (DRE)',
  },
  {
    key: 'cmv',
    label: 'CMV / CPV / CSP (Custos)',
    aliases: [
      'cmv',
      'cpv',
      'csp',
      'custo',
      'custos',
      'custo das mercadorias',
      'custo das mercadorias vendidas',
      'custo dos produtos vendidos',
      'custo dos servicos prestados',
      'custo das vendas',
    ],
    format: 'currency',
    category: 'Cálculo (DRE)',
  },
  {
    key: 'despAdm',
    label: 'Despesas Administrativas',
    aliases: [
      'desp adm',
      'despadm',
      'despesas administrativas',
      'despesas operacionais',
      'despesas gerais',
      'despesas gerais e administrativas',
      'despesas adm',
      'adm',
      'desp operacionais',
      'despesas fixas',
      'gastos administrativos',
    ],
    format: 'currency',
    category: 'Cálculo (DRE)',
  },
  {
    key: 'despFolha',
    label: 'Despesas com Folha (Manual)',
    aliases: [
      'desp folha',
      'despfolha',
      'despesas com folha',
      'despesas folha',
      'despesas com pessoal',
      'folha de pagamento total',
      'gastos com pessoal',
      'total folha',
    ],
    format: 'currency',
    category: 'Cálculo (DRE)',
  },
  {
    key: 'tributos',
    label: 'Tributos e Impostos (Manual)',
    aliases: [
      'tributos',
      'impostos',
      'impostos sobre o lucro',
      'tributos sobre o lucro',
      'irpj e csll',
      'irpj',
      'csll',
      'simples nacional',
      'impostos totais',
      'provisao tributos',
    ],
    format: 'currency',
    category: 'Cálculo (DRE)',
  },
  {
    key: 'resFinanceiro',
    label: 'Resultado Financeiro',
    aliases: [
      'res financeiro',
      'resfinanceiro',
      'resultado financeiro',
      'resultado financeiro liquido',
      'receitas financeiras liquidas',
      'despesas financeiras liquidas',
      'receitas financeiras',
      'despesas financeiras',
      'lucro financeiro',
      'saldo financeiro',
    ],
    format: 'currency',
    category: 'Cálculo (DRE)',
  },

  // Tributos
  {
    key: 'tribBase',
    label: 'Base de Cálculo dos Tributos',
    aliases: [
      'trib base',
      'tribbase',
      'base de calculo dos tributos',
      'base de calculo',
      'base tributavel',
      'base de calculo tributos',
      'base impostos',
      'base tributos',
      'base calculo',
    ],
    format: 'currency',
    category: 'Tributos',
  },
  {
    key: 'tribAliq',
    label: 'Alíquota Efetiva de Tributos',
    aliases: [
      'trib aliq',
      'tribaliq',
      'aliquota',
      'aliquota de tributos',
      'aliquota tributos',
      'aliquota efetiva',
      'aliquota percentual',
      'aliquota imposto',
      'percentual tributos',
      'taxa tributos',
    ],
    format: 'percent',
    category: 'Tributos',
  },

  // Folha de Pagamento
  {
    key: 'folhaSalarios',
    label: 'Salários Base Brutos',
    aliases: [
      'folha salarios',
      'folhasalarios',
      'salarios',
      'salarios base',
      'salario',
      'salarios brutos',
      'total salarios',
      'remuneracoes',
      'remuneracao base',
      'ordenados',
    ],
    format: 'currency',
    category: 'Folha de Pagamento',
  },
  {
    key: 'folhaInss',
    label: 'INSS Patronal (%)',
    aliases: [
      'folha inss',
      'folhainss',
      'inss',
      'inss patronal',
      'aliquota inss',
      'inss %',
      'percentual inss',
      'taxa inss',
    ],
    format: 'percent',
    category: 'Folha de Pagamento',
  },
  {
    key: 'folhaFgts',
    label: 'FGTS (%)',
    aliases: [
      'folha fgts',
      'folhafgts',
      'fgts',
      'aliquota fgts',
      'fgts %',
      'percentual fgts',
      'taxa fgts',
    ],
    format: 'percent',
    category: 'Folha de Pagamento',
  },
  {
    key: 'folhaOutros',
    label: 'Outros Encargos e Benefícios',
    aliases: [
      'folha outros',
      'folhaoutros',
      'outros encargos',
      'outros beneficios',
      'beneficios',
      'encargos adicionais',
      'vale transporte',
      'vale refeicao',
      'outros encargos e beneficios',
      'outros',
    ],
    format: 'currency',
    category: 'Folha de Pagamento',
  },

  // Identificação (caso venha na planilha)
  {
    key: 'clienteNome',
    label: 'Nome do Cliente / Razão Social',
    aliases: [
      'cliente',
      'nome do cliente',
      'razao social cliente',
      'empresa cliente',
      'cliente nome',
    ],
    format: 'text',
    category: 'Identificação',
  },
  {
    key: 'clienteCnpj',
    label: 'CNPJ do Cliente',
    aliases: ['cnpj cliente', 'cnpj do cliente', 'cpf cliente'],
    format: 'text',
    category: 'Identificação',
  },
  {
    key: 'empresaNome',
    label: 'Nome da Empresa Emitente',
    aliases: ['empresa', 'nome da empresa', 'razao social empresa', 'emitente', 'empresa nome'],
    format: 'text',
    category: 'Identificação',
  },
]

/**
 * Normaliza um texto para busca flexível: minúsculo, sem acentos, sem pontuação, sem espaços repetidos.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
    .replace(/[^a-z0-9]/g, ' ') // troca pontuação por espaço
    .replace(/\s+/g, ' ') // comprime múltiplos espaços
    .trim()
}

/**
 * Converte um valor bruto de célula (número, string com formatação pt-BR ou porcentagem) para number.
 */
export function parseSpreadsheetNumber(val: unknown, isPercent = false): number | null {
  if (val === undefined || val === null || val === '') {
    return null
  }

  // Se já for número nativo do Excel
  if (typeof val === 'number') {
    if (isNaN(val)) return null
    // Se o Excel armazenou percentual como decimal (ex: 0.20 para 20%) e o campo é percentual
    if (isPercent && Math.abs(val) > 0 && Math.abs(val) <= 1) {
      return Number((val * 100).toFixed(4))
    }
    return val
  }

  const str = String(val).trim()
  if (!str) return null

  // Verifica se há símbolo de percentual no texto
  const hasPercentSign = str.includes('%')

  // Remove caracteres que não sejam dígitos, '-', '.', ','
  // Tratamento de padrão pt-BR: "1.234,56" -> 1234.56 ou "1234,56" -> 1234.56
  // Se tiver tanto ponto quanto vírgula (ex: "R$ 1.250.000,50"): ponto é milhar, vírgula é decimal
  let cleaned = str.replace(/[^\d,.-]/g, '')

  if (!cleaned) return null

  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Ex: "1.234,56" -> remove pontos e troca vírgula por ponto
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    // Ex: "1234,56" -> troca vírgula por ponto
    cleaned = cleaned.replace(',', '.')
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    // Ex: "1.250.000" sem decimais -> remove todos os pontos
    cleaned = cleaned.replace(/\./g, '')
  }

  const parsed = parseFloat(cleaned)
  if (isNaN(parsed)) return null

  // Se o campo for percentual e tinha o símbolo % mas veio formatado ex: "20%"
  if (isPercent && !hasPercentSign && Math.abs(parsed) > 0 && Math.abs(parsed) <= 1) {
    return Number((parsed * 100).toFixed(4))
  }

  return parsed
}

export interface RecognizedItem {
  key: keyof CalculatorState
  label: string
  category: string
  originalHeader: string
  rawValue: unknown
  parsedValue: number | string
  displayFormatted: string
}

export interface IgnoredItem {
  source: string
  reason: string
}

export interface ParseSpreadsheetResult {
  sheetName: string
  orientation: 'horizontal' | 'vertical'
  recognized: RecognizedItem[]
  ignored: IgnoredItem[]
  unrecognizedHeaders: string[]
  patch: Partial<CalculatorState>
}

/**
 * Encontra a definição de campo que melhor bate com um cabeçalho/rótulo fornecido.
 */
export function findMatchingField(header: string): FieldMappingDefinition | null {
  const normHeader = normalizeText(header)
  if (!normHeader) return null

  // 1. Procura match exato com alias normalizado
  for (const field of IMPORTABLE_FIELDS) {
    for (const alias of field.aliases) {
      const normAlias = normalizeText(alias)
      if (normHeader === normAlias) {
        return field
      }
    }
  }

  // 2. Procura se o header contém um alias completo ou vice-versa (com limite de tamanho mínimo)
  let bestMatch: FieldMappingDefinition | null = null
  let maxAliasLen = 0

  for (const field of IMPORTABLE_FIELDS) {
    for (const alias of field.aliases) {
      const normAlias = normalizeText(alias)
      if (normAlias.length < 3) continue

      const isSub =
        normHeader.includes(normAlias) || (normAlias.includes(normHeader) && normHeader.length >= 4)

      if (isSub && normAlias.length > maxAliasLen) {
        maxAliasLen = normAlias.length
        bestMatch = field
      }
    }
  }

  return bestMatch
}

/**
 * Analisa a primeira planilha de uma pasta de trabalho (Workbook) e detecta se é horizontal ou vertical.
 */
export function parseWorkbook(workbook: XLSX.WorkBook): ParseSpreadsheetResult {
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('A planilha está vazia ou não possui abas.')
  }

  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet || !sheet['!ref']) {
    throw new Error('A aba da planilha selecionada está vazia.')
  }

  // Converte a planilha para matriz 2D (linhas x colunas)
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  })

  if (!rawRows || rawRows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada na planilha.')
  }

  // Descobrir orientação:
  // Se a coluna A tem vários textos reconhecíveis como nomes de campos e a coluna B tem valores numéricos,
  // ou se a linha 1 tem vários nomes de campos em colunas diferentes.
  let verticalScore = 0
  let horizontalScore = 0

  // Testa primeiras linhas na vertical (coluna 0)
  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const cellVal = rawRows[r]?.[0]
    if (typeof cellVal === 'string' && findMatchingField(cellVal)) {
      verticalScore++
    }
  }

  // Testa primeira linha não-vazia na horizontal
  let headerRowIndex = 0
  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r] || []
    let score = 0
    for (const cell of row) {
      if (typeof cell === 'string' && findMatchingField(cell)) {
        score++
      }
    }
    if (score > horizontalScore) {
      horizontalScore = score
      headerRowIndex = r
    }
  }

  const isVertical = verticalScore > horizontalScore && verticalScore >= 2

  const recognized: RecognizedItem[] = []
  const ignored: IgnoredItem[] = []
  const unrecognizedHeaders: string[] = []
  const patch: Partial<CalculatorState> = {}
  const seenKeys = new Set<keyof CalculatorState>()

  if (isVertical) {
    // Processamento Vertical: Coluna A = Nome do Campo, Coluna B = Valor
    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r] || []
      const headerCell = row[0]
      const valueCell = row[1] !== undefined ? row[1] : row[2] // tenta coluna B ou C se B estiver vazia

      if (headerCell === null || headerCell === undefined || String(headerCell).trim() === '') {
        continue
      }

      const headerText = String(headerCell).trim()
      const match = findMatchingField(headerText)

      if (!match) {
        unrecognizedHeaders.push(headerText)
        continue
      }

      if (seenKeys.has(match.key)) {
        ignored.push({
          source: `${headerText} (linha ${r + 1})`,
          reason: 'Campo duplicado na planilha; o primeiro valor foi mantido.',
        })
        continue
      }

      if (match.format === 'text') {
        const textVal = String(valueCell ?? '').trim()
        if (textVal) {
          patch[match.key] = textVal as never
          seenKeys.add(match.key)
          recognized.push({
            key: match.key,
            label: match.label,
            category: match.category,
            originalHeader: headerText,
            rawValue: valueCell,
            parsedValue: textVal,
            displayFormatted: textVal,
          })
        }
      } else {
        const numVal = parseSpreadsheetNumber(valueCell, match.format === 'percent')
        if (numVal !== null) {
          patch[match.key] = numVal as never
          seenKeys.add(match.key)
          recognized.push({
            key: match.key,
            label: match.label,
            category: match.category,
            originalHeader: headerText,
            rawValue: valueCell,
            parsedValue: numVal,
            displayFormatted:
              match.format === 'percent'
                ? `${numVal.toLocaleString('pt-BR')}%`
                : `R$ ${numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          })
        } else {
          ignored.push({
            source: `${headerText} (linha ${r + 1})`,
            reason: 'Valor não numérico ou vazio.',
          })
        }
      }
    }

    return {
      sheetName: firstSheetName,
      orientation: 'vertical',
      recognized,
      ignored,
      unrecognizedHeaders,
      patch,
    }
  }

  // Processamento Horizontal: Linha de cabeçalho + linha de valores subsequente
  const headerRow = rawRows[headerRowIndex] || []
  // Procura a primeira linha subsequente com valores numéricos
  let dataRow: unknown[] | null = null
  let dataRowIndex = headerRowIndex + 1

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const candidate = rawRows[r]
    if (candidate && candidate.some((c) => c !== null && c !== undefined && c !== '')) {
      dataRow = candidate
      dataRowIndex = r
      break
    }
  }

  if (!dataRow) {
    throw new Error('Nenhuma linha de valores foi encontrada abaixo do cabeçalho da planilha.')
  }

  for (let col = 0; col < headerRow.length; col++) {
    const headerCell = headerRow[col]
    if (headerCell === null || headerCell === undefined || String(headerCell).trim() === '') {
      continue
    }

    const headerText = String(headerCell).trim()
    const match = findMatchingField(headerText)
    const valueCell = dataRow[col]

    if (!match) {
      unrecognizedHeaders.push(headerText)
      continue
    }

    if (seenKeys.has(match.key)) {
      ignored.push({
        source: `${headerText} (coluna ${col + 1})`,
        reason: 'Campo duplicado na planilha.',
      })
      continue
    }

    if (match.format === 'text') {
      const textVal = String(valueCell ?? '').trim()
      if (textVal) {
        patch[match.key] = textVal as never
        seenKeys.add(match.key)
        recognized.push({
          key: match.key,
          label: match.label,
          category: match.category,
          originalHeader: headerText,
          rawValue: valueCell,
          parsedValue: textVal,
          displayFormatted: textVal,
        })
      }
    } else {
      const numVal = parseSpreadsheetNumber(valueCell, match.format === 'percent')
      if (numVal !== null) {
        patch[match.key] = numVal as never
        seenKeys.add(match.key)
        recognized.push({
          key: match.key,
          label: match.label,
          category: match.category,
          originalHeader: headerText,
          rawValue: valueCell,
          parsedValue: numVal,
          displayFormatted:
            match.format === 'percent'
              ? `${numVal.toLocaleString('pt-BR')}%`
              : `R$ ${numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        })
      } else {
        ignored.push({
          source: `${headerText} (linha ${dataRowIndex + 1}, coluna ${col + 1})`,
          reason: 'Valor não numérico ou vazio.',
        })
      }
    }
  }

  return {
    sheetName: firstSheetName,
    orientation: 'horizontal',
    recognized,
    ignored,
    unrecognizedHeaders,
    patch,
  }
}

/**
 * Lê um arquivo File do navegador (.xlsx ou .xls) e extrai o resultado do parsing.
 */
export async function parseExcelFile(file: File): Promise<ParseSpreadsheetResult> {
  const validExtensions = ['.xlsx', '.xls']
  const fileName = file.name.toLowerCase()
  const isValid = validExtensions.some((ext) => fileName.endsWith(ext))

  if (!isValid) {
    throw new Error(
      'Formato de arquivo inválido. Por favor, envie uma planilha no formato .xlsx ou .xls.',
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    raw: true,
  })

  return parseWorkbook(workbook)
}
