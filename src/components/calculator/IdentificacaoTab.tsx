import React, { useRef } from 'react'
import { CalculatorState } from '@/types/calculator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Building2,
  Calendar,
  ArrowRight,
  UserCheck,
} from 'lucide-react'

interface IdentificacaoTabProps {
  state: CalculatorState
  onChange: (patch: Partial<CalculatorState>) => void
  onNavigateTab: (tab: CalculatorState['tab']) => void
  onGenerateDocument: () => void
}

export const IdentificacaoTab: React.FC<IdentificacaoTabProps> = ({
  state,
  onChange,
  onNavigateTab,
  onGenerateDocument,
}) => {
  const companyFileRef = useRef<HTMLInputElement>(null)

  // Compress & resize image to data URL to preserve URL length
  const handleImageUpload = (
    file: File,
    maxWidth: number,
    onSuccess: (dataUrl: string, originalWidth: number, originalHeight: number) => void,
  ) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        // scale down if wider than maxWidth
        if (width > maxWidth) {
          const ratio = maxWidth / width
          width = maxWidth
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          // Use compressed PNG / JPEG
          const compressedData = canvas.toDataURL('image/png', 0.85)
          onSuccess(compressedData, width, height)
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Handle Logo Emissor
  const onUploadLogoEmissor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleImageUpload(file, 800, (dataUrl, w, h) => {
      onChange({
        logoData: dataUrl,
        logoWidth: w,
        logoHeight: h,
      })
    })
  }

  const handleLogoWidthChange = (newWidth: number) => {
    if (state.logoRatio === 1 && state.logoWidth > 0 && state.logoHeight > 0) {
      const ratio = state.logoHeight / state.logoWidth
      onChange({
        logoWidth: newWidth,
        logoHeight: Math.round(newWidth * ratio),
      })
    } else {
      onChange({ logoWidth: newWidth })
    }
  }

  const handleLogoHeightChange = (newHeight: number) => {
    if (state.logoRatio === 1 && state.logoWidth > 0 && state.logoHeight > 0) {
      const ratio = state.logoWidth / state.logoHeight
      onChange({
        logoHeight: newHeight,
        logoWidth: Math.round(newHeight * ratio),
      })
    } else {
      onChange({ logoHeight: newHeight })
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* SEÇÃO 1: DADOS DO EMISSOR */}
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#1E3A5F]" />
            <CardTitle className="text-lg font-bold text-slate-900">
              Logo e Dados do Emissor (Sua Empresa)
            </CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Identificação da empresa emitente utilizada nos relatórios e visualizações geradas.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Logo Upload + Controls */}
          <div className="rounded-lg border border-dashed border-slate-300 p-5 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <Label className="text-sm font-semibold text-slate-800">Logo da Empresa</Label>
                <p className="text-xs text-slate-500">
                  Formatos aceitos: PNG, JPG ou SVG (máx. 800px)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ logoControls: state.logoControls === 1 ? 0 : 1 })}
                  className="text-xs h-8 text-slate-600 gap-1.5"
                >
                  {state.logoControls === 1 ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Ocultar controles
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Ajustar dimensões
                    </>
                  )}
                </Button>

                {state.logoData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ logoData: '' })}
                    className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </Button>
                )}

                <input
                  ref={companyFileRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml"
                  className="hidden"
                  onChange={onUploadLogoEmissor}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => companyFileRef.current?.click()}
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-8 gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {state.logoData ? 'Substituir' : 'Enviar Logo'}
                </Button>
              </div>
            </div>

            {/* Preview Box */}
            <div className="mt-4 flex flex-col items-center justify-center min-h-[160px] bg-white rounded-lg border border-slate-200 p-2 sm:p-4 overflow-hidden shadow-sm">
              {state.logoData ? (
                <div className="flex flex-col items-center w-full">
                  <div
                    className="flex items-center justify-center w-full overflow-hidden rounded bg-slate-50/70 p-2 sm:p-4 transition-all duration-200"
                    style={{
                      width: '100%',
                      maxWidth: state.logoWidth ? `${Math.min(state.logoWidth, 1200)}px` : '100%',
                      height: state.logoHeight ? `${Math.min(state.logoHeight, 600)}px` : 'auto',
                      minHeight: '140px',
                    }}
                  >
                    <img
                      src={state.logoData}
                      alt="Logo Emissor"
                      style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: state.logoHeight
                          ? `${Math.min(state.logoHeight, 600)}px`
                          : '320px',
                        objectFit: 'contain',
                      }}
                      className="transition-all duration-200 w-full drop-shadow-xs"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end w-full mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 px-1 gap-2">
                    <span className="tabular-nums font-mono text-slate-400">
                      {state.logoWidth}px × {state.logoHeight}px
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-500" />
                  <p className="text-xs">Nenhuma logo enviada para o emissor.</p>
                </div>
              )}
            </div>

            {/* Controls when logoControls = 1 */}
            {state.logoControls === 1 && (
              <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3 rounded border border-slate-200">
                <div>
                  <Label htmlFor="logoWidth" className="text-xs text-slate-600 font-medium">
                    Largura (px)
                  </Label>
                  <Input
                    id="logoWidth"
                    type="number"
                    min="20"
                    max="1200"
                    value={state.logoWidth || ''}
                    onChange={(e) => handleLogoWidthChange(parseInt(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="logoHeight" className="text-xs text-slate-600 font-medium">
                    Altura (px)
                  </Label>
                  <Input
                    id="logoHeight"
                    type="number"
                    min="20"
                    max="800"
                    value={state.logoHeight || ''}
                    onChange={(e) => handleLogoHeightChange(parseInt(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div className="flex items-center pt-5 space-x-2">
                  <Checkbox
                    id="logoRatio"
                    checked={state.logoRatio === 1}
                    onCheckedChange={(c) => onChange({ logoRatio: c ? 1 : 0 })}
                  />
                  <Label
                    htmlFor="logoRatio"
                    className="text-xs font-medium cursor-pointer text-slate-700"
                  >
                    Manter proporção
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Dados Textuais Emissor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="empresaNome" className="text-xs font-medium text-slate-700">
                Nome da Empresa / Razão Social
              </Label>
              <Input
                id="empresaNome"
                placeholder="Ex: Minha Empresa Consultoria Ltda"
                value={state.empresaNome}
                onChange={(e) => onChange({ empresaNome: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="empresaCnpj" className="text-xs font-medium text-slate-700">
                CNPJ
              </Label>
              <Input
                id="empresaCnpj"
                placeholder="00.000.000/0001-00"
                value={state.empresaCnpj}
                onChange={(e) => onChange({ empresaCnpj: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="empresaEndereco" className="text-xs font-medium text-slate-700">
                Endereço
              </Label>
              <Input
                id="empresaEndereco"
                placeholder="Av. Paulista, 1000 - Bela Vista"
                value={state.empresaEndereco}
                onChange={(e) => onChange({ empresaEndereco: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="empresaCidade" className="text-xs font-medium text-slate-700">
                Cidade
              </Label>
              <Input
                id="empresaCidade"
                placeholder="São Paulo"
                value={state.empresaCidade}
                onChange={(e) => onChange({ empresaCidade: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="empresaUf" className="text-xs font-medium text-slate-700">
                UF (Estado)
              </Label>
              <Input
                id="empresaUf"
                placeholder="SP"
                maxLength={2}
                value={state.empresaUf}
                onChange={(e) => onChange({ empresaUf: e.target.value.toUpperCase() })}
                className="mt-1 h-9 bg-[#F9FAFB] uppercase"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: PERÍODO E EMISSÃO */}
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1E3A5F]" />
            <CardTitle className="text-lg font-bold text-slate-900">Período e Emissão</CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Defina o período de apuração contábil e a data de formalização do relatório.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="periodoInicio" className="text-xs font-medium text-slate-700">
                Período Início
              </Label>
              <Input
                id="periodoInicio"
                type="date"
                value={state.periodoInicio}
                onChange={(e) => onChange({ periodoInicio: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="periodoFim" className="text-xs font-medium text-slate-700">
                Período Fim
              </Label>
              <Input
                id="periodoFim"
                type="date"
                value={state.periodoFim}
                onChange={(e) => onChange({ periodoFim: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="dataEmissao" className="text-xs font-medium text-slate-700">
                Data de Emissão
              </Label>
              <Input
                id="dataEmissao"
                type="date"
                value={state.dataEmissao}
                onChange={(e) => onChange({ dataEmissao: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onNavigateTab('cliente')}
              className="w-full sm:w-auto text-xs h-9 text-[#1E3A5F] hover:bg-slate-50 gap-2 border-[#1E3A5F]/30"
            >
              <UserCheck className="w-3.5 h-3.5" /> Ir para Dados do Cliente{' '}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              onClick={onGenerateDocument}
              className="w-full sm:w-auto bg-[#1E3A5F] hover:bg-[#16304F] text-white px-6 h-9 text-xs font-semibold shadow-sm"
            >
              Gerar Documento
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
