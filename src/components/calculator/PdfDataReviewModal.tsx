import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ClientExtractionResult, ExtractedField } from '@/lib/clientDataParser'
import { CalculatorState } from '@/types/calculator'
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileSearch,
} from 'lucide-react'

interface PdfDataReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  extractionResult: ClientExtractionResult | null
  onApply: (selectedData: Partial<CalculatorState>) => void
  isExtracting?: boolean
  pdfName?: string
  onRequestPassword?: () => void
  documentLabel?: string
}

export const PdfDataReviewModal: React.FC<PdfDataReviewModalProps> = ({
  open,
  onOpenChange,
  extractionResult,
  onApply,
  isExtracting = false,
  pdfName,
  onRequestPassword,
  documentLabel,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  // Initialize all detected fields as selected by default whenever a new result arrives
  useEffect(() => {
    if (extractionResult && extractionResult.fields.length > 0) {
      const initial: Record<string, boolean> = {}
      extractionResult.fields.forEach((f) => {
        initial[f.key] = true
      })
      setSelectedKeys(initial)
    } else {
      setSelectedKeys({})
    }
  }, [extractionResult])

  const fields = extractionResult?.fields || []
  const selectedCount = Object.values(selectedKeys).filter(Boolean).length

  const handleSelectAll = () => {
    const updated: Record<string, boolean> = {}
    fields.forEach((f) => {
      updated[f.key] = true
    })
    setSelectedKeys(updated)
  }

  const handleDeselectAll = () => {
    const updated: Record<string, boolean> = {}
    fields.forEach((f) => {
      updated[f.key] = false
    })
    setSelectedKeys(updated)
  }

  const toggleField = (key: string) => {
    setSelectedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleConfirm = () => {
    const patch: Partial<CalculatorState> = {}
    fields.forEach((f) => {
      if (selectedKeys[f.key]) {
        let val = f.value
        // Garantia de segurança adicional: se for o campo clienteNome ou clienteRamo, aplicar trim
        if (f.key === 'clienteNome' || f.key === 'clienteRamo') {
          val = val.trim()
        }
        ;(patch as Record<string, string>)[f.key] = val
      }
    })
    onApply(patch)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-slate-900 border-slate-200">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/40">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#1E3A5F]/10 flex items-center justify-center text-[#1E3A5F]">
              <Sparkles className="w-4 h-4 text-[#1E3A5F]" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Revisão de Dados Extraídos do PDF
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600">
            {pdfName ? (
              <span>
                {documentLabel ? <strong>{documentLabel}</strong> : 'Documento'}:{' '}
                <strong>{pdfName}</strong> • Verifique as informações encontradas antes de aplicar
                ao dossiê.
              </span>
            ) : (
              documentLabel || 'Verifique as informações encontradas antes de aplicar ao dossiê.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Loading State */}
          {isExtracting && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-[#1E3A5F] rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-800">
                Processando e extraindo dados do cliente...
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Lendo o texto do documento e identificando CNPJ, razão social, endereço e emissão.
              </p>
            </div>
          )}

          {/* Error / Password Protected State */}
          {!isExtracting && extractionResult?.errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-900">
                  {extractionResult.isPasswordProtected
                    ? 'Arquivo PDF protegido por senha'
                    : 'Atenção ao abrir o PDF'}
                </h4>
                <p className="text-xs text-red-700 mt-1">{extractionResult.errorMessage}</p>

                {extractionResult.isPasswordProtected && onRequestPassword && (
                  <div className="mt-3 pt-2 border-t border-red-200/60">
                    <Button
                      type="button"
                      size="sm"
                      onClick={onRequestPassword}
                      className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-8 gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Digitar Senha e Desbloquear
                    </Button>
                  </div>
                )}

                {!extractionResult.isPasswordProtected && (
                  <p className="text-xs text-slate-500 mt-2">
                    Dica: Verifique o arquivo enviado ou preencha os campos cadastrais do cliente
                    manualmente.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No Text Layer / Scanned Image warning */}
          {!isExtracting &&
            !extractionResult?.errorMessage &&
            !extractionResult?.hasTextLayer &&
            fields.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 text-center space-y-2">
                <FileSearch className="w-8 h-8 text-amber-600 mx-auto" />
                <h4 className="text-sm font-semibold text-amber-900">
                  PDF sem camada de texto identificável
                </h4>
                <p className="text-xs text-amber-700 max-w-md mx-auto">
                  Este PDF aparenta ser uma imagem escaneada ou digitalizada sem camada de texto
                  OCR. Não foi possível ler os caracteres para preenchimento automático.
                </p>
                <div className="pt-2 text-xs text-slate-500">
                  Você pode continuar usando o PDF anexado para consulta e preencher os campos do
                  cliente manualmente.
                </div>
              </div>
            )}

          {/* Text found, but zero client fields detected */}
          {!isExtracting &&
            !extractionResult?.errorMessage &&
            extractionResult?.hasTextLayer &&
            fields.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center space-y-2">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-800">
                  Dado não encontrado no documento
                </h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  {extractionResult.docType === 'cnpj'
                    ? 'O texto do documento foi lido, mas não foi possível identificar o número do CNPJ ou Razão Social deste cliente.'
                    : extractionResult.docType === 'ie'
                      ? 'O texto do documento foi lido, mas não foi possível identificar o número da Inscrição Estadual (IE) deste cliente.'
                      : extractionResult.docType === 'im'
                        ? 'O texto do documento foi lido, mas não foi possível identificar o número da Inscrição Municipal (IM/CCM) deste cliente.'
                        : `O texto do documento foi lido (${extractionResult.totalPages} ${
                            extractionResult.totalPages === 1 ? 'página' : 'páginas'
                          }), porém nenhum padrão claro de cliente brasileiro foi encontrado com segurança.`}
                </p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Nenhum campo será alterado no seu dossiê. Você pode preencher manualmente na aba
                  Cliente ou enviar outro documento.
                </p>
              </div>
            )}

          {/* Fields List */}
          {!isExtracting && fields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {fields.length} {fields.length === 1 ? 'campo detectado' : 'campos detectados'}:
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                    {selectedCount} selecionado(s)
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs h-7 text-blue-600 hover:text-blue-700"
                  >
                    Marcar todos
                  </Button>
                  <span className="text-slate-300">|</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    className="text-xs h-7 text-slate-500 hover:text-slate-700"
                  >
                    Desmarcar todos
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                {fields.map((field: ExtractedField) => {
                  const isChecked = !!selectedKeys[field.key]
                  return (
                    <div
                      key={field.key}
                      onClick={() => toggleField(field.key)}
                      className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-blue-200 bg-blue-50/20 shadow-2xs'
                          : 'border-slate-200 bg-white opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`field-${field.key}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleField(field.key)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <span className="text-xs font-semibold text-slate-800">
                              {field.label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {field.isDifferent && field.currentValue && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-300 bg-amber-50 text-amber-800"
                                >
                                  Substituirá valor atual
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  field.confidence === 'high'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                                }`}
                              >
                                {field.confidence === 'high' ? 'Alta precisão' : 'Detectado'}
                              </Badge>
                            </div>
                          </div>

                          {/* Valor Detectado */}
                          <div className="text-sm font-semibold text-[#1E3A5F] break-words">
                            {field.value}
                          </div>

                          {/* Comparação com Atual se houver */}
                          {field.currentValue && field.isDifferent && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                              <span className="line-through text-slate-400">
                                {field.currentValue}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="font-medium text-blue-700">{field.value}</span>
                            </div>
                          )}

                          {/* Snippet / Contexto */}
                          {field.snippet && (
                            <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono break-words">
                              <span className="font-semibold text-slate-600 font-sans mr-1">
                                Origem no texto:
                              </span>
                              "{field.snippet}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 w-full sm:w-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Processado localmente no navegador sem envio a servidores.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9 text-slate-600"
            >
              Cancelar
            </Button>
            {fields.length > 0 && (
              <Button
                type="button"
                size="sm"
                disabled={selectedCount === 0 || isExtracting}
                onClick={handleConfirm}
                className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 gap-1.5 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmar e Aplicar ({selectedCount})
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
