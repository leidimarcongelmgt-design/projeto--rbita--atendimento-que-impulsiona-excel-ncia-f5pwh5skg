import { useState, useEffect, useCallback } from 'react'
import { CalculatorState, DEFAULT_CALCULATOR_STATE } from '@/types/calculator'
import { parseStateFromUrl, serializeStateToUrl } from '@/lib/calculatorState'
import { Header } from '@/components/calculator/Header'
import { IdentificacaoTab } from '@/components/calculator/IdentificacaoTab'
import { EmpresasTab } from '@/components/calculator/EmpresasTab'
import { DptoPessoalTab } from '@/components/calculator/DptoPessoalTab'
import { DptoFiscalTab } from '@/components/calculator/DptoFiscalTab'
import { DocumentView } from '@/components/calculator/DocumentView'
import { EmpresaRow } from '@/types/empresa'
import { DptoPessoalRow } from '@/types/dptoPessoal'
import { DptoFiscalRow } from '@/types/dptoFiscal'
import { loadEmpresasFromStorage, clearEmpresasStorage } from '@/lib/empresasService'
import { loadDptoPessoalFromStorage, clearDptoPessoalStorage } from '@/lib/dptoPessoalService'
import { loadDptoFiscalFromStorage, clearDptoFiscalStorage } from '@/lib/dptoFiscalService'
import { toast } from 'sonner'

export default function Index() {
  // Initialize state strictly from URL query parameters
  const [state, setState] = useState<CalculatorState>(() => {
    return parseStateFromUrl(window.location.search)
  })

  // Empresas persistidas em sessionStorage (não poluindo a URL)
  const [empresas, setEmpresas] = useState<EmpresaRow[]>(() => {
    return loadEmpresasFromStorage()
  })

  // Dpto. Pessoal persistido em sessionStorage (não poluindo a URL)
  const [dptoRows, setDptoRows] = useState<DptoPessoalRow[]>(() => {
    return loadDptoPessoalFromStorage()
  })

  // Dpto. Fiscal persistido em sessionStorage (não poluindo a URL)
  const [fiscalRows, setFiscalRows] = useState<DptoFiscalRow[]>(() => {
    return loadDptoFiscalFromStorage()
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

  // Reset all parameters to reference defaults ("Nova Consulta")
  const handleReset = useCallback(() => {
    const nextState = { ...DEFAULT_CALCULATOR_STATE }
    setState(nextState)
    setEmpresas([])
    setDptoRows([])
    setFiscalRows([])
    clearEmpresasStorage()
    clearDptoPessoalStorage()
    clearDptoFiscalStorage()
    setIsDocumentMode(false)
    const newQuery = serializeStateToUrl(nextState)
    window.history.replaceState(null, '', `${window.location.pathname}${newQuery}`)
    toast.info('Valores redefinidos para os padrões da referência.')
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
          <DocumentView state={state} onBack={() => setIsDocumentMode(false)} />
        ) : (
          <div>
            {state.tab === 'identificacao' && (
              <IdentificacaoTab
                state={state}
                onChange={updateState}
                onGenerateDocument={() => setIsDocumentMode(true)}
              />
            )}
            {state.tab === 'empresas' && (
              <EmpresasTab empresas={empresas} onEmpresasChange={setEmpresas} />
            )}
            {state.tab === 'dpto-pessoal' && (
              <DptoPessoalTab rows={dptoRows} onRowsChange={setDptoRows} empresas={empresas} />
            )}
            {state.tab === 'fiscal-pesos' && (
              <DptoFiscalTab rows={fiscalRows} onRowsChange={setFiscalRows} empresas={empresas} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
