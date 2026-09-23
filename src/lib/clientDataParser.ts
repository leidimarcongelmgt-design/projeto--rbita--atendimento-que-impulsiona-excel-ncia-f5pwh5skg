import { CalculatorState } from '@/types/calculator'

export interface ExtractedField {
  key: keyof CalculatorState
  label: string
  value: string
  currentValue: string
  snippet: string
  confidence: 'high' | 'medium' | 'low'
  isDifferent: boolean
}

export type DocumentExtractionType = 'all' | 'cnpj' | 'ie' | 'im'

export interface ClientExtractionResult {
  fields: ExtractedField[]
  rawText: string
  hasTextLayer: boolean
  totalPages: number
  errorMessage?: string
  isPasswordProtected?: boolean
  docType?: DocumentExtractionType
}
// Brazilian states UF list
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

/**
 * Validates a Brazilian CNPJ number (14 digits)
 */
export function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return false
  if (/^(\d)\1{13}$/.test(clean)) return false

  let size = 12
  let numbers = clean.substring(0, size)
  const digits = clean.substring(size)
  let sum = 0
  let pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0), 10)) return false

  size = size + 1
  numbers = clean.substring(0, size)
  sum = 0
  pos = size - 7
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return result === parseInt(digits.charAt(1), 10)
}

/**
 * Validates a Brazilian CPF number (11 digits)
 */
export function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false

  let sum = 0
  let remainder: number

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(clean.substring(9, 10), 10)) return false

  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(clean.substring(10, 11), 10)
}

/**
 * Formats 14 digits as XX.XXX.XXX/XXXX-XX or 11 digits as XXX.XXX.XXX-XX
 */
export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return value
}

/**
 * Extracts a surrounding snippet of text around a match for context display
 */
function extractSnippet(text: string, index: number, matchLength: number, radius = 45): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + matchLength + radius)
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim()
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  return snippet
}

/**
 * Heuristically parses extracted PDF text to locate Brazilian client data.
 * Focuses on client / tomador / destinatário / sacado / consumidor sections,
 * differentiating them from the issuer (prestador / emitente).
 */
export function parseClientDataFromPdfText(
  rawText: string,
  currentState: CalculatorState,
  hasTextLayer = true,
  totalPages = 1,
  errorMessage?: string,
  isPasswordProtected = false,
  docType: DocumentExtractionType = 'all',
): ClientExtractionResult {
  if (!rawText || !hasTextLayer || errorMessage) {
    return {
      fields: [],
      rawText: rawText || '',
      hasTextLayer,
      totalPages,
      errorMessage,
      isPasswordProtected,
      docType,
    }
  }

  // ---------------------------------------------------------------------------
  // Extração Direcionada para Inscrição Estadual (docType === 'ie')
  // Comprovante de Inscrição e Situação Cadastral (Sintegra, Cadesp, Siare, etc.)
  // ---------------------------------------------------------------------------
  if (docType === 'ie') {
    const fields: ExtractedField[] = []
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    let detectedIE = ''
    let ieSnippet = ''
    let ieConfidence: 'high' | 'medium' | 'low' = 'low'

    // Patterns específicos de Comprovante de Inscrição Estadual
    const specificIeRegexes = [
      /(?:N[ÚU]MERO\s+DA\s+)?INSCRI[ÇC][ÃA]O\s+ESTADUAL[:\s\-–—]+([0-9.\-–/]{5,25}|ISENTO\b)/i,
      /(?:INSC\.?\s*ESTADUAL|INSC\.?\s*EST\.?|\bIE\b)[:\s\-–—]+([0-9.\-–/]{5,25}|ISENTO\b)/i,
      /(?:INSCRI[ÇC][ÃA]O\s+NO\s+CADASTRO\s+DE\s+CONTRIBUINTES|CADASTRO\s+ESTADUAL)[:\s\-–—]+([0-9.\-–/]{5,25})/i,
    ]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const regex of specificIeRegexes) {
        const match = regex.exec(line)
        if (match && match[1]) {
          const candidate = match[1].replace(/^(?:[:\-–—]\s*)+/, '').trim()
          if (candidate && !/^(?:CNPJ|CPF|ENDERE|MUNIC|DATA)/i.test(candidate)) {
            detectedIE = candidate
            ieSnippet = line
            ieConfidence = 'high'
            break
          }
        }
      }
      if (detectedIE) break

      // Linha com rótulo "INSCRIÇÃO ESTADUAL" e valor na linha seguinte
      if (
        /^(?:N[ÚU]MERO\s+DA\s+)?INSCRI[ÇC][ÃA]O\s+ESTADUAL[:\-–—]?$/i.test(line) ||
        /^INSC\.?\s*ESTADUAL[:\-–—]?$/i.test(line)
      ) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
          const candidateMatch = /^([0-9.\-–/]{5,25}|ISENTO\b)/i.exec(nextLine)
          if (candidateMatch) {
            detectedIE = candidateMatch[1].trim()
            ieSnippet = `${line} -> ${nextLine}`
            ieConfidence = 'high'
            break
          }
        }
      }
    }

    if (detectedIE) {
      fields.push({
        key: 'clienteIE',
        label: 'Inscrição Estadual do Cliente',
        value: detectedIE,
        currentValue: currentState.clienteIE || '',
        snippet: ieSnippet,
        confidence: ieConfidence,
        isDifferent:
          detectedIE.trim().toLowerCase() !== (currentState.clienteIE || '').trim().toLowerCase(),
      })
    }

    return {
      fields,
      rawText,
      hasTextLayer,
      totalPages,
      docType,
    }
  }

  // ---------------------------------------------------------------------------
  // Extração Direcionada para Inscrição Municipal (docType === 'im')
  // Comprovante do Cadastro de Contribuintes Mobiliários (CCM / FIC / DUC / IM)
  // ---------------------------------------------------------------------------
  if (docType === 'im') {
    const fields: ExtractedField[] = []
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    let detectedIM = ''
    let imSnippet = ''
    let imConfidence: 'high' | 'medium' | 'low' = 'low'

    const specificImRegexes = [
      /(?:N[ÚU]MERO\s+DA\s+)?INSCRI[ÇC][ÃA]O\s+MUNICIPAL[:\s\-–—]+([0-9.\-–/]{4,25}|ISENTO\b)/i,
      /(?:INSC\.?\s*MUNICIPAL|INSC\.?\s*MUN\.?|\bIM\b)[:\s\-–—]+([0-9.\-–/]{4,25}|ISENTO\b)/i,
      /(?:CADASTRO\s+DE\s+CONTRIBUINTES\s+MOBILI[ÁA]RIOS|\bCCM\b)[:\s\-–—]+([0-9.\-–/]{4,25})/i,
      /(?:CADASTRO\s+MOBILI[ÁA]RIO|INSCRI[ÇC][ÃA]O\s+MOBILI[ÁA]RIA)[:\s\-–—]+([0-9.\-–/]{4,25})/i,
    ]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const regex of specificImRegexes) {
        const match = regex.exec(line)
        if (match && match[1]) {
          const candidate = match[1].replace(/^(?:[:\-–—]\s*)+/, '').trim()
          if (candidate && !/^(?:CNPJ|CPF|ENDERE|ESTADUAL|DATA)/i.test(candidate)) {
            detectedIM = candidate
            imSnippet = line
            imConfidence = 'high'
            break
          }
        }
      }
      if (detectedIM) break

      // Linha com rótulo "INSCRIÇÃO MUNICIPAL" ou "CCM" e valor na linha seguinte
      if (
        /^(?:N[ÚU]MERO\s+DA\s+)?INSCRI[ÇC][ÃA]O\s+MUNICIPAL[:\-–—]?$/i.test(line) ||
        /^INSC\.?\s*MUNICIPAL[:\-–—]?$/i.test(line) ||
        /^(?:CADASTRO\s+DE\s+CONTRIBUINTES\s+MOBILI[ÁA]RIOS|\bCCM\b)[:\-–—]?$/i.test(line)
      ) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
          const candidateMatch = /^([0-9.\-–/]{4,25}|ISENTO\b)/i.exec(nextLine)
          if (candidateMatch) {
            detectedIM = candidateMatch[1].trim()
            imSnippet = `${line} -> ${nextLine}`
            imConfidence = 'high'
            break
          }
        }
      }
    }

    if (detectedIM) {
      fields.push({
        key: 'clienteIM',
        label: 'Inscrição Municipal do Cliente',
        value: detectedIM,
        currentValue: currentState.clienteIM || '',
        snippet: imSnippet,
        confidence: imConfidence,
        isDifferent:
          detectedIM.trim().toLowerCase() !== (currentState.clienteIM || '').trim().toLowerCase(),
      })
    }

    return {
      fields,
      rawText,
      hasTextLayer,
      totalPages,
      docType,
    }
  }

  // ---------------------------------------------------------------------------
  // Extração para Cartão CNPJ (docType === 'cnpj') ou Documento Geral ('all')
  // ---------------------------------------------------------------------------
  const isCnpjCardMode = docType === 'cnpj'

  const fields: ExtractedField[] = []
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // ---------------------------------------------------------------------------
  // 1. Section Identification & Document Segmentation
  // Brazilian documents (NF-e, NFS-e, Boletos, Faturas, Contratos) typically have:
  // - Issuer section: PRESTADOR (DE SERVIÇOS), EMITENTE, CEDENTE, BENEFICIÁRIO, FORNECEDOR, VENDEDOR, CONTRATADA
  // - Client section: TOMADOR (DE SERVIÇOS), DESTINATÁRIO / REMETENTE, DADOS DO CLIENTE, CLIENTE, SACADO, CONSUMIDOR, PAGADOR, CONTRATANTE
  // ---------------------------------------------------------------------------

  const ISSUER_HEADER_REGEX =
    /(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?PRESTADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?EMITENTE|(?:DADOS\s+DA\s+)?EMPRESA\s+EMISSORA|CEDENTE|BENEFICI[ÁA]RIO|FORNECEDOR|VENDEDOR|LOCADOR|CONTRATADA)\b/i

  const CLIENT_HEADER_REGEX =
    /(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?TOMADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|(?:DADOS\s+DO\s+)?CLIENTE|SACADO|CONSUMIDOR|PAGADOR|COMPRADOR|LOCAT[ÁA]RIO|CONTRATANTE)\b/i

  const SECTION_BOUNDARY_REGEX =
    /(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?PRESTADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?EMITENTE|CEDENTE|BENEFICI[ÁA]RIO|FORNECEDOR|CONTRATADA|DADOS\s+DOS\s+SERVI[ÇC]OS|DISCRIMINA[ÇC][ÃA]O\s+DOS\s+SERVI[ÇC]OS|DESCRI[ÇC][ÃA]O\s+DOS\s+PRODUTOS|DADOS\s+DO\s+PRODUTO|C[ÁA]LCULO\s+DO\s+IMPOSTO|DADOS\s+ADICIONAIS|INFORMA[ÇC][ÕO]ES\s+COMPLEMENTARES|VALOR\s+TOTAL|FATURA(?:\s*\/\s*DUPLICATA)?|ITENS\s+DA\s+NOTA|OBSERVA[ÇC][ÕO]ES?)\b/i

  // Find client block occurrences in the raw text.
  // Note: if there are multiple occurrences of CLIENT_HEADER_REGEX (or nested headers),
  // we look for a client header and isolate the text until the next section boundary.
  let clientSectionText = ''
  let clientSectionLines: string[] = []

  // Global regex search to find the best client header (prioritizing TOMADOR/DESTINATÁRIO)
  const clientHeaderGlobal = new RegExp(CLIENT_HEADER_REGEX.source, 'gi')
  let bestClientMatch: RegExpExecArray | null = null
  let currMatch: RegExpExecArray | null

  while ((currMatch = clientHeaderGlobal.exec(rawText)) !== null) {
    // If we find TOMADOR or DESTINATÁRIO, strongly prefer it
    if (/TOMADOR|DESTINAT[ÁA]RIO|SACADO|PAGADOR/i.test(currMatch[0])) {
      bestClientMatch = currMatch
      break
    }
    if (!bestClientMatch) {
      bestClientMatch = currMatch
    }
  }

  if (bestClientMatch) {
    const startIdx = bestClientMatch.index
    const afterClient = rawText.slice(startIdx + bestClientMatch[0].length)

    // Look for the next section boundary (after at least 20 characters)
    const nextBoundaryMatch = SECTION_BOUNDARY_REGEX.exec(afterClient.slice(20))
    if (nextBoundaryMatch) {
      const endOffset = 20 + nextBoundaryMatch.index
      clientSectionText = afterClient.slice(0, endOffset)
    } else {
      // Limit to 2500 chars of client block
      clientSectionText = afterClient.slice(0, 2500)
    }

    clientSectionLines = clientSectionText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  }

  // Also collect lines that explicitly match client/issuer in line-by-line inspection
  const linesToSearch = clientSectionLines.length > 0 ? clientSectionLines : lines

  // Note: CNPJ/CPF extraction is performed after section and client name detection
  // to allow neighborhood association with the client name line (e.g. RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA)
  let detectedCnpj = ''
  let cnpjSnippet = ''
  let cnpjConfidence: 'high' | 'medium' | 'low' = 'medium'

  // --- A.1 Inscrição Estadual (IE) do Cliente ---
  let detectedIE = ''
  let ieSnippet = ''
  let ieConfidence: 'high' | 'medium' | 'low' = 'low'

  const ieLabelRegex =
    /(?:INSCRI[ÇC][ÃA]O ESTADUAL|INSC\.?\s*ESTADUAL|INSC\.?\s*EST\.?|\bIE\b)[:\s]+([0-9.\-–/]{5,20}|ISENTO\b)/i

  for (const line of linesToSearch) {
    const match = ieLabelRegex.exec(line)
    if (match && match[1]) {
      const candidate = match[1].replace(/^(?:[:\-–—]\s*)+/, '').trim()
      if (candidate && !/^(?:CNPJ|CPF|ENDERE)/i.test(candidate)) {
        detectedIE = candidate
        ieSnippet = line
        ieConfidence = clientSectionText ? 'high' : 'medium'
        break
      }
    }
  }

  if (detectedIE) {
    fields.push({
      key: 'clienteIE',
      label: 'Inscrição Estadual do Cliente',
      value: detectedIE,
      currentValue: currentState.clienteIE || '',
      snippet: ieSnippet,
      confidence: ieConfidence,
      isDifferent:
        detectedIE.trim().toLowerCase() !== (currentState.clienteIE || '').trim().toLowerCase(),
    })
  }

  // --- A.2 Inscrição Municipal (IM) do Cliente ---
  let detectedIM = ''
  let imSnippet = ''
  let imConfidence: 'high' | 'medium' | 'low' = 'low'

  const imLabelRegex =
    /(?:INSCRI[ÇC][ÃA]O MUNICIPAL|INSC\.?\s*MUNICIPAL|INSC\.?\s*MUN\.?|\bIM\b|CCM)[:\s]+([0-9.\-–/]{4,20}|ISENTO\b)/i

  for (const line of linesToSearch) {
    const match = imLabelRegex.exec(line)
    if (match && match[1]) {
      const candidate = match[1].replace(/^(?:[:\-–—]\s*)+/, '').trim()
      if (candidate && !/^(?:CNPJ|CPF|ENDERE)/i.test(candidate)) {
        detectedIM = candidate
        imSnippet = line
        imConfidence = clientSectionText ? 'high' : 'medium'
        break
      }
    }
  }

  if (detectedIM) {
    fields.push({
      key: 'clienteIM',
      label: 'Inscrição Municipal do Cliente',
      value: detectedIM,
      currentValue: currentState.clienteIM || '',
      snippet: imSnippet,
      confidence: imConfidence,
      isDifferent:
        detectedIM.trim().toLowerCase() !== (currentState.clienteIM || '').trim().toLowerCase(),
    })
  }

  // --- A.3 Ramo de Atividade / Atividade Econômica / CNAE do Cliente ---
  let detectedRamo = ''
  let ramoSnippet = ''
  let ramoConfidence: 'high' | 'medium' | 'low' = 'low'

  /**
   * Limpa e padroniza a descrição ou código + descrição de CNAE / Ramo de Atividade.
   * Remove rótulos residuais como "CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL",
   * "ATIVIDADE ECONÔMICA PRINCIPAL", "CNAE PRINCIPAL", etc.,
   * pontuações no início/fim, mantendo o código (ex: 41.10-7-00 ou 4110-7/00 ou 41.10-7)
   * e sua respectiva descrição textual ("código - descrição").
   */
  const cleanRamoValue = (raw: string): string => {
    if (!raw) return ''
    let cleaned = raw.replace(/[\r\n\t]+/g, ' ').trim()

    // 1. Cortar outros campos conhecidos que possam vir colados no final da linha
    cleaned = cleaned
      .split(
        /\s+(?:\b(?:C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+DA\s+ATIVIDADE\s+ECON[ÔO]MICA\s+SECUND[ÁA]RIA|ATIVIDADE\s+ECON[ÔO]MICA\s+SECUND[ÁA]RIA|CNAE\s+SECUND[ÁA]RI[AO]|CNPJ|CPF|INSCRI[ÇC][ÃA]O|INSC|ENDERE[ÇC]O|LOGRADOURO|TEL|TELEFONE|FONE|E-?MAIL|VALOR|DATA)\b\s*[:\-–—|/])/i,
      )[0]
      .trim()

    // 2. Remover repetidamente marcadores e rótulos no início
    let prev = ''
    while (prev !== cleaned) {
      prev = cleaned

      // Remove prefixos de cabeçalho do Cartão CNPJ e afins
      // Ex: "CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL", "CÓDIGO E DESCRIÇÃO DO CNAE"
      cleaned = cleaned
        .replace(
          /^(?:C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+(?:DAS?\s+)?(?:ATIVIDADES?\s+ECON[ÔO]MICAS?|CNAE)(?:\s+PRINCIPAL)?[\s:]*)+/i,
          '',
        )
        .trim()

      // Remove prefixos de cabeçalho de ramo/cnae
      cleaned = cleaned
        .replace(
          /^(?:(?:RAMO\s+DE\s+ATIVIDADE|RAMO\s+DE\s+NEG[ÓO]CIO|RAMO\s+DE\s+ATUA[ÇC][ÃA]O|ATIVIDADE\s+ECON[ÔO]MICA(?:\s+DO\s+TOMADOR|\s+DO\s+CLIENTE)?|RAMO|CNAE)[\s:]+)+/i,
          '',
        )
        .trim()

      // Remove marcadores qualificadores de atividade (PRINCIPAL, SECUND[ÁA]RI[AO], etc.)
      cleaned = cleaned
        .replace(/^(?:PRINCIPAL|SECUND[ÁA]RI[AO]|PRIM[ÁA]RI[AO])\b\s*[:\-–—|/]*\s*/i, '')
        .trim()

      // Remove rótulo CNAE se ainda preceder o código
      cleaned = cleaned.replace(/^CNAE\b\s*[:\-–—|/]*\s*/i, '').trim()

      // Remove pontuações e símbolos residuais no início
      cleaned = cleaned.replace(/^(?:[:\-–—|/._()[\]]\s*)+/, '').trim()
    }

    // 3. Remover marcadores secundários no final se sobrarem
    cleaned = cleaned.replace(/\s*[:\-–—|/._()[\]\s]+$/, '').trim()

    // 4. Normalizar separador entre código e descrição: garantir espaço hífen espaço
    // Ex: "41.10-7-00-Incorporação" -> "41.10-7-00 - Incorporação"
    cleaned = cleaned.replace(
      /^(\d{2}[.\s]?\d{2}[-\s]?\d(?:[-\s]?\d{2})?)\s*[-–—:]\s*(.+)$/,
      '$1 - $2',
    )

    // 5. Normalizar espaços múltiplos
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()

    return cleaned
  }

  /**
   * Determina se o valor de ramo é meramente um marcador/rótulo (ex: "principal", "secundária", "cnae", etc.)
   */
  const isBareRamoMarker = (val: string): boolean => {
    const s = val
      .trim()
      .toLowerCase()
      .replace(/^[;,:.\-–—|/\\_()[\]\s]+/, '')
      .replace(/[;,:.\-–—|/\\_()[\]\s]+$/, '')
    if (!s) return true
    return /^(?:principal|secund[áa]ri[ao]|prim[áa]ri[ao]|cnae|cnae\s+principal|cnae\s+secund[áa]ri[ao]|atividade|atividade\s+principal|atividade\s+econ[ôo]mica|atividade\s+econ[ôo]mica\s+principal|c[óo]digo\s+e\s+descri[çc][ãa]o\s+da\s+atividade\s+econ[ôo]mica\s+principal|c[óo]digo\s+e\s+descri[çc][ãa]o\s+da\s+atividade\s+econ[ôo]mica|c[óo]digo\s+e\s+descri[çc][ãa]o|ramo|ramo\s+de\s+atividade)$/i.test(
      s,
    )
  }

  // Regex para linha contendo CNAE (com código numérico como 41.10-7-00, 4110-7/00, 41.10-7 ou descrição rica)
  const cnaeCodeWithDescRegex =
    /(?:(?:(?:C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+DA\s+)?ATIVIDADE\s+ECON[ÔO]MICA(?:\s+PRINCIPAL)?|CNAE(?:\s+PRINCIPAL)?|RAMO(?:\s+DE\s+ATIVIDADE)?)[\s:]+)?(\d{2}[.\s]?\d{2}[-\s]?\d(?:[-\s]?\d{2})?|\d{4,7})\s*[-–—:]\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s/.,&()'-]{3,})/i

  // Regex para rótulos explícitos de Ramo de Atividade / Atividade Principal (inline com valor na mesma linha)
  const ramoExplicitLabelRegex =
    /(?:C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+DA\s+ATIVIDADE\s+ECON[ÔO]MICA\s+PRINCIPAL|C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+DO\s+CNAE\s+PRINCIPAL|RAMO\s+DE\s+ATIVIDADE|RAMO\s+DE\s+NEG[ÓO]CIO|RAMO\s+DE\s+ATUA[ÇC][ÃA]O|ATIVIDADE\s+ECON[ÔO]MICA\s+PRINCIPAL|ATIVIDADE\s+ECON[ÔO]MICA|ATIVIDADE\s+PRINCIPAL|CNAE\s+PRINCIPAL|CNAE|RAMO)[:\s]+([^\n\r]{3,160})/i

  // Regex para linha contendo apenas o rótulo de cabeçalho da atividade (valor virá na próxima linha)
  const ramoLabelHeaderOnlyRegex =
    /^(?:C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+DA\s+ATIVIDADE\s+ECON[ÔO]MICA\s+PRINCIPAL|C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+DO\s+CNAE\s+PRINCIPAL|C[ÓO]DIGO\s+E\s+DESCRI[ÇC][ÃA]O\s+DA\s+ATIVIDADE\s+ECON[ÔO]MICA|RAMO\s+DE\s+ATIVIDADE|RAMO\s+DE\s+NEG[ÓO]CIO|RAMO\s+DE\s+ATUA[ÇC][ÃA]O|ATIVIDADE\s+ECON[ÔO]MICA\s+PRINCIPAL|ATIVIDADE\s+ECON[ÔO]MICA|ATIVIDADE\s+PRINCIPAL|CNAE\s+PRINCIPAL|CNAE|RAMO)[:\-–—]?$/i

  // 1. Prioridade Máxima: Procurar CNAE Principal com código e descrição estruturados
  // dentro das linhas prioritárias (seção do cliente ou linhas gerais se não isolada)
  for (let i = 0; i < linesToSearch.length; i++) {
    const line = linesToSearch[i]
    if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) continue

    // Verifica se a linha possui menção explícita a PRINCIPAL + CNAE / ATIVIDADE / CÓDIGO
    if (/PRINCIPAL/i.test(line) && /(?:CNAE|ATIVIDADE|RAMO|C[ÓO]DIGO|\d{2}\.\d{2})/i.test(line)) {
      // Exemplo 1: "CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL: 41.10-7-00 - Incorporação de empreendimentos imobiliários"
      // ou "Atividade Econômica Principal: 41.10-7-00 - Incorporação de empreendimentos imobiliários"
      // ou "CNAE PRINCIPAL: 41.10-7-00 - Incorporação de empreendimentos imobiliários"
      const cnaeMatch = cnaeCodeWithDescRegex.exec(line)
      if (cnaeMatch) {
        const fullCandidate = cleanRamoValue(line)
        if (fullCandidate && !isBareRamoMarker(fullCandidate) && fullCandidate.length >= 5) {
          detectedRamo = fullCandidate
          ramoSnippet = line
          ramoConfidence = 'high'
          break
        }
      }

      // Se a linha tem rótulo e valor inline
      const labelMatch = ramoExplicitLabelRegex.exec(line)
      if (labelMatch && labelMatch[1]) {
        let cleaned = cleanRamoValue(labelMatch[1])
        if (cleaned && !isBareRamoMarker(cleaned) && cleaned.length >= 4) {
          detectedRamo = cleaned
          ramoSnippet = line
          ramoConfidence = 'high'
          break
        }
      }

      // Se a linha contém apenas o rótulo/marcador "CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL" ou "CNAE PRINCIPAL"
      // e o valor real está na linha seguinte (i + 1)
      if (i + 1 < linesToSearch.length) {
        const nextLine = linesToSearch[i + 1].trim()
        // Ignorar se a próxima linha for outro cabeçalho como ATIVIDADE SECUNDÁRIA
        if (!/SECUND[ÁA]RI[AO]/i.test(nextLine)) {
          const cleanedNext = cleanRamoValue(nextLine)
          if (cleanedNext && !isBareRamoMarker(cleanedNext) && cleanedNext.length >= 5) {
            detectedRamo = cleanedNext
            ramoSnippet = `${line} -> ${nextLine}`
            ramoConfidence = 'high'
            break
          }
        }
      }
    }
  }

  // 2. Prioridade 2: Linha com rótulo "CNAE" ou "Atividade Econômica" em geral
  if (!detectedRamo) {
    for (let i = 0; i < linesToSearch.length; i++) {
      const line = linesToSearch[i]
      if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) continue

      // Descartar linhas de CNAE SECUNDÁRIA quando houver opção principal
      if (/SECUND[ÁA]RI[AO]/i.test(line) && !/PRINCIPAL/i.test(line)) continue

      // Inline match
      const match = ramoExplicitLabelRegex.exec(line)
      if (match && match[1]) {
        let candidate = cleanRamoValue(match[1])

        // Se o candidato for apenas a palavra "principal" ou marcador vazio, verificar linha seguinte
        if (isBareRamoMarker(candidate) || candidate.length < 4) {
          if (i + 1 < linesToSearch.length) {
            const nextCandidate = cleanRamoValue(linesToSearch[i + 1])
            if (nextCandidate && !isBareRamoMarker(nextCandidate) && nextCandidate.length >= 4) {
              candidate = nextCandidate
              ramoSnippet = `${line} -> ${linesToSearch[i + 1]}`
            }
          }
        }

        if (
          candidate &&
          !isBareRamoMarker(candidate) &&
          candidate.length >= 4 &&
          !/^(?:CNPJ|CPF)/i.test(candidate)
        ) {
          detectedRamo = candidate
          if (!ramoSnippet) ramoSnippet = line
          ramoConfidence = clientSectionText ? 'high' : 'medium'
          break
        }
      }

      // Header-only na linha i e valor na linha i + 1
      if (ramoLabelHeaderOnlyRegex.test(line)) {
        if (i + 1 < linesToSearch.length) {
          let nextLine = linesToSearch[i + 1].trim()
          let candidate = cleanRamoValue(nextLine)

          // Se a próxima linha ainda for apenas o marcador "principal" (ex: Linha 1: "CNAE", Linha 2: "Principal", Linha 3: "41.10-7-00...")
          if (isBareRamoMarker(candidate)) {
            if (i + 2 < linesToSearch.length) {
              const line3 = linesToSearch[i + 2].trim()
              const cand3 = cleanRamoValue(line3)
              if (cand3 && !isBareRamoMarker(cand3) && cand3.length >= 4) {
                candidate = cand3
                ramoSnippet = `${line} -> ${nextLine} -> ${line3}`
              }
            }
          }

          if (
            candidate &&
            !isBareRamoMarker(candidate) &&
            candidate.length >= 4 &&
            !/^(?:CNPJ|CPF)/i.test(candidate)
          ) {
            detectedRamo = candidate
            if (!ramoSnippet) ramoSnippet = `${line} -> ${nextLine}`
            ramoConfidence = clientSectionText ? 'high' : 'medium'
            break
          }
        }
      }
    }
  }

  // 3. Prioridade 3: Identificação de código CNAE solto (ex: "41.10-7-00 - Incorporação...")
  // mesmo sem rótulo explícito, dentro da seção do cliente
  if (!detectedRamo && clientSectionLines.length > 0) {
    for (const line of clientSectionLines) {
      if (ISSUER_HEADER_REGEX.test(line)) continue
      if (/SECUND[ÁA]RI[AO]/i.test(line)) continue

      const codeMatch = cnaeCodeWithDescRegex.exec(line)
      if (codeMatch) {
        const cleaned = cleanRamoValue(line)
        if (
          cleaned &&
          !isBareRamoMarker(cleaned) &&
          cleaned.length >= 8 &&
          !/^(?:CNPJ|CPF)/i.test(cleaned)
        ) {
          detectedRamo = cleaned
          ramoSnippet = line
          ramoConfidence = 'medium'
          break
        }
      }
    }
  }

  // Sanitização final do ramo detectado para garantir que nunca seja a palavra "principal" ou rótulos
  if (detectedRamo) {
    detectedRamo = cleanRamoValue(detectedRamo)
    if (isBareRamoMarker(detectedRamo)) {
      detectedRamo = ''
    }
  }

  if (detectedRamo) {
    fields.push({
      key: 'clienteRamo',
      label: isCnpjCardMode
        ? 'Código e Descrição da Atividade Econômica Principal'
        : 'Ramo de Atividade do Cliente',
      value: detectedRamo,
      currentValue: currentState.clienteRamo || '',
      snippet: ramoSnippet,
      confidence: ramoConfidence,
      isDifferent:
        detectedRamo.trim().toLowerCase() !== (currentState.clienteRamo || '').trim().toLowerCase(),
    })
  }

  // ---------------------------------------------------------------------------
  // Helper functions for candidate evaluation (Name & CNPJ)
  // ---------------------------------------------------------------------------

  /**
   * Limpeza e sanitização agressiva do nome / razão social do cliente.
   * Remove rótulos residuais, cabeçalhos de seção, pontuações, CNPJ/CPF colados
   * e fragmentos indesejados, garantindo que o valor contenha APENAS a razão social pura.
   */
  const cleanClientName = (raw: string): string => {
    if (!raw) return ''
    let cleaned = raw.replace(/[\r\n\t]+/g, ' ').trim()

    // 1. Remover marcadores e cabeçalhos de seção vazados no início ou meio
    const sectionHeaders = [
      /^(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?TOMADOR(?:\s+DE\s+SERVI[ÇC]OS?)?)\s*[:\-–—|/]*\s*/i,
      /^(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?)\s*[:\-–—|/]*\s*/i,
      /^(?:(?:DADOS\s+DO\s+)?CLIENTE|SACADO|CONSUMIDOR|PAGADOR|COMPRADOR|LOCAT[ÁA]RIO|CONTRATANTE)\s*[:\-–—|/]*\s*/i,
    ]
    for (const sh of sectionHeaders) {
      cleaned = cleaned.replace(sh, '').trim()
    }

    // 2. Remover rótulos precedentes no início do valor
    const leadingLabels = [
      /^(?:NOME\s*\/\s*RAZ[ÃA]O\s*SOCIAL|RAZ[ÃA]O\s*SOCIAL(?:\s+DO\s+TOMADOR|\s+DO\s+CLIENTE|\s+DO\s+DESTINAT[ÁA]RIO)?|NOME\s+EMPRESARIAL|NOME\s+DO\s+TOMADOR|NOME\s+DO\s+CLIENTE|NOME\s+FANTASIA|NOME|TOMADOR|SACADO|DESTINAT[ÁA]RIO|CLIENTE|PAGADOR|CONSUMIDOR)\s*[:\-–—|/]*\s*/i,
      /^(?:TOMADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|CLIENTE|SACADO)\s*[:\-–—|/]*\s*/i,
    ]
    let prev = ''
    while (prev !== cleaned) {
      prev = cleaned
      for (const lbl of leadingLabels) {
        cleaned = cleaned.replace(lbl, '').trim()
      }
      cleaned = cleaned.replace(/^(?:[:\-–—|/.]\s*)+/, '').trim()
    }

    // 3. Cortar em rótulos conhecidos de outros campos que apareçam a seguir (CNPJ, CPF, IE, Endereço, etc.)
    cleaned = cleaned
      .split(
        /\s+(?:\b(?:CNPJ|CPF|CNPJ\s*\/\s*CPF|INSCRI[ÇC][ÃA]O(?:\s+ESTADUAL|\s+MUNICIPAL)?|\bIE\b|\bIM\b|\bCCM\b|ENDERE[ÇC]O|LOGRADOURO|RUA|AV|AVENIDA|BAIRRO|CEP|MUNIC[ÍI]PIO|CIDADE|UF|ESTADO|TEL|TELEFONE|FONE|E-?MAIL|DATA(?:\s+DE\s+EMISS[ÃA]O)?)\b\s*[:\-–—|/])/i,
      )[0]
      .trim()

    // 4. Cortar caso um CNPJ formatado ou CPF formatado apareça colado após um espaço ou traço
    cleaned = cleaned.split(/\s+(?:[-–—|/]\s*)?\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)[0].trim()
    cleaned = cleaned.split(/\s+(?:[-–—|/]\s*)?\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/)[0].trim()

    // 5. Cortar sequências numéricas longas coladas no final (ex.: CNPJ puro com 14 dígitos ou CPF com 11 dígitos)
    cleaned = cleaned.replace(/\s+(?:[-–—|/]\s*)?\b\d{11,14}\b.*$/g, '').trim()
    cleaned = cleaned
      .replace(/\s+(?:[-–—|/]\s*)?\b\d{2}\s*\d{3}\s*\d{3}\s*\d{4}\s*\d{2}\b.*$/g, '')
      .trim()

    // 6. Remover pontuações e símbolos residuais nas pontas
    cleaned = cleaned.replace(/^[;,:.\-–—|/\\_()[\]\s]+/, '').trim()
    cleaned = cleaned.replace(/[;,:.\-–—|/\\_()[\]\s]+$/, '').trim()

    // 7. Normalizar espaços múltiplos
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()

    // 8. Se após a limpeza ainda sobrarem resquícios de sufixos de rótulo no final (ex: " : " ou "-")
    cleaned = cleaned.replace(/[:\-–—|/]+$/, '').trim()

    return cleaned
  }

  // Helper: check if a candidate string is valid as a business or person name
  const isExcludedGenericTerm = (str: string): boolean => {
    const s = str.trim().toLowerCase()
    if (s.length < 3) return true
    // Exclude label phrases or system terms (exact matches)
    if (
      /^(?:danfe|documento|nota\s+fiscal|nota\s+fiscal\s+eletr[ôo]nica|nfs-?e|nf-?e|chave\s+de\s+acesso|natureza\s+da\s+opera[çc][ãa]o|protocolo|folha|dossie|dossiê|relat[óo]rio|comprovante|recibo|boleto|fatura|duplicata|dados\s+do|dados\s+da|identifica[çc][ãa]o|endere[çc]o|munic[íi]pio|cidade|estado|telefone|e-?mail|cnpj|cpf|inscri[çc][ãa]o|inscri[çc][ãa]o\s+estadual|inscri[çc][ãa]o\s+municipal|descri[çc][ãa]o|valor|valor\s+total|imposto|issqn|icms|pis|cofins|irpj|csll|simples\s+nacional|prestador(?:\s+de\s+servi[çc]os?)?|emitente|empresa\s+emissora|cedente|benefici[áa]rio|tomador(?:\s+de\s+servi[çc]os?)?|destinat[áa]rio(?:\s*\/\s*remetente)?|sacado|consumidor|cliente|pagador)$/i.test(
        s,
      )
    ) {
      return true
    }
    // Exclude if it looks like only numbers, punctuation, or dates
    if (/^[\d\s./\-–—,]+$/.test(s)) return true
    if (/^\d{2}[/\-.]\d{2}[/\-.]\d{4}$/.test(s)) return true
    // Exclude header titles like "DADOS DO TOMADOR DE SERVIÇOS"
    if (/^(?:dados|identifica[çc][ãa]o)\s+(?:do|da|dos|das)\s+/i.test(s)) {
      return true
    }
    // Exclude known current emitter name
    if (currentState.empresaNome && s === currentState.empresaNome.trim().toLowerCase()) {
      return true
    }
    return false
  }

  const cleanNameCandidate = (val: string): string => {
    return cleanClientName(val)
  }

  // Helper to append next line(s) if the company name was wrapped onto subsequent lines in PDF
  const mergeWrappedNameLines = (
    baseCandidate: string,
    sourceLines: string[],
    startIndex: number,
  ): string => {
    let result = baseCandidate
    let idx = startIndex + 1
    while (idx < sourceLines.length && idx <= startIndex + 2) {
      const nextRaw = sourceLines[idx].trim()
      // Stop if next line is a header or label
      if (
        ISSUER_HEADER_REGEX.test(nextRaw) ||
        CLIENT_HEADER_REGEX.test(nextRaw) ||
        /^(?:CNPJ|CPF|INSCRI|ENDERE|RUA|AV|BAIRRO|CEP|MUNIC|CIDADE|UF|VALOR|DATA)/i.test(nextRaw)
      ) {
        break
      }

      // Check if next line looks like a name continuation (e.g. "INCORPORADORA SPE LTDA", "SPE LTDA", "LTDA", "ME")
      if (
        /\b(?:INCORPORADORA|CONSTRUTORA|ENGENHARIA|EMPREENDIMENTOS?|PARTICIPA[ÇC][ÕO]ES|SERVI[ÇC]OS?|COM[ÉE]RCIO|SPE|LTDA|S\/?A|EIRELI|ME|EPP)\b/i.test(
          nextRaw,
        ) ||
        (!/\b(?:LTDA|S\/?A|EIRELI|ME|EPP)\b/i.test(result) &&
          /^[A-ZÀ-Ÿ0-9\s.&'-]{2,50}$/.test(nextRaw))
      ) {
        const continuation = cleanNameCandidate(nextRaw)
        if (continuation && !isExcludedGenericTerm(continuation)) {
          result = `${result} ${continuation}`
          // If we reached LTDA / S/A / EIRELI / etc., stop chaining
          if (/\b(?:LTDA|S\/?A|EIRELI|ME|EPP)\b/i.test(continuation)) {
            break
          }
        }
      } else {
        break
      }
      idx++
    }
    return cleanClientName(result)
  }

  // --- B. Razão Social / Nome do Cliente ---
  // The client name (tomador, destinatário, sacado, comprador, cliente) must ALWAYS take
  // precedence over the emitter / issuer / prestador company name.
  let detectedNome = ''
  let nomeSnippet = ''
  let nomeConfidence: 'high' | 'medium' | 'low' = 'low'
  let detectedNomeLineIndex = -1

  // Priority 1: High-specificity Client/Tomador/Destinatário/Sacado labeled patterns
  // E.g.: "Tomador do Serviço: EMPRESA CLIENTE LTDA", "Destinatário/Remetente: FULANO DE TAL",
  // "Nome / Razão Social do Tomador: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA", "Sacado: NOME CLIENTE"
  // Priority 0: Explicit "Nome Empresarial" inside client section or explicit client patterns
  // E.g.: "Nome Empresarial: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA"
  // or line 1: "Nome Empresarial", line 2: "RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA"
  // Treated with highest priority when within client section or paired with client context,
  // strictly discarding issuer/prestador blocks.
  const NOME_EMPRESARIAL_INLINE_REGEX =
    /(?:(?:TOMADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|SACADO|PAGADOR|CONSUMIDOR|CLIENTE|CONTRATANTE)[\s:]+)?NOME\s+EMPRESARIAL(?:\s+DO\s+(?:TOMADOR|DESTINAT[ÁA]RIO|CLIENTE|SACADO))?[:\s\-–—]+([^\n\r]{3,120})/i

  const NOME_EMPRESARIAL_HEADER_ONLY_REGEX =
    /^(?:(?:TOMADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|SACADO|PAGADOR|CONSUMIDOR|CLIENTE)[\s:]+)?NOME\s+EMPRESARIAL(?:\s+DO\s+(?:TOMADOR|DESTINAT[ÁA]RIO|CLIENTE|SACADO))?[:\-–—]?$/i

  // 0.a) Scan inside clientSectionLines first if client section was detected
  if (clientSectionLines.length > 0) {
    for (let i = 0; i < clientSectionLines.length; i++) {
      const line = clientSectionLines[i]
      if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) continue

      // Inline: "Nome Empresarial: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA"
      const match = NOME_EMPRESARIAL_INLINE_REGEX.exec(line)
      if (match && match[1]) {
        let candidate = cleanNameCandidate(match[1])
        if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
          candidate = mergeWrappedNameLines(candidate, clientSectionLines, i)
          detectedNome = candidate
          nomeSnippet = line
          nomeConfidence = 'high'
          const fullIdx = lines.indexOf(line)
          if (fullIdx !== -1) detectedNomeLineIndex = fullIdx
          break
        }
      }

      // Next line: "Nome Empresarial" / line+1: "RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA"
      if (NOME_EMPRESARIAL_HEADER_ONLY_REGEX.test(line)) {
        if (i + 1 < clientSectionLines.length) {
          const nextLine = clientSectionLines[i + 1].trim()
          let candidate = cleanNameCandidate(nextLine)
          if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
            candidate = mergeWrappedNameLines(candidate, clientSectionLines, i + 1)
            detectedNome = candidate
            nomeSnippet = `${line} -> ${nextLine}`
            nomeConfidence = 'high'
            const fullIdx = lines.indexOf(nextLine)
            if (fullIdx !== -1) detectedNomeLineIndex = fullIdx
            break
          }
        }
      }
    }
  }

  // 0.b) If not in clientSectionLines (or clientSectionLines not isolated), scan all lines outside issuer block
  if (!detectedNome) {
    let inIssuerBlock = false
    let inClientBlock = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) {
        inIssuerBlock = true
        inClientBlock = false
      } else if (CLIENT_HEADER_REGEX.test(line)) {
        inIssuerBlock = false
        inClientBlock = true
      } else if (SECTION_BOUNDARY_REGEX.test(line) && inClientBlock) {
        inClientBlock = false
      }

      // Never extract client name from within issuer section
      if (inIssuerBlock) continue

      // Inline match for Nome Empresarial
      const match = NOME_EMPRESARIAL_INLINE_REGEX.exec(line)
      if (match && match[1]) {
        let candidate = cleanNameCandidate(match[1])
        if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
          candidate = mergeWrappedNameLines(candidate, lines, i)
          detectedNome = candidate
          nomeSnippet = line
          nomeConfidence = 'high'
          detectedNomeLineIndex = i
          break
        }
      }

      // Next line match for Nome Empresarial
      if (NOME_EMPRESARIAL_HEADER_ONLY_REGEX.test(line)) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
          let candidate = cleanNameCandidate(nextLine)
          if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
            candidate = mergeWrappedNameLines(candidate, lines, i + 1)
            detectedNome = candidate
            nomeSnippet = `${line} -> ${nextLine}`
            nomeConfidence = 'high'
            detectedNomeLineIndex = i + 1
            break
          }
        }
      }
    }
  }

  // Priority 1: High-specificity Client/Tomador/Destinatário/Sacado labeled patterns
  // E.g.: "Tomador do Serviço: EMPRESA CLIENTE LTDA", "Destinatário/Remetente: FULANO DE TAL",
  // "Nome / Razão Social do Tomador: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA", "Sacado: NOME CLIENTE"
  const explicitClientNameRegexes = [
    /(?:TOMADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|SACADO|PAGADOR|CONSUMIDOR|CLIENTE|CONTRATANTE)[\s:]+(?:NOME\s+EMPRESARIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|RAZ[ÃA]O\s*SOCIAL)?[:\s\-–—]+([^\n\r]{3,120})/i,
    /(?:NOME\s+EMPRESARIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|RAZ[ÃA]O\s*SOCIAL)\s+(?:DO\s+)?(?:TOMADOR|DESTINAT[ÁA]RIO|CLIENTE|SACADO|CONSUMIDOR)[:\s\-–—]+([^\n\r]{3,120})/i,
    /NOME\s+DO\s+CLIENTE[:\s\-–—]+([^\n\r]{3,120})/i,
    /(?:^|\b)(?:TOMADOR|DESTINAT[ÁA]RIO|SACADO|PAGADOR|CLIENTE)[:\s\-–—]+([^\n\r]{3,120})/i,
  ]

  // Priority 1 scan in full text
  if (!detectedNome) {
    for (const regex of explicitClientNameRegexes) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Don't match lines that are clearly PRESTADOR / EMITENTE headers
        if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) {
          continue
        }
        const match = regex.exec(line)
        if (match && match[1]) {
          let candidate = cleanNameCandidate(match[1])
          if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
            candidate = mergeWrappedNameLines(candidate, lines, i)
            detectedNome = candidate
            nomeSnippet = line
            nomeConfidence = 'high'
            detectedNomeLineIndex = i
            break
          }
        }
      }
      if (detectedNome) break
    }
  }

  // Priority 2: If we identified a clientSectionText, search inside it for "Nome Empresarial", "Razão Social", "Nome/Razão Social" or multi-line patterns
  if (!detectedNome && clientSectionLines.length > 0) {
    const clientBlockNameRegex =
      /(?:NOME\s+EMPRESARIAL|RAZ[ÃA]O\s*SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|NOME)[:\s\-–—]+([^\n\r]{3,120})/i

    for (let i = 0; i < clientSectionLines.length; i++) {
      const line = clientSectionLines[i]
      // Skip if this line explicitly mentions issuer
      if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) continue

      const match = clientBlockNameRegex.exec(line)
      if (match && match[1]) {
        let candidate = cleanNameCandidate(match[1])
        if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
          candidate = mergeWrappedNameLines(candidate, clientSectionLines, i)
          detectedNome = candidate
          nomeSnippet = line
          nomeConfidence = 'high'
          const fullIdx = lines.indexOf(line)
          if (fullIdx !== -1) detectedNomeLineIndex = fullIdx
          break
        }
      }

      // Next-line pattern inside client block:
      // Line i: "Nome Empresarial", "Razão Social:" or "Nome / Razão Social"
      // Line i+1: "RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA"
      if (
        /(?:NOME\s+EMPRESARIAL|RAZ[ÃA]O\s*SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|NOME)[:]?$/i.test(
          line,
        )
      ) {
        if (i + 1 < clientSectionLines.length) {
          const nextLine = clientSectionLines[i + 1].trim()
          let candidate = cleanNameCandidate(nextLine)
          if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
            candidate = mergeWrappedNameLines(candidate, clientSectionLines, i + 1)
            detectedNome = candidate
            nomeSnippet = `${line} -> ${nextLine}`
            nomeConfidence = 'high'
            const fullIdx = lines.indexOf(nextLine)
            if (fullIdx !== -1) detectedNomeLineIndex = fullIdx
            break
          }
        }
      }
    }

    // Priority 3: First valid business name or person name line inside client section block
    // (Common in invoices where customer name immediately follows "TOMADOR DE SERVIÇOS")
    if (!detectedNome) {
      for (let i = 0; i < Math.min(clientSectionLines.length, 8); i++) {
        const line = clientSectionLines[i]
        if (ISSUER_HEADER_REGEX.test(line)) continue
        let candidate = cleanNameCandidate(line)
        if (
          !isExcludedGenericTerm(candidate) &&
          candidate.length >= 4 &&
          /[A-Za-zÀ-ÿ]{3,}/.test(candidate)
        ) {
          candidate = mergeWrappedNameLines(candidate, clientSectionLines, i)

          // Check if looks like a company or personal name (Ltda, SPE, Incorporadora, S/A, ME, EPP, or capitalized words)
          if (
            /\b(?:LTDA|S\/?A|EIRELI|ME|EPP|SPE|INCORPORADORA|CONSTRUTORA|ENGENHARIA|SERVI[ÇC]OS|COMERCIO|COM[ÉE]RCIO|INDUSTRIA|IND[ÚU]STRIA)\b/i.test(
              candidate,
            ) ||
            /^[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)+/.test(candidate) ||
            /^[A-ZÀ-Ÿ0-9\s.&'-]{5,}$/.test(candidate)
          ) {
            detectedNome = candidate
            nomeSnippet = candidate
            nomeConfidence = 'high'
            const fullIdx = lines.indexOf(line)
            if (fullIdx !== -1) detectedNomeLineIndex = fullIdx
            break
          }
        }
      }
    }
  }

  // Priority 4: Look for name in general lines if not yet found
  if (!detectedNome) {
    const fallbackNameRegex =
      /(?:RAZ[ÃA]O\s*SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|NOME\s+EMPRESARIAL)[:\s\-–—]+([^\n\r]{3,120})/i

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip issuer sections
      if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) continue

      const match = fallbackNameRegex.exec(line)
      if (match && match[1]) {
        let candidate = cleanNameCandidate(match[1])
        if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
          candidate = mergeWrappedNameLines(candidate, lines, i)
          detectedNome = candidate
          nomeSnippet = line
          nomeConfidence = 'medium'
          detectedNomeLineIndex = i
          break
        }
      }

      // Next line fallback
      if (
        /(?:RAZ[ÃA]O\s*SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|NOME\s+EMPRESARIAL)[:]?$/i.test(
          line,
        )
      ) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
          let candidate = cleanNameCandidate(nextLine)
          if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
            candidate = mergeWrappedNameLines(candidate, lines, i + 1)
            detectedNome = candidate
            nomeSnippet = `${line} -> ${nextLine}`
            nomeConfidence = 'medium'
            detectedNomeLineIndex = i + 1
            break
          }
        }
      }
    }
  }

  // Priority 5: Specific company entity detection (e.g. SPE LTDA / INCORPORADORA / LTDA / S/A)
  // when not located by explicit labels, strictly excluding issuer lines and current empresaNome
  if (!detectedNome) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) continue
      if (
        /\b(?:SPE\s+LTDA|INCORPORADORA|LTDA|S\/?A|EIRELI|ME|EPP)\b/i.test(line) &&
        !isExcludedGenericTerm(line) &&
        line.length <= 120
      ) {
        let cand = cleanNameCandidate(line)
        if (!isExcludedGenericTerm(cand) && cand.length >= 4) {
          cand = mergeWrappedNameLines(cand, lines, i)
          detectedNome = cand
          nomeSnippet = line
          nomeConfidence = 'low'
          detectedNomeLineIndex = i
          break
        }
      }
    }
  }

  // If detectedNomeLineIndex was not set but detectedNome was found, locate its first line
  if (detectedNome && detectedNomeLineIndex === -1) {
    const firstWord = detectedNome.split(/\s+/)[0]
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(firstWord)) {
        detectedNomeLineIndex = i
        break
      }
    }
  }

  if (detectedNome) {
    const finalCleanNome = cleanClientName(detectedNome)
    if (finalCleanNome && !isExcludedGenericTerm(finalCleanNome)) {
      fields.push({
        key: 'clienteNome',
        label: 'Nome / Razão Social',
        value: finalCleanNome,
        currentValue: currentState.clienteNome || '',
        snippet: nomeSnippet,
        confidence: nomeConfidence,
        isDifferent:
          finalCleanNome.trim().toLowerCase() !==
          (currentState.clienteNome || '').trim().toLowerCase(),
      })
    }
  }

  // ---------------------------------------------------------------------------
  // A. Extração Especializada de CNPJ / CPF do Cliente (Tomador)
  // Requisitos:
  // 1. Garantir que o CNPJ/CPF extraído pertença ao tomador/cliente (ex: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA),
  //    e nunca ao emissor/prestador.
  // 2. Descartar CNPJs do emissor (seção prestador/emitente e currentState.empresaCnpj).
  // 3. Suportar CNPJ em linha separada do nome ou rótulo ("CNPJ:\n45.987.654/0001-88" ou "Nome\nCNPJ: ...").
  // 4. Associação por vizinhança: dar alta prioridade ao CNPJ dentro da seção do tomador ou
  //    adjacente às linhas do nome do cliente identificado.
  // ---------------------------------------------------------------------------

  interface CnpjCandidate {
    digits: string
    formatted: string
    snippet: string
    lineIndex: number
    inClientSection: boolean
    hasClientLabel: boolean
    isIssuerSection: boolean
    distanceToName: number // absolute line distance to detected client name
  }

  const allCnpjCandidates: CnpjCandidate[] = []
  const knownIssuerDigits = (currentState.empresaCnpj || '').replace(/\D/g, '')

  // Track active section state across document lines
  let currentSection: 'issuer' | 'client' | 'other' = 'other'

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]

    // Check section header transitions
    if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) {
      currentSection = 'issuer'
    } else if (CLIENT_HEADER_REGEX.test(line)) {
      currentSection = 'client'
    } else if (SECTION_BOUNDARY_REGEX.test(line) && currentSection === 'client') {
      currentSection = 'other'
    }

    const isInClientSec =
      currentSection === 'client' || (clientSectionText !== '' && clientSectionLines.includes(line))
    const isUnderIssuerSec = currentSection === 'issuer'

    const distToName = detectedNomeLineIndex !== -1 ? Math.abs(idx - detectedNomeLineIndex) : 999

    const hasClientLabelInLine =
      /(?:TOMADOR|DESTINAT[ÁA]RIO|SACADO|CLIENTE|PAGADOR|CONSUMIDOR)/i.test(line)

    // Check line for masked CNPJ
    const maskedCnpjMatches = line.matchAll(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)
    for (const m of maskedCnpjMatches) {
      const val = m[0]
      const digits = val.replace(/\D/g, '')
      if (isValidCNPJ(digits)) {
        allCnpjCandidates.push({
          digits,
          formatted: formatCpfCnpj(digits),
          snippet: line,
          lineIndex: idx,
          inClientSection: isInClientSec,
          hasClientLabel: hasClientLabelInLine,
          isIssuerSection: isUnderIssuerSec,
          distanceToName: distToName,
        })
      }
    }

    // Check line for masked CPF
    const maskedCpfMatches = line.matchAll(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)
    for (const m of maskedCpfMatches) {
      const val = m[0]
      const digits = val.replace(/\D/g, '')
      if (isValidCPF(digits)) {
        allCnpjCandidates.push({
          digits,
          formatted: formatCpfCnpj(digits),
          snippet: line,
          lineIndex: idx,
          inClientSection: isInClientSec,
          hasClientLabel: hasClientLabelInLine,
          isIssuerSection: isUnderIssuerSec,
          distanceToName: distToName,
        })
      }
    }

    // Check unmasked CNPJ / CPF (e.g. "CNPJ: 45987654000188" or "CNPJ / CPF: 45987654000188")
    const unmaskedMatches = line.matchAll(/(?:CNPJ|CPF|CNPJ\/CPF)[:\s]+(\d{11,14})\b/gi)
    for (const m of unmaskedMatches) {
      const digits = m[1]
      if (digits.length === 14 && isValidCNPJ(digits)) {
        allCnpjCandidates.push({
          digits,
          formatted: formatCpfCnpj(digits),
          snippet: line,
          lineIndex: idx,
          inClientSection: isInClientSec,
          hasClientLabel: hasClientLabelInLine,
          isIssuerSection: isUnderIssuerSec,
          distanceToName: distToName,
        })
      } else if (digits.length === 11 && isValidCPF(digits)) {
        allCnpjCandidates.push({
          digits,
          formatted: formatCpfCnpj(digits),
          snippet: line,
          lineIndex: idx,
          inClientSection: isInClientSec,
          hasClientLabel: hasClientLabelInLine,
          isIssuerSection: isUnderIssuerSec,
          distanceToName: distToName,
        })
      }
    }

    // Check pattern where label is on line idx, and CNPJ/CPF is on next line (idx + 1)
    // E.g.: "CNPJ:" or "CNPJ / CPF:" or "CPF:" alone
    if (/(?:^|\s)(?:CNPJ(?:\s*\/\s*CPF)?|CPF)[:]?$/i.test(line) && idx + 1 < lines.length) {
      const nextLine = lines[idx + 1].trim()
      const nextMaskedCnpj = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.exec(nextLine)
      if (nextMaskedCnpj && isValidCNPJ(nextMaskedCnpj[0])) {
        const digits = nextMaskedCnpj[0].replace(/\D/g, '')
        allCnpjCandidates.push({
          digits,
          formatted: formatCpfCnpj(digits),
          snippet: `${line} ${nextLine}`,
          lineIndex: idx + 1,
          inClientSection: isInClientSec,
          hasClientLabel: hasClientLabelInLine,
          isIssuerSection: isUnderIssuerSec,
          distanceToName:
            detectedNomeLineIndex !== -1 ? Math.abs(idx + 1 - detectedNomeLineIndex) : 999,
        })
      }
      const nextMaskedCpf = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.exec(nextLine)
      if (nextMaskedCpf && isValidCPF(nextMaskedCpf[0])) {
        const digits = nextMaskedCpf[0].replace(/\D/g, '')
        allCnpjCandidates.push({
          digits,
          formatted: formatCpfCnpj(digits),
          snippet: `${line} ${nextLine}`,
          lineIndex: idx + 1,
          inClientSection: isInClientSec,
          hasClientLabel: hasClientLabelInLine,
          isIssuerSection: isUnderIssuerSec,
          distanceToName:
            detectedNomeLineIndex !== -1 ? Math.abs(idx + 1 - detectedNomeLineIndex) : 999,
        })
      }
      // Also unmasked digits on next line
      const nextDigitsMatch = /^(\d{11}|\d{14})\b/.exec(nextLine)
      if (nextDigitsMatch) {
        const digits = nextDigitsMatch[1]
        if (
          (digits.length === 14 && isValidCNPJ(digits)) ||
          (digits.length === 11 && isValidCPF(digits))
        ) {
          allCnpjCandidates.push({
            digits,
            formatted: formatCpfCnpj(digits),
            snippet: `${line} ${nextLine}`,
            lineIndex: idx + 1,
            inClientSection: isInClientSec,
            hasClientLabel: hasClientLabelInLine,
            isIssuerSection: isUnderIssuerSec,
            distanceToName:
              detectedNomeLineIndex !== -1 ? Math.abs(idx + 1 - detectedNomeLineIndex) : 999,
          })
        }
      }
    }
  }

  // Deduplicate candidates by digits while keeping best metadata
  const candidateMap = new Map<string, CnpjCandidate>()
  for (const cand of allCnpjCandidates) {
    const existing = candidateMap.get(cand.digits)
    if (!existing) {
      candidateMap.set(cand.digits, cand)
    } else {
      // Merge best attributes
      if (cand.inClientSection) existing.inClientSection = true
      if (cand.hasClientLabel) existing.hasClientLabel = true
      if (!cand.isIssuerSection) existing.isIssuerSection = false
      if (cand.distanceToName < existing.distanceToName) {
        existing.distanceToName = cand.distanceToName
        existing.lineIndex = cand.lineIndex
        existing.snippet = cand.snippet
      }
    }
  }

  // Filter out issuer CNPJ if known from state
  const validCandidates = Array.from(candidateMap.values()).filter(
    (c) => !knownIssuerDigits || c.digits !== knownIssuerDigits,
  )

  if (validCandidates.length > 0) {
    // Scoring function for choosing the tomador CNPJ:
    // +1000 for inClientSection
    // +600 for hasClientLabel
    // -500 for isIssuerSection
    // Distance bonus: if distanceToName <= 5 lines, +500 - (distance * 50)
    const scoreCandidate = (c: CnpjCandidate): number => {
      let score = 0
      if (c.inClientSection) score += 1000
      if (c.hasClientLabel) score += 600
      if (c.isIssuerSection) score -= 500
      if (c.distanceToName <= 6) {
        score += 500 - c.distanceToName * 50
      } else if (c.distanceToName <= 15) {
        score += 200 - c.distanceToName * 10
      }
      return score
    }

    validCandidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
    const bestCand = validCandidates[0]
    const bestScore = scoreCandidate(bestCand)

    // Only accept if not heavily negative (i.e., not exclusively in issuer section when another might exist)
    if (validCandidates.length === 1 && bestCand.isIssuerSection && !bestCand.inClientSection) {
      // If there is only one CNPJ in the document and it was in the issuer section,
      // check if the document has a distinct client section without CNPJ.
      // If clientSectionText exists and this CNPJ is NOT in it, it belongs to the issuer.
      if (!clientSectionText) {
        detectedCnpj = bestCand.formatted
        cnpjSnippet = bestCand.snippet
        cnpjConfidence = 'low'
      }
    } else {
      detectedCnpj = bestCand.formatted
      cnpjSnippet = bestCand.snippet
      cnpjConfidence = bestScore >= 500 ? 'high' : bestScore >= 100 ? 'medium' : 'low'
    }
  }

  if (detectedCnpj) {
    fields.push({
      key: 'clienteCnpj',
      label: 'CNPJ / CPF do Cliente',
      value: detectedCnpj,
      currentValue: currentState.clienteCnpj || '',
      snippet: cnpjSnippet,
      confidence: cnpjConfidence,
      isDifferent:
        detectedCnpj.replace(/\D/g, '') !== (currentState.clienteCnpj || '').replace(/\D/g, ''),
    })
  }

  // --- C. Endereço do Cliente ---
  let detectedEndereco = ''
  let enderecoSnippet = ''
  let enderecoConfidence: 'high' | 'medium' | 'low' = 'low'

  const enderecoLabelRegex =
    /(?:ENDERE[ÇC]O|LOGRADOURO|RUA|AVENIDA|AV\.|RODOVIA|ROD\.)[:\s]+([^\n\r]{6,120})/i

  for (let i = 0; i < linesToSearch.length; i++) {
    const line = linesToSearch[i]
    const match = enderecoLabelRegex.exec(line)
    if (match && match[1]) {
      let candidate = match[1].replace(/^(?:[:\-–—]\s*)+/, '').trim()
      // Cut off if phone/email/CNPJ is stuck on the end
      candidate = candidate.split(/\s+(?:CNPJ|CPF|INSCRI|FONE|TEL|E-?MAIL|CEP)/i)[0].trim()
      if (candidate.length >= 5) {
        detectedEndereco = candidate
        enderecoSnippet = line
        enderecoConfidence = clientSectionText ? 'high' : 'medium'
        break
      }
    }

    // Pattern: "Endereço:" alone, value on next line
    if (/^(?:ENDERE[ÇC]O|LOGRADOURO)[:]?$/i.test(line)) {
      if (i + 1 < linesToSearch.length) {
        const nextLine = linesToSearch[i + 1].trim()
        if (nextLine.length >= 6 && !/^(?:CNPJ|CPF|DATA|TELEFONE)/i.test(nextLine)) {
          detectedEndereco = nextLine
          enderecoSnippet = `${line} -> ${nextLine}`
          enderecoConfidence = 'high'
          break
        }
      }
    }
  }

  if (detectedEndereco) {
    fields.push({
      key: 'clienteEndereco',
      label: 'Endereço do Cliente',
      value: detectedEndereco,
      currentValue: currentState.clienteEndereco || '',
      snippet: enderecoSnippet,
      confidence: enderecoConfidence,
      isDifferent:
        detectedEndereco.trim().toLowerCase() !==
        (currentState.clienteEndereco || '').trim().toLowerCase(),
    })
  }

  // --- D. Cidade e UF do Cliente ---
  let detectedCidade = ''
  let detectedUf = ''
  let cidadeUfSnippet = ''
  let cidadeConfidence: 'high' | 'medium' | 'low' = 'low'

  // Look for "Cidade / UF" or "Município:" or "São Paulo - SP" or "Campinas/SP"
  const cidadeUfRegex =
    /(?:CIDADE|MUNIC[ÍI]PIO)[:\s]+([A-Za-zÀ-ÿ\s'-]{3,35})(?:[\s/-]+(?:UF[:\s]*)?([A-Za-z]{2}))?\b/i

  for (const line of linesToSearch) {
    const match = cidadeUfRegex.exec(line)
    if (match) {
      const cityCandidate = match[1].trim()
      const ufCandidate = (match[2] || '').trim().toUpperCase()

      if (cityCandidate && !/^(?:CNPJ|CPF|ENDERE)/i.test(cityCandidate)) {
        detectedCidade = cityCandidate
        cidadeUfSnippet = line
        cidadeConfidence = 'medium'
        if (ufCandidate && BRAZILIAN_UFS.has(ufCandidate)) {
          detectedUf = ufCandidate
          cidadeConfidence = 'high'
        }
        break
      }
    }

    // Alternative: line like "Belo Horizonte - MG" or "Curitiba / PR"
    const simpleCityUfMatch =
      /\b([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)?)\s*[/-]\s*([A-Z]{2})\b/.exec(line)
    if (simpleCityUfMatch) {
      const candidateUf = simpleCityUfMatch[2].toUpperCase()
      if (BRAZILIAN_UFS.has(candidateUf)) {
        detectedCidade = simpleCityUfMatch[1].trim()
        detectedUf = candidateUf
        cidadeUfSnippet = line
        cidadeConfidence = 'medium'
        break
      }
    }
  }

  // Look for standalone UF if city had no UF
  if (!detectedUf) {
    const ufAloneRegex = /(?:UF|ESTADO)[:\s]+([A-Za-z]{2})\b/i
    for (const line of linesToSearch) {
      const ufMatch = ufAloneRegex.exec(line)
      if (ufMatch) {
        const uf = ufMatch[1].toUpperCase()
        if (BRAZILIAN_UFS.has(uf)) {
          detectedUf = uf
          if (!cidadeUfSnippet) cidadeUfSnippet = line
          break
        }
      }
    }
  }

  if (detectedCidade) {
    fields.push({
      key: 'clienteCidade',
      label: 'Cidade do Cliente',
      value: detectedCidade,
      currentValue: currentState.clienteCidade || '',
      snippet: cidadeUfSnippet,
      confidence: cidadeConfidence,
      isDifferent:
        detectedCidade.trim().toLowerCase() !==
        (currentState.clienteCidade || '').trim().toLowerCase(),
    })
  }

  if (detectedUf) {
    fields.push({
      key: 'clienteUf',
      label: 'UF do Cliente',
      value: detectedUf,
      currentValue: currentState.clienteUf || '',
      snippet: cidadeUfSnippet,
      confidence: cidadeConfidence,
      isDifferent:
        detectedUf.trim().toUpperCase() !== (currentState.clienteUf || '').trim().toUpperCase(),
    })
  }

  // --- E. Data de Emissão (Bônus contextual do documento) ---
  let detectedEmissao = ''
  let emissaoSnippet = ''

  const emissaoRegex =
    /(?:DATA(?: DE)? EMISS[ÃA]O|EMISS[ÃA]O|DATA DA EMISS[ÃA]O|EMITIDO EM)[:\s]+(\d{2})[/\-.](\d{2})[/\-.](\d{4})\b/i
  for (const line of lines) {
    const match = emissaoRegex.exec(line)
    if (match) {
      const [, day, month, year] = match
      // Format as YYYY-MM-DD for HTML input[type=date]
      detectedEmissao = `${year}-${month}-${day}`
      emissaoSnippet = line
      break
    }
  }

  if (detectedEmissao) {
    fields.push({
      key: 'dataEmissao',
      label: 'Data de Emissão do Documento',
      value: detectedEmissao,
      currentValue: currentState.dataEmissao || '',
      snippet: emissaoSnippet,
      confidence: 'medium',
      isDifferent: detectedEmissao !== (currentState.dataEmissao || ''),
    })
  }

  // Se for Cartão CNPJ (docType === 'cnpj'), restringir os campos ao CNPJ, Nome Empresarial e Ramo de Atividade (Atividade Principal)
  const finalFields = isCnpjCardMode
    ? fields.filter(
        (f) => f.key === 'clienteCnpj' || f.key === 'clienteNome' || f.key === 'clienteRamo',
      )
    : fields

  return {
    fields: finalFields,
    rawText,
    hasTextLayer,
    totalPages,
    docType,
  }
}
