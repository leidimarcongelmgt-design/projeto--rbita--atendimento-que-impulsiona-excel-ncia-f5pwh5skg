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

export interface ClientExtractionResult {
  fields: ExtractedField[]
  rawText: string
  hasTextLayer: boolean
  totalPages: number
  errorMessage?: string
  isPasswordProtected?: boolean
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
): ClientExtractionResult {
  if (!rawText || !hasTextLayer || errorMessage) {
    return {
      fields: [],
      rawText: rawText || '',
      hasTextLayer,
      totalPages,
      errorMessage,
      isPasswordProtected,
    }
  }

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
    /(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?PRESTADOR(?:\s+DE\s+SERVI[ÇC]OS)?|(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?EMITENTE|(?:DADOS\s+DA\s+)?EMPRESA\s+EMISSORA|CEDENTE|BENEFICI[ÁA]RIO|FORNECEDOR|VENDEDOR|LOCADOR|CONTRATADA)\b/i

  const CLIENT_HEADER_REGEX =
    /(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?TOMADOR(?:\s+DE\s+SERVI[ÇC]OS)?|(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|(?:DADOS\s+DO\s+)?CLIENTE|SACADO|CONSUMIDOR|PAGADOR|COMPRADOR|LOCAT[ÁA]RIO|CONTRATANTE)\b/i

  const SECTION_BOUNDARY_REGEX =
    /(?:(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?PRESTADOR(?:\s+DE\s+SERVI[ÇC]OS)?|(?:DADOS\s+DO\s+|IDENTIFICA[ÇC][ÃA]O\s+DO\s+)?EMITENTE|CEDENTE|BENEFICI[ÁA]RIO|FORNECEDOR|CONTRATADA|DADOS\s+DOS\s+SERVI[ÇC]OS|DISCRIMINA[ÇC][ÃA]O\s+DOS\s+SERVI[ÇC]OS|DESCRI[ÇC][ÃA]O\s+DOS\s+PRODUTOS|DADOS\s+DO\s+PRODUTO|C[ÁA]LCULO\s+DO\s+IMPOSTO|DADOS\s+ADICIONAIS|INFORMA[ÇC][ÕO]ES\s+COMPLEMENTARES|VALOR\s+TOTAL|FATURA(?:\s*\/\s*DUPLICATA)?|ITENS\s+DA\s+NOTA|OBSERVA[ÇC][ÕO]ES?)\b/i

  // Find all client block occurrences in the raw text
  let clientSectionText = ''
  let clientSectionLines: string[] = []

  const clientMatch = CLIENT_HEADER_REGEX.exec(rawText)
  if (clientMatch) {
    const startIdx = clientMatch.index
    const afterClient = rawText.slice(startIdx + clientMatch[0].length)

    // Look for the next section boundary (after at least 30 characters)
    const nextBoundaryMatch = SECTION_BOUNDARY_REGEX.exec(afterClient.slice(30))
    if (nextBoundaryMatch) {
      const endOffset = 30 + nextBoundaryMatch.index
      clientSectionText = afterClient.slice(0, endOffset)
    } else {
      // Limit to 2000 chars of client block
      clientSectionText = afterClient.slice(0, 2000)
    }

    clientSectionLines = clientSectionText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  }

  // Also collect lines that explicitly match client/issuer in line-by-line inspection
  const linesToSearch = clientSectionLines.length > 0 ? clientSectionLines : lines

  // --- A. CNPJ / CPF do Cliente ---
  // When multiple CNPJs exist (e.g. Issuer + Customer), ensure we pick the client's CNPJ.
  // We prioritize:
  // 1. CNPJ/CPF found inside the isolated clientSectionText
  // 2. CNPJ/CPF explicitly labeled with Tomador/Destinatário/Sacado/Cliente in line
  // 3. Fallback: all valid CNPJs/CPFs in document, discarding the one belonging to the issuer / empresaCnpj or issuer section
  let detectedCnpj = ''
  let cnpjSnippet = ''
  let cnpjConfidence: 'high' | 'medium' | 'low' = 'medium'

  const cnpjMaskedRegex = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g
  const cpfMaskedRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g

  // Try to find CNPJ/CPF inside client section first
  const searchInText = (text: string, isClientScope: boolean) => {
    let match: RegExpExecArray | null
    // Reset regex indices
    cnpjMaskedRegex.lastIndex = 0
    cpfMaskedRegex.lastIndex = 0

    // CNPJ masked
    while ((match = cnpjMaskedRegex.exec(text)) !== null) {
      const val = match[0]
      if (isValidCNPJ(val)) {
        // Skip if identical to current empresa CNPJ
        if (
          currentState.empresaCnpj &&
          val.replace(/\D/g, '') === currentState.empresaCnpj.replace(/\D/g, '')
        ) {
          continue
        }
        return {
          val: formatCpfCnpj(val),
          snippet: extractSnippet(text, match.index, val.length),
          confidence: (isClientScope ? 'high' : 'medium') as 'high' | 'medium',
        }
      }
    }
    // CPF masked
    while ((match = cpfMaskedRegex.exec(text)) !== null) {
      const val = match[0]
      if (isValidCPF(val)) {
        if (
          currentState.empresaCnpj &&
          val.replace(/\D/g, '') === currentState.empresaCnpj.replace(/\D/g, '')
        ) {
          continue
        }
        return {
          val: formatCpfCnpj(val),
          snippet: extractSnippet(text, match.index, val.length),
          confidence: (isClientScope ? 'high' : 'medium') as 'high' | 'medium',
        }
      }
    }
    // Unmasked 14 digits CNPJ near "CNPJ" or "CPF"
    const unmaskedCnpjRegex = /(?:CNPJ|CPF)[:\s]+(\d{11,14})\b/gi
    while ((match = unmaskedCnpjRegex.exec(text)) !== null) {
      const val = match[1]
      if (val.length === 14 && isValidCNPJ(val)) {
        if (
          currentState.empresaCnpj &&
          val.replace(/\D/g, '') === currentState.empresaCnpj.replace(/\D/g, '')
        ) {
          continue
        }
        return {
          val: formatCpfCnpj(val),
          snippet: extractSnippet(text, match.index, match[0].length),
          confidence: (isClientScope ? 'high' : 'medium') as 'high' | 'medium',
        }
      } else if (val.length === 11 && isValidCPF(val)) {
        if (
          currentState.empresaCnpj &&
          val.replace(/\D/g, '') === currentState.empresaCnpj.replace(/\D/g, '')
        ) {
          continue
        }
        return {
          val: formatCpfCnpj(val),
          snippet: extractSnippet(text, match.index, match[0].length),
          confidence: (isClientScope ? 'high' : 'medium') as 'high' | 'medium',
        }
      }
    }
    return null
  }

  let foundDoc = clientSectionText ? searchInText(clientSectionText, true) : null

  // If not found in clientSectionText, search lines excluding issuer lines
  if (!foundDoc) {
    const nonIssuerLines = lines.filter((l) => !ISSUER_HEADER_REGEX.test(l))
    foundDoc = searchInText(nonIssuerLines.join('\n'), false)
  }

  // General fallback on full text if still nothing found
  if (!foundDoc) {
    foundDoc = searchInText(rawText, false)
  }

  if (foundDoc) {
    detectedCnpj = foundDoc.val
    cnpjSnippet = foundDoc.snippet
    cnpjConfidence = foundDoc.confidence
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

  // --- A.3 Ramo de Atividade / Atividade Econômica do Cliente ---
  let detectedRamo = ''
  let ramoSnippet = ''
  let ramoConfidence: 'high' | 'medium' | 'low' = 'low'

  const ramoLabelRegex =
    /(?:RAMO DE ATIVIDADE|RAMO DE NEG[ÓO]CIO|RAMO DE ATUA[ÇC][ÃA]O|ATIVIDADE ECON[ÔO]MICA|ATIVIDADE PRINCIPAL|CNAE PRINCIPAL|RAMO)[:\s]+([^\n\r]{4,80})/i

  for (const line of linesToSearch) {
    const match = ramoLabelRegex.exec(line)
    if (match && match[1]) {
      let candidate = match[1].replace(/^(?:[:\-–—]\s*)+/, '').trim()
      candidate = candidate.split(/\s+(?:CNPJ|CPF|INSCRI|ENDERE|TEL|FONE|E-?MAIL)/i)[0].trim()
      if (candidate.length >= 4 && !/^(?:CNPJ|CPF)/i.test(candidate)) {
        detectedRamo = candidate
        ramoSnippet = line
        ramoConfidence = clientSectionText ? 'high' : 'medium'
        break
      }
    }
  }

  if (detectedRamo) {
    fields.push({
      key: 'clienteRamo',
      label: 'Ramo de Atividade do Cliente',
      value: detectedRamo,
      currentValue: currentState.clienteRamo || '',
      snippet: ramoSnippet,
      confidence: ramoConfidence,
      isDifferent:
        detectedRamo.trim().toLowerCase() !== (currentState.clienteRamo || '').trim().toLowerCase(),
    })
  }

  // --- B. Razão Social / Nome do Cliente ---
  // The user explicitly requires:
  // "ao importar o arquivo no campo nome empresarial desejo que seja importado o nome do cliente"
  // The client name (tomador, destinatário, sacado, comprador, cliente) must ALWAYS take
  // precedence over the emitter / issuer / prestador company name.

  let detectedNome = ''
  let nomeSnippet = ''
  let nomeConfidence: 'high' | 'medium' | 'low' = 'low'

  // Helper: check if a candidate string is valid as a business or person name
  const isExcludedGenericTerm = (str: string): boolean => {
    const s = str.trim().toLowerCase()
    if (s.length < 3) return true
    // Exclude label phrases or system terms
    if (
      /^(?:danfe|documento|nota fiscal|nfs-?e|nf-?e|chave de acesso|natureza da opera|protocolo|folha|dossie|dossiê|relat[óo]rio|comprovante|recibo|boleto|fatura|duplicata|dados do|identifica|endere[çc]o|munic[íi]pio|cidade|estado|telefone|e-?mail|cnpj|cpf|inscri[çc][ãa]o|descri[çc][ãa]o|valor|imposto|issqn|icms|pis|cofins|irpj|csll|simples nacional|prestador|emitente|cedente|benefici[áa]rio|tomador|destinat[áa]rio|sacado|consumidor|cliente)$/i.test(
        s,
      )
    ) {
      return true
    }
    // Exclude if it looks like only numbers, punctuation, or dates
    if (/^[\d\s./\-–—,]+$/.test(s)) return true
    if (/^\d{2}[/\-.]\d{2}[/\-.]\d{4}$/.test(s)) return true
    // Exclude known current emitter name
    if (currentState.empresaNome && s === currentState.empresaNome.trim().toLowerCase()) {
      return true
    }
    return false
  }

  const cleanNameCandidate = (val: string): string => {
    let cleaned = val.replace(/^(?:[:\-–—|]\s*)+/, '').trim()
    // Remove subsequent trailing label blocks like "CNPJ: ...", "Inscrição: ...", "Endereço: ..."
    cleaned = cleaned
      .split(/\s+(?:CNPJ|CPF|INSCRI|ENDERE|RUA|AV\.|BAIRRO|CEP|TEL|FONE|E-?MAIL|DATA)/i)[0]
      .trim()
    // Strip trailing punctuation
    cleaned = cleaned.replace(/[;,\-–—]+$/, '').trim()
    return cleaned
  }

  // Priority 1: High-specificity Client/Tomador/Destinatário/Sacado labeled patterns
  // E.g.: "Tomador do Serviço: EMPRESA CLIENTE LTDA", "Destinatário/Remetente: FULANO DE TAL",
  // "Nome / Razão Social do Tomador: CLIENTE X", "Sacado: NOME CLIENTE", "Cliente: XYZ S/A"
  const explicitClientNameRegexes = [
    /(?:TOMADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|SACADO|PAGADOR|CONSUMIDOR|CLIENTE|CONTRATANTE)[\s:]+(?:NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|RAZ[ÃA]O\s*SOCIAL)?[:\s\-–—]+([^\n\r]{3,90})/i,
    /(?:NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|RAZ[ÃA]O\s*SOCIAL)\s+(?:DO\s+)?(?:TOMADOR|DESTINAT[ÁA]RIO|CLIENTE|SACADO|CONSUMIDOR)[:\s\-–—]+([^\n\r]{3,90})/i,
    /NOME\s+DO\s+CLIENTE[:\s\-–—]+([^\n\r]{3,90})/i,
    /(?:^|\b)(?:TOMADOR|DESTINAT[ÁA]RIO|SACADO|PAGADOR|CLIENTE)[:\s\-–—]+([^\n\r]{3,90})/i,
  ]

  // Priority 1 scan in full text
  for (const regex of explicitClientNameRegexes) {
    for (const line of lines) {
      // Don't match lines that are clearly PRESTADOR / EMITENTE headers
      if (ISSUER_HEADER_REGEX.test(line) && !CLIENT_HEADER_REGEX.test(line)) {
        continue
      }
      const match = regex.exec(line)
      if (match && match[1]) {
        const candidate = cleanNameCandidate(match[1])
        if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
          detectedNome = candidate
          nomeSnippet = line
          nomeConfidence = 'high'
          break
        }
      }
    }
    if (detectedNome) break
  }

  // Priority 2: If we identified a clientSectionText, search inside it for "Nome/Razão Social" or multi-line patterns
  if (!detectedNome && clientSectionLines.length > 0) {
    const clientBlockNameRegex =
      /(?:RAZ[ÃA]O\s*SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|NOME\s+EMPRESARIAL|NOME)[:\s\-–—]+([^\n\r]{3,90})/i

    for (let i = 0; i < clientSectionLines.length; i++) {
      const line = clientSectionLines[i]
      // Skip if this line explicitly mentions issuer
      if (ISSUER_HEADER_REGEX.test(line)) continue

      const match = clientBlockNameRegex.exec(line)
      if (match && match[1]) {
        const candidate = cleanNameCandidate(match[1])
        if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
          detectedNome = candidate
          nomeSnippet = line
          nomeConfidence = 'high'
          break
        }
      }

      // Next-line pattern inside client block:
      // Line i: "Razão Social:" or "Nome / Razão Social"
      // Line i+1: "ALPHA COMERCIO E SERVICOS LTDA"
      if (
        /(?:RAZ[ÃA]O\s*SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|NOME\s+EMPRESARIAL)[:]?$/i.test(
          line,
        )
      ) {
        if (i + 1 < clientSectionLines.length) {
          const nextLine = clientSectionLines[i + 1].trim()
          const candidate = cleanNameCandidate(nextLine)
          if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
            detectedNome = candidate
            nomeSnippet = `${line} -> ${nextLine}`
            nomeConfidence = 'high'
            break
          }
        }
      }
    }

    // Priority 3: First valid business name or person name line inside client section block
    // (Common in invoices where customer name immediately follows "TOMADOR DE SERVIÇOS")
    if (!detectedNome) {
      for (let i = 0; i < Math.min(clientSectionLines.length, 6); i++) {
        const candidate = cleanNameCandidate(clientSectionLines[i])
        if (
          !isExcludedGenericTerm(candidate) &&
          candidate.length >= 4 &&
          /[A-Za-zÀ-ÿ]{3,}/.test(candidate)
        ) {
          // Check if looks like a company or personal name (Ltda, S/A, ME, EPP, or 2+ capitalized words)
          if (
            /\b(?:LTDA|S\/?A|EIRELI|ME|EPP|SERVI[ÇC]OS|COMERCIO|COM[ÉE]RCIO|INDUSTRIA|IND[ÚU]STRIA)\b/i.test(
              candidate,
            ) ||
            /^[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)+/.test(candidate) ||
            /^[A-ZÀ-Ÿ0-9\s.&'-]{5,}$/.test(candidate)
          ) {
            detectedNome = candidate
            nomeSnippet = candidate
            nomeConfidence = 'medium'
            break
          }
        }
      }
    }
  }

  // Priority 4: Look for name associated with the detected client CNPJ/CPF
  // If we already detected a client CNPJ, search lines around it (within 3 lines above or below)
  if (!detectedNome && detectedCnpj) {
    const rawCnpjDigits = detectedCnpj.replace(/\D/g, '')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.replace(/\D/g, '').includes(rawCnpjDigits)) {
        // Inspect line itself for a name preceding or following CNPJ
        const beforeCnpjMatch = /^(.*?)(?:CNPJ|CPF)/i.exec(line)
        if (beforeCnpjMatch) {
          const cand = cleanNameCandidate(beforeCnpjMatch[1])
          if (!isExcludedGenericTerm(cand) && cand.length >= 4) {
            detectedNome = cand
            nomeSnippet = line
            nomeConfidence = 'high'
            break
          }
        }

        // Check 2 lines above
        for (let offset = -1; offset >= -2; offset--) {
          const targetIdx = i + offset
          if (targetIdx >= 0) {
            const candLine = lines[targetIdx]
            // Skip issuer section lines
            if (ISSUER_HEADER_REGEX.test(candLine)) continue
            const cand = cleanNameCandidate(candLine)
            if (!isExcludedGenericTerm(cand) && cand.length >= 4 && /[A-Za-zÀ-ÿ]{3,}/.test(cand)) {
              detectedNome = cand
              nomeSnippet = candLine
              nomeConfidence = 'medium'
              break
            }
          }
        }
        if (detectedNome) break

        // Check 1 line below
        if (i + 1 < lines.length) {
          const candLine = lines[i + 1]
          if (!ISSUER_HEADER_REGEX.test(candLine)) {
            const cand = cleanNameCandidate(candLine)
            if (!isExcludedGenericTerm(cand) && cand.length >= 4 && /[A-Za-zÀ-ÿ]{3,}/.test(cand)) {
              detectedNome = cand
              nomeSnippet = candLine
              nomeConfidence = 'medium'
              break
            }
          }
        }
        if (detectedNome) break
      }
    }
  }

  // Priority 5: Fallback - General "Razão Social" or "Nome" in linesToSearch,
  // making sure NOT to pick the emitter/prestador name
  if (!detectedNome) {
    const fallbackNameRegex =
      /(?:RAZ[ÃA]O\s*SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O\s*SOCIAL)?|NOME\s+EMPRESARIAL)[:\s\-–—]+([^\n\r]{3,90})/i

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip issuer sections
      if (ISSUER_HEADER_REGEX.test(line)) continue

      const match = fallbackNameRegex.exec(line)
      if (match && match[1]) {
        const candidate = cleanNameCandidate(match[1])
        if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
          detectedNome = candidate
          nomeSnippet = line
          nomeConfidence = 'medium'
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
          const candidate = cleanNameCandidate(nextLine)
          if (!isExcludedGenericTerm(candidate) && candidate.length >= 3) {
            detectedNome = candidate
            nomeSnippet = `${line} -> ${nextLine}`
            nomeConfidence = 'medium'
            break
          }
        }
      }
    }
  }

  // Priority 6: Fallback for single-entity documents with no section markers
  // (Preserve current fallback behavior when document has only one identifiable business name)
  if (!detectedNome && !clientSectionText) {
    for (const line of lines) {
      if (ISSUER_HEADER_REGEX.test(line)) continue
      if (
        /\b(?:LTDA|S\/?A|EIRELI|ME|EPP)\b/i.test(line) &&
        !isExcludedGenericTerm(line) &&
        line.length <= 80
      ) {
        const cand = cleanNameCandidate(line)
        if (!isExcludedGenericTerm(cand) && cand.length >= 4) {
          detectedNome = cand
          nomeSnippet = line
          nomeConfidence = 'low'
          break
        }
      }
    }
  }

  if (detectedNome) {
    fields.push({
      key: 'clienteNome',
      label: 'Nome / Razão Social',
      value: detectedNome,
      currentValue: currentState.clienteNome || '',
      snippet: nomeSnippet,
      confidence: nomeConfidence,
      isDifferent:
        detectedNome.trim().toLowerCase() !== (currentState.clienteNome || '').trim().toLowerCase(),
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

  return {
    fields,
    rawText,
    hasTextLayer,
    totalPages,
  }
}
