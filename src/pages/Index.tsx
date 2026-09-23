import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { CalculatorState, DEFAULT_CALCULATOR_STATE, computeFinancials } from '@/types/calculator'
import { parseStateFromUrl, serializeStateToUrl } from '@/lib/calculatorState'
import { Header } from '@/components/calculator/Header'
import { IdentificacaoTab } from '@/components/calculator/IdentificacaoTab'
import { ClienteTab } from '@/components/calculator/ClienteTab'
import { CalculoTab } from '@/components/calculator/CalculoTab'
import { TributosTab } from '@/components/calculator/TributosTab'
import { FolhaTab } from '@/components/calculator/FolhaTab'
import { DocumentView } from '@/components/calculator/DocumentView'
import { toast } from 'sonner'
import {
  AttachedPdf,
  loadPersistedPdf,
  savePdfFile,
  clearAttachedPdf,
  clearAllAttachedPdfs,
  PdfDocumentCategory,
} from '@/lib/pdfStorage'

export default function Index() {
  const _location = useLocation()

  // Initialize state strictly from URL query parameters
  const [state, setState] = useState<CalculatorState>(() => {
    return parseStateFromUrl(window.location.search)
  })

  // Attached PDFs stored in session/memory
  const [attachedCnpjPdf, setAttachedCnpjPdf] = useState<AttachedPdf | null>(() => {
    return loadPersistedPdf('cnpj')
  })
  const [attachedIePdf, setAttachedIePdf] = useState<AttachedPdf | null>(() => {
    return loadPersistedPdf('ie')
  })
  const [attachedImPdf, setAttachedImPdf] = useState<AttachedPdf | null>(() => {
    return loadPersistedPdf('im')
  })

  const [hasCopied, setHasCopied] = useState(false)
  const [isDocumentMode, setIsDocumentMode] = useState(false)

  useEffect(() => {
    document.title = 'DOSSIÊ DO CLIENTE'
  }, [])

  // Listen to external popstate/URL changes
  useEffect(() => {
    const handlePopState = () => {
      setState(parseStateFromUrl(window.location.search))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Sync state changes directly to the URL using replaceState (preserving scroll position)
  const updateState = useCallback((patch: Partial<CalculatorState>) => {
    setState((prevState) => {
      const nextState: CalculatorState = { ...prevState, ...patch }
      const newQuery = serializeStateToUrl(nextState)

      const currentScrollY = window.scrollY
      window.history.replaceState(null, '', `${window.location.pathname}${newQuery}`)
      window.scrollTo(0, currentScrollY)

      return nextState
    })
  }, [])

  // Calculate live financials
  const computed = useMemo(() => {
    return computeFinancials(state)
  }, [state])

  // PDF handlers
  const handleUploadPdf = useCallback(
    async (file: File, category: PdfDocumentCategory): Promise<ArrayBuffer | null> => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        toast.error('Por favor, selecione um arquivo no formato PDF (.pdf).')
        return null
      }
      try {
        const buffer = await file.arrayBuffer()
        const saved = await savePdfFile(file, category)
        if (category === 'cnpj') setAttachedCnpjPdf(saved)
        else if (category === 'ie') setAttachedIePdf(saved)
        else if (category === 'im') setAttachedImPdf(saved)

        const categoryLabels: Record<PdfDocumentCategory, string> = {
          cnpj: 'PDF do Cartão CNPJ',
          ie: 'PDF da Inscrição Estadual',
          im: 'PDF da Inscrição Municipal',
        }
        toast.success(`${categoryLabels[category]} "${file.name}" importado com sucesso!`)
        return buffer
      } catch {
        toast.error('Erro ao ler o arquivo PDF.')
        return null
      }
    },
    [],
  )

  const handleRemovePdf = useCallback((category: PdfDocumentCategory) => {
    clearAttachedPdf(category)
    if (category === 'cnpj') {
      setAttachedCnpjPdf(null)
      toast.info('PDF do CNPJ removido.')
    } else if (category === 'ie') {
      setAttachedIePdf(null)
      toast.info('PDF da Inscrição Estadual removido.')
    } else if (category === 'im') {
      setAttachedImPdf(null)
      toast.info('PDF da Inscrição Municipal removido.')
    }
  }, [])

  // Reset all parameters to reference defaults ("Nova Consulta")
  const handleReset = useCallback(() => {
    const nextState = { ...DEFAULT_CALCULATOR_STATE }
    setState(nextState)
    setIsDocumentMode(false)
    clearAllAttachedPdfs()
    setAttachedCnpjPdf(null)
    setAttachedIePdf(null)
    setAttachedImPdf(null)
    const newQuery = serializeStateToUrl(nextState)
    window.history.replaceState(null, '', `${window.location.pathname}${newQuery}`)
    toast.info('Valores e documentos anexos redefinidos para os padrões da referência.')
  }, [])

  // Copy current URL to clipboard with confirmation toast
  const handleCopyLink = useCallback(async () => {
    try {
      const currentUrl = window.location.href
      await navigator.clipboard.writeText(currentUrl)
      setHasCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setHasCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }, [])

  const handleTabChange = useCallback(
    (newTab: CalculatorState['tab']) => {
      setIsDocumentMode(false)
      updateState({ tab: newTab })
    },
    [updateState],
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        onReset={handleReset}
        onCopyLink={handleCopyLink}
        hasCopied={hasCopied}
        activeTab={state.tab}
        onTabChange={handleTabChange}
        isDocumentMode={isDocumentMode}
      />

      <div className="max-w-[1100px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {isDocumentMode ? (
          <DocumentView
            state={state}
            computed={computed}
            onBack={() => setIsDocumentMode(false)}
            attachedCnpjPdf={attachedCnpjPdf}
            attachedIePdf={attachedIePdf}
            attachedImPdf={attachedImPdf}
          />
        ) : (
          <div>
            {state.tab === 'identificacao' && (
              <IdentificacaoTab
                state={state}
                onChange={updateState}
                onNavigateTab={handleTabChange}
                onGenerateDocument={() => setIsDocumentMode(true)}
              />
            )}

            {state.tab === 'cliente' && (
              <ClienteTab
                state={state}
                onChange={updateState}
                onNavigateTab={handleTabChange}
                onGenerateDocument={() => setIsDocumentMode(true)}
                attachedCnpjPdf={attachedCnpjPdf}
                attachedIePdf={attachedIePdf}
                attachedImPdf={attachedImPdf}
                onUploadPdf={handleUploadPdf}
                onRemovePdf={handleRemovePdf}
              />
            )}
            {state.tab === 'calculo' && (
              <CalculoTab
                state={state}
                computed={computed}
                onChange={updateState}
                onNavigateTab={handleTabChange}
              />
            )}

            {state.tab === 'tributos' && (
              <TributosTab
                state={state}
                computed={computed}
                onChange={updateState}
                onNavigateTab={handleTabChange}
              />
            )}

            {state.tab === 'folha' && (
              <FolhaTab
                state={state}
                computed={computed}
                onChange={updateState}
                onNavigateTab={handleTabChange}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
