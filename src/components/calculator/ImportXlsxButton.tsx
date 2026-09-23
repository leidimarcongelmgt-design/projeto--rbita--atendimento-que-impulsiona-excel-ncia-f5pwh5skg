import React, { useRef, useState } from 'react'
import { CalculatorState } from '@/types/calculator'
import { parseExcelFile, ParseSpreadsheetResult, RecognizedItem } from '@/lib/xlsxParser'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  Loader2,
  ArrowRight,
  Download,
  CheckSquare,
  Square,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface ImportXlsxButtonProps {
  onImport: (patch: Partial<CalculatorState>) => void
  variant?: 'prominent' | 'discrete'
  className?: string
}

export const ImportXlsxButton: React.FC<ImportXlsxButtonProps> = ({
  onImport,
  variant = 'prominent',
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [importResult, setImportResult] = useState<ParseSpreadsheetResult | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentFileName, setCurrentFileName] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  // Lista de categorias presentes nos itens reconhecidos
  const recognizedCategories = React.useMemo(() => {
    if (!importResult) return []
    const catMap = new Map<string, RecognizedItem[]>()
    importResult.recognized.forEach((item) => {
      const list = catMap.get(item.category) || []
      list.push(item)
      catMap.set(item.category, list)
    })
    return Array.from(catMap.entries()).map(([name, items]) => ({
      name,
      items,
      selectedCount: items.filter((it) => selectedKeys.has(it.key)).length,
      totalCount: items.length,
    }))
  }, [importResult, selectedKeys])

  const totalRecognized = importResult?.recognized.length || 0
  const selectedCount = selectedKeys.size

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCurrentFileName(file.name)
    setIsLoading(true)

    try {
      const result = await parseExcelFile(file)
      setIsLoading(false)

      if (result.recognized.length === 0) {
        toast.error(
          'Nenhum campo reconhecido na planilha. Verifique se os nomes das colunas ou linhas correspondem aos termos contábeis esperados.',
          { duration: 5000 },
        )
        return
      }

      setImportResult(result)
      // Seleciona todos os campos reconhecidos por padrão
      setSelectedKeys(new Set(result.recognized.map((item) => item.key)))
      setIsDialogOpen(true)
    } catch (err: unknown) {
      setIsLoading(false)
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Falha ao processar o arquivo XLSX. Verifique se o arquivo não está corrompido.'
      toast.error(errorMsg, { duration: 5000 })
    }
  }

  // Alternar campo individual
  const toggleField = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Marcar todos os campos
  const selectAll = () => {
    if (!importResult) return
    setSelectedKeys(new Set(importResult.recognized.map((item) => item.key)))
  }

  // Desmarcar todos os campos
  const deselectAll = () => {
    setSelectedKeys(new Set())
  }

  // Marcar todos de uma categoria específica
  const selectCategory = (category: string) => {
    if (!importResult) return
    const catKeys = importResult.recognized
      .filter((item) => item.category === category)
      .map((item) => item.key)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      catKeys.forEach((k) => next.add(k))
      return next
    })
  }

  // Desmarcar todos de uma categoria específica
  const deselectCategory = (category: string) => {
    if (!importResult) return
    const catKeys = importResult.recognized
      .filter((item) => item.category === category)
      .map((item) => item.key)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      catKeys.forEach((k) => next.delete(k))
      return next
    })
  }

  // Alternar todos de uma categoria específica
  const toggleCategory = (category: string) => {
    if (!importResult) return
    const catItems = importResult.recognized.filter((item) => item.category === category)
    const allSelected = catItems.every((item) => selectedKeys.has(item.key))
    if (allSelected) {
      deselectCategory(category)
    } else {
      selectCategory(category)
    }
  }

  const handleConfirmImport = () => {
    if (!importResult) return

    // Constrói o patch filtrando apenas as chaves selecionadas
    const filteredPatch: Partial<CalculatorState> = {}
    let importedCount = 0

    for (const item of importResult.recognized) {
      if (selectedKeys.has(item.key)) {
        // Atribui ao patch o valor correspondente
        ;(filteredPatch as Record<string, unknown>)[item.key] = importResult.patch[item.key]
        importedCount++
      }
    }

    if (importedCount === 0) {
      toast.warning('Selecione pelo menos um campo para importar.')
      return
    }

    onImport(filteredPatch)
    setIsDialogOpen(false)

    toast.success(
      `${importedCount} ${importedCount === 1 ? 'campo importado' : 'campos importados'} com sucesso! Os valores e a URL foram atualizados.`,
      { duration: 4500 },
    )
    setImportResult(null)
  }

  const handleDownloadTemplate = () => {
    try {
      // Cria planilha modelo tanto em formato horizontal quanto vertical
      const wb = XLSX.utils.book_new()

      // Modelo Horizontal
      const wsDataHorizontal = [
        [
          'Receita Bruta',
          'Deduções',
          'CMV',
          'Despesas Administrativas',
          'Resultado Financeiro',
          'Base de Cálculo Tributos',
          'Alíquota Tributos (%)',
          'Salários Base',
          'INSS Patronal (%)',
          'FGTS (%)',
          'Outros Encargos',
        ],
        [150000.0, 15000.0, 60000.0, 20000.0, 1500.0, 55000.0, 15.0, 25000.0, 20.0, 8.0, 1200.0],
      ]
      const wsHorizontal = XLSX.utils.aoa_to_sheet(wsDataHorizontal)
      XLSX.utils.book_append_sheet(wb, wsHorizontal, 'Modelo Horizontal')

      // Modelo Vertical
      const wsDataVertical = [
        ['Campo', 'Valor'],
        ['Receita Bruta', 150000.0],
        ['Deduções', 15000.0],
        ['CMV', 60000.0],
        ['Despesas Administrativas', 20000.0],
        ['Resultado Financeiro', 1500.0],
        ['Base de Cálculo Tributos', 55000.0],
        ['Alíquota Tributos (%)', 15.0],
        ['Salários Base', 25000.0],
        ['INSS Patronal (%)', 20.0],
        ['FGTS (%)', 8.0],
        ['Outros Encargos', 1200.0],
      ]
      const wsVertical = XLSX.utils.aoa_to_sheet(wsDataVertical)
      XLSX.utils.book_append_sheet(wb, wsVertical, 'Modelo Vertical')

      XLSX.writeFile(wb, 'modelo_dossie_financeiro.xlsx')
      toast.success('Modelo de planilha XLSX baixado!')
    } catch {
      toast.error('Não foi possível gerar a planilha modelo.')
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleFileChange}
      />

      {variant === 'prominent' ? (
        <Button
          type="button"
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`bg-[#1E3A5F] hover:bg-[#152A45] text-white shadow-sm font-semibold flex items-center gap-2 transition-all ${className}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Lendo Planilha...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Importar Planilha (XLSX)</span>
            </>
          )}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-xs flex items-center gap-1.5 h-8 ${className}`}
          title="Importar dados de planilha Excel (.xlsx)"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>Importar XLSX</span>
        </Button>
      )}

      {/* Modal de Confirmação e Resumo dos Dados Importados */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Revisar Importação de Planilha
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Arquivo: <strong>{currentFileName}</strong> (aba &ldquo;
                  {importResult?.sheetName}&rdquo; &bull; formato{' '}
                  {importResult?.orientation === 'vertical' ? 'vertical' : 'horizontal'})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Aviso de Não Sobrescrição */}
            <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Regra de Segurança de Dados:</p>
                <p className="text-blue-800 mt-0.5">
                  Apenas os campos reconhecidos abaixo serão atualizados. Qualquer outro campo que
                  já esteja preenchido no seu dossiê permanecerá intacto. Os cálculos automáticos
                  ativos continuarão funcionando normalmente.
                </p>
              </div>
            </div>

            {/* Lista de Campos Reconhecidos e Seleção */}
            {importResult && importResult.recognized.length > 0 && (
              <div className="space-y-3">
                {/* Cabeçalho da Seção com Atalhos em Bloco */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Escolha os dados a importar
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Selecione individualmente ou use os atalhos por categoria abaixo
                    </p>
                  </div>

                  {/* Atalhos Rápidos Gerais */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAll}
                      disabled={selectedCount === totalRecognized}
                      className="h-7 text-[11px] px-2.5 py-0 text-slate-700 border-slate-300 hover:bg-slate-100"
                    >
                      <CheckSquare className="w-3 h-3 mr-1 text-emerald-600" />
                      Marcar todos ({totalRecognized})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectAll}
                      disabled={selectedCount === 0}
                      className="h-7 text-[11px] px-2.5 py-0 text-slate-700 border-slate-300 hover:bg-slate-100"
                    >
                      <Square className="w-3 h-3 mr-1 text-slate-400" />
                      Desmarcar todos
                    </Button>
                  </div>
                </div>

                {/* Filtros / Atalhos por Categoria */}
                <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-100/70 rounded-lg border border-slate-200/80 text-xs">
                  <span className="text-[11px] font-semibold text-slate-600 mr-1">
                    Por Categoria:
                  </span>
                  {recognizedCategories.map((cat) => {
                    const isAllSelected = cat.selectedCount === cat.totalCount
                    const isNoneSelected = cat.selectedCount === 0

                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => toggleCategory(cat.name)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                          isAllSelected
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : isNoneSelected
                              ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                        }`}
                        title={`Clique para ${isAllSelected ? 'desmarcar' : 'marcar'} todos da categoria ${cat.name}`}
                      >
                        <Checkbox
                          checked={isAllSelected ? true : isNoneSelected ? false : 'indeterminate'}
                          className="h-3 w-3 pointer-events-none"
                        />
                        <span>{cat.name}</span>
                        <span className="font-mono text-[10px] opacity-75">
                          ({cat.selectedCount}/{cat.totalCount})
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Lista agrupada por categoria */}
                <div className="space-y-3">
                  {recognizedCategories.map((cat) => {
                    const isAllSelected = cat.selectedCount === cat.totalCount

                    return (
                      <div
                        key={cat.name}
                        className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs"
                      >
                        {/* Cabeçalho do Grupo Clicável */}
                        <div
                          onClick={() => toggleCategory(cat.name)}
                          className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={
                                isAllSelected
                                  ? true
                                  : cat.selectedCount === 0
                                    ? false
                                    : 'indeterminate'
                              }
                              onCheckedChange={() => toggleCategory(cat.name)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                          </div>

                          <span className="text-[11px] text-slate-500 font-medium">
                            {cat.selectedCount} de {cat.totalCount} selecionado
                            {cat.totalCount > 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Itens do Grupo com Checkbox Individual */}
                        <div className="divide-y divide-slate-100">
                          {cat.items.map((item: RecognizedItem) => {
                            const isChecked = selectedKeys.has(item.key)

                            return (
                              <label
                                key={item.key}
                                htmlFor={`field-${item.key}`}
                                className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-white hover:bg-slate-50/80'
                                    : 'bg-slate-50/40 text-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    id={`field-${item.key}`}
                                    checked={isChecked}
                                    onCheckedChange={() => toggleField(item.key)}
                                    className="mt-0.5 h-4 w-4"
                                  />
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-semibold ${
                                          isChecked
                                            ? 'text-slate-900'
                                            : 'text-slate-500 line-through'
                                        }`}
                                      >
                                        {item.label}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Identificado por: &ldquo;
                                      <span className="font-medium text-slate-700">
                                        {item.originalHeader}
                                      </span>
                                      &rdquo;
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className={`text-right font-mono font-bold text-sm tabular-nums self-end sm:self-auto ${
                                    isChecked ? 'text-slate-900' : 'text-slate-400'
                                  }`}
                                >
                                  {item.displayFormatted}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Alertas de Campos Ignorados / Duplicados */}
            {importResult && importResult.ignored.length > 0 && (
              <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Avisos de Valores Ignorados ({importResult.ignored.length})</span>
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-amber-800">
                  {importResult.ignored.map((ig, idx) => (
                    <li key={idx}>
                      <strong>{ig.source}</strong>: {ig.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cabeçalhos não mapeados */}
            {importResult && importResult.unrecognizedHeaders.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 mb-1">
                  <FileQuestion className="w-3.5 h-3.5 text-slate-500" />
                  <span>Colunas/linhas não reconhecidas (ignoradas):</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {importResult.unrecognizedHeaders.slice(0, 10).join(', ')}
                  {importResult.unrecognizedHeaders.length > 10
                    ? ` e mais ${importResult.unrecognizedHeaders.length - 10}...`
                    : ''}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-xs text-slate-600 border-slate-300 hover:bg-slate-200/60 inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Modelo (.xlsx)
              </Button>

              {/* Resumo dinâmico no rodapé */}
              {importResult && (
                <div className="text-xs text-slate-600 font-medium">
                  <span
                    className={
                      selectedCount === 0
                        ? 'text-rose-600 font-bold'
                        : selectedCount === totalRecognized
                          ? 'text-emerald-700 font-bold'
                          : 'text-[#1E3A5F] font-bold'
                    }
                  >
                    {selectedCount} de {totalRecognized}
                  </span>{' '}
                  {totalRecognized === 1
                    ? 'campo será importado'
                    : selectedCount === 1
                      ? 'campo será importado'
                      : 'campos serão importados'}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="text-xs text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                className="bg-[#1E3A5F] hover:bg-[#152A45] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  selectedCount === 0
                    ? 'Selecione pelo menos um campo para importar'
                    : 'Aplicar campos selecionados ao dossiê'
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar e Aplicar ({selectedCount})</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
