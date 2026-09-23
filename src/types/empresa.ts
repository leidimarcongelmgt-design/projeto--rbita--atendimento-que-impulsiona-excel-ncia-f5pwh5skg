export interface EmpresaRow {
  id: string
  empresas: string
  cnpj: string
  regimeTrib: string
  ramoAtividade: string
  zona: string
  filial: string
  entrada: string
  grupo: string
  // Campos opcionais legados caso existam em sessionStorage ou planilhas antigas
  contabil?: string
  numFunc?: number | string
  peso1?: number | string
  peso2?: number | string
}

export type EmpresaColumnKey =
  | 'empresas'
  | 'cnpj'
  | 'regimeTrib'
  | 'ramoAtividade'
  | 'zona'
  | 'filial'
  | 'entrada'
  | 'grupo'

export const EMPRESA_COLUMNS: {
  key: EmpresaColumnKey
  label: string
  numeric?: boolean
  tooltip?: string
}[] = [
  { key: 'empresas', label: 'EMPRESAS' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'regimeTrib', label: 'REGIME TRIB.' },
  { key: 'ramoAtividade', label: 'RAMO DE ATIVIDADE 2' },
  { key: 'zona', label: 'ZONA' },
  { key: 'filial', label: 'FILIAL' },
  { key: 'entrada', label: 'CLIENTE DESDE' },
  { key: 'grupo', label: 'GRUPO' },
]

export interface ImportResult {
  addedCount: number
  updatedCount: number
  ignoredRowsCount: number
  unrecognizedColumns: string[]
  totalRowsProcessed: number
  newRecords: EmpresaRow[]
}
