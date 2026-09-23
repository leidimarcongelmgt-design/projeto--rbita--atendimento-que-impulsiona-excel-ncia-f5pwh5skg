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

  // 1. Locate Client Section or prioritize lines after client labels
  // Common Brazilian invoices / documents partition issuer vs client
  // Issuer labels: PRESTADOR, EMITENTE, CEDENTE, VENDEDOR, FORNECEDOR
  // Client labels: TOMADOR, DESTINATÁRIO, DESTINATARIO, CLIENTE, SACADO, CONSUMIDOR, COMPRADOR, CONTRATANTE

  // Let's create an indexed search for client-specific blocks
  const clientHeaderRegex =
    /(?:TOMADOR(?: DE SERVI[ÇC]OS)?|DESTINAT[ÁA]RIO(?:\s*\/\s*REMETENTE)?|DADOS DO CLIENTE|CLIENTE|SACADO|CONSUMIDOR|CONTRATANTE)/i
  const issuerHeaderRegex =
    /(?:PRESTADOR(?: DE SERVI[ÇC]OS)?|EMITENTE|DADOS DA EMPRESA|CEDENTE|FORNECEDOR)/i

  let clientSectionText = ''
  let clientSectionStartIdx = -1

  const clientMatch = clientHeaderRegex.exec(rawText)
  if (clientMatch) {
    clientSectionStartIdx = clientMatch.index
    // Find next issuer header or end of page/document
    const afterClient = rawText.slice(clientSectionStartIdx)
    const nextIssuerMatch = issuerHeaderRegex.exec(afterClient.slice(100))
    if (nextIssuerMatch) {
      clientSectionText = afterClient.slice(0, nextIssuerMatch.index + 100)
    } else {
      clientSectionText = afterClient.slice(0, 1500)
    }
  }

  const linesToSearch = clientSectionText
    ? clientSectionText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : lines

  // --- A. CNPJ / CPF do Cliente ---
  // If we have a client section, look there first. If not, look in full text.
  let detectedCnpj = ''
  let cnpjSnippet = ''
  let cnpjConfidence: 'high' | 'medium' | 'low' = 'medium'

  const cnpjMaskedRegex = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g
  const cpfMaskedRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g

  // Try to find CNPJ/CPF inside client section first
  const searchInText = (text: string, isClientScope: boolean) => {
    let match: RegExpExecArray | null
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
        return {
          val: formatCpfCnpj(val),
          snippet: extractSnippet(text, match.index, match[0].length),
          confidence: (isClientScope ? 'high' : 'medium') as 'high' | 'medium',
        }
      } else if (val.length === 11 && isValidCPF(val)) {
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
  let detectedNome = ''
  let nomeSnippet = ''
  let nomeConfidence: 'high' | 'medium' | 'low' = 'low'

  // Look for label patterns like "Razão Social:", "Nome/Razão Social:", "Destinatário:", "Tomador do Serviço:"
  const nameLabelRegex =
    /(?:RAZ[ÃA]O SOCIAL|NOME(?:\s*\/\s*RAZ[ÃA]O SOCIAL)?|NOME DO CLIENTE|DESTINAT[ÁA]RIO|TOMADOR(?: DO SERVI[ÇC]O)?|CONSUMIDOR|CLIENTE)[:\s]+([^\n\r]{3,80})/i

  // Inspect client lines for name
  for (let i = 0; i < linesToSearch.length; i++) {
    const line = linesToSearch[i]
    const match = nameLabelRegex.exec(line)
    if (match && match[1]) {
      const candidate = match[1].replace(/^(?:[:\-–—]\s*)+/, '').trim()
      // Filter out invalid names (e.g., just numbers or other label prefixes)
      if (
        candidate.length >= 3 &&
        !/^\d+$/.test(candidate) &&
        !/^(?:CNPJ|CPF|ENDERE|INSCR)/i.test(candidate)
      ) {
        // Strip trailing indicators like "CNPJ: ..." if on the same line
        const cleaned = candidate.split(/\s+(?:CNPJ|CPF|INSCRI|ENDERE)/i)[0].trim()
        if (cleaned.length >= 3) {
          detectedNome = cleaned
          nomeSnippet = line
          nomeConfidence = clientSectionText ? 'high' : 'medium'
          break
        }
      }
    }

    // Secondary pattern: label alone on one line, value on the next line
    if (
      /(?:RAZ[ÃA]O SOCIAL|NOME DO CLIENTE|TOMADOR(?: DO SERVI[ÇC]O)?|DESTINAT[ÁA]RIO)[:]?$/i.test(
        line,
      )
    ) {
      if (i + 1 < linesToSearch.length) {
        const nextLine = linesToSearch[i + 1].trim()
        if (
          nextLine.length >= 3 &&
          !/^(?:CNPJ|CPF|ENDERE|INSCR)/i.test(nextLine) &&
          !/^\d+$/.test(nextLine)
        ) {
          detectedNome = nextLine
          nomeSnippet = `${line} -> ${nextLine}`
          nomeConfidence = 'high'
          break
        }
      }
    }
  }

  // Fallback: If no label match, try to look at lines directly succeeding the client block header
  if (!detectedNome && clientSectionText) {
    const sublines = clientSectionText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    // The line after the section header is very often the customer name in invoices
    for (let i = 1; i < Math.min(sublines.length, 5); i++) {
      const candidate = sublines[i]
      if (
        candidate.length >= 4 &&
        !/^(?:CNPJ|CPF|ENDERE|INSCRI|DATA|FONE|TELEFONE|E-?MAIL|CEP)/i.test(candidate) &&
        !/^\d+$/.test(candidate) &&
        /[A-Za-zÀ-ÿ]{3,}/.test(candidate)
      ) {
        // Check if looks like a company or personal name (Ltda, S/A, ME, EPP, or 2+ capitalized words)
        if (
          /\b(?:LTDA|S\/?A|EIRELI|ME|EPP|SERVI[ÇC]OS|COMERCIO|COM[ÉE]RCIO|INDUSTRIA|IND[ÚU]STRIA)\b/i.test(
            candidate,
          ) ||
          /^[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)+/.test(candidate)
        ) {
          detectedNome = candidate
          nomeSnippet = candidate
          nomeConfidence = 'medium'
          break
        }
      }
    }
  }

  if (detectedNome) {
    // If name matches the emitter name, don't confuse it with client
    if (
      !currentState.empresaNome ||
      detectedNome.toLowerCase() !== currentState.empresaNome.toLowerCase()
    ) {
      fields.push({
        key: 'clienteNome',
        label: 'Nome / Razão Social do Cliente',
        value: detectedNome,
        currentValue: currentState.clienteNome || '',
        snippet: nomeSnippet,
        confidence: nomeConfidence,
        isDifferent:
          detectedNome.trim().toLowerCase() !==
          (currentState.clienteNome || '').trim().toLowerCase(),
      })
    }
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
