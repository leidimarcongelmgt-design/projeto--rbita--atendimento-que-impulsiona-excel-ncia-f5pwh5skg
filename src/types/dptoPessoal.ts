export interface DptoPessoalRow {
  id: string
  empresa: string
  numFunc: number | string
}

export interface DptoImportResult {
  addedCount: number
  updatedCount: number
  ignoredRowsCount: number
  unrecognizedColumns: string[]
  totalRowsProcessed: number
  rows: DptoPessoalRow[]
}
