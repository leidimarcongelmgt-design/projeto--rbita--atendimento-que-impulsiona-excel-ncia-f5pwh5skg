import { useState, useEffect, useCallback } from 'react'
import { CalculatorState, DEFAULT_CALCULATOR_STATE } from '@/types/calculator'
import { parseStateFromUrl, serializeStateToUrl } from '@/lib/calculatorState'
import { Header } from '@/components/calculator/Header'
import { IdentificacaoTab } from '@/components/calculator/IdentificacaoTab'
import { EmpresasTab } from '@/components/calculator/EmpresasTab'
import { DptoPessoalTab } from '@/components/calculator/DptoPessoalTab'
import { DptoFiscalTab } from '@/components/calculator/DptoFiscalTab'
import { DptoContabilTab } from '@/components/calculator/DptoContabilTab'
import { DocumentView } from '@/components/calculator/DocumentView'
import { EmpresaRow } from '@/types/empresa'
import { DptoPessoalRow } from '@/types/dptoPessoal'
import { DptoFiscalRow } from '@/types/dptoFiscal'
import { DptoContabilRow } from '@/types/dptoContabil'
import { loadEmpresasFromStorage, fetchEmpresas } from '@/lib/empresasService'
import { loadDptoPessoalFromStorage, fetchDptoPessoal } from '@/lib/dptoPessoalService'
import { loadDptoFiscalFromStorage, fetchDptoFiscal } from '@/lib/dptoFiscalService'
import { loadDptoContabilFromStorage, fetchDptoContabil } from '@/lib/dptoContabilService'
import { toast } from 'sonner'

export default function Index() {
  // Initialize state strictly from URL query parameters
  const [state, setState] = useState<CalculatorState>(() => {
    return parseStateFromUrl(window.location.search)
  })

  // Empresas persistidas permanentemente (carrega inicial síncrono para render instantâneo)
  const [empresas, setEmpresas] = useState<EmpresaRow[]>(() => {
    return loadEmpresasFromStorage()
  })

  // Dpto. Pessoal persistido permanentemente
  const [dptoRows, setDptoRows] = useState<DptoPessoalRow[]>(() => {
    return loadDptoPessoalFromStorage()
  })

  // Dpto. Fiscal persistido permanentemente
  const [fiscalRows, setFiscalRows] = useState<DptoFiscalRow[]>(() => {
    return loadDptoFiscalFromStorage()
  })

  // Dpto. Contábil persistido permanentemente
  const [contabilRows, setContabilRows] = useState<DptoContabilRow[]>(() => {
    return loadDptoContabilFromStorage()
  })

  const [hasCopied, setHasCopied] = useState(false)
  const [isDocumentMode, setIsDocumentMode] = useState(false)

  useEffect(() => {
    document.title = 'DOSSIÊ DO CLIENTE'
  }, [])

  // Carrega assincronamente os dados atualizados ao entrar no sistema ou ao alternar abas
  // Carrega assincronamente os dados atualizados ao entrar no sistema ou ao alternar abas
  useEffect(() => {
    let isMounted = true

    const loadPersistentDataForTab = async () => {
      try {
        if (state.tab === 'empresas') {
          const emp = await fetchEmpresas().catch(() => loadEmpresasFromStorage())
          if (isMounted && emp) {
            setEmpresas(emp)
          }
        } else if (state.tab === 'dpto-pessoal') {
          const dpto = await fetchDptoPessoal().catch(() => loadDptoPessoalFromStorage())
          if (isMounted && dpto) {
            setDptoRows(dpto)
          }
        } else if (state.tab === 'fiscal-pesos') {
          const fisc = await fetchDptoFiscal().catch(() => loadDptoFiscalFromStorage())
          if (isMounted && fisc) {
            setFiscalRows(fisc)
          }
        } else if (state.tab === 'contabil') {
          const cont = await fetchDptoContabil().catch(() => loadDptoContabilFromStorage())
          if (isMounted && cont) {
            setContabilRows(cont)
          }
        }
      } catch {
        // Falha no backend silenciada com fallback local
      }
    }

    loadPersistentDataForTab()

    return () => {
      isMounted = false
    }
  }, [state.tab])

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

  // "Nova Consulta": redefine apenas os parâmetros da URL da aba Identificação,
  // preservando permanentemente os dados das tabelas, colunas personalizadas e larguras no navegador!
  const handleReset = useCallback(() => {
    const nextState = { ...DEFAULT_CALCULATOR_STATE }
    setState(nextState)
    setIsDocumentMode(false)
    const newQuery = serializeStateToUrl(nextState)
    window.history.replaceState(null, '', `${window.location.pathname}${newQuery}`)
    toast.info(
      'Nova Consulta iniciada: formulário de Identificação redefinido. Os dados importados e tabelas continuam salvos de forma permanente.',
    )
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
            {state.tab === 'contabil' && (
              <DptoContabilTab
                rows={contabilRows}
                onRowsChange={setContabilRows}
                empresas={empresas}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
