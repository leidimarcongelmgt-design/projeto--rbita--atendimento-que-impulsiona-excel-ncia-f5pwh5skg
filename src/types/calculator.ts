export interface CalculatorState {
  // Active tab (apenas Identificação)
  tab: 'identificacao'

  // Identification & Branding (Emissor)
  logoWidth: number
  logoHeight: number
  logoRatio: number // 0 or 1
  logoControls: number // 0 or 1

  logoData: string

  empresaNome: string
  empresaCnpj: string
  empresaEndereco: string
  empresaCidade: string
  empresaUf: string

  periodoInicio: string
  periodoFim: string
  dataEmissao: string
}

export const DEFAULT_CALCULATOR_STATE: CalculatorState = {
  tab: 'identificacao',

  logoWidth: 538,
  logoHeight: 181,
  logoRatio: 0,
  logoControls: 1,

  logoData: '',

  empresaNome: '',
  empresaCnpj: '',
  empresaEndereco: '',
  empresaCidade: '',
  empresaUf: '',

  periodoInicio: '',
  periodoFim: '',
  dataEmissao: '',
}
