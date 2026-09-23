export interface CalculatorState {
  // P&L financial inputs
  receita: number
  deducoes: number
  cmv: number
  despAdm: number
  despFolha: number
  tributos: number
  resFinanceiro: number

  // Taxes
  tribBase: number
  tribAliq: number
  usarCalcTrib: number // 0 or 1

  // Payroll
  folhaSalarios: number
  folhaInss: number // default 20
  folhaFgts: number // default 8
  folhaOutros: number
  folha13: number // 0 or 1, default 1
  folhaFerias: number // 0 or 1, default 1
  usarCalcFolha: number // 0 or 1, default 1

  // Active tab
  tab: 'identificacao' | 'cliente' | 'calculo' | 'tributos' | 'folha'

  // Identification & Branding
  logoWidth: number
  logoHeight: number
  logoRatio: number // 0 or 1
  logoControls: number // 0 or 1
  clientLogoWidth: number
  clientLogoHeight: number
  clientLogoRatio: number // 0 or 1
  clientLogoControls: number // 0 or 1

  logoData: string
  clientLogoData: string

  empresaNome: string
  empresaCnpj: string
  empresaEndereco: string
  empresaCidade: string
  empresaUf: string

  clienteNome: string
  clienteCnpj: string
  clienteIE: string
  clienteIM: string
  clienteRamo: string
  clienteEndereco: string
  clienteCidade: string
  clienteUf: string

  // Client Contacts
  contFinNome: string
  contFinTelefone: string
  contFinEmail: string
  contEstoqueNome: string
  contEstoqueTelefone: string
  contEstoqueEmail: string
  contRhNome: string
  contRhTelefone: string
  contRhEmail: string
  contLegalNome: string
  contLegalTelefone: string
  contLegalEmail: string

  periodoInicio: string
  periodoFim: string
  dataEmissao: string
}

export const DEFAULT_CALCULATOR_STATE: CalculatorState = {
  receita: 0,
  deducoes: 0,
  cmv: 0,
  despAdm: 0,
  despFolha: 0,
  tributos: 0,
  resFinanceiro: 0,

  tribBase: 0,
  tribAliq: 0,
  usarCalcTrib: 1,

  folhaSalarios: 0,
  folhaInss: 20,
  folhaFgts: 8,
  folhaOutros: 0,
  folha13: 1,
  folhaFerias: 1,
  usarCalcFolha: 1,

  tab: 'identificacao',

  logoWidth: 538,
  logoHeight: 181,
  logoRatio: 0,
  logoControls: 1,
  clientLogoWidth: 150,
  clientLogoHeight: 150,
  clientLogoRatio: 1,
  clientLogoControls: 0,

  logoData: '',
  clientLogoData: '',

  empresaNome: '',
  empresaCnpj: '',
  empresaEndereco: '',
  empresaCidade: '',
  empresaUf: '',

  clienteNome: '',
  clienteCnpj: '',
  clienteIE: '',
  clienteIM: '',
  clienteRamo: '',
  clienteEndereco: '',
  clienteCidade: '',
  clienteUf: '',

  contFinNome: '',
  contFinTelefone: '',
  contFinEmail: '',
  contEstoqueNome: '',
  contEstoqueTelefone: '',
  contEstoqueEmail: '',
  contRhNome: '',
  contRhTelefone: '',
  contRhEmail: '',
  contLegalNome: '',
  contLegalTelefone: '',
  contLegalEmail: '',

  periodoInicio: '',
  periodoFim: '',
  dataEmissao: '',
}

export interface ComputedFinancials {
  receitaLiquida: number
  resultadoBruto: number
  folhaCalculada: {
    salarios: number
    inssValor: number
    fgtsValor: number
    outros: number
    decimoTerceiroValor: number
    feriasValor: number
    totalFolha: number
  }
  despFolhaEfetiva: number
  tributosCalculados: number
  tributosEfetivo: number
  resultadoExercicio: number
}

export function computeFinancials(state: CalculatorState): ComputedFinancials {
  const receita = Number(state.receita) || 0
  const deducoes = Number(state.deducoes) || 0
  const cmv = Number(state.cmv) || 0
  const despAdm = Number(state.despAdm) || 0
  const resFinanceiro = Number(state.resFinanceiro) || 0

  const receitaLiquida = receita - deducoes
  const resultadoBruto = receitaLiquida - cmv

  // Payroll calculation
  const folhaSalarios = Number(state.folhaSalarios) || 0
  const folhaInss = Number(state.folhaInss) || 0
  const folhaFgts = Number(state.folhaFgts) || 0
  const folhaOutros = Number(state.folhaOutros) || 0

  const inssValor = folhaSalarios * (folhaInss / 100)
  const fgtsValor = folhaSalarios * (folhaFgts / 100)
  const decimoTerceiroValor = state.folha13 === 1 ? folhaSalarios / 12 : 0
  const feriasValor = state.folhaFerias === 1 ? folhaSalarios / 12 : 0
  const totalFolha =
    folhaSalarios + inssValor + fgtsValor + folhaOutros + decimoTerceiroValor + feriasValor

  const despFolhaEfetiva = state.usarCalcFolha === 1 ? totalFolha : Number(state.despFolha) || 0

  // Taxes calculation
  const tribBase = Number(state.tribBase) || 0
  const tribAliq = Number(state.tribAliq) || 0
  const tributosCalculados = tribBase * (tribAliq / 100)
  const tributosEfetivo =
    state.usarCalcTrib === 1 ? tributosCalculados : Number(state.tributos) || 0

  const resultadoExercicio =
    resultadoBruto - despAdm - despFolhaEfetiva - tributosEfetivo + resFinanceiro

  return {
    receitaLiquida,
    resultadoBruto,
    folhaCalculada: {
      salarios: folhaSalarios,
      inssValor,
      fgtsValor,
      outros: folhaOutros,
      decimoTerceiroValor,
      feriasValor,
      totalFolha,
    },
    despFolhaEfetiva,
    tributosCalculados,
    tributosEfetivo,
    resultadoExercicio,
  }
}
