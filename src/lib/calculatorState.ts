import { CalculatorState, DEFAULT_CALCULATOR_STATE } from '@/types/calculator'

export function parseStateFromUrl(search: string): CalculatorState {
  const params = new URLSearchParams(search)

  const parseNum = (key: string, def: number): number => {
    const val = params.get(key)
    if (val === null || val === '') return def
    const num = parseFloat(val)
    return isNaN(num) ? def : num
  }

  const parseBinary = (key: string, def: number): number => {
    const val = params.get(key)
    if (val === null || val === '') return def
    return val === '1' || val === 'true' ? 1 : 0
  }

  const parseStr = (key: string, def: string): string => {
    const val = params.get(key)
    return val !== null ? val : def
  }

  const tabParam = params.get('tab')
  let tab: CalculatorState['tab'] = DEFAULT_CALCULATOR_STATE.tab
  if (
    tabParam === 'identificacao' ||
    tabParam === 'calculo' ||
    tabParam === 'tributos' ||
    tabParam === 'folha'
  ) {
    tab = tabParam
  }

  return {
    receita: parseNum('receita', DEFAULT_CALCULATOR_STATE.receita),
    deducoes: parseNum('deducoes', DEFAULT_CALCULATOR_STATE.deducoes),
    cmv: parseNum('cmv', DEFAULT_CALCULATOR_STATE.cmv),
    despAdm: parseNum('despAdm', DEFAULT_CALCULATOR_STATE.despAdm),
    despFolha: parseNum('despFolha', DEFAULT_CALCULATOR_STATE.despFolha),
    tributos: parseNum('tributos', DEFAULT_CALCULATOR_STATE.tributos),
    resFinanceiro: parseNum('resFinanceiro', DEFAULT_CALCULATOR_STATE.resFinanceiro),

    tribBase: parseNum('tribBase', DEFAULT_CALCULATOR_STATE.tribBase),
    tribAliq: parseNum('tribAliq', DEFAULT_CALCULATOR_STATE.tribAliq),
    usarCalcTrib: parseBinary('usarCalcTrib', DEFAULT_CALCULATOR_STATE.usarCalcTrib),

    folhaSalarios: parseNum('folhaSalarios', DEFAULT_CALCULATOR_STATE.folhaSalarios),
    folhaInss: parseNum('folhaInss', DEFAULT_CALCULATOR_STATE.folhaInss),
    folhaFgts: parseNum('folhaFgts', DEFAULT_CALCULATOR_STATE.folhaFgts),
    folhaOutros: parseNum('folhaOutros', DEFAULT_CALCULATOR_STATE.folhaOutros),
    folha13: parseBinary('folha13', DEFAULT_CALCULATOR_STATE.folha13),
    folhaFerias: parseBinary('folhaFerias', DEFAULT_CALCULATOR_STATE.folhaFerias),
    usarCalcFolha: parseBinary('usarCalcFolha', DEFAULT_CALCULATOR_STATE.usarCalcFolha),

    tab,

    logoWidth: parseNum('logoWidth', DEFAULT_CALCULATOR_STATE.logoWidth),
    logoHeight: parseNum('logoHeight', DEFAULT_CALCULATOR_STATE.logoHeight),
    logoRatio: parseBinary('logoRatio', DEFAULT_CALCULATOR_STATE.logoRatio),
    logoControls: parseBinary('logoControls', DEFAULT_CALCULATOR_STATE.logoControls),
    clientLogoWidth: parseNum('clientLogoWidth', DEFAULT_CALCULATOR_STATE.clientLogoWidth),
    clientLogoHeight: parseNum('clientLogoHeight', DEFAULT_CALCULATOR_STATE.clientLogoHeight),
    clientLogoRatio: parseBinary('clientLogoRatio', DEFAULT_CALCULATOR_STATE.clientLogoRatio),
    clientLogoControls: parseBinary(
      'clientLogoControls',
      DEFAULT_CALCULATOR_STATE.clientLogoControls,
    ),

    logoData: parseStr('logoData', DEFAULT_CALCULATOR_STATE.logoData),
    clientLogoData: parseStr('clientLogoData', DEFAULT_CALCULATOR_STATE.clientLogoData),

    empresaNome: parseStr('empresaNome', DEFAULT_CALCULATOR_STATE.empresaNome),
    empresaCnpj: parseStr('empresaCnpj', DEFAULT_CALCULATOR_STATE.empresaCnpj),
    empresaEndereco: parseStr('empresaEndereco', DEFAULT_CALCULATOR_STATE.empresaEndereco),
    empresaCidade: parseStr('empresaCidade', DEFAULT_CALCULATOR_STATE.empresaCidade),
    empresaUf: parseStr('empresaUf', DEFAULT_CALCULATOR_STATE.empresaUf),

    clienteNome: parseStr('clienteNome', DEFAULT_CALCULATOR_STATE.clienteNome),
    clienteCnpj: parseStr('clienteCnpj', DEFAULT_CALCULATOR_STATE.clienteCnpj),
    clienteEndereco: parseStr('clienteEndereco', DEFAULT_CALCULATOR_STATE.clienteEndereco),
    clienteCidade: parseStr('clienteCidade', DEFAULT_CALCULATOR_STATE.clienteCidade),
    clienteUf: parseStr('clienteUf', DEFAULT_CALCULATOR_STATE.clienteUf),

    periodoInicio: parseStr('periodoInicio', DEFAULT_CALCULATOR_STATE.periodoInicio),
    periodoFim: parseStr('periodoFim', DEFAULT_CALCULATOR_STATE.periodoFim),
    dataEmissao: parseStr('dataEmissao', DEFAULT_CALCULATOR_STATE.dataEmissao),
  }
}

export function serializeStateToUrl(state: CalculatorState): string {
  const params = new URLSearchParams()

  const setNum = (key: string, val: number) => {
    params.set(key, String(Number.isFinite(val) ? val : 0))
  }

  setNum('receita', state.receita)
  setNum('deducoes', state.deducoes)
  setNum('cmv', state.cmv)
  setNum('despAdm', state.despAdm)
  setNum('despFolha', state.despFolha)
  setNum('tributos', state.tributos)
  setNum('resFinanceiro', state.resFinanceiro)

  setNum('tribBase', state.tribBase)
  setNum('tribAliq', state.tribAliq)
  params.set('usarCalcTrib', String(state.usarCalcTrib))

  setNum('folhaSalarios', state.folhaSalarios)
  setNum('folhaInss', state.folhaInss)
  setNum('folhaFgts', state.folhaFgts)
  setNum('folhaOutros', state.folhaOutros)
  params.set('folha13', String(state.folha13))
  params.set('folhaFerias', String(state.folhaFerias))
  params.set('usarCalcFolha', String(state.usarCalcFolha))

  params.set('tab', state.tab)

  setNum('logoWidth', state.logoWidth)
  setNum('logoHeight', state.logoHeight)
  params.set('logoRatio', String(state.logoRatio))
  params.set('logoControls', String(state.logoControls))

  setNum('clientLogoWidth', state.clientLogoWidth)
  setNum('clientLogoHeight', state.clientLogoHeight)
  params.set('clientLogoRatio', String(state.clientLogoRatio))
  params.set('clientLogoControls', String(state.clientLogoControls))

  if (state.logoData) params.set('logoData', state.logoData)
  if (state.clientLogoData) params.set('clientLogoData', state.clientLogoData)

  if (state.empresaNome) params.set('empresaNome', state.empresaNome)
  if (state.empresaCnpj) params.set('empresaCnpj', state.empresaCnpj)
  if (state.empresaEndereco) params.set('empresaEndereco', state.empresaEndereco)
  if (state.empresaCidade) params.set('empresaCidade', state.empresaCidade)
  if (state.empresaUf) params.set('empresaUf', state.empresaUf)

  if (state.clienteNome) params.set('clienteNome', state.clienteNome)
  if (state.clienteCnpj) params.set('clienteCnpj', state.clienteCnpj)
  if (state.clienteEndereco) params.set('clienteEndereco', state.clienteEndereco)
  if (state.clienteCidade) params.set('clienteCidade', state.clienteCidade)
  if (state.clienteUf) params.set('clienteUf', state.clienteUf)

  if (state.periodoInicio) params.set('periodoInicio', state.periodoInicio)
  if (state.periodoFim) params.set('periodoFim', state.periodoFim)
  if (state.dataEmissao) params.set('dataEmissao', state.dataEmissao)

  return `?${params.toString()}`
}

/**
 * Formats a number as BRL currency: R$ 1.234,56
 */
export function formatBRL(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00'
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Formats a percentage: 20% or 15,5%
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '—'
  }
  return (
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value) + '%'
  )
}

/**
 * Format Brazilian date DD/MM/YYYY
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—'
  // If it's YYYY-MM-DD from input[type=date]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }
  return dateStr
}
