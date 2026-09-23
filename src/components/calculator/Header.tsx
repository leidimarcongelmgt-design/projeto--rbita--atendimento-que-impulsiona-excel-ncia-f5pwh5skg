import React from 'react'
import { CalculatorState } from '@/types/calculator'
import { Button } from '@/components/ui/button'
import { FolderOpen, RotateCcw, Link2, Check } from 'lucide-react'

interface HeaderProps {
  onReset: () => void
  onCopyLink: () => void
  hasCopied: boolean
  activeTab: CalculatorState['tab']
  onTabChange: (tab: CalculatorState['tab']) => void
  isDocumentMode: boolean
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onCopyLink,
  hasCopied,
  activeTab,
  onTabChange,
  isDocumentMode,
}) => {
  const tabs: { id: CalculatorState['tab']; label: string }[] = [
    { id: 'identificacao', label: 'Identificação' },
  ]

  return (
    <header className="app-header border-b border-slate-200 bg-white sticky top-0 z-30 card-shadow">
      {/* Top bar with branding and actions */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1E3A5F] flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
              DOSSIÊ DO CLIENTE
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Identificação do emissor e emissão de dossiê
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopyLink}
            className="text-xs h-8 text-slate-700 hover:text-slate-900 border-slate-300 gap-1.5 transition-all"
            title="Copiar URL com todos os parâmetros atuais"
          >
            {hasCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copiado!</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Copiar Link</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-xs h-8 text-slate-700 hover:text-red-700 hover:border-red-300 border-slate-300 gap-1.5 transition-all"
            title="Redefinir parâmetros para valores iniciais"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Nova Consulta</span>
          </Button>
        </div>
      </div>

      {/* Segmented Control / Horizontal Pills for Tabs (hidden if in full Document Mode) */}
      {!isDocumentMode && (
        <div className="app-tabs border-t border-slate-100 bg-slate-50/70">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
            <div className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-150 flex-shrink-0 ${
                      isActive
                        ? 'bg-[#1E3A5F] text-white shadow-sm ring-1 ring-[#1E3A5F]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
