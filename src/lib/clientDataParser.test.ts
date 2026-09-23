import { parseClientDataFromPdfText } from './clientDataParser'
import { DEFAULT_CALCULATOR_STATE } from '@/types/calculator'

// Casos de teste e validação de regressão para extração de dados de clientes em PDFs fiscais
// Garante compatibilidade e cobertura para o cenário relatado pelo usuário:
// Nome: "RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA"
export function runClientParserSelfCheck(): { passed: boolean; results: string[] } {
  const results: string[] = []
  let passed = true

  const testInvoice1 = `
    PRESTADOR DE SERVIÇOS
    Razão Social: ENGENHARIA E CONSTRUCOES ALVORADA LTDA
    CNPJ: 11.222.333/0001-44

    TOMADOR DE SERVIÇOS
    Razão Social: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ: 45.987.654/0001-88
    Endereço: RUA DAS FLORES, 500
    Município: SAO PAULO - SP
  `

  const testInvoice2 = `
    DADOS DO EMITENTE
    EMITENTE: AUDITORIA E PERICIAS CONTABEIS S/S LTDA
    CNPJ: 05.123.456/0001-99

    DADOS DO TOMADOR
    Nome / Razão Social
    RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ / CPF: 45.987.654/0001-88
  `

  const testInvoice3 = `
    PRESTADOR DE SERVIÇOS
    EMPRESA PRESTADORA LTDA
    CNPJ: 11.222.333/0001-44

    TOMADOR DO SERVIÇO
    RESIDENCIAL ESTRELA
    INCORPORADORA SPE LTDA
    CNPJ: 45.987.654/0001-88
  `

  const testInvoice4 = `
    PRESTADOR: SERVICOS ADMINISTRATIVOS LTDA
    CNPJ: 11.222.333/0001-44

    TOMADOR: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ: 45.987.654/0001-88
  `

  // Teste 1
  const r1 = parseClientDataFromPdfText(testInvoice1, DEFAULT_CALCULATOR_STATE)
  const n1 = r1.fields.find((f) => f.key === 'clienteNome')?.value
  const c1 = r1.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n1 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c1 === '45.987.654/0001-88') {
    results.push('OK: Cenário 1 (Prestador vs Tomador com Razão Social)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 1 - obteve nome: ${n1}, cnpj: ${c1}`)
  }

  // Teste 2
  const r2 = parseClientDataFromPdfText(testInvoice2, DEFAULT_CALCULATOR_STATE)
  const n2 = r2.fields.find((f) => f.key === 'clienteNome')?.value
  if (n2 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 2 (Rótulo em uma linha, valor na seguinte)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 2 - obteve nome: ${n2}`)
  }

  // Teste 3
  const r3 = parseClientDataFromPdfText(testInvoice3, DEFAULT_CALCULATOR_STATE)
  const n3 = r3.fields.find((f) => f.key === 'clienteNome')?.value
  if (n3 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 3 (Nome quebrado em múltiplas linhas)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 3 - obteve nome: ${n3}`)
  }

  // Teste 4
  const r4 = parseClientDataFromPdfText(testInvoice4, DEFAULT_CALCULATOR_STATE)
  const n4 = r4.fields.find((f) => f.key === 'clienteNome')?.value
  if (n4 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 4 (TOMADOR: <Nome>)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 4 - obteve nome: ${n4}`)
  }

  return { passed, results }
}
