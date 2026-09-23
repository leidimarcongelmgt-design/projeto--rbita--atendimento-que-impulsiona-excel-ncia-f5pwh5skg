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

  const handleConfirmImport = () => {
    if (!importResult) return

    onImport(importResult.patch)
    setIsDialogOpen(false)

    const count = importResult.recognized.length
    toast.success(
      `${count} ${count === 1 ? 'campo importado' : 'campos importados'} com sucesso! Os valores e a URL foram atualizados.`,
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

            {/* Lista de Campos Reconhecidos */}
            {importResult && importResult.recognized.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Campos Reconhecidos ({importResult.recognized.length})
                  </h4>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs"
                  >
                    Prontos para importação
                  </Badge>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 bg-white">
                  {importResult.recognized.map((item: RecognizedItem) => (
                    <div
                      key={item.key}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{item.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {item.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Identificado por: &ldquo;
                          <span className="font-medium text-slate-700">{item.originalHeader}</span>
                          &rdquo;
                        </div>
                      </div>

                      <div className="text-right font-mono font-bold text-slate-900 text-sm">
                        {item.displayFormatted}
                      </div>
                    </div>
                  ))}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="text-xs text-slate-600 border-slate-300 hover:bg-slate-200/60 inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Modelo de Exemplo (.xlsx)
            </Button>

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
                className="bg-[#1E3A5F] hover:bg-[#152A45] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar e Aplicar no Dossiê
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
