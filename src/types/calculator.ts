export interface CalculatorState {
  // Active tab (apenas Identificação e Cliente)
  tab: 'identificacao' | 'cliente'

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
