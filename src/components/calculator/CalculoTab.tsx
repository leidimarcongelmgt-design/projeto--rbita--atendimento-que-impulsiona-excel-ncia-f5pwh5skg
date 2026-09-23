import React from 'react'
import { CalculatorState, ComputedFinancials } from '@/types/calculator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CurrencyInput } from './CurrencyInput'
import { formatBRL, formatPercent } from '@/lib/calculatorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calculator, Sparkles, AlertCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalculoTabProps {
  state: CalculatorState
  computed: ComputedFinancials
  onChange: (patch: Partial<CalculatorState>) => void
  onNavigateTab: (tab: CalculatorState['tab']) => void
}

export const CalculoTab: React.FC<CalculoTabProps> = ({
  state,
  computed,
  onChange,
  onNavigateTab,
}) => {
  const isLucro = computed.resultadoExercicio >= 0

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#1E3A5F]" />
                <CardTitle className="text-lg font-bold text-slate-900">
                  Demonstração do Resultado do Exercício (DRE)
                </CardTitle>
              </div>
              <CardDescription className="text-slate-500 mt-1">
                Estrutura analítica de receitas, custos, despesas operacionais e apuração do
                resultado.
              </CardDescription>
            </div>

            {/* Quick Badges Indicating calculation links */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {state.usarCalcFolha === 1 ? (
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors flex items-center gap-1 py-1"
                  onClick={() => onNavigateTab('folha')}
                >
                  <Sparkles className="w-3 h-3 text-blue-600" /> Folha calculada
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-600 border-slate-200 py-1"
                >
                  Folha manual
                </Badge>
              )}

              {state.usarCalcTrib === 1 ? (
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors flex items-center gap-1 py-1"
                  onClick={() => onNavigateTab('tributos')}
                >
                  <Sparkles className="w-3 h-3 text-purple-600" /> Tributos calculados
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-600 border-slate-200 py-1"
                >
                  Tributos manuais
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Tabela Interativa de Linhas Financeiras */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
            {/* 1. (+) Receita Bruta */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    +
                  </span>
                  <label
                    htmlFor="receita"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    Receita Bruta
                  </label>
                </div>
                <p className="text-xs text-slate-500 pl-8">
                  Faturamento bruto total de vendas de produtos e prestação de serviços
                </p>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0">
                <CurrencyInput
                  id="receita"
                  value={state.receita}
                  onChange={(val) => onChange({ receita: val })}
                />
              </div>
            </div>

            {/* 2. (−) Deduções */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                    −
                  </span>
                  <label
                    htmlFor="deducoes"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    Deduções da Receita Bruta
                  </label>
                </div>
                <p className="text-xs text-slate-500 pl-8">
                  Devoluções, abatimentos, descontos comerciais e impostos sobre vendas diretas
                </p>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0">
                <CurrencyInput
                  id="deducoes"
                  value={state.deducoes}
                  onChange={(val) => onChange({ deducoes: val })}
                />
              </div>
            </div>

            {/* 3. (=) Receita Líquida (COMPUTADA) */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/90 font-medium">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
                  =
                </span>
                <div>
                  <span className="text-sm font-bold text-slate-900">Receita Líquida</span>
                  <span className="text-xs text-slate-500 block font-normal">
                    Receita Bruta − Deduções
                  </span>
                </div>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0 text-right pr-3 text-base font-bold text-slate-900 tabular-nums">
                {formatBRL(computed.receitaLiquida)}
              </div>
            </div>

            {/* 4. (−) CMV */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                    −
                  </span>
                  <label
                    htmlFor="cmv"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    CMV / CPV / CSP
                  </label>
                </div>
                <p className="text-xs text-slate-500 pl-8">
                  Custo das Mercadorias Vendidas, Produtos Vendidos ou Serviços Prestados
                </p>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0">
                <CurrencyInput
                  id="cmv"
                  value={state.cmv}
                  onChange={(val) => onChange({ cmv: val })}
                />
              </div>
            </div>

            {/* 5. (=) Resultado Bruto (COMPUTADO) */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/90 font-medium">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
                  =
                </span>
                <div>
                  <span className="text-sm font-bold text-slate-900">
                    Resultado Bruto (Lucro Bruto)
                  </span>
                  <span className="text-xs text-slate-500 block font-normal">
                    Receita Líquida − CMV
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  'w-full sm:w-64 sm:flex-shrink-0 text-right pr-3 text-base font-bold tabular-nums',
                  computed.resultadoBruto >= 0 ? 'text-slate-900' : 'text-red-600',
                )}
              >
                {formatBRL(computed.resultadoBruto)}
              </div>
            </div>

            {/* 6. (−) Despesas Administrativas */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                    −
                  </span>
                  <label
                    htmlFor="despAdm"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    Despesas Administrativas e Operacionais
                  </label>
                </div>
                <p className="text-xs text-slate-500 pl-8">
                  Aluguel, utilidades, software, consultorias e despesas gerais
                </p>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0">
                <CurrencyInput
                  id="despAdm"
                  value={state.despAdm}
                  onChange={(val) => onChange({ despAdm: val })}
                />
              </div>
            </div>

            {/* 7. (−) Despesas com Folha de Pagamento */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                    −
                  </span>
                  <label
                    htmlFor="despFolha"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    Despesas com Folha de Pagamento
                  </label>
                  {state.usarCalcFolha === 1 && (
                    <Badge
                      variant="secondary"
                      className="text-[11px] bg-blue-100 text-blue-800 border-blue-200"
                    >
                      usar calculado
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 pl-8">
                  <p className="text-xs text-slate-500">
                    Salários, encargos sociais (INSS, FGTS), 13º salário e férias provisionadas
                  </p>
                  {state.usarCalcFolha === 1 && (
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-xs text-[#1E3A5F] inline-flex items-center gap-0.5 hover:underline"
                      onClick={() => onNavigateTab('folha')}
                    >
                      Editar na aba Folha <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0">
                <CurrencyInput
                  id="despFolha"
                  value={computed.despFolhaEfetiva}
                  onChange={(val) => onChange({ despFolha: val })}
                  readOnly={state.usarCalcFolha === 1}
                />
              </div>
            </div>

            {/* 8. (−) Tributos */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                    −
                  </span>
                  <label
                    htmlFor="tributos"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    Tributos e Impostos sobre o Lucro
                  </label>
                  {state.usarCalcTrib === 1 && (
                    <Badge
                      variant="secondary"
                      className="text-[11px] bg-purple-100 text-purple-800 border-purple-200"
                    >
                      usar calculado
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 pl-8">
                  <p className="text-xs text-slate-500">
                    IRPJ, CSLL, Simples Nacional ou tributação incidente sobre a base escolhida
                  </p>
                  {state.usarCalcTrib === 1 && (
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-xs text-[#1E3A5F] inline-flex items-center gap-0.5 hover:underline"
                      onClick={() => onNavigateTab('tributos')}
                    >
                      Editar na aba Tributos <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0">
                <CurrencyInput
                  id="tributos"
                  value={computed.tributosEfetivo}
                  onChange={(val) => onChange({ tributos: val })}
                  readOnly={state.usarCalcTrib === 1}
                />
              </div>
            </div>

            {/* 9. (+/−) Resultado Financeiro */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                    ±
                  </span>
                  <label
                    htmlFor="resFinanceiro"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    Resultado Financeiro Líquido
                  </label>
                </div>
                <p className="text-xs text-slate-500 pl-8">
                  Receitas financeiras (aplicações, juros) menos despesas financeiras (juros
                  bancários, tarifas)
                </p>
              </div>
              <div className="w-full sm:w-64 sm:flex-shrink-0">
                <CurrencyInput
                  id="resFinanceiro"
                  value={state.resFinanceiro}
                  onChange={(val) => onChange({ resFinanceiro: val })}
                />
              </div>
            </div>

            {/* 10. (=) RESULTADO DO EXERCÍCIO (DESTAQUE MÁXIMO) */}
            <div
              className={cn(
                'p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors',
                isLucro
                  ? 'bg-emerald-50/70 border-t-2 border-emerald-500'
                  : 'bg-rose-50/70 border-t-2 border-rose-500',
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-sm font-extrabold',
                      isLucro ? 'bg-[#2E7D32]' : 'bg-[#C62828]',
                    )}
                  >
                    =
                  </span>
                  <span className="text-base sm:text-lg font-bold text-slate-900">
                    Resultado Líquido do Exercício
                  </span>
                  <Badge
                    className={cn(
                      'text-xs font-semibold uppercase ml-2',
                      isLucro
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700',
                    )}
                  >
                    {isLucro ? 'Lucro Líquido' : 'Prejuízo Líquido'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 pl-9">
                  Resultado Bruto − Despesas Adm. − Despesas c/ Folha − Tributos ± Resultado
                  Financeiro
                </p>
              </div>

              <div className="text-right sm:flex-shrink-0">
                <div
                  className={cn(
                    'text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight transition-all duration-150',
                    isLucro ? 'text-[#2E7D32]' : 'text-[#C62828]',
                  )}
                >
                  {formatBRL(computed.resultadoExercicio)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Margem Líquida:{' '}
                  {state.receita > 0
                    ? formatPercent((computed.resultadoExercicio / state.receita) * 100)
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Legenda Explicativa */}
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                <strong>Legenda:</strong> Campos marcados com indicador{' '}
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-semibold">
                  usar calculado
                </span>{' '}
                são preenchidos automaticamente conforme as configurações das abas{' '}
                <strong>Folha</strong> e <strong>Tributos</strong>.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
