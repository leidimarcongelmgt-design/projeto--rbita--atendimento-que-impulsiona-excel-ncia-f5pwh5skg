import React from 'react'
import { CalculatorState } from '@/types/calculator'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Printer,
  Building2,
  UserCheck,
  FileText,
  Phone,
  Mail,
  User,
  Users,
  MapPin,
  Briefcase,
} from 'lucide-react'
import { AttachedPdf, formatFileSize } from '@/lib/pdfStorage'

interface DocumentViewProps {
  state: CalculatorState
  onBack: () => void
  attachedCnpjPdf?: AttachedPdf | null
  attachedIePdf?: AttachedPdf | null
  attachedImPdf?: AttachedPdf | null
}

export const DocumentView: React.FC<DocumentViewProps> = ({
  state,
  onBack,
  attachedCnpjPdf,
  attachedIePdf,
  attachedImPdf,
}) => {
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

            {/* Logo do Cliente ou Dados */}
            <div className="text-left sm:text-right space-y-2 self-start sm:self-auto max-w-[340px]">
              {state.clientLogoData ? (
                <div className="flex items-center sm:justify-end max-w-[300px] sm:ml-auto">
                  <img
                    src={state.clientLogoData}
                    alt={state.clienteNome || 'Logo Cliente'}
                    style={{
                      maxHeight: state.clientLogoHeight
                        ? `${Math.min(state.clientLogoHeight, 100)}px`
                        : '85px',
                      maxWidth: '100%',
                      width: 'auto',
                      objectFit: 'contain',
                    }}
                    className="sm:ml-auto drop-shadow-xs"
                  />
                </div>
              ) : (
                <div className="flex items-center sm:justify-end gap-1.5 text-slate-500">
                  <UserCheck className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">
                    {state.clienteNome || 'CLIENTE'}
                  </span>
                </div>
              )}

              <div className="text-xs text-slate-600 leading-relaxed">
                {state.clienteNome && (
                  <p className="font-semibold text-slate-800">{state.clienteNome}</p>
                )}
                {state.clienteRamo && (
                  <p className="text-slate-500 font-medium">
                    <span className="text-slate-400">Ramo: </span>
                    {state.clienteRamo}
                  </p>
                )}
                {state.clienteCnpj && <p>CNPJ/CPF: {state.clienteCnpj}</p>}
                {(state.clienteIE || state.clienteIM) && (
                  <p className="text-[11px] text-slate-500">
                    {state.clienteIE && <span>IE: {state.clienteIE}</span>}
                    {state.clienteIE && state.clienteIM && ' • '}
                    {state.clienteIM && <span>IM: {state.clienteIM}</span>}
                  </p>
                )}
                {state.clienteEndereco && <p>{state.clienteEndereco}</p>}
                {(state.clienteCidade || state.clienteUf) && (
                  <p>
                    {state.clienteCidade}
                    {state.clienteCidade && state.clienteUf && ' - '}
                    {state.clienteUf}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Título do Relatório */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wide text-[#1E3A5F]">
                Dossiê Cadastral do Cliente
              </h1>
              <p className="text-xs text-slate-500">
                Ficha cadastral completa, identificação fiscal e contatos operacionais
              </p>
            </div>
          </div>
        </div>

        {/* 1. SEÇÃO: DADOS CADASTRAIS DO CLIENTE */}
        <div className="mb-8 print-break-inside-avoid">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
            <Building2 className="w-4 h-4 text-[#1E3A5F]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
              1. Dados Cadastrais e Inscrições do Cliente
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50/50 p-4 rounded border border-slate-200">
            <div>
              <span className="text-slate-500 block text-[11px]">Razão Social / Nome</span>
              <span className="font-semibold text-slate-800 text-sm">
                {state.clienteNome || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">CNPJ / CPF</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {state.clienteCnpj || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Inscrição Estadual (IE)</span>
              <span className="font-medium text-slate-800 tabular-nums">
                {state.clienteIE || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Inscrição Municipal (IM / CCM)
              </span>
              <span className="font-medium text-slate-800 tabular-nums">
                {state.clienteIM || '—'}
              </span>
            </div>
            {state.clienteRamo && (
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px] flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-slate-400" /> Ramo de Atividade / CNAE
                  Principal
                </span>
                <span className="font-medium text-slate-800">{state.clienteRamo}</span>
              </div>
            )}
            {(state.clienteEndereco || state.clienteCidade || state.clienteUf) && (
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> Endereço Completo
                </span>
                <span className="font-medium text-slate-800">
                  {state.clienteEndereco || ''}
                  {state.clienteEndereco && (state.clienteCidade || state.clienteUf) && ' — '}
                  {state.clienteCidade || ''}
                  {state.clienteCidade && state.clienteUf && ' - '}
                  {state.clienteUf || ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. SEÇÃO: CONTATOS DO CLIENTE (Renderizado se algum campo estiver preenchido) */}
        {(state.contFinNome ||
          state.contFinTelefone ||
          state.contFinEmail ||
          state.contEstoqueNome ||
          state.contEstoqueTelefone ||
          state.contEstoqueEmail ||
          state.contRhNome ||
          state.contRhTelefone ||
          state.contRhEmail ||
          state.contLegalNome ||
          state.contLegalTelefone ||
          state.contLegalEmail) && (
          <div className="mb-8 border border-slate-200 rounded p-4 bg-slate-50/40 print-break-inside-avoid">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
              <Users className="w-4 h-4 text-[#1E3A5F]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                2. Contatos Responsáveis do Cliente
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Financeiro */}
              {(state.contFinNome || state.contFinTelefone || state.contFinEmail) && (
                <div className="p-3 bg-white rounded border border-slate-200/80 space-y-1">
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-emerald-800 border-b border-slate-100 pb-1 mb-1">
                    Financeiro
                  </p>
                  {state.contFinNome && (
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{state.contFinNome}</span>
                    </p>
                  )}
                  {state.contFinTelefone && (
                    <p className="text-slate-600 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="tabular-nums">{state.contFinTelefone}</span>
                    </p>
                  )}
                  {state.contFinEmail && (
                    <p className="text-slate-600 flex items-center gap-1.5 break-all">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{state.contFinEmail}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Estoque */}
              {(state.contEstoqueNome || state.contEstoqueTelefone || state.contEstoqueEmail) && (
                <div className="p-3 bg-white rounded border border-slate-200/80 space-y-1">
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-amber-800 border-b border-slate-100 pb-1 mb-1">
                    Estoque
                  </p>
                  {state.contEstoqueNome && (
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{state.contEstoqueNome}</span>
                    </p>
                  )}
                  {state.contEstoqueTelefone && (
                    <p className="text-slate-600 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="tabular-nums">{state.contEstoqueTelefone}</span>
                    </p>
                  )}
                  {state.contEstoqueEmail && (
                    <p className="text-slate-600 flex items-center gap-1.5 break-all">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{state.contEstoqueEmail}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Recursos Humanos */}
              {(state.contRhNome || state.contRhTelefone || state.contRhEmail) && (
                <div className="p-3 bg-white rounded border border-slate-200/80 space-y-1">
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-blue-800 border-b border-slate-100 pb-1 mb-1">
                    Recursos Humanos
                  </p>
                  {state.contRhNome && (
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{state.contRhNome}</span>
                    </p>
                  )}
                  {state.contRhTelefone && (
                    <p className="text-slate-600 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="tabular-nums">{state.contRhTelefone}</span>
                    </p>
                  )}
                  {state.contRhEmail && (
                    <p className="text-slate-600 flex items-center gap-1.5 break-all">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{state.contRhEmail}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Representante Legal */}
              {(state.contLegalNome || state.contLegalTelefone || state.contLegalEmail) && (
                <div className="p-3 bg-white rounded border border-slate-200/80 space-y-1">
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-purple-800 border-b border-slate-100 pb-1 mb-1">
                    Representante Legal
                  </p>
                  {state.contLegalNome && (
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{state.contLegalNome}</span>
                    </p>
                  )}
                  {state.contLegalTelefone && (
                    <p className="text-slate-600 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="tabular-nums">{state.contLegalTelefone}</span>
                    </p>
                  )}
                  {state.contLegalEmail && (
                    <p className="text-slate-600 flex items-center gap-1.5 break-all">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{state.contLegalEmail}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. ASSINATURAS DO DOCUMENTO */}
        <div className="mt-16 pt-8 border-t border-slate-200 print-break-inside-avoid">
          {' '}
          <div className="grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 w-3/4 mx-auto mb-2"></div>
              <p className="font-bold text-slate-800">{state.empresaNome || 'Empresa Emissora'}</p>
              <p className="text-slate-500">Emissor / Responsável</p>
            </div>
            <div>
              <div className="border-b border-slate-400 w-3/4 mx-auto mb-2"></div>
              <p className="font-bold text-slate-800">
                {state.contLegalNome
                  ? `${state.contLegalNome} (${state.clienteNome || 'Cliente'})`
                  : state.clienteNome || 'Cliente / Representante Legal'}
              </p>
              <p className="text-slate-500">De Acordo / Ciência</p>
            </div>
          </div>
        </div>

        {/* Anexos PDF Referenciados */}
        {(attachedCnpjPdf || attachedIePdf || attachedImPdf) && (
          <div className="mt-8 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Documentos Anexos Arquivados Digitalmente:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {attachedCnpjPdf && (
                <div className="flex items-center justify-between text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200/70">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
                    <span className="truncate">
                      <strong>Cartão CNPJ:</strong> {attachedCnpjPdf.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {formatFileSize(attachedCnpjPdf.size)}
                  </span>
                </div>
              )}
              {attachedIePdf && (
                <div className="flex items-center justify-between text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200/70">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
                    <span className="truncate">
                      <strong>Insc. Estadual:</strong> {attachedIePdf.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {formatFileSize(attachedIePdf.size)}
                  </span>
                </div>
              )}
              {attachedImPdf && (
                <div className="flex items-center justify-between text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200/70">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
                    <span className="truncate">
                      <strong>Insc. Municipal:</strong> {attachedImPdf.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {formatFileSize(attachedImPdf.size)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rodapé legal no documento impresso */}
        <div className="mt-12 text-center text-[10px] text-slate-400">
          Documento gerado pelo DOSSIÊ DO CLIENTE • Proibida a reprodução total ou parcial sem
          autorização.
        </div>
      </div>
    </div>
  )
}
