import React from 'react'
import { CalculatorState, ComputedFinancials } from '@/types/calculator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CurrencyInput } from './CurrencyInput'
import { formatBRL, formatPercent } from '@/lib/calculatorState'
import { Percent, ArrowRight, Info, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TributosTabProps {
  state: CalculatorState
  computed: ComputedFinancials
  onChange: (patch: Partial<CalculatorState>) => void
  onNavigateTab: (tab: CalculatorState['tab']) => void
}

export const TributosTab: React.FC<TributosTabProps> = ({
  state,
  computed,
  onChange,
  onNavigateTab,
}) => {
  const isEnabled = state.usarCalcTrib === 1

  // Handle Preset base selection
  const handleBasePreset = (value: string) => {
    let newBase = state.tribBase
    if (value === 'resultadoExercicio') {
      // Current Resultado do Exercício before taxes
      const baseBeforeTaxes =
        computed.resultadoBruto - state.despAdm - computed.despFolhaEfetiva + state.resFinanceiro
      newBase = Math.max(0, baseBeforeTaxes)
    } else if (value === 'receitaLiquida') {
      newBase = Math.max(0, computed.receitaLiquida)
    } else if (value === 'resultadoBruto') {
      newBase = Math.max(0, computed.resultadoBruto)
    }
    onChange({ tribBase: newBase })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-[#1E3A5F]" />
                <CardTitle className="text-lg font-bold text-slate-900">
                  Cálculo de Tributos e Impostos
                </CardTitle>
              </div>
              <CardDescription className="text-slate-500">
                Configure a base de apuração e a alíquota efetiva para calcular automaticamente a
                provisão de impostos.
              </CardDescription>
            </div>

            {/* Controles do Cabeçalho: Toggle de Cálculo */}
            <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-lg border border-slate-200 self-start sm:self-auto">
              <Switch
                id="usarCalcTrib"
                checked={isEnabled}
                onCheckedChange={(checked) => onChange({ usarCalcTrib: checked ? 1 : 0 })}
                className="data-[state=checked]:bg-[#1E3A5F]"
              />
              <Label
                htmlFor="usarCalcTrib"
                className="text-sm font-semibold cursor-pointer text-slate-800"
              >
                {isEnabled ? 'Cálculo Ativo' : 'Cálculo Desativado'}
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {isEnabled ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Seleção de Base e Input Manual */}
                <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-slate-900">
                      1. Base de Cálculo dos Tributos
                    </Label>
                    <span className="text-xs text-slate-500">Selecione ou edite livremente</span>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                      Preencher automaticamente com:
                    </Label>
                    <Select onValueChange={handleBasePreset}>
                      <SelectTrigger className="w-full bg-white h-9">
                        <SelectValue placeholder="Escolher base contábil..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resultadoExercicio">
                          Resultado do Exercício (antes tributos):{' '}
                          {formatBRL(
                            Math.max(
                              0,
                              computed.resultadoBruto -
                                state.despAdm -
                                computed.despFolhaEfetiva +
                                state.resFinanceiro,
                            ),
                          )}
                        </SelectItem>
                        <SelectItem value="receitaLiquida">
                          Receita Líquida: {formatBRL(computed.receitaLiquida)}
                        </SelectItem>
                        <SelectItem value="resultadoBruto">
                          Resultado Bruto: {formatBRL(computed.resultadoBruto)}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label
                      htmlFor="tribBase"
                      className="text-xs font-medium text-slate-600 mb-1.5 block"
                    >
                      Valor da Base de Cálculo (R$)
                    </Label>
                    <CurrencyInput
                      id="tribBase"
                      value={state.tribBase}
                      onChange={(val) => onChange({ tribBase: val })}
                      placeholder="0,00"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Você pode alterar o valor da base a qualquer momento se houver adições ou
                      exclusões fiscais.
                    </p>
                  </div>
                </div>

                {/* Alíquota % */}
                <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <Label className="text-sm font-bold text-slate-900 block">
                    2. Alíquota Efetiva (%)
                  </Label>

                  <div>
                    <Label
                      htmlFor="tribAliq"
                      className="text-xs font-medium text-slate-600 mb-1.5 block"
                    >
                      Percentual de Tributação incidente
                    </Label>
                    <div className="relative">
                      <Input
                        id="tribAliq"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={state.tribAliq || ''}
                        onChange={(e) => onChange({ tribAliq: parseFloat(e.target.value) || 0 })}
                        placeholder="Ex: 15"
                        className="pr-10 h-9 bg-white text-right tabular-nums font-semibold"
                      />
                      <span className="absolute right-3 top-2 text-sm font-bold text-slate-500 pointer-events-none">
                        %
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="text-[11px] text-slate-500 mr-1 self-center">
                        Sugestões:
                      </span>
                      {[6, 11, 15, 24, 34].map((aliq) => (
                        <Button
                          key={aliq}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onChange({ tribAliq: aliq })}
                          className="h-6 text-xs px-2 py-0 bg-white hover:bg-slate-100"
                        >
                          {aliq}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD DE RESULTADO EM DESTAQUE */}
              <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-700" />
                    <span className="text-sm font-bold text-purple-950 uppercase tracking-wider">
                      Tributos Apurados
                    </span>
                  </div>
                  <p className="text-xs text-purple-800">
                    Fórmula: {formatBRL(state.tribBase)} × {formatPercent(state.tribAliq)} = Total
                    Provisão
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Este montante é transmitido automaticamente para a linha{' '}
                    <strong>(−) Tributos</strong> na aba de Cálculo.
                  </p>
                </div>

                <div className="text-right sm:flex-shrink-0">
                  <div className="text-2xl sm:text-3xl font-extrabold text-purple-900 tabular-nums">
                    {formatBRL(computed.tributosCalculados)}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => onNavigateTab('calculo')}
                    className="p-0 h-auto text-xs text-purple-700 font-semibold inline-flex items-center gap-1 hover:underline mt-1"
                  >
                    Ver reflexo no Resultado do Exercício <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Estado Desligado */
            <div className="text-center py-12 px-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/70">
              <Info className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                Cálculo Automático de Tributos Desativado
              </h3>
              <p className="text-sm text-slate-500 max-width-lg mx-auto mt-1 max-w-md">
                Quando desativado, o valor dos impostos pode ser digitado livremente na aba{' '}
                <strong>Cálculo</strong>, na linha correspondente a Tributos.
              </p>
              <Button
                type="button"
                onClick={() => onChange({ usarCalcTrib: 1 })}
                className="mt-4 bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs"
              >
                Ativar Cálculo de Tributos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
