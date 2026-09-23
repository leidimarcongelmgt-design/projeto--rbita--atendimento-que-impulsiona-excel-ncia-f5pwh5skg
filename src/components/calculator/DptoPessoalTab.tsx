import React, { useState, useRef, useMemo, useEffect } from 'react'
import { DptoPessoalRow } from '@/types/dptoPessoal'
import { EmpresaRow } from '@/types/empresa'
import {
  parseDptoPessoalFile,
  mergeDptoRows,
  saveDptoPessoalToStorage,
  syncFromEmpresas,
} from '@/lib/dptoPessoalService'
import { useResizableColumns, RESIZABLE_STORAGE_KEYS } from '@/hooks/use-resizable-columns'
import { ResizableTh } from '@/components/calculator/ResizableTh'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Users,
  Upload,
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Plus,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'

interface DptoPessoalTabProps {
  rows: DptoPessoalRow[]
  onRowsChange: (rows: DptoPessoalRow[]) => void
  empresas: EmpresaRow[]
}

type SortField = 'empresa' | 'cnpj' | 'zona' | 'numFunc'
type SortConfig = {
  field: SortField
  direction: 'asc' | 'desc'
} | null

const DEFAULT_DPTO_PESSOAL_COL_WIDTHS: { [key: string]: number } = {
  index: 48,
  empresa: 340,
  cnpj: 160,
  zona: 130,
  numFunc: 220,
  acoes: 64,
}

const MIN_DPTO_PESSOAL_COL_WIDTHS: { [key: string]: number } = {
  index: 40,
  empresa: 150,
  cnpj: 120,
  zona: 80,
  numFunc: 100,
  acoes: 50,
}

export const DptoPessoalTab: React.FC<DptoPessoalTabProps> = ({ rows, onRowsChange, empresas }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hook de controle de larguras com persistência em sessionStorage
  const { widths, startResize, isDraggingRef } = useResizableColumns(
    RESIZABLE_STORAGE_KEYS.DPTO_PESSOAL,
    DEFAULT_DPTO_PESSOAL_COL_WIDTHS,
    MIN_DPTO_PESSOAL_COL_WIDTHS,
  )

  // Busca e ordenação
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)

  // Diálogo de Conflito de Importação
  const [pendingFileRows, setPendingFileRows] = useState<{
    rows: DptoPessoalRow[]
    ignoredRowsCount: number
    unrecognizedColumns: string[]
  } | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)

  // Diálogo de Confirmação para Limpar Tudo
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  // Diálogo para Adicionar Nova Empresa Manualmente
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newEmpresaNome, setNewEmpresaNome] = useState('')
  const [newEmpresaCnpj, setNewEmpresaCnpj] = useState('')
  const [newZona, setNewZona] = useState('')
  const [newNumFunc, setNewNumFunc] = useState('')

  // Resumo da última importação
  const [lastImportSummary, setLastImportSummary] = useState<{
    added: number
    updated: number
    ignored: number
    unrecognized: string[]
  } | null>(null)

  // Persiste no sessionStorage sempre que a lista mudar
  useEffect(() => {
    saveDptoPessoalToStorage(rows)
  }, [rows])

  // Trata o arquivo selecionado
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    try {
      const parsed = await parseDptoPessoalFile(file)

      if (parsed.rows.length === 0) {
        toast.error(
          'Nenhum registro válido encontrado. Certifique-se de que a planilha possui as colunas EMPRESAS e Nº FUNC.',
        )
        if (parsed.ignoredRowsCount > 0) {
          toast.warning(
            `${parsed.ignoredRowsCount} linha(s) ignorada(s) por falta de identificação da empresa.`,
          )
        }
        return
      }

      if (rows.length > 0) {
        setPendingFileRows(parsed)
        setConflictDialogOpen(true)
      } else {
        applyImport(parsed.rows, 'replace', parsed.ignoredRowsCount, parsed.unrecognizedColumns)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao ler a planilha. Verifique se o formato é .xlsx ou .xls válido.')
    }
  }

  const applyImport = (
    incomingRows: DptoPessoalRow[],
    mode: 'replace' | 'append',
    ignoredCount = 0,
    unrecognizedCols: string[] = [],
  ) => {
    const result = mergeDptoRows(rows, incomingRows, mode)
    onRowsChange(result.rows)

    setLastImportSummary({
      added: result.addedCount,
      updated: result.updatedCount,
      ignored: ignoredCount,
      unrecognized: unrecognizedCols,
    })

    if (mode === 'replace') {
      toast.success(`${result.addedCount} registro(s) importado(s) com sucesso.`)
    } else {
      let msg = `${result.addedCount} novo(s) registro(s) adicionado(s)`
      if (result.updatedCount > 0) {
        msg += `, ${result.updatedCount} atualizado(s)`
      }
      toast.success(msg + '.')
    }

    if (ignoredCount > 0) {
      toast.warning(`${ignoredCount} linha(s) sem identificação da empresa foram ignoradas.`)
    }

    setPendingFileRows(null)
    setConflictDialogOpen(false)
  }

  const handleConfirmReplace = () => {
    if (!pendingFileRows) return
    applyImport(
      pendingFileRows.rows,
      'replace',
      pendingFileRows.ignoredRowsCount,
      pendingFileRows.unrecognizedColumns,
    )
  }

  const handleConfirmAppend = () => {
    if (!pendingFileRows) return
    applyImport(
      pendingFileRows.rows,
      'append',
      pendingFileRows.ignoredRowsCount,
      pendingFileRows.unrecognizedColumns,
    )
  }

  // Sincronizar da aba Empresas
  const handleSyncFromEmpresas = () => {
    if (empresas.length === 0) {
      toast.info('Não há empresas cadastradas na aba Empresas para sincronizar.')
      return
    }

    const synced = syncFromEmpresas(empresas, rows)
    onRowsChange(synced)
    toast.success(`${synced.length} empresa(s) carregada(s) da aba Empresas com sucesso!`)
  }

  // Edição inline do número de funcionários
  const handleNumFuncChange = (id: string, value: string) => {
    const updated = rows.map((r) => {
      if (r.id !== id) return r
      const trimmed = value.trim()
      if (trimmed === '') return { ...r, numFunc: '' }
      const parsed = Number(trimmed.replace(',', '.'))
      return { ...r, numFunc: !isNaN(parsed) ? parsed : value }
    })
    onRowsChange(updated)
  }

  // Edição inline de ZONA
  const handleZonaChange = (id: string, value: string) => {
    const updated = rows.map((r) => (r.id === id ? { ...r, zona: value } : r))
    onRowsChange(updated)
  }

  // Edição inline de CNPJ
  const handleCnpjChange = (id: string, value: string) => {
    const updated = rows.map((r) => (r.id === id ? { ...r, cnpj: value } : r))
    onRowsChange(updated)
  }

  // Edição inline do nome da empresa
  const handleEmpresaChange = (id: string, value: string) => {
    const updated = rows.map((r) => (r.id === id ? { ...r, empresa: value } : r))
    onRowsChange(updated)
  }

  // Adicionar linha manualmente
  const handleAddManualRow = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedNome = newEmpresaNome.trim()
    if (!trimmedNome) {
      toast.error('Informe o nome da empresa.')
      return
    }

    let numVal: number | string = ''
    if (newNumFunc.trim() !== '') {
      const parsed = Number(newNumFunc.trim().replace(',', '.'))
      numVal = !isNaN(parsed) ? parsed : newNumFunc.trim()
    }

    const newRow: DptoPessoalRow = {
      id: `dpto-manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      empresa: trimmedNome,
      cnpj: newEmpresaCnpj.trim(),
      zona: newZona.trim(),
      numFunc: numVal,
    }

    onRowsChange([...rows, newRow])
    setNewEmpresaNome('')
    setNewEmpresaCnpj('')
    setNewZona('')
    setNewNumFunc('')
    setAddModalOpen(false)
    toast.success(`Empresa "${trimmedNome}" adicionada.`)
  }

  // Remover linha individual
  const handleDeleteRow = (id: string, empresaNome: string) => {
    const updated = rows.filter((r) => r.id !== id)
    onRowsChange(updated)
    toast.success(`Registro da empresa "${empresaNome || 'Sem Nome'}" removido.`)
  }

  // Limpar tudo
  const handleClearAll = () => {
    onRowsChange([])
    setLastImportSummary(null)
    setClearDialogOpen(false)
    toast.info('Lista do Dpto. Pessoal - Pesos limpa com sucesso.')
  }

  // Alternar ordenação
  const handleSort = (field: SortField) => {
    setSortConfig((prev) => {
      if (!prev || prev.field !== field) {
        return { field, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { field, direction: 'desc' }
      }
      return null
    })
  }

  // Total de funcionários somados
  const totalFuncionarios = useMemo(() => {
    return rows.reduce((acc, r) => {
      const val =
        typeof r.numFunc === 'number' ? r.numFunc : parseFloat(String(r.numFunc).replace(',', '.'))
      return acc + (Number.isFinite(val) ? val : 0)
    }, 0)
  }, [rows])

  // Filtragem e ordenação memoizadas
  const filteredAndSortedRows = useMemo(() => {
    let list = [...rows]

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const matchEmpresa = r.empresa.toLowerCase().includes(q)
        const matchFunc = String(r.numFunc).toLowerCase().includes(q)
        const matchZona = (r.zona || '').toLowerCase().includes(q)
        const matchCnpj = r.cnpj ? r.cnpj.toLowerCase().includes(q) : false
        return matchEmpresa || matchFunc || matchZona || matchCnpj
      })
    }

    if (sortConfig) {
      const { field, direction } = sortConfig
      list.sort((a, b) => {
        if (field === 'numFunc') {
          const numA =
            typeof a.numFunc === 'number'
              ? a.numFunc
              : parseFloat(String(a.numFunc).replace(',', '.')) || 0
          const numB =
            typeof b.numFunc === 'number'
              ? b.numFunc
              : parseFloat(String(b.numFunc).replace(',', '.')) || 0
          return direction === 'asc' ? numA - numB : numB - numA
        }

        const strA = (a[field] || '').toLowerCase()
        const strB = (b[field] || '').toLowerCase()
        const cmp = strA.localeCompare(strB, 'pt-BR', { numeric: true })
        return direction === 'asc' ? cmp : -cmp
      })
    }

    return list
  }, [rows, searchQuery, sortConfig])

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Card Principal */}
        <Card className="border border-slate-200 card-shadow bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1E3A5F]" />
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Dpto. Pessoal - Pesos
                  </CardTitle>
                </div>
                <CardDescription className="text-slate-500 mt-1">
                  Gerencie as informações de empresas, CNPJ, Zona e Nº de Funcionários.
                </CardDescription>
              </div>

              {/* Botões de Ação do Topo */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleFileSelected}
                />

                {empresas.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSyncFromEmpresas}
                    className="text-xs h-9 text-[#1E3A5F] hover:bg-slate-100 border-slate-300 gap-1.5"
                    title="Preencher com o nome, CNPJ, Zona e nº de funcionários das empresas cadastradas na aba Empresas"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>Carregar de Empresas ({empresas.length})</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(true)}
                  className="text-xs h-9 text-slate-700 hover:text-slate-900 border-slate-300 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  <span>Adicionar Manual</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 px-4 gap-2 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importar Planilha</span>
                </Button>

                {rows.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClearDialogOpen(true)}
                    className="text-xs h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-slate-300 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Tudo</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Banner de Orientação */}
            <div className="rounded-lg border border-purple-900/20 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-900" />
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Colunas processadas nesta aba
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  EMPRESAS, CNPJ, ZONA e Nº FUNC. gerenciados nesta aba
                </span>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="inline-flex min-w-full text-[11px] font-bold text-white tracking-wider rounded overflow-hidden shadow-xs border border-purple-950">
                  <div className="bg-[#380638] px-4 py-2 text-left flex-1 border-r border-purple-950/40">
                    EMPRESAS
                  </div>
                  <div className="bg-[#380638] px-4 py-2 text-left w-44 border-r border-purple-950/40">
                    CNPJ
                  </div>
                  <div className="bg-[#380638] px-4 py-2 text-left w-36 border-r border-purple-950/40">
                    ZONA
                  </div>
                  <div className="bg-[#380638] px-4 py-2 text-right w-44">Nº FUNC.</div>
                </div>
              </div>
            </div>

            {/* Resumo da Última Importação */}
            {lastImportSummary && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      Importação processada: {lastImportSummary.added} registro(s) adicionado(s)
                      {lastImportSummary.updated > 0 &&
                        `, ${lastImportSummary.updated} atualizado(s)`}
                      .
                    </p>
                    {lastImportSummary.ignored > 0 && (
                      <p className="text-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {lastImportSummary.ignored} linha(s) ignorada(s) por falta de nome da
                        empresa.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLastImportSummary(null)}
                  className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {/* Cards de Métricas Rápidas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Total de Empresas</span>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{rows.length}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-[#1E3A5F]">
                  <Building className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">
                    Total Geral de Funcionários
                  </span>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">
                    {totalFuncionarios.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Barra de Busca e Contador */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Filtrar por empresa, CNPJ, zona ou nº func..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-8 text-xs bg-[#F9FAFB]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Badge
                  variant="outline"
                  className="font-semibold px-2.5 py-1 text-slate-700 bg-slate-50"
                >
                  {rows.length} {rows.length === 1 ? 'empresa cadastrada' : 'empresas cadastradas'}
                </Badge>
                {searchQuery && (
                  <span className="text-slate-500">
                    ({filteredAndSortedRows.length} exibida
                    {filteredAndSortedRows.length === 1 ? '' : 's'})
                  </span>
                )}
              </div>
            </div>

            {/* Tabela de Empresas e Nº Funcionários */}
            {rows.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-12 text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-slate-200/80 flex items-center justify-center mx-auto mb-3 text-slate-500">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Nenhum registro no Dpto. Pessoal - Pesos
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                  Importe uma planilha com as colunas EMPRESAS, CNPJ, ZONA e Nº FUNC., carregue os
                  dados já existentes na aba Empresas ou adicione manualmente.
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {empresas.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSyncFromEmpresas}
                      className="text-xs h-9 px-4 gap-2 text-[#1E3A5F] border-slate-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Carregar de Empresas ({empresas.length})</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 px-4 gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Importar Planilha (.xlsx, .xls)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddModalOpen(true)}
                    className="text-xs h-9 px-4 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Manualmente</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs table-fixed">
                    <thead>
                      <tr className="bg-[#380638] text-white select-none">
                        <ResizableTh
                          width={widths.index}
                          minWidth={MIN_DPTO_PESSOAL_COL_WIDTHS.index}
                          resizable={true}
                          onResizeStart={(e) => startResize(e, 'index')}
                          className="py-2.5 px-3 font-semibold text-center border-r border-purple-950/40"
                        >
                          #
                        </ResizableTh>
                        <ResizableTh
                          width={widths.empresa}
                          minWidth={MIN_DPTO_PESSOAL_COL_WIDTHS.empresa}
                          resizable={true}
                          onResizeStart={(e) => startResize(e, 'empresa')}
                          onHeaderClick={() => handleSort('empresa')}
                          isDraggingRef={isDraggingRef}
                          className="py-2.5 px-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-purple-900/60 transition-colors border-r border-purple-950/40 overflow-hidden"
                          title="Clique para ordenar por Empresa"
                        >
                          <div className="inline-flex items-center gap-1.5 w-full overflow-hidden">
                            <span className="truncate">EMPRESAS</span>
                            {sortConfig?.field === 'empresa' ? (
                              sortConfig.direction === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-purple-300 opacity-60 flex-shrink-0" />
                            )}
                          </div>
                        </ResizableTh>
                        <ResizableTh
                          width={widths.cnpj}
                          minWidth={MIN_DPTO_PESSOAL_COL_WIDTHS.cnpj}
                          resizable={true}
                          onResizeStart={(e) => startResize(e, 'cnpj')}
                          onHeaderClick={() => handleSort('cnpj')}
                          isDraggingRef={isDraggingRef}
                          className="py-2.5 px-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-purple-900/60 transition-colors border-r border-purple-950/40 overflow-hidden"
                          title="Clique para ordenar por CNPJ"
                        >
                          <div className="inline-flex items-center gap-1.5 w-full overflow-hidden">
                            <span className="truncate">CNPJ</span>
                            {sortConfig?.field === 'cnpj' ? (
                              sortConfig.direction === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-purple-300 opacity-60 flex-shrink-0" />
                            )}
                          </div>
                        </ResizableTh>
                        <ResizableTh
                          width={widths.zona}
                          minWidth={MIN_DPTO_PESSOAL_COL_WIDTHS.zona}
                          resizable={true}
                          onResizeStart={(e) => startResize(e, 'zona')}
                          onHeaderClick={() => handleSort('zona')}
                          isDraggingRef={isDraggingRef}
                          className="py-2.5 px-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-purple-900/60 transition-colors border-r border-purple-950/40 overflow-hidden"
                          title="Clique para ordenar por Zona"
                        >
                          <div className="inline-flex items-center gap-1.5 w-full overflow-hidden">
                            <span className="truncate">ZONA</span>
                            {sortConfig?.field === 'zona' ? (
                              sortConfig.direction === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-purple-300 opacity-60 flex-shrink-0" />
                            )}
                          </div>
                        </ResizableTh>
                        <ResizableTh
                          width={widths.numFunc}
                          minWidth={MIN_DPTO_PESSOAL_COL_WIDTHS.numFunc}
                          resizable={true}
                          onResizeStart={(e) => startResize(e, 'numFunc')}
                          onHeaderClick={() => handleSort('numFunc')}
                          isDraggingRef={isDraggingRef}
                          className="py-2.5 px-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-purple-900/60 transition-colors border-r border-purple-950/40 text-right overflow-hidden"
                          title="Clique para ordenar por Nº de Funcionários"
                        >
                          <div className="inline-flex items-center justify-end gap-1.5 w-full overflow-hidden">
                            <span className="truncate">Nº FUNC.</span>
                            {sortConfig?.field === 'numFunc' ? (
                              sortConfig.direction === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-purple-300 opacity-60 flex-shrink-0" />
                            )}
                          </div>
                        </ResizableTh>
                        <th
                          style={{
                            width: `${widths.acoes}px`,
                            minWidth: `${MIN_DPTO_PESSOAL_COL_WIDTHS.acoes}px`,
                          }}
                          className="py-2.5 px-3 font-semibold text-center select-none"
                        >
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredAndSortedRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Nenhum registro encontrado para o filtro "{searchQuery}".
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedRows.map((row, index) => (
                          <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100 truncate">
                              {index + 1}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 overflow-hidden">
                              <Input
                                value={row.empresa}
                                onChange={(e) => handleEmpresaChange(row.id, e.target.value)}
                                className="h-8 text-xs font-medium text-slate-900 border-transparent hover:border-slate-300 focus:border-[#1E3A5F] bg-transparent focus:bg-white w-full"
                                placeholder="Nome da empresa"
                              />
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 overflow-hidden">
                              <Input
                                type="text"
                                value={row.cnpj || ''}
                                onChange={(e) => handleCnpjChange(row.id, e.target.value)}
                                className="h-8 text-xs font-mono text-slate-700 border-transparent hover:border-slate-300 focus:border-[#1E3A5F] bg-transparent focus:bg-white w-full"
                                placeholder="00.000.000/0000-00"
                              />
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 overflow-hidden">
                              <Input
                                type="text"
                                value={row.zona || ''}
                                onChange={(e) => handleZonaChange(row.id, e.target.value)}
                                className="h-8 text-xs text-slate-800 border-transparent hover:border-slate-300 focus:border-[#1E3A5F] bg-transparent focus:bg-white w-full"
                                placeholder="Zona..."
                              />
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-right overflow-hidden">
                              <Input
                                type="text"
                                value={row.numFunc}
                                onChange={(e) => handleNumFuncChange(row.id, e.target.value)}
                                className="h-8 text-xs text-right font-mono font-semibold text-slate-900 border-transparent hover:border-slate-300 focus:border-[#1E3A5F] bg-transparent focus:bg-white w-full"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRow(row.id, row.empresa)}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <span>Remover registro</span>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredAndSortedRows.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 font-semibold text-slate-800 border-t-2 border-slate-300">
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px] truncate">
                            Σ
                          </td>
                          <td className="py-2.5 px-3 uppercase tracking-wider text-[11px] text-slate-600 truncate">
                            Total Geral ({filteredAndSortedRows.length} empresa
                            {filteredAndSortedRows.length === 1 ? '' : 's'})
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate">
                            {
                              filteredAndSortedRows.filter((r) => (r.cnpj || '').trim() !== '')
                                .length
                            }{' '}
                            com CNPJ
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate">
                            {
                              filteredAndSortedRows.filter((r) => (r.zona || '').trim() !== '')
                                .length
                            }{' '}
                            com Zona
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-[#1E3A5F] truncate">
                            {filteredAndSortedRows
                              .reduce((acc, r) => {
                                const val =
                                  typeof r.numFunc === 'number'
                                    ? r.numFunc
                                    : parseFloat(String(r.numFunc).replace(',', '.'))
                                return acc + (Number.isFinite(val) ? val : 0)
                              }, 0)
                              .toLocaleString('pt-BR')}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diálogo de Conflito de Importação */}
        <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Como deseja importar a nova planilha?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Já existem {rows.length} empresa(s) cadastradas em Dpto. Pessoal - Pesos. A planilha
                contém {pendingFileRows?.rows.length ?? 0} registro(s) com informações de Nº de
                Funcionários.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 text-xs text-slate-600 space-y-2">
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">Substituir tudo</span>
                Apaga os registros atuais de Dpto. Pessoal - Pesos e mantém apenas os novos
                registros.
              </div>
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">
                  Adicionar / Atualizar existentes
                </span>
                Acrescenta novos registros e atualiza os dados de empresas que já existam na lista
                pelo nome ou CNPJ.
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConflictDialogOpen(false)}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleConfirmReplace}
                className="text-xs h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-slate-300"
              >
                Substituir tudo
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAppend}
                className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9"
              >
                Adicionar às existentes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo para Adicionar Nova Empresa Manualmente */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Adicionar Empresa em Dpto. Pessoal - Pesos
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Cadastre o nome da empresa e o respectivo número de funcionários.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddManualRow} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="manualEmpresa" className="text-xs font-semibold text-slate-700">
                  Nome da Empresa *
                </Label>
                <Input
                  id="manualEmpresa"
                  placeholder="Ex: Alfa Transportes Ltda"
                  value={newEmpresaNome}
                  onChange={(e) => setNewEmpresaNome(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manualPessoalCnpj" className="text-xs font-semibold text-slate-700">
                  CNPJ (opcional)
                </Label>
                <Input
                  id="manualPessoalCnpj"
                  placeholder="00.000.000/0000-00"
                  value={newEmpresaCnpj}
                  onChange={(e) => setNewEmpresaCnpj(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manualPessoalZona" className="text-xs font-semibold text-slate-700">
                  ZONA (opcional)
                </Label>
                <Input
                  id="manualPessoalZona"
                  type="text"
                  placeholder="Ex: 01, ZONA NORTE, ZONA 2..."
                  value={newZona}
                  onChange={(e) => setNewZona(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manualNumFunc" className="text-xs font-semibold text-slate-700">
                  Nº de Funcionários
                </Label>
                <Input
                  id="manualNumFunc"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Ex: 25"
                  value={newNumFunc}
                  onChange={(e) => setNewNumFunc(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9"
                >
                  Adicionar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Confirmação: Limpar Tudo */}
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                Limpar registros do Dpto. Pessoal - Pesos?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 pt-1">
                Essa ação removerá todas as {rows.length} empresas e seus respectivos números de
                funcionários desta aba. Essa ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs h-9">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAll}
                className="text-xs h-9 bg-red-600 hover:bg-red-700 text-white"
              >
                Sim, Limpar Tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
