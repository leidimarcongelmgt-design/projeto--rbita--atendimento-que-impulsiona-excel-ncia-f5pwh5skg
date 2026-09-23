import * as XLSX from 'xlsx'
import {
  parseSpreadsheetBuffer,
  normalizeLabel,
  normalizeUF,
  matchHeaderToFieldKey,
  formatFieldValue,
} from './spreadsheetParser'
import { DEFAULT_CALCULATOR_STATE } from '@/types/calculator'

/**
 * Utilitário de auto-checagem e testes unitários do parser de planilha.
 * Roda cenários para garantir compatibilidade horizontal, vertical,
 * normalização de UF, máscaras de CNPJ/CPF/Telefone, contatos por área
 * e distinção correta entre Emissor e Cliente.
 */
export function runSpreadsheetParserSelfCheck(): { passed: boolean; results: string[] } {
  const results: string[] = []
  let passed = true

  // Helper para criar buffer XLSX na memória a partir de matriz 2D de linhas
  const createWorkbookBuffer = (rows: unknown[][]): ArrayBuffer => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return out
  }

  // 1. Testes de utilitários isolados
  // Normalização de rótulos
  if (
    normalizeLabel('Razão Social / Nome Empresarial') === 'razao social nome empresarial' &&
    normalizeLabel('INSCRIÇÃO ESTADUAL') === 'inscricao estadual' &&
    normalizeLabel('E-mail (Financeiro)') === 'e mail financeiro'
  ) {
    results.push('OK: normalização de rótulos sem acento e sem caracteres especiais')
  } else {
    passed = false
    results.push('FALHA: normalizeLabel falhou')
  }

  // Normalização de UF (sigla de 2 letras e nomes por extenso)
  if (
    normalizeUF('SP') === 'SP' &&
    normalizeUF('são paulo') === 'SP' &&
    normalizeUF('MINAS GERAIS') === 'MG' &&
    normalizeUF('Rio de Janeiro') === 'RJ' &&
    normalizeUF('Distrito Federal') === 'DF'
  ) {
    results.push('OK: normalizeUF converte nomes por extenso e siglas minúsculas para 2 letras')
  } else {
    passed = false
    results.push('FALHA: normalizeUF falhou em converter estados')
  }

  // Reconhecimento de cabeçalhos
  if (
    matchHeaderToFieldKey('Razão Social Emissor') === 'empresaNome' &&
    matchHeaderToFieldKey('CNPJ Emissor') === 'empresaCnpj' &&
    matchHeaderToFieldKey('Endereço da Empresa') === 'empresaEndereco' &&
    matchHeaderToFieldKey('Cidade Emissor') === 'empresaCidade' &&
    matchHeaderToFieldKey('UF Emissor') === 'empresaUf' &&
    matchHeaderToFieldKey('Razão Social') === 'clienteNome' &&
    matchHeaderToFieldKey('CNPJ / CPF') === 'clienteCnpj' &&
    matchHeaderToFieldKey('Inscrição Estadual') === 'clienteIE' &&
    matchHeaderToFieldKey('Inscrição Municipal') === 'clienteIM' &&
    matchHeaderToFieldKey('Ramo de Atividade') === 'clienteRamo' &&
    matchHeaderToFieldKey('Telefone Financeiro') === 'contFinTelefone' &&
    matchHeaderToFieldKey('E-mail RH') === 'contRhEmail' &&
    matchHeaderToFieldKey('Nome Representante Legal') === 'contLegalNome' &&
    matchHeaderToFieldKey('Logo da Empresa') === null
  ) {
    results.push(
      'OK: matchHeaderToFieldKey reconhece campos do emissor, cliente e contatos e descarta logos',
    )
  } else {
    passed = false
    results.push('FALHA: matchHeaderToFieldKey falhou no mapeamento')
  }

  // Formatação de valores (telefone e CNPJ)
  const phoneFormatted = formatFieldValue('contFinTelefone', '11987654321')
  const cnpjFormatted = formatFieldValue('clienteCnpj', '11222333000144')
  if (phoneFormatted === '(11) 98765-4321' && cnpjFormatted === '11.222.333/0001-44') {
    results.push('OK: formatFieldValue aplica máscara em telefone e CNPJ')
  } else {
    passed = false
    results.push(`FALHA: formatFieldValue falhou: phone=${phoneFormatted}, cnpj=${cnpjFormatted}`)
  }

  // 2. Cenário HORIZONTAL: cabeçalhos na linha 1, valores na linha 2
  const horizontalRows = [
    [
      'Razão Social Emissor',
      'CNPJ Emissor',
      'Endereço Emissor',
      'Cidade Emissor',
      'UF Emissor',
      'Nome do Cliente',
      'CNPJ do Cliente',
      'Inscrição Estadual',
      'Inscrição Municipal',
      'Ramo de Atividade',
      'Endereço do Cliente',
      'Cidade do Cliente',
      'UF do Cliente',
      'Contato Financeiro Nome',
      'Telefone Financeiro',
      'E-mail Financeiro',
      'Contato Estoque Nome',
      'Telefone Estoque',
      'E-mail Estoque',
      'Contato RH Nome',
      'Telefone RH',
      'E-mail RH',
      'Representante Legal Nome',
      'Telefone Representante Legal',
      'E-mail Representante Legal',
    ],
    [
      'Órbita Consultoria Empresarial Ltda',
      '12.345.678/0001-99',
      'Av. Paulista, 1000',
      'São Paulo',
      'São Paulo',
      'Alpha Indústria e Comércio S/A',
      '98.765.432/0001-11',
      '123.456.789.000',
      '9876543-2',
      'Fabricação de Produtos Metalúrgicos',
      'Rodovia Anhanguera, km 50',
      'Campinas',
      'SP',
      'Mariana Contas',
      '11999887766',
      'financeiro@alphaindustria.com.br',
      'Carlos Almoxarifado',
      '11988776655',
      'estoque@alphaindustria.com.br',
      'Fernanda RH',
      '11977665544',
      'rh@alphaindustria.com.br',
      'Dr. Roberto Sócio',
      '11966554433',
      'diretoria@alphaindustria.com.br',
    ],
  ]

  const bufferH = createWorkbookBuffer(horizontalRows)
  const resultH = parseSpreadsheetBuffer(
    bufferH,
    'cadastro_horizontal.xlsx',
    DEFAULT_CALCULATOR_STATE,
  )

  const findH = (k: keyof typeof DEFAULT_CALCULATOR_STATE) =>
    resultH.fields.find((f) => f.key === k)?.value

  if (
    findH('empresaNome') === 'Órbita Consultoria Empresarial Ltda' &&
    findH('empresaCnpj') === '12.345.678/0001-99' &&
    findH('empresaUf') === 'SP' &&
    findH('clienteNome') === 'Alpha Indústria e Comércio S/A' &&
    findH('clienteCnpj') === '98.765.432/0001-11' &&
    findH('clienteIE') === '123.456.789.000' &&
    findH('contFinTelefone') === '(11) 99988-7766' &&
    findH('contLegalNome') === 'Dr. Roberto Sócio'
  ) {
    results.push(
      'OK: Cenário Horizontal - todos os campos de emissor, cliente e contatos extraídos',
    )
  } else {
    passed = false
    results.push('FALHA: Cenário Horizontal não extraiu todos os campos esperados')
  }

  // 3. Cenário VERTICAL: Rótulos na Coluna A, Valores na Coluna B
  const verticalRows = [
    ['Razão Social da Empresa', 'Beta Auditoria e Governança S/S'],
    ['CNPJ Emissor', '01.234.567/0001-89'],
    ['Endereço Emissor', 'Rua Augusta, 500'],
    ['Cidade Emissor', 'São Paulo'],
    ['UF Emissor', 'SP'],
    ['Nome / Razão Social', 'Delta Alimentos do Brasil Ltda'],
    ['CNPJ / CPF', '55.666.777/0001-88'],
    ['Inscrição Estadual', 'ISENTO'],
    ['Inscrição Municipal', '11223344'],
    ['Ramo de Atividade', 'Comércio Atacadista de Alimentos'],
    ['Endereço', 'Av. das Nações Unidas, 1200'],
    ['Cidade', 'Osasco'],
    ['UF', 'São Paulo'],
    ['Nome para Contato Financeiro', 'Ana Paula'],
    ['Telefone Financeiro', '1133334444'],
    ['E-mail Financeiro', 'fin@delta.com.br'],
    ['Contato Estoque', 'Marcos'],
    ['Telefone Estoque', '1133335555'],
    ['E-mail Estoque', 'estoque@delta.com.br'],
    ['Contato Recursos Humanos', 'Clara DP'],
    ['Telefone RH', '1133336666'],
    ['E-mail RH', 'dp@delta.com.br'],
    ['Representante Legal', 'Dr. Marcos Dias'],
    ['Telefone Representante', '11988887777'],
    ['E-mail Representante', 'adv@delta.com.br'],
  ]

  const bufferV = createWorkbookBuffer(verticalRows)
  const resultV = parseSpreadsheetBuffer(
    bufferV,
    'cadastro_vertical.xlsx',
    DEFAULT_CALCULATOR_STATE,
  )

  const findV = (k: keyof typeof DEFAULT_CALCULATOR_STATE) =>
    resultV.fields.find((f) => f.key === k)?.value

  if (
    findV('empresaNome') === 'Beta Auditoria e Governança S/S' &&
    findV('empresaCnpj') === '01.234.567/0001-89' &&
    findV('clienteNome') === 'Delta Alimentos do Brasil Ltda' &&
    findV('clienteCnpj') === '55.666.777/0001-88' &&
    findV('clienteIE') === 'ISENTO' &&
    findV('clienteUf') === 'SP' &&
    findV('contFinTelefone') === '(11) 3333-4444' &&
    findV('contLegalTelefone') === '(11) 98888-7777'
  ) {
    results.push('OK: Cenário Vertical - todos os campos de emissor, cliente e contatos extraídos')
  } else {
    passed = false
    results.push('FALHA: Cenário Vertical não extraiu todos os campos esperados')
  }

  // 4. Cenário de valores monetários / números sem formatação prévia
  // Exemplo: CNPJ com 14 dígitos puros "11222333000144" deve virar formatado
  const unformattedRows = [
    ['CNPJ', '11222333000144'],
    ['Razão Social', 'Tech Solutions Ltda'],
    ['Telefone Financeiro', '11999998888'],
  ]
  const bufferU = createWorkbookBuffer(unformattedRows)
  const resultU = parseSpreadsheetBuffer(bufferU, 'desformatado.xlsx', DEFAULT_CALCULATOR_STATE)

  const cnpjU = resultU.fields.find((f) => f.key === 'clienteCnpj')?.value
  const telU = resultU.fields.find((f) => f.key === 'contFinTelefone')?.value

  if (cnpjU === '11.222.333/0001-44' && telU === '(11) 99999-8888') {
    results.push('OK: CNPJ e Telefone sem formatação convertidos automaticamente')
  } else {
    passed = false
    results.push(`FALHA: Formatação automática falhou: cnpj=${cnpjU}, tel=${telU}`)
  }

  return { passed, results }
}
