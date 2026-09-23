export interface DptoContabilRow {
  id: string
  empresa: string
  cnpj?: string
  zona?: string
  contabil: string
}

export interface DptoContabilImportResult {
  addedCount: number
  updatedCount: number
  ignoredRowsCount: number
  unrecognizedColumns: string[]
  totalRowsProcessed: number
  rows: DptoContabilRow[]
}
