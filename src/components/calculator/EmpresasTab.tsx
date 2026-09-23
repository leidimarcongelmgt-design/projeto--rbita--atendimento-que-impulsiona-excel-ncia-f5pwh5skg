import React, { useState, useRef, useMemo, useEffect } from 'react'
import { EmpresaRow, EMPRESA_COLUMNS, EmpresaColumnKey } from '@/types/empresa'
import { parseEmpresasFile, mergeEmpresas, saveEmpresasToStorage } from '@/lib/empresasService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  FileSpreadsheet,
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
} from 'lucide-react'
import { toast } from 'sonner'

interface EmpresasTabProps {
  empresas: EmpresaRow[]
  onEmpresasChange: (empresas: EmpresaRow[]) => void
}

type SortConfig = {
  key: EmpresaColumnKey
  direction: 'asc' | 'desc'
} | null

export const EmpresasTab: React.FC<EmpresasTabProps> = ({ empresas, onEmpresasChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados de busca e ordenação
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)

  // Estado para diálogo de conflito (quando já existem empresas e o usuário faz novo upload)
  const [pendingFileRows, setPendingFileRows] = useState<{
    rows: EmpresaRow[]
    ignoredRowsCount: number
    unrecognizedColumns: string[]
  } | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)

  // Diálogo para confirmação de "Limpar Tudo"
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  // Mensagem/aviso de pós-importação
  const [lastImportSummary, setLastImportSummary] = useState<{
    added: number
    updated: number
    ignored: number
    unrecognized: string[]
  } | null>(null)

  // Salva no sessionStorage sempre que a lista de empresas mudar
  useEffect(() => {
    saveEmpresasToStorage(empresas)
  }, [empresas])

  // Tratamento do arquivo selecionado
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reseta o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''

    try {
      const parsed = await parseEmpresasFile(file)

      if (parsed.rows.length === 0) {
        toast.error('Nenhum registro válido encontrado na planilha.')
        if (parsed.ignoredRowsCount > 0) {
          toast.warning(
            `${parsed.ignoredRowsCount} linha(s) ignorada(s) por falta de EMPRESAS e CNPJ.`,
          )
        }
        return
      }

      // Se já existem empresas cadastradas, pergunta se quer Substituir ou Adicionar
      if (empresas.length > 0) {
        setPendingFileRows(parsed)
        setConflictDialogOpen(true)
      } else {
        // Importação direta quando a lista está vazia
        applyImport(parsed.rows, 'replace', parsed.ignoredRowsCount, parsed.unrecognizedColumns)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao ler a planilha. Verifique se o formato é .xlsx ou .xls válido.')
    }
  }

  const applyImport = (
    incomingRows: EmpresaRow[],
    mode: 'replace' | 'append',
    ignoredCount = 0,
    unrecognizedCols: string[] = [],
  ) => {
    const result = mergeEmpresas(empresas, incomingRows, mode)
    onEmpresasChange(result.newRecords)

    setLastImportSummary({
      added: result.addedCount,
      updated: result.updatedCount,
      ignored: ignoredCount,
      unrecognized: unrecognizedCols,
    })

    if (mode === 'replace') {
      toast.success(`${result.addedCount} empresa(s) importada(s) com sucesso.`)
    } else {
      let msg = `${result.addedCount} nova(s) empresa(s) adicionada(s)`
      if (result.updatedCount > 0) {
        msg += `, ${result.updatedCount} atualizada(s) por CNPJ existente`
      }
      toast.success(msg + '.')
    }

    if (ignoredCount > 0) {
      toast.warning(`${ignoredCount} linha(s) sem EMPRESAS e CNPJ foram ignoradas.`)
    }
    if (unrecognizedCols.length > 0) {
      toast.info(`Colunas não reconhecidas e descartadas: ${unrecognizedCols.join(', ')}`)
    }

    setPendingFileRows(null)
    setConflictDialogOpen(false)
  }

  // Ações de conflito
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

  // Limpar tudo
  const handleClearAll = () => {
    onEmpresasChange([])
    setLastImportSummary(null)
    setClearDialogOpen(false)
    toast.info('Lista de empresas limpa com sucesso.')
  }

  // Remover linha individual
  const handleDeleteRow = (id: string, empresaNome: string) => {
    const updated = empresas.filter((row) => row.id !== id)
    onEmpresasChange(updated)
    toast.success(`Empresa "${empresaNome || 'Sem Nome'}" removida.`)
  }

  // Alternar ordenação
  const handleSort = (columnKey: EmpresaColumnKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== columnKey) {
        return { key: columnKey, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { key: columnKey, direction: 'desc' }
      }
      return null // desativa ordenação no 3º clique
    })
  }

  // Filtragem e ordenação memoizadas
  const filteredAndSortedEmpresas = useMemo(() => {
    let result = [...empresas]

    // Filtro por texto em tempo real (EMPRESAS ou CNPJ)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const qDigits = q.replace(/\D/g, '')
      result = result.filter((item) => {
        const matchEmpresa = item.empresas.toLowerCase().includes(q)
        const matchCnpj = item.cnpj.toLowerCase().includes(q)
        const matchCnpjDigits = qDigits ? item.cnpj.replace(/\D/g, '').includes(qDigits) : false
        return matchEmpresa || matchCnpj || matchCnpjDigits
      })
    }

    // Ordenação
    if (sortConfig) {
      const { key, direction } = sortConfig
      const colMeta = EMPRESA_COLUMNS.find((c) => c.key === key)
      const isNum = colMeta?.numeric

      result.sort((a, b) => {
        const valA = a[key]
        const valB = b[key]

        if (isNum) {
          const numA =
            typeof valA === 'number' ? valA : parseFloat(String(valA).replace(',', '.')) || 0
          const numB =
            typeof valB === 'number' ? valB : parseFloat(String(valB).replace(',', '.')) || 0
          return direction === 'asc' ? numA - numB : numB - numA
        }

        const strA = (valA ?? '').toString().toLowerCase()
        const strB = (valB ?? '').toString().toLowerCase()
        const cmp = strA.localeCompare(strB, 'pt-BR', { numeric: true })
        return direction === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [empresas, searchQuery, sortConfig])

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Card Principal: Importação e Gerenciamento */}
        <Card className="border border-slate-200 card-shadow bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#1E3A5F]" />
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Importação de Empresas
                  </CardTitle>
                </div>
                <CardDescription className="text-slate-500 mt-1">
                  Importe planilhas Excel (.xlsx ou .xls) com as 12 colunas padrão (EMPRESAS, CNPJ,
                  REGIME TRIB., RAMO DE ATIVIDADE 2, ZONA, Nº FUNC., PESO, FILIAL, CONTÁBIL,
                  ENTRADA, GRUPO, PESO).
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

                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 px-4 gap-2 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importar Planilha (XLSX)</span>
                </Button>

                {empresas.length > 0 && (
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
            {/* Banner com cabeçalho de referência visual inspirado na imagem enviada */}
            <div className="rounded-lg border border-purple-900/20 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-900" />
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Estrutura esperada do cabeçalho da planilha
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Duas colunas PESO mapeadas posicionalmente: PESO e PESO (2)
                </span>
              </div>

              {/* Representação visual do cabeçalho (cores roxas como na imagem anexada) */}
              <div className="overflow-x-auto pb-1">
                <div className="inline-flex min-w-full text-[11px] font-bold text-white tracking-wider rounded overflow-hidden shadow-xs border border-purple-950">
                  {EMPRESA_COLUMNS.map((col, idx) => (
                    <div
                      key={col.key}
                      className={`bg-[#380638] px-3 py-2 whitespace-nowrap text-center ${
                        idx < EMPRESA_COLUMNS.length - 1 ? 'border-r border-purple-950/40' : ''
                      }`}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alerta de Resumo da Última Importação */}
            {lastImportSummary && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      Importação processada: {lastImportSummary.added} registro(s) adicionado(s)
                      {lastImportSummary.updated > 0 &&
                        `, ${lastImportSummary.updated} atualizado(s) por CNPJ`}
                      .
                    </p>
                    {lastImportSummary.ignored > 0 && (
                      <p className="text-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {lastImportSummary.ignored} linha(s) ignorada(s) por ausência de EMPRESAS e
                        CNPJ.
                      </p>
                    )}
                    {lastImportSummary.unrecognized.length > 0 && (
                      <p className="text-slate-500">
                        Colunas não mapeadas descartadas:{' '}
                        <span className="font-mono text-slate-700">
                          {lastImportSummary.unrecognized.join(', ')}
                        </span>
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

            {/* Barra de Busca e Contador */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Filtrar por EMPRESAS ou CNPJ..."
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
                  {empresas.length}{' '}
                  {empresas.length === 1 ? 'empresa importada' : 'empresas importadas'}
                </Badge>
                {searchQuery && (
                  <span className="text-slate-500">
                    ({filteredAndSortedEmpresas.length} exibida
                    {filteredAndSortedEmpresas.length === 1 ? '' : 's'})
                  </span>
                )}
              </div>
            </div>

            {/* Tabela com as 12 Colunas */}
            {empresas.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-12 text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-slate-200/80 flex items-center justify-center mx-auto mb-3 text-slate-500">
                  <Building className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Nenhuma empresa importada</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                  Clique no botão abaixo para carregar uma planilha Excel com as colunas EMPRESAS,
                  CNPJ, REGIME TRIB., RAMO DE ATIVIDADE 2, ZONA, Nº FUNC., PESO, FILIAL, CONTÁBIL,
                  ENTRADA, GRUPO e PESO.
                </p>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 px-4 gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Selecionar Planilha (.xlsx, .xls)</span>
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#380638] text-white select-none">
                        <th className="py-2.5 px-3 font-semibold text-center w-12 border-r border-purple-950/40">
                          #
                        </th>
                        {EMPRESA_COLUMNS.map((col) => {
                          const isSorted = sortConfig?.key === col.key
                          return (
                            <th
                              key={col.key}
                              onClick={() => handleSort(col.key)}
                              className={`py-2.5 px-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-purple-900/60 transition-colors border-r border-purple-950/40 whitespace-nowrap ${
                                col.numeric ? 'text-right' : 'text-left'
                              }`}
                              title={col.tooltip || `Clique para ordenar por ${col.label}`}
                            >
                              <div
                                className={`inline-flex items-center gap-1.5 ${
                                  col.numeric ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                <span>{col.label}</span>
                                {isSorted ? (
                                  sortConfig.direction === 'asc' ? (
                                    <ArrowUp className="w-3.5 h-3.5 text-yellow-300" />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5 text-yellow-300" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 text-purple-300 opacity-60" />
                                )}
                              </div>
                            </th>
                          )
                        })}
                        <th className="py-2.5 px-3 font-semibold text-center w-12">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredAndSortedEmpresas.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="py-8 text-center text-slate-500">
                            Nenhum registro encontrado para o filtro "{searchQuery}".
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedEmpresas.map((empresa, index) => (
                          <tr
                            key={empresa.id}
                            className="hover:bg-slate-50 transition-colors group"
                          >
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                              {index + 1}
                            </td>
                            <td
                              className="py-2.5 px-3 font-medium text-slate-900 border-r border-slate-100 whitespace-nowrap max-w-[220px] truncate"
                              title={empresa.empresas}
                            >
                              {empresa.empresas || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {empresa.cnpj || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {empresa.regimeTrib || '—'}
                            </td>
                            <td
                              className="py-2.5 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap max-w-[180px] truncate"
                              title={empresa.ramoAtividade}
                            >
                              {empresa.ramoAtividade || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {empresa.zona || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap">
                              {empresa.numFunc !== '' ? empresa.numFunc : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap">
                              {empresa.peso1 !== '' ? empresa.peso1 : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {empresa.filial || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {empresa.contabil || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {empresa.entrada || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {empresa.grupo || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap">
                              {empresa.peso2 !== '' ? empresa.peso2 : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRow(empresa.id, empresa.empresas)}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <span>Remover empresa</span>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diálogo de Conflito de Importação (Substituir vs Adicionar) */}
        <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Como deseja importar a nova planilha?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Já existem {empresas.length} empresa(s) cadastradas. A nova planilha contém{' '}
                {pendingFileRows?.rows.length ?? 0} empresa(s) válidas.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 text-xs text-slate-600 space-y-2">
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">Substituir tudo</span>
                Apaga os registros atuais e mantém apenas os {pendingFileRows?.rows.length ??
                  0}{' '}
                novos registros da planilha.
              </div>
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">
                  Adicionar às existentes
                </span>
                Acrescenta os novos registros. Caso um CNPJ já exista na tabela, a linha existente
                será atualizada com os novos dados sem duplicar.
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

        {/* Diálogo de Confirmação: Limpar Tudo */}
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                Tem certeza que deseja limpar todas as empresas?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 pt-1">
                Essa ação removerá todas as {empresas.length} empresas importadas nesta sessão. Essa
                ação não poderá ser desfeita.
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
