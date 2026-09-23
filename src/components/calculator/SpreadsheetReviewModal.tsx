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
import {
  SpreadsheetParseResult,
  SpreadsheetExtractedField,
  ALLOWED_SPREADSHEET_KEYS,
} from '@/lib/spreadsheetParser'
import { CalculatorState } from '@/types/calculator'
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Building,
  UserCheck,
  Users,
} from 'lucide-react'

interface SpreadsheetReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parseResult: SpreadsheetParseResult | null
  onApply: (selectedData: Partial<CalculatorState>) => void
  isLoading?: boolean
}

export const SpreadsheetReviewModal: React.FC<SpreadsheetReviewModalProps> = ({
  open,
  onOpenChange,
  parseResult,
  onApply,
  isLoading = false,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  // Inicia com todos os campos reconhecidos marcados por padrão
  useEffect(() => {
    if (parseResult && parseResult.fields.length > 0) {
      const initial: Record<string, boolean> = {}
      parseResult.fields.forEach((f) => {
        initial[f.key] = true
      })
      setSelectedKeys(initial)
    } else {
      setSelectedKeys({})
    }
  }, [parseResult])

  const fields = (parseResult?.fields || []).filter((f) => ALLOWED_SPREADSHEET_KEYS.has(f.key))
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
      if (selectedKeys[f.key] && ALLOWED_SPREADSHEET_KEYS.has(f.key)) {
        let val = f.value
        // Limpeza básica
        if (typeof val === 'string') {
          val = val.trim()
        }
        ;(patch as Record<string, string>)[f.key] = val
      }
    })
    onApply(patch)
    onOpenChange(false)
  }

  // Agrupamento por categorias
  const emissorFields = fields.filter((f) => f.category === 'emissor')
  const clienteFields = fields.filter((f) => f.category === 'cliente')
  const contatoFields = fields.filter((f) => f.category === 'contato')

  const renderFieldCard = (field: SpreadsheetExtractedField) => {
    const isChecked = !!selectedKeys[field.key]
    return (
      <div
        key={field.key}
        onClick={() => toggleField(field.key)}
        className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
          isChecked
            ? 'border-emerald-300 bg-emerald-50/20 shadow-2xs'
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
              <span className="text-xs font-semibold text-slate-800">{field.label}</span>
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
                  className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  Planilha
                </Badge>
              </div>
            </div>

            {/* Valor a ser aplicado */}
            <div className="text-sm font-semibold text-[#1E3A5F] break-words">{field.value}</div>

            {/* Comparação com Atual se houver */}
            {field.currentValue && field.isDifferent && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                <span className="line-through text-slate-400">{field.currentValue}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="font-medium text-emerald-700">{field.value}</span>
              </div>
            )}

            {/* Origem na planilha */}
            {field.sourceLocation && (
              <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono break-words">
                <span className="font-semibold text-slate-600 font-sans mr-1">
                  Origem na planilha:
                </span>
                {field.sourceLocation}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-slate-900 border-slate-200">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/40">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Importar Dados da Planilha (XLSX / XLS)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600">
            {parseResult?.fileName ? (
              <span>
                Arquivo: <strong>{parseResult.fileName}</strong> • Verifique todos os campos
                encontrados na planilha antes de aplicá-los ao dossiê.
              </span>
            ) : (
              'Verifique todos os campos encontrados na planilha antes de aplicá-los ao dossiê.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-800">Lendo conteúdo da planilha...</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Interpretando colunas e linhas para identificar dados do emissor, cliente e
                contatos.
              </p>
            </div>
          )}

          {/* Avisos */}
          {!isLoading && parseResult?.warnings && parseResult.warnings.length > 0 && (
            <div className="space-y-2">
              {parseResult.warnings.map((warn, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 flex items-start gap-2 text-xs ${
                    warn.type === 'warning'
                      ? 'border-amber-200 bg-amber-50/60 text-amber-800'
                      : 'border-blue-200 bg-blue-50/60 text-blue-800'
                  }`}
                >
                  {warn.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  )}
                  <span>{warn.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Nenhum campo reconhecido */}
          {!isLoading && fields.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center space-y-2">
              <Info className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-800">
                Nenhum campo reconhecido na planilha
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Não foram localizados cabeçalhos ou linhas correspondentes aos dados cadastrais
                (Razão Social, CNPJ, IE, IM, Ramo de Atividade, Endereço ou Contatos).
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                Dica: Certifique-se de que a planilha possui cabeçalhos como "Razão Social", "CNPJ",
                "Telefone Financeiro", etc. tanto no formato horizontal quanto vertical.
              </p>
            </div>
          )}

          {/* Lista de campos por seção */}
          {!isLoading && fields.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {fields.length} {fields.length === 1 ? 'campo detectado' : 'campos detectados'}:
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-800">
                    {selectedCount} selecionado(s)
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs h-7 text-emerald-700 hover:text-emerald-800"
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

              {/* 1. Emissor */}
              {emissorFields.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Building className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>Dados do Emissor (Aba Identificação)</span>
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {emissorFields.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">{emissorFields.map(renderFieldCard)}</div>
                </div>
              )}

              {/* 2. Cliente */}
              {clienteFields.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <UserCheck className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>Dados Cadastrais do Cliente (Aba Cliente)</span>
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {clienteFields.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">{clienteFields.map(renderFieldCard)}</div>
                </div>
              )}

              {/* 3. Contatos */}
              {contatoFields.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Users className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>Contatos do Cliente (Financeiro, Estoque, RH, Representante)</span>
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {contatoFields.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">{contatoFields.map(renderFieldCard)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 w-full sm:w-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Processado 100% no seu navegador sem envio a servidores externos.</span>
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
                disabled={selectedCount === 0 || isLoading}
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
