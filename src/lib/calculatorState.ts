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

  // 'identificacao', 'empresas', 'dpto-pessoal'/'pesos', 'fiscal-pesos'/'dpto-fiscal', ou 'contabil'/'dpto-contabil' são aceitos; qualquer outro faz fallback seguro para 'identificacao'
  const rawTab = params.get('tab')
  const tab: CalculatorState['tab'] =
    rawTab === 'empresas'
      ? 'empresas'
      : rawTab === 'dpto-pessoal' || rawTab === 'pesos'
        ? 'dpto-pessoal'
        : rawTab === 'fiscal-pesos' || rawTab === 'dpto-fiscal'
          ? 'fiscal-pesos'
          : rawTab === 'contabil' || rawTab === 'dpto-contabil'
            ? 'contabil'
            : 'identificacao'

  return {
    tab,

    logoWidth: parseNum('logoWidth', DEFAULT_CALCULATOR_STATE.logoWidth),
    logoHeight: parseNum('logoHeight', DEFAULT_CALCULATOR_STATE.logoHeight),
    logoRatio: parseBinary('logoRatio', DEFAULT_CALCULATOR_STATE.logoRatio),
    logoControls: parseBinary('logoControls', DEFAULT_CALCULATOR_STATE.logoControls),

    logoData: parseStr('logoData', DEFAULT_CALCULATOR_STATE.logoData),

    empresaNome: parseStr('empresaNome', DEFAULT_CALCULATOR_STATE.empresaNome),
    empresaCnpj: parseStr('empresaCnpj', DEFAULT_CALCULATOR_STATE.empresaCnpj),
    empresaEndereco: parseStr('empresaEndereco', DEFAULT_CALCULATOR_STATE.empresaEndereco),
    empresaCidade: parseStr('empresaCidade', DEFAULT_CALCULATOR_STATE.empresaCidade),
    empresaUf: parseStr('empresaUf', DEFAULT_CALCULATOR_STATE.empresaUf),

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

  params.set('tab', state.tab)

  setNum('logoWidth', state.logoWidth)
  setNum('logoHeight', state.logoHeight)
  params.set('logoRatio', String(state.logoRatio))
  params.set('logoControls', String(state.logoControls))

  if (state.logoData) params.set('logoData', state.logoData)

  if (state.empresaNome) params.set('empresaNome', state.empresaNome)
  if (state.empresaCnpj) params.set('empresaCnpj', state.empresaCnpj)
  if (state.empresaEndereco) params.set('empresaEndereco', state.empresaEndereco)
  if (state.empresaCidade) params.set('empresaCidade', state.empresaCidade)
  if (state.empresaUf) params.set('empresaUf', state.empresaUf)

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

/**
 * Formats/masks Brazilian phone numbers as (XX) XXXXX-XXXX (mobile) or (XX) XXXX-XXXX (landline)
 */
export function formatPhoneBR(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : ''
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }
  if (digits.length <= 10) {
    // Landline: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  // Mobile (11 digits): (XX) XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}
