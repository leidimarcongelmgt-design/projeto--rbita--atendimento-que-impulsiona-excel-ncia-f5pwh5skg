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
  const c4 = r4.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n4 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c4 === '45.987.654/0001-88') {
    results.push('OK: Cenário 4 (TOMADOR: <Nome>)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 4 - obteve nome: ${n4}, cnpj: ${c4}`)
  }

  // Teste 5: Documento com CNPJ do emissor antes do cliente (garantir descarte do emissor e seleção do cliente)
  const testInvoice5 = `
    NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e
    PRESTADOR DE SERVIÇOS
    Razão Social: SOFTWARES E SERVICOS DIGITAIS LTDA
    CNPJ: 02.444.888/0001-55
    Endereço: AV BRASIL, 1500 - CENTRO

    TOMADOR DE SERVIÇOS
    Nome/Razão Social: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ/CPF: 45.987.654/0001-88
    Endereço: RUA DAS FLORES, 500
    Município: SAO PAULO - SP
  `
  const r5 = parseClientDataFromPdfText(testInvoice5, DEFAULT_CALCULATOR_STATE)
  const n5 = r5.fields.find((f) => f.key === 'clienteNome')?.value
  const c5 = r5.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n5 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c5 === '45.987.654/0001-88') {
    results.push('OK: Cenário 5 (Emissor antes do cliente - CNPJ do tomador selecionado)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 5 - obteve nome: ${n5}, cnpj: ${c5}`)
  }

  // Teste 6: CNPJ em linha separada do rótulo e do nome do tomador
  const testInvoice6 = `
    PRESTADOR DE SERVIÇOS
    EMPRESA CONSULTORIA FINANCEIRA LTDA
    CNPJ: 11.222.333/0001-44

    TOMADOR DE SERVIÇOS
    RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ:
    45.987.654/0001-88
    RUA DAS FLORES, 500 - SAO PAULO - SP
  `
  const r6 = parseClientDataFromPdfText(testInvoice6, DEFAULT_CALCULATOR_STATE)
  const n6 = r6.fields.find((f) => f.key === 'clienteNome')?.value
  const c6 = r6.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n6 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c6 === '45.987.654/0001-88') {
    results.push('OK: Cenário 6 (CNPJ em linha separada do rótulo)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 6 - obteve nome: ${n6}, cnpj: ${c6}`)
  }

  // Teste 7: Documento com múltiplos CNPJs (emissor, intermediário e tomador/cliente)
  const testInvoice7 = `
    EMITENTE DA NOTA FISCAL
    Razão Social: BANCO INTERMEDIADOR E PAGAMENTOS S/A
    CNPJ: 60.701.190/0001-04

    PRESTADOR DE SERVIÇOS
    Razão Social: CONSTRUTORA E INCORPORADORA MODELO LTDA
    CNPJ: 33.444.555/0001-66

    TOMADOR DO SERVIÇO / CLIENTE
    Razão Social: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ/CPF: 45.987.654/0001-88
    Inscrição Municipal: 12345678
    Endereço: RUA DAS FLORES, 500 - SAO PAULO - SP
  `
  const r7 = parseClientDataFromPdfText(testInvoice7, DEFAULT_CALCULATOR_STATE)
  const n7 = r7.fields.find((f) => f.key === 'clienteNome')?.value
  const c7 = r7.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n7 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c7 === '45.987.654/0001-88') {
    results.push('OK: Cenário 7 (Múltiplos CNPJs - tomador priorizado e isolado)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 7 - obteve nome: ${n7}, cnpj: ${c7}`)
  }

  // Teste 8: Documento sem seção tomador explícita, mas com proximidade ao nome do cliente
  const testInvoice8 = `
    FATURA DE COBRANÇA
    EMPRESA EMISSORA DE ENERGIA S/A
    CNPJ: 01.234.567/0001-89

    RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    45.987.654/0001-88
    RUA DAS FLORES, 500
  `
  const r8 = parseClientDataFromPdfText(testInvoice8, {
    ...DEFAULT_CALCULATOR_STATE,
    empresaCnpj: '01.234.567/0001-89',
    empresaNome: 'EMPRESA EMISSORA DE ENERGIA S/A',
  })
  const n8 = r8.fields.find((f) => f.key === 'clienteNome')?.value
  const c8 = r8.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n8 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c8 === '45.987.654/0001-88') {
    results.push('OK: Cenário 8 (Associação por vizinhança de linha ao nome do cliente)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 8 - obteve nome: ${n8}, cnpj: ${c8}`)
  }

  // Teste 9: Nome com rótulo e dois-pontos colados no mesmo valor e pontuações
  const testInvoice9 = `
    PRESTADOR DE SERVIÇOS
    Razão Social: SOFTWARES E SISTEMAS LTDA
    CNPJ: 10.000.000/0001-00

    TOMADOR DE SERVIÇOS:
    Nome/Razão Social: : - RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA - :
    CNPJ: 45.987.654/0001-88
  `
  const r9 = parseClientDataFromPdfText(testInvoice9, DEFAULT_CALCULATOR_STATE)
  const n9 = r9.fields.find((f) => f.key === 'clienteNome')?.value
  if (n9 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 9 (Nome com rótulo colado e pontuação residual limpos)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 9 - obteve nome: ${n9}`)
  }

  // Teste 10: Nome com CNPJ colado na mesma linha
  const testInvoice10 = `
    EMITENTE
    EMITENTE EXEMPLO LTDA
    CNPJ: 01.111.111/0001-11

    TOMADOR
    Razão Social: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA CNPJ: 45.987.654/0001-88
  `
  const r10 = parseClientDataFromPdfText(testInvoice10, DEFAULT_CALCULATOR_STATE)
  const n10 = r10.fields.find((f) => f.key === 'clienteNome')?.value
  const c10 = r10.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n10 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c10 === '45.987.654/0001-88') {
    results.push('OK: Cenário 10 (Nome com CNPJ colado na mesma linha isolado perfeitamente)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 10 - obteve nome: ${n10}, cnpj: ${c10}`)
  }

  // Teste 11: Marcador de seção vazado no valor do nome do tomador
  const testInvoice11 = `
    PRESTADOR DE SERVIÇOS
    Razão Social: SERVIÇOS GERAIS LTDA
    CNPJ: 22.333.444/0001-55

    TOMADOR DE SERVIÇOS: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ: 45.987.654/0001-88
  `
  const r11 = parseClientDataFromPdfText(testInvoice11, DEFAULT_CALCULATOR_STATE)
  const n11 = r11.fields.find((f) => f.key === 'clienteNome')?.value
  if (n11 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 11 (Marcador de seção TOMADOR DE SERVIÇOS vazado removido)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 11 - obteve nome: ${n11}`)
  }

  // Teste 12: Nome com CNPJ não formatado (14 dígitos) colado no fim da linha
  const testInvoice12 = `
    DADOS DO EMITENTE
    EMPRESA BETA LTDA
    CNPJ: 33.222.111/0001-00

    DESTINATÁRIO / REMETENTE
    Nome Empresarial: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA 45987654000188
  `
  const r12 = parseClientDataFromPdfText(testInvoice12, DEFAULT_CALCULATOR_STATE)
  const n12 = r12.fields.find((f) => f.key === 'clienteNome')?.value
  if (n12 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 12 (Nome com dígitos de CNPJ colados no final)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 12 - obteve nome: ${n12}`)
  }

  // Teste 13: Nome quebrado em duas linhas com rótulo "Tomador:" e caracteres residuais
  const testInvoice13 = `
    PRESTADOR
    ALFA CONSULTORIA LTDA
    CNPJ: 99.888.777/0001-66

    TOMADOR DO SERVIÇO:
    RESIDENCIAL ESTRELA
    INCORPORADORA SPE LTDA :
    CNPJ/CPF: 45.987.654/0001-88
  `
  const r13 = parseClientDataFromPdfText(testInvoice13, DEFAULT_CALCULATOR_STATE)
  const n13 = r13.fields.find((f) => f.key === 'clienteNome')?.value
  if (n13 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 13 (Quebrado em duas linhas com pontuações no final)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 13 - obteve nome: ${n13}`)
  }

  // Teste 14: Nome sob rótulo "Nome Empresarial" na mesma linha dentro do tomador
  const testInvoice14 = `
    PRESTADOR DE SERVIÇOS
    Razão Social: TECNOLOGIA E SERVICOS LTDA
    CNPJ: 12.345.678/0001-90

    TOMADOR DO SERVIÇO
    Nome Empresarial: RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ: 45.987.654/0001-88
    Endereço: RUA DAS FLORES, 500
  `
  const r14 = parseClientDataFromPdfText(testInvoice14, DEFAULT_CALCULATOR_STATE)
  const n14 = r14.fields.find((f) => f.key === 'clienteNome')?.value
  const c14 = r14.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n14 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c14 === '45.987.654/0001-88') {
    results.push('OK: Cenário 14 (Nome Empresarial na mesma linha)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 14 - obteve nome: ${n14}, cnpj: ${c14}`)
  }

  // Teste 15: Nome sob rótulo "Nome Empresarial" em linha separada dentro do tomador
  const testInvoice15 = `
    DADOS DO EMITENTE
    EMITENTE: AUDITORIA E CONSULTORIA LTDA
    CNPJ: 01.999.888/0001-77

    DADOS DO TOMADOR
    Nome Empresarial
    RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA
    CNPJ/CPF: 45.987.654/0001-88
  `
  const r15 = parseClientDataFromPdfText(testInvoice15, DEFAULT_CALCULATOR_STATE)
  const n15 = r15.fields.find((f) => f.key === 'clienteNome')?.value
  const c15 = r15.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n15 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c15 === '45.987.654/0001-88') {
    results.push('OK: Cenário 15 (Nome Empresarial em linha separada)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 15 - obteve nome: ${n15}, cnpj: ${c15}`)
  }

  // Teste 16: Nome Empresarial com quebra em duas linhas e caracteres residuais
  const testInvoice16 = `
    PRESTADOR DE SERVIÇOS
    CONSTRUTORA E ENGENHARIA LTDA
    CNPJ: 11.222.333/0001-44

    TOMADOR DE SERVIÇOS
    Nome Empresarial:
    RESIDENCIAL ESTRELA
    INCORPORADORA SPE LTDA
    CNPJ: 45.987.654/0001-88
  `
  const r16 = parseClientDataFromPdfText(testInvoice16, DEFAULT_CALCULATOR_STATE)
  const n16 = r16.fields.find((f) => f.key === 'clienteNome')?.value
  if (n16 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA') {
    results.push('OK: Cenário 16 (Nome Empresarial em linha separada quebrado em duas linhas)')
  } else {
    passed = false
    results.push(`FALHA: Cenário 16 - obteve nome: ${n16}`)
  }

  // Teste 17: Prestador possui "Razão Social" e Tomador possui "Nome Empresarial"
  // Garante que o Nome Empresarial do tomador não seja confundido ou substituído pelo prestador
  const testInvoice17 = `
    IDENTIFICAÇÃO DO PRESTADOR DE SERVIÇOS
    Nome / Razão Social: CONTABILIDADE INTEGRADA S/S
    CNPJ: 98.765.432/0001-10

    IDENTIFICAÇÃO DO TOMADOR DE SERVIÇOS
    Nome Empresarial: : - RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA - :
    CNPJ: 45.987.654/0001-88
  `
  const r17 = parseClientDataFromPdfText(testInvoice17, DEFAULT_CALCULATOR_STATE)
  const n17 = r17.fields.find((f) => f.key === 'clienteNome')?.value
  const c17 = r17.fields.find((f) => f.key === 'clienteCnpj')?.value
  if (n17 === 'RESIDENCIAL ESTRELA INCORPORADORA SPE LTDA' && c17 === '45.987.654/0001-88') {
    results.push(
      'OK: Cenário 17 (Prestador com Razão Social vs Tomador com Nome Empresarial pontuado)',
    )
  } else {
    passed = false
    results.push(`FALHA: Cenário 17 - obteve nome: ${n17}, cnpj: ${c17}`)
  }

  return { passed, results }
}
