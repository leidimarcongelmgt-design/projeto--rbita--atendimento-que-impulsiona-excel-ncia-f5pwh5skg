import React, { useRef, useState, useCallback, useEffect } from 'react'
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
  UserCheck,
  FileText,
  ExternalLink,
  Download,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Loader2,
  ArrowRight,
  Users,
  DollarSign,
  Boxes,
  Briefcase,
  Scale,
  Phone,
  Mail,
  User,
  Building,
  Building2,
  Landmark,
  FileSpreadsheet,
} from 'lucide-react'
import { formatPhoneBR } from '@/lib/calculatorState'
import {
  AttachedPdf,
  formatFileSize,
  getAttachedPdfArrayBuffer,
  PdfDocumentCategory,
} from '@/lib/pdfStorage'
import { extractTextFromPdf } from '@/lib/pdfTextExtractor'
import {
  parseClientDataFromPdfText,
  ClientExtractionResult,
  DocumentExtractionType,
} from '@/lib/clientDataParser'
import { runClientParserSelfCheck } from '@/lib/clientDataParser.test'
import { PdfDataReviewModal } from './PdfDataReviewModal'
import { PdfPasswordDialog } from './PdfPasswordDialog'
import { toast } from 'sonner'

interface ClienteTabProps {
  state: CalculatorState
  onChange: (patch: Partial<CalculatorState>) => void
  onNavigateTab: (tab: CalculatorState['tab']) => void
  onGenerateDocument: () => void
  attachedCnpjPdf?: AttachedPdf | null
  attachedIePdf?: AttachedPdf | null
  attachedImPdf?: AttachedPdf | null
  onUploadPdf: (file: File, category: PdfDocumentCategory) => Promise<ArrayBuffer | null> | void
  onRemovePdf: (category: PdfDocumentCategory) => void
}

export const ClienteTab: React.FC<ClienteTabProps> = ({
  state,
  onChange,
  onNavigateTab,
  onGenerateDocument,
  attachedCnpjPdf,
  attachedIePdf,
  attachedImPdf,
  onUploadPdf,
  onRemovePdf,
}) => {
  const clientFileRef = useRef<HTMLInputElement>(null)
  const cnpjPdfFileRef = useRef<HTMLInputElement>(null)
  const iePdfFileRef = useRef<HTMLInputElement>(null)
  const imPdfFileRef = useRef<HTMLInputElement>(null)

  // PDF Data Extraction states
  const [isExtracting, setIsExtracting] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [extractionResult, setExtractionResult] = useState<ClientExtractionResult | null>(null)
  const [activePdfName, setActivePdfName] = useState<string>('')
  const [activeDocumentLabel, setActiveDocumentLabel] = useState<string>('')

  // Password Dialog states for protected PDFs
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordError, setPasswordError] = useState<string>('')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const pendingBufferRef = useRef<ArrayBuffer | null>(null)
  const pendingPdfNameRef = useRef<string>('')
  const pendingDocTypeRef = useRef<DocumentExtractionType>('cnpj')
  const pendingDocLabelRef = useRef<string>('')

  // Process text and open review modal
  const runExtractionOnBuffer = useCallback(
    async (
      buffer: ArrayBuffer,
      pdfName: string,
      docType: DocumentExtractionType,
      docLabel = 'Documento PDF',
      password?: string,
    ) => {
      setIsExtracting(true)
      setActivePdfName(pdfName)
      setActiveDocumentLabel(docLabel)
      pendingBufferRef.current = buffer
      pendingPdfNameRef.current = pdfName
      pendingDocTypeRef.current = docType
      pendingDocLabelRef.current = docLabel

      try {
        const textResult = await extractTextFromPdf(buffer, { password })

        if (textResult.isPasswordProtected) {
          // Open password dialog directly
          setPasswordDialogOpen(true)
          if (password) {
            setPasswordError('Senha incorreta, tente novamente.')
          } else {
            setPasswordError('')
          }
          setReviewModalOpen(false)
          return
        }

        // Successfully extracted (or unencrypted)
        setPasswordDialogOpen(false)
        setPasswordError('')
        setReviewModalOpen(true)

        const parsed = parseClientDataFromPdfText(
          textResult.fullText,
          state,
          textResult.hasTextLayer,
          textResult.totalPages,
          textResult.error,
          textResult.isPasswordProtected,
          docType,
        )
        setExtractionResult(parsed)
      } catch (err: unknown) {
        console.error('Erro na extração de texto do PDF:', err)
        setReviewModalOpen(true)
        setExtractionResult({
          fields: [],
          rawText: '',
          hasTextLayer: false,
          totalPages: 0,
          errorMessage: 'Erro inesperado ao processar o conteúdo do PDF.',
          isPasswordProtected: false,
          docType,
        })
      } finally {
        setIsExtracting(false)
      }
    },
    [state],
  )

  // Handle password submission from dialog
  const handleSubmitPassword = useCallback(
    async (password: string) => {
      const buffer = pendingBufferRef.current
      if (!buffer) {
        toast.error('Arquivo PDF não disponível para desbloqueio.')
        setPasswordDialogOpen(false)
        return
      }

      setIsUnlocking(true)
      setPasswordError('')

      try {
        const textResult = await extractTextFromPdf(buffer, { password })
        if (textResult.isPasswordProtected) {
          setPasswordError('Senha incorreta, tente novamente.')
          return
        }

        // Password valid!
        setPasswordDialogOpen(false)
        setPasswordError('')
        toast.success('PDF desprotegido com sucesso!')

        // Show review modal with extracted fields
        setReviewModalOpen(true)
        const parsed = parseClientDataFromPdfText(
          textResult.fullText,
          state,
          textResult.hasTextLayer,
          textResult.totalPages,
          textResult.error,
          false,
          pendingDocTypeRef.current,
        )
        setExtractionResult(parsed)
      } catch (err: unknown) {
        console.error('Erro ao desbloquear PDF:', err)
        setPasswordError('Não foi possível desbloquear o PDF com a senha informada.')
      } finally {
        setIsUnlocking(false)
      }
    },
    [state],
  )

  const handleOpenPasswordPrompt = useCallback(() => {
    setPasswordDialogOpen(true)
    setPasswordError('')
  }, [])

  // Self-check dos cenários do parser ao carregar a aba
  useEffect(() => {
    const check = runClientParserSelfCheck()
    if (!check.passed) {
      console.warn('[clientDataParser] Falha na auto-checagem de regressão:', check.results)
    }
  }, [])

  // Trigger re-extraction manually on currently attached PDF
  const handleManualExtraction = useCallback(
    async (
      pdf: AttachedPdf | null | undefined,
      docType: DocumentExtractionType,
      docLabel: string,
    ) => {
      if (!pdf) {
        toast.error('Nenhum PDF anexado para extração.')
        return
      }
      const buffer = await getAttachedPdfArrayBuffer(pdf, pdf.category)
      if (!buffer) {
        toast.error('Não foi possível obter o conteúdo do PDF anexado para reprocessamento.')
        return
      }
      await runExtractionOnBuffer(buffer, pdf.name, docType, docLabel)
    },
    [runExtractionOnBuffer],
  )

  // Apply chosen fields to calculator state and URL
  const handleApplyExtractedData = useCallback(
    (patch: Partial<CalculatorState>) => {
      onChange(patch)
      const count = Object.keys(patch).length
      toast.success(
        `${count} ${count === 1 ? 'campo do cliente preenchido' : 'campos do cliente preenchidos'} com sucesso!`,
      )
    },
    [onChange],
  )

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

  // Handle Logo Cliente
  const onUploadLogoCliente = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleImageUpload(file, 400, (dataUrl, w, h) => {
      onChange({
        clientLogoData: dataUrl,
        clientLogoWidth: w,
        clientLogoHeight: h,
      })
    })
  }

  const handleClientLogoWidthChange = (newWidth: number) => {
    if (state.clientLogoRatio === 1 && state.clientLogoWidth > 0 && state.clientLogoHeight > 0) {
      const ratio = state.clientLogoHeight / state.clientLogoWidth
      onChange({
        clientLogoWidth: newWidth,
        clientLogoHeight: Math.round(newWidth * ratio),
      })
    } else {
      onChange({ clientLogoWidth: newWidth })
    }
  }

  const handleClientLogoHeightChange = (newHeight: number) => {
    if (state.clientLogoRatio === 1 && state.clientLogoWidth > 0 && state.clientLogoHeight > 0) {
      const ratio = state.clientLogoWidth / state.clientLogoHeight
      onChange({
        clientLogoHeight: newHeight,
        clientLogoWidth: Math.round(newHeight * ratio),
      })
    } else {
      onChange({ clientLogoHeight: newHeight })
    }
  }

  const handleCnpjPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    await onUploadPdf(file, 'cnpj')
    runExtractionOnBuffer(buffer, file.name, 'cnpj', 'Cartão CNPJ')
    e.target.value = ''
  }

  const handleIePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    await onUploadPdf(file, 'ie')
    runExtractionOnBuffer(buffer, file.name, 'ie', 'Inscrição Estadual')
    e.target.value = ''
  }

  const handleImPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    await onUploadPdf(file, 'im')
    runExtractionOnBuffer(buffer, file.name, 'im', 'Inscrição Municipal')
    e.target.value = ''
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* SEÇÃO 1: DADOS DO CLIENTE */}
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#1E3A5F]" />
            <CardTitle className="text-lg font-bold text-slate-900">
              Identificação do Cliente
            </CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Dados cadastrais e societários do cliente destinatário deste dossiê.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Client Logo Upload + Controls */}
          <div className="rounded-lg border border-dashed border-slate-300 p-5 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <Label className="text-sm font-semibold text-slate-800">Logotipo do Cliente</Label>
                <p className="text-xs text-slate-500">
                  Formatos aceitos: PNG, JPG ou SVG (máx. 400px)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({ clientLogoControls: state.clientLogoControls === 1 ? 0 : 1 })
                  }
                  className="text-xs h-8 text-slate-600 gap-1.5"
                >
                  {state.clientLogoControls === 1 ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Ocultar controles
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Ajustar dimensões
                    </>
                  )}
                </Button>

                {state.clientLogoData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ clientLogoData: '' })}
                    className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </Button>
                )}

                <input
                  ref={clientFileRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml"
                  className="hidden"
                  onChange={onUploadLogoCliente}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => clientFileRef.current?.click()}
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-8 gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {state.clientLogoData ? 'Substituir' : 'Enviar Logo Cliente'}
                </Button>
              </div>
            </div>

            {/* Preview Box */}
            <div className="mt-4 flex flex-col items-center justify-center min-h-[140px] bg-white rounded-lg border border-slate-200 p-2 sm:p-4 overflow-hidden shadow-sm">
              {state.clientLogoData ? (
                <div className="flex flex-col items-center w-full">
                  <div
                    className="flex items-center justify-center w-full overflow-hidden rounded bg-slate-50/70 p-2 sm:p-4 transition-all duration-200"
                    style={{
                      width: '100%',
                      maxWidth: state.clientLogoWidth
                        ? `${Math.min(state.clientLogoWidth, 800)}px`
                        : '100%',
                      height: state.clientLogoHeight
                        ? `${Math.min(state.clientLogoHeight, 400)}px`
                        : 'auto',
                      minHeight: '120px',
                    }}
                  >
                    <img
                      src={state.clientLogoData}
                      alt="Logo Cliente"
                      style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: state.clientLogoHeight
                          ? `${Math.min(state.clientLogoHeight, 400)}px`
                          : '240px',
                        objectFit: 'contain',
                      }}
                      className="transition-all duration-200 w-full drop-shadow-xs"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end w-full mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 px-1 gap-2">
                    <span className="tabular-nums font-mono text-slate-400">
                      {state.clientLogoWidth}px × {state.clientLogoHeight}px
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
                  <p className="text-xs">Nenhum logotipo enviado para o cliente.</p>
                </div>
              )}
            </div>

            {/* Controls when clientLogoControls = 1 */}
            {state.clientLogoControls === 1 && (
              <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3 rounded border border-slate-200">
                <div>
                  <Label htmlFor="clientLogoWidth" className="text-xs text-slate-600 font-medium">
                    Largura (px)
                  </Label>
                  <Input
                    id="clientLogoWidth"
                    type="number"
                    min="20"
                    max="800"
                    value={state.clientLogoWidth || ''}
                    onChange={(e) => handleClientLogoWidthChange(parseInt(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="clientLogoHeight" className="text-xs text-slate-600 font-medium">
                    Altura (px)
                  </Label>
                  <Input
                    id="clientLogoHeight"
                    type="number"
                    min="20"
                    max="600"
                    value={state.clientLogoHeight || ''}
                    onChange={(e) => handleClientLogoHeightChange(parseInt(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div className="flex items-center pt-5 space-x-2">
                  <Checkbox
                    id="clientLogoRatio"
                    checked={state.clientLogoRatio === 1}
                    onCheckedChange={(c) => onChange({ clientLogoRatio: c ? 1 : 0 })}
                  />
                  <Label
                    htmlFor="clientLogoRatio"
                    className="text-xs font-medium cursor-pointer text-slate-700"
                  >
                    Manter proporção
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Dados Textuais Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="clienteNome" className="text-xs font-medium text-slate-700">
                Nome do Cliente / Razão Social
              </Label>
              <Input
                id="clienteNome"
                placeholder="Ex: Indústria e Comércio Alpha S/A"
                value={state.clienteNome}
                onChange={(e) => onChange({ clienteNome: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="clienteCnpj" className="text-xs font-medium text-slate-700">
                CNPJ / CPF
              </Label>
              <Input
                id="clienteCnpj"
                placeholder="00.000.000/0001-00"
                value={state.clienteCnpj}
                onChange={(e) => onChange({ clienteCnpj: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="clienteRamo" className="text-xs font-medium text-slate-700">
                Ramo de Atividade
              </Label>
              <Input
                id="clienteRamo"
                placeholder="Ex: Comércio Varejista de Calçados"
                value={state.clienteRamo}
                onChange={(e) => onChange({ clienteRamo: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="clienteIE" className="text-xs font-medium text-slate-700">
                Inscrição Estadual
              </Label>
              <Input
                id="clienteIE"
                placeholder="Ex: 123.456.789.110 ou Isento"
                value={state.clienteIE}
                onChange={(e) => onChange({ clienteIE: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="clienteIM" className="text-xs font-medium text-slate-700">
                Inscrição Municipal
              </Label>
              <Input
                id="clienteIM"
                placeholder="Ex: 987654321"
                value={state.clienteIM}
                onChange={(e) => onChange({ clienteIM: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="clienteEndereco" className="text-xs font-medium text-slate-700">
                Endereço
              </Label>
              <Input
                id="clienteEndereco"
                placeholder="Rua das Indústrias, 500"
                value={state.clienteEndereco}
                onChange={(e) => onChange({ clienteEndereco: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="clienteCidade" className="text-xs font-medium text-slate-700">
                Cidade
              </Label>
              <Input
                id="clienteCidade"
                placeholder="Campinas"
                value={state.clienteCidade}
                onChange={(e) => onChange({ clienteCidade: e.target.value })}
                className="mt-1 h-9 bg-[#F9FAFB]"
              />
            </div>
            <div>
              <Label htmlFor="clienteUf" className="text-xs font-medium text-slate-700">
                UF (Estado)
              </Label>
              <Input
                id="clienteUf"
                placeholder="SP"
                maxLength={2}
                value={state.clienteUf}
                onChange={(e) => onChange({ clienteUf: e.target.value.toUpperCase() })}
                className="mt-1 h-9 bg-[#F9FAFB] uppercase"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: CONTATOS DO CLIENTE (Financeiro, Estoque, RH e Representante Legal) */}
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1E3A5F]" />
            <CardTitle className="text-lg font-bold text-slate-900">Contatos do Cliente</CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Cadastre os contatos responsáveis por cada área da empresa do cliente (Nome, Telefone e
            E-mail).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Financeiro */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
                <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Financeiro</h4>
                  <p className="text-[11px] text-slate-500">
                    Contas a pagar/receber, tesouraria e faturamento
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="contFinNome"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <User className="w-3 h-3 text-slate-400" />
                    Nome para Contato
                  </Label>
                  <Input
                    id="contFinNome"
                    placeholder="Ex: Carlos Andrade"
                    value={state.contFinNome}
                    onChange={(e) => onChange({ contFinNome: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contFinTelefone"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    Telefone
                  </Label>
                  <Input
                    id="contFinTelefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={state.contFinTelefone}
                    onChange={(e) => onChange({ contFinTelefone: formatPhoneBR(e.target.value) })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contFinEmail"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3 text-slate-400" />
                    E-mail
                  </Label>
                  <Input
                    id="contFinEmail"
                    type="email"
                    placeholder="financeiro@empresa.com.br"
                    value={state.contFinEmail}
                    onChange={(e) => onChange({ contFinEmail: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 2. Estoque */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
                <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Estoque</h4>
                  <p className="text-[11px] text-slate-500">
                    Logística, almoxarifado e suprimentos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="contEstoqueNome"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <User className="w-3 h-3 text-slate-400" />
                    Nome para Contato
                  </Label>
                  <Input
                    id="contEstoqueNome"
                    placeholder="Ex: Mariana Silva"
                    value={state.contEstoqueNome}
                    onChange={(e) => onChange({ contEstoqueNome: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contEstoqueTelefone"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    Telefone
                  </Label>
                  <Input
                    id="contEstoqueTelefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={state.contEstoqueTelefone}
                    onChange={(e) =>
                      onChange({ contEstoqueTelefone: formatPhoneBR(e.target.value) })
                    }
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contEstoqueEmail"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3 text-slate-400" />
                    E-mail
                  </Label>
                  <Input
                    id="contEstoqueEmail"
                    type="email"
                    placeholder="estoque@empresa.com.br"
                    value={state.contEstoqueEmail}
                    onChange={(e) => onChange({ contEstoqueEmail: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 3. Recursos Humanos */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
                <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Recursos Humanos</h4>
                  <p className="text-[11px] text-slate-500">
                    Gestão de pessoas, folha e departamento pessoal
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="contRhNome"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <User className="w-3 h-3 text-slate-400" />
                    Nome para Contato
                  </Label>
                  <Input
                    id="contRhNome"
                    placeholder="Ex: Juliana Mendes"
                    value={state.contRhNome}
                    onChange={(e) => onChange({ contRhNome: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contRhTelefone"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    Telefone
                  </Label>
                  <Input
                    id="contRhTelefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={state.contRhTelefone}
                    onChange={(e) => onChange({ contRhTelefone: formatPhoneBR(e.target.value) })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contRhEmail"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3 text-slate-400" />
                    E-mail
                  </Label>
                  <Input
                    id="contRhEmail"
                    type="email"
                    placeholder="rh@empresa.com.br"
                    value={state.contRhEmail}
                    onChange={(e) => onChange({ contRhEmail: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 4. Representante Legal */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
                <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Representante Legal</h4>
                  <p className="text-[11px] text-slate-500">
                    Sócio administrador, procurador ou diretoria executiva
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="contLegalNome"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <User className="w-3 h-3 text-slate-400" />
                    Nome para Contato
                  </Label>
                  <Input
                    id="contLegalNome"
                    placeholder="Ex: Dr. Roberto Guimarães"
                    value={state.contLegalNome}
                    onChange={(e) => onChange({ contLegalNome: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contLegalTelefone"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    Telefone
                  </Label>
                  <Input
                    id="contLegalTelefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={state.contLegalTelefone}
                    onChange={(e) => onChange({ contLegalTelefone: formatPhoneBR(e.target.value) })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="contLegalEmail"
                    className="text-xs font-medium text-slate-700 flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3 text-slate-400" />
                    E-mail
                  </Label>
                  <Input
                    id="contLegalEmail"
                    type="email"
                    placeholder="legal@empresa.com.br"
                    value={state.contLegalEmail}
                    onChange={(e) => onChange({ contLegalEmail: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onNavigateTab('calculo')}
              className="w-full sm:w-auto text-xs h-9 text-slate-700 gap-2"
            >
              Ir para Cálculo da DRE <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              onClick={onGenerateDocument}
              className="w-full sm:w-auto bg-[#1E3A5F] hover:bg-[#16304F] text-white px-6 h-9 text-xs font-semibold shadow-sm"
            >
              Visualizar Documento Final
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3: DOCUMENTOS FISCAIS DO CLIENTE (CNPJ, INSCRIÇÃO ESTADUAL E INSCRIÇÃO MUNICIPAL) */}
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#1E3A5F]" />
            <CardTitle className="text-lg font-bold text-slate-900">
              Documentos Fiscais do Cliente
            </CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Importe os PDFs oficiais dos registros fiscais do cliente (Cartão CNPJ, Inscrição
            Estadual e Inscrição Municipal) como anexos com extração automática dos números
            cadastrais e dados do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. PDF do CNPJ (Cartão CNPJ) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1E3A5F] flex items-center justify-center font-bold">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">PDF do CNPJ</h4>
                      <p className="text-[11px] text-slate-500">Cartão CNPJ (Receita Federal)</p>
                    </div>
                  </div>
                  {attachedCnpjPdf && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemovePdf('cnpj')}
                      className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                      title="Remover Cartão CNPJ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="mt-4">
                  {attachedCnpjPdf ? (
                    <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-200 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <CheckCircle2 className="w-3 h-3" /> PDF Conectado com Sucesso
                      </div>
                      <p className="text-xs font-bold text-slate-800 break-all line-clamp-2">
                        {attachedCnpjPdf.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatFileSize(attachedCnpjPdf.size)}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(attachedCnpjPdf.blobUrl, '_blank')}
                          className="text-[11px] h-7 px-2 text-slate-700"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                        </Button>
                        <a
                          href={attachedCnpjPdf.blobUrl}
                          download={attachedCnpjPdf.name}
                          className="inline-flex"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-7 px-2 text-slate-700"
                          >
                            <Download className="w-3 h-3 mr-1" /> Baixar
                          </Button>
                        </a>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isExtracting}
                        onClick={() =>
                          handleManualExtraction(attachedCnpjPdf, 'cnpj', 'Cartão CNPJ')
                        }
                        className="w-full text-xs h-7.5 bg-blue-50 text-[#1E3A5F] hover:bg-blue-100 font-medium gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600" /> Reextrair Dados do CNPJ
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 px-2 bg-white rounded-lg border border-dashed border-slate-300">
                      <Building className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-700">
                        Nenhum Cartão CNPJ anexado
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Importe para ler CNPJ, Razão, Atividade, Endereço, Cidade e UF
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">
                <input
                  ref={cnpjPdfFileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleCnpjPdfChange}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => cnpjPdfFileRef.current?.click()}
                  className="w-full bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-8 gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {attachedCnpjPdf ? 'Trocar Cartão CNPJ' : 'Importar Cartão CNPJ'}
                </Button>
              </div>
            </div>

            {/* 2. PDF da Inscrição Estadual */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        PDF da Inscrição Estadual
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Comprovante Estadual (CADESP/SEFAZ)
                      </p>
                    </div>
                  </div>
                  {attachedIePdf && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemovePdf('ie')}
                      className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                      title="Remover PDF da Inscrição Estadual"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="mt-4">
                  {attachedIePdf ? (
                    <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-200 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <CheckCircle2 className="w-3 h-3" /> PDF Conectado com Sucesso
                      </div>
                      <p className="text-xs font-bold text-slate-800 break-all line-clamp-2">
                        {attachedIePdf.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatFileSize(attachedIePdf.size)}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(attachedIePdf.blobUrl, '_blank')}
                          className="text-[11px] h-7 px-2 text-slate-700"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                        </Button>
                        <a
                          href={attachedIePdf.blobUrl}
                          download={attachedIePdf.name}
                          className="inline-flex"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-7 px-2 text-slate-700"
                          >
                            <Download className="w-3 h-3 mr-1" /> Baixar
                          </Button>
                        </a>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isExtracting}
                        onClick={() =>
                          handleManualExtraction(attachedIePdf, 'ie', 'Inscrição Estadual')
                        }
                        className="w-full text-xs h-7.5 bg-purple-50 text-purple-900 hover:bg-purple-100 font-medium gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-purple-700" /> Reextrair Inscrição
                        Estadual
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 px-2 bg-white rounded-lg border border-dashed border-slate-300">
                      <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-700">
                        Nenhum PDF de IE anexado
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Importe para ler a Inscrição Estadual
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">
                <input
                  ref={iePdfFileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleIePdfChange}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => iePdfFileRef.current?.click()}
                  className="w-full bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-8 gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {attachedIePdf ? 'Trocar PDF da IE' : 'Importar Inscrição Estadual'}
                </Button>
              </div>
            </div>

            {/* 3. PDF da Inscrição Municipal */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        PDF da Inscrição Municipal
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Cadastro Mobiliário (Prefeitura/CCM)
                      </p>
                    </div>
                  </div>
                  {attachedImPdf && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemovePdf('im')}
                      className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                      title="Remover PDF da Inscrição Municipal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="mt-4">
                  {attachedImPdf ? (
                    <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-200 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <CheckCircle2 className="w-3 h-3" /> PDF Conectado com Sucesso
                      </div>
                      <p className="text-xs font-bold text-slate-800 break-all line-clamp-2">
                        {attachedImPdf.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatFileSize(attachedImPdf.size)}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(attachedImPdf.blobUrl, '_blank')}
                          className="text-[11px] h-7 px-2 text-slate-700"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                        </Button>
                        <a
                          href={attachedImPdf.blobUrl}
                          download={attachedImPdf.name}
                          className="inline-flex"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-7 px-2 text-slate-700"
                          >
                            <Download className="w-3 h-3 mr-1" /> Baixar
                          </Button>
                        </a>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isExtracting}
                        onClick={() =>
                          handleManualExtraction(attachedImPdf, 'im', 'Inscrição Municipal')
                        }
                        className="w-full text-xs h-7.5 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-medium gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-700" /> Reextrair Inscrição
                        Municipal
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 px-2 bg-white rounded-lg border border-dashed border-slate-300">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-700">
                        Nenhum PDF de IM anexado
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Importe para ler a Inscrição Municipal (CCM)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">
                <input
                  ref={imPdfFileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleImPdfChange}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => imPdfFileRef.current?.click()}
                  className="w-full bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-8 gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {attachedImPdf ? 'Trocar PDF da IM' : 'Importar Inscrição Municipal'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Revisão e Confirmação de Dados Extraídos do PDF */}
      <PdfDataReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        extractionResult={extractionResult}
        onApply={handleApplyExtractedData}
        isExtracting={isExtracting}
        pdfName={activePdfName}
        onRequestPassword={handleOpenPasswordPrompt}
        documentLabel={activeDocumentLabel}
      />

      {/* Diálogo de Senha para Desproteger PDF */}
      <PdfPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        pdfName={activePdfName}
        errorMessage={passwordError}
        isSubmitting={isUnlocking}
        onSubmitPassword={handleSubmitPassword}
      />
    </div>
  )
}
