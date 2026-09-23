export interface EmpresaRow {
  id: string
  empresas: string
  cnpj: string
  regimeTrib: string
  ramoAtividade: string
  zona: string
  numFunc: number | string
  filial: string
  contabil: string
  entrada: string
  grupo: string
  // Campos opcionais legados caso existam em sessionStorage
  peso1?: number | string
  peso2?: number | string
}

export type EmpresaColumnKey =
  | 'empresas'
  | 'cnpj'
  | 'regimeTrib'
  | 'ramoAtividade'
  | 'zona'
  | 'numFunc'
  | 'filial'
  | 'contabil'
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
  { key: 'numFunc', label: 'Nº FUNC.', numeric: true },
  { key: 'filial', label: 'FILIAL' },
  { key: 'contabil', label: 'CONTÁBIL' },
  { key: 'entrada', label: 'ENTRADA' },
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
