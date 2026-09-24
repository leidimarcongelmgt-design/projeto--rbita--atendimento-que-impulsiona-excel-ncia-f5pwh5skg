export interface CustomColumnDef {
  id: string // Identificador único / chave interna da coluna
  label: string // Título exibido no cabeçalho
  created?: string
}

export interface EmpresaRow {
  id: string
  empresas: string
  cnpj: string
  regimeTrib: string
  ramoAtividade: string
  filial: string
  grupo: string
  entrada: string // CLIENTE DESDE (mantido para compatibilidade e histórico)
  zona: string
  contabil: string // CONTÁBIL
  numFunc: number | string // Nº FUNC.
  pesoFolha: number | string // PESO FOLHA (imagem: PESO FOL...)
  pesoFiscal: number | string // PESO FISCAL
  receitas: number | string // RECEITAS
  despCustos: number | string // DESP./CUSTOS
  enviaSped: string // ENVIA SPED
  observacoes: string // OBSERVAÇÕES
  lnk: string // LNK
  isManual?: boolean // Identifica linhas cadastradas manualmente
  customFields?: Record<string, string> // Valores das colunas personalizadas (chave = CustomColumnDef.id)
  // Campos opcionais legados caso existam em sessionStorage ou sincronização
  peso1?: number | string
  peso2?: number | string
}

export type EmpresaFixedColumnKey =
  | 'empresas'
  | 'cnpj'
  | 'regimeTrib'
  | 'ramoAtividade'
  | 'filial'
  | 'grupo'
  | 'entrada'
  | 'zona'
  | 'contabil'
  | 'numFunc'
  | 'pesoFolha'
  | 'pesoFiscal'
  | 'receitas'
  | 'despCustos'
  | 'enviaSped'
  | 'observacoes'
  | 'lnk'

export type EmpresaColumnKey = EmpresaFixedColumnKey | string

export const EMPRESA_COLUMNS: {
  key: EmpresaFixedColumnKey
  label: string
  numeric?: boolean
  tooltip?: string
}[] = [
  { key: 'empresas', label: 'EMPRESAS' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'regimeTrib', label: 'REGIME TRIB.' },
  { key: 'ramoAtividade', label: 'RAMO DE ATIVIDADE 2' },
  { key: 'filial', label: 'FILIAL' },
  { key: 'grupo', label: 'GRUPO' },
  { key: 'entrada', label: 'CLIENTE DESDE' },
  { key: 'zona', label: 'ZONA' },
  { key: 'contabil', label: 'CONTÁBIL' },
  { key: 'numFunc', label: 'Nº FUNC.', numeric: true },
  { key: 'pesoFolha', label: 'PESO FOLHA', numeric: true },
  { key: 'pesoFiscal', label: 'PESO FISCAL', numeric: true },
  { key: 'receitas', label: 'RECEITAS', numeric: true },
  { key: 'despCustos', label: 'DESP./CUSTOS', numeric: true },
  { key: 'enviaSped', label: 'ENVIA SPED' },
  { key: 'observacoes', label: 'OBSERVAÇÕES' },
  { key: 'lnk', label: 'LNK' },
]

export interface ImportResult {
  addedCount: number
  updatedCount: number
  ignoredRowsCount: number
  unrecognizedColumns: string[]
  totalRowsProcessed: number
  newRecords: EmpresaRow[]
}
