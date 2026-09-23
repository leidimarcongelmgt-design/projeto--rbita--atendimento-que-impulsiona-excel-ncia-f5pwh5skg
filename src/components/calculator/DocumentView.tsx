import React from 'react'
import { CalculatorState } from '@/types/calculator'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, Building2, MapPin } from 'lucide-react'

interface DocumentViewProps {
  state: CalculatorState
  onBack: () => void
}

export const DocumentView: React.FC<DocumentViewProps> = ({ state, onBack }) => {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Botões de Ação na tela (escondidos na impressão via .no-print) */}
      <div className="no-print flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 card-shadow">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="gap-2 text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Dossiê
        </Button>

        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500 hidden sm:block">
            Dica: Utilize a opção "Salvar como PDF" nas configurações da impressora.
          </p>
          <Button
            type="button"
            onClick={handlePrint}
            className="bg-[#1E3A5F] hover:bg-[#16304F] text-white gap-2 font-semibold shadow-sm"
          >
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO IMPRIMÍVEL (FORMATO FOLHA A4) */}
      <div className="print-only-container bg-white border border-slate-200 shadow-lg rounded-lg p-8 sm:p-12 max-w-[900px] mx-auto text-slate-900">
        {/* Cabeçalho do Documento */}
        <div className="border-b-2 border-[#1E3A5F] pb-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            {/* Logo do Emissor ou Nome */}
            <div className="space-y-2 max-w-[340px]">
              {state.logoData ? (
                <div className="flex items-center max-w-[300px]">
                  <img
                    src={state.logoData}
                    alt={state.empresaNome || 'Logo Emissor'}
                    style={{
                      maxHeight: state.logoHeight ? `${Math.min(state.logoHeight, 110)}px` : '90px',
                      maxWidth: '100%',
                      width: 'auto',
                      objectFit: 'contain',
                    }}
                    className="drop-shadow-xs"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#1E3A5F]">
                  <Building2 className="w-6 h-6" />
                  <span className="font-bold text-lg">
                    {state.empresaNome || 'EMPRESA EMISSORA'}
                  </span>
                </div>
              )}

              <div className="text-xs text-slate-600 leading-relaxed">
                {state.empresaNome && (
                  <p className="font-semibold text-slate-800">{state.empresaNome}</p>
                )}
                {state.empresaCnpj && <p>CNPJ: {state.empresaCnpj}</p>}
                {state.empresaEndereco && <p>{state.empresaEndereco}</p>}
                {(state.empresaCidade || state.empresaUf) && (
                  <p>
                    {state.empresaCidade}
                    {state.empresaCidade && state.empresaUf && ' - '}
                    {state.empresaUf}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Título do Relatório */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wide text-[#1E3A5F]">
                Dossiê de Identificação
              </h1>
              <p className="text-xs text-slate-500">Identificação cadastral da empresa emissora</p>
            </div>
          </div>
        </div>

        {/* 1. SEÇÃO: DADOS CADASTRAIS DO EMISSOR */}
        <div className="mb-8 print-break-inside-avoid">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
            <Building2 className="w-4 h-4 text-[#1E3A5F]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
              1. Dados Cadastrais do Emissor
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50/50 p-4 rounded border border-slate-200">
            <div>
              <span className="text-slate-500 block text-[11px]">Razão Social / Nome</span>
              <span className="font-semibold text-slate-800 text-sm">
                {state.empresaNome || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">CNPJ</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {state.empresaCnpj || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Cidade / UF</span>
              <span className="font-medium text-slate-800">
                {state.empresaCidade || state.empresaUf
                  ? `${state.empresaCidade || ''}${state.empresaCidade && state.empresaUf ? ' - ' : ''}${state.empresaUf || ''}`
                  : '—'}
              </span>
            </div>
            {(state.empresaEndereco || state.empresaCidade || state.empresaUf) && (
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> Endereço Completo
                </span>
                <span className="font-medium text-slate-800">
                  {state.empresaEndereco || ''}
                  {state.empresaEndereco && (state.empresaCidade || state.empresaUf) && ' — '}
                  {state.empresaCidade || ''}
                  {state.empresaCidade && state.empresaUf && ' - '}
                  {state.empresaUf || ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. ASSINATURA DO DOCUMENTO */}
        <div className="mt-16 pt-8 border-t border-slate-200 print-break-inside-avoid">
          <div className="max-w-xs mx-auto text-center text-xs">
            <div className="border-b border-slate-400 w-3/4 mx-auto mb-2"></div>
            <p className="font-bold text-slate-800">{state.empresaNome || 'Empresa Emissora'}</p>
            <p className="text-slate-500">Emissor / Responsável</p>
          </div>
        </div>

        {/* Rodapé legal no documento impresso */}
        <div className="mt-12 text-center text-[10px] text-slate-400">
          Documento gerado pelo DOSSIÊ DO CLIENTE • Proibida a reprodução total ou parcial sem
          autorização.
        </div>
      </div>
    </div>
  )
}
