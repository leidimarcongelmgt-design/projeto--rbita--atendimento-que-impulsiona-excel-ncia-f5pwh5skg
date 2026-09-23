export interface DptoFiscalRow {
  id: string
  empresa: string
  cnpj?: string
  zona?: string
  peso: number | string
}

export interface DptoFiscalImportResult {
  addedCount: number
  updatedCount: number
  ignoredRowsCount: number
  unrecognizedColumns: string[]
  totalRowsProcessed: number
  rows: DptoFiscalRow[]
}
