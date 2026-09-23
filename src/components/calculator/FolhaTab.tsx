import React from 'react'
import { CalculatorState, ComputedFinancials } from '@/types/calculator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from './CurrencyInput'
import { formatBRL } from '@/lib/calculatorState'
import { Users, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportXlsxButton } from './ImportXlsxButton'

interface FolhaTabProps {
  state: CalculatorState
  computed: ComputedFinancials
  onChange: (patch: Partial<CalculatorState>) => void
  onNavigateTab: (tab: CalculatorState['tab']) => void
}

export const FolhaTab: React.FC<FolhaTabProps> = ({ state, computed, onChange, onNavigateTab }) => {
  const isEnabled = state.usarCalcFolha === 1
  const folha = computed.folhaCalculada

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border border-slate-200 card-shadow bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1E3A5F]" />
                <CardTitle className="text-lg font-bold text-slate-900">
                  Cálculo de Despesas com Folha de Pagamento
                </CardTitle>
              </div>
              <CardDescription className="text-slate-500">
                Apuração detalhada de salários base, encargos sociais e provisões trabalhistas (13º
                e férias).
              </CardDescription>
            </div>

            {/* Controles do Cabeçalho: Importar XLSX Discreto + Toggle */}
            <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
              <ImportXlsxButton onImport={onChange} variant="discrete" />
              <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <Switch
                  id="usarCalcFolha"
                  checked={isEnabled}
                  onCheckedChange={(checked) => onChange({ usarCalcFolha: checked ? 1 : 0 })}
                  className="data-[state=checked]:bg-[#1E3A5F]"
                />
                <Label
                  htmlFor="usarCalcFolha"
                  className="text-sm font-semibold cursor-pointer text-slate-800"
                >
                  {isEnabled ? 'Cálculo Ativo' : 'Cálculo Desativado'}
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {isEnabled ? (
            <div className="space-y-6">
              {/* Inputs da Folha */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna 1: Salários e Outros */}
                <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-900">1. Base de Remunerações</h3>

                  <div>
                    <Label
                      htmlFor="folhaSalarios"
                      className="text-xs font-medium text-slate-700 mb-1.5 block"
                    >
                      Total de Salários Base Brutos (R$)
                    </Label>
                    <CurrencyInput
                      id="folhaSalarios"
                      value={state.folhaSalarios}
                      onChange={(val) => onChange({ folhaSalarios: val })}
                      placeholder="0,00"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Soma dos salários contratuais de toda a equipe no período.
                    </p>
                  </div>

                  <div>
                    <Label
                      htmlFor="folhaOutros"
                      className="text-xs font-medium text-slate-700 mb-1.5 block"
                    >
                      Outros Encargos e Benefícios Fixos (R$)
                    </Label>
                    <CurrencyInput
                      id="folhaOutros"
                      value={state.folhaOutros}
                      onChange={(val) => onChange({ folhaOutros: val })}
                      placeholder="0,00"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Vale-transporte, vale-refeição, plano de saúde, seguro de vida e adicionais.
                    </p>
                  </div>
                </div>

                {/* Coluna 2: Encargos % e Provisões */}
                <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-900">2. Encargos & Provisões</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label
                        htmlFor="folhaInss"
                        className="text-xs font-medium text-slate-700 mb-1.5 block"
                      >
                        INSS Patronal (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="folhaInss"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={state.folhaInss || ''}
                          onChange={(e) => onChange({ folhaInss: parseFloat(e.target.value) || 0 })}
                          placeholder="20"
                          className="pr-8 h-9 bg-white text-right tabular-nums font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-500 pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label
                        htmlFor="folhaFgts"
                        className="text-xs font-medium text-slate-700 mb-1.5 block"
                      >
                        FGTS (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="folhaFgts"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={state.folhaFgts || ''}
                          onChange={(e) => onChange({ folhaFgts: parseFloat(e.target.value) || 0 })}
                          placeholder="8"
                          className="pr-8 h-9 bg-white text-right tabular-nums font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-500 pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 space-y-3 border-t border-slate-200">
                    <Label className="text-xs font-bold text-slate-700 block">
                      Provisões Mensais (1/12 avos)
                    </Label>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="folha13"
                        checked={state.folha13 === 1}
                        onCheckedChange={(c) => onChange({ folha13: c ? 1 : 0 })}
                      />
                      <Label
                        htmlFor="folha13"
                        className="text-xs font-medium cursor-pointer text-slate-700"
                      >
                        Provisão de 13º Salário (+1/12 de salários)
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="folhaFerias"
                        checked={state.folhaFerias === 1}
                        onCheckedChange={(c) => onChange({ folhaFerias: c ? 1 : 0 })}
                      />
                      <Label
                        htmlFor="folhaFerias"
                        className="text-xs font-medium cursor-pointer text-slate-700"
                      >
                        Provisão de Férias (+1/12 de salários)
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card de Breakdown em 2 colunas com componente, fórmula e valor */}
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Demonstrativo Detalhado dos Componentes da Folha
                  </h4>
                </div>
                <div className="divide-y divide-slate-100 text-sm">
                  <div className="grid grid-cols-12 p-3.5 items-center hover:bg-slate-50">
                    <div className="col-span-5 font-medium text-slate-800">Salários Base</div>
                    <div className="col-span-4 text-xs text-slate-500">Valor bruto informado</div>
                    <div className="col-span-3 text-right font-semibold text-slate-900 tabular-nums">
                      {formatBRL(folha.salarios)}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 p-3.5 items-center hover:bg-slate-50">
                    <div className="col-span-5 font-medium text-slate-800">
                      INSS Patronal ({state.folhaInss}%)
                    </div>
                    <div className="col-span-4 text-xs text-slate-500">
                      {formatBRL(folha.salarios)} × {state.folhaInss}%
                    </div>
                    <div className="col-span-3 text-right font-semibold text-slate-900 tabular-nums">
                      {formatBRL(folha.inssValor)}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 p-3.5 items-center hover:bg-slate-50">
                    <div className="col-span-5 font-medium text-slate-800">
                      FGTS ({state.folhaFgts}%)
                    </div>
                    <div className="col-span-4 text-xs text-slate-500">
                      {formatBRL(folha.salarios)} × {state.folhaFgts}%
                    </div>
                    <div className="col-span-3 text-right font-semibold text-slate-900 tabular-nums">
                      {formatBRL(folha.fgtsValor)}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 p-3.5 items-center hover:bg-slate-50">
                    <div className="col-span-5 font-medium text-slate-800">
                      Outros Encargos e Benefícios
                    </div>
                    <div className="col-span-4 text-xs text-slate-500">Valor fixo</div>
                    <div className="col-span-3 text-right font-semibold text-slate-900 tabular-nums">
                      {formatBRL(folha.outros)}
                    </div>
                  </div>

                  {state.folha13 === 1 && (
                    <div className="grid grid-cols-12 p-3.5 items-center hover:bg-slate-50 bg-blue-50/20">
                      <div className="col-span-5 font-medium text-slate-800">
                        Provisão de 13º Salário
                      </div>
                      <div className="col-span-4 text-xs text-slate-500">
                        {formatBRL(folha.salarios)} / 12
                      </div>
                      <div className="col-span-3 text-right font-semibold text-slate-900 tabular-nums">
                        {formatBRL(folha.decimoTerceiroValor)}
                      </div>
                    </div>
                  )}

                  {state.folhaFerias === 1 && (
                    <div className="grid grid-cols-12 p-3.5 items-center hover:bg-slate-50 bg-blue-50/20">
                      <div className="col-span-5 font-medium text-slate-800">
                        Provisão de Férias
                      </div>
                      <div className="col-span-4 text-xs text-slate-500">
                        {formatBRL(folha.salarios)} / 12
                      </div>
                      <div className="col-span-3 text-right font-semibold text-slate-900 tabular-nums">
                        {formatBRL(folha.feriasValor)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD DE TOTAL EM DESTAQUE (22px negrito) */}
              <div className="p-6 rounded-lg bg-gradient-to-r from-blue-50 via-sky-50 to-slate-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-700" />
                    <span className="text-sm font-bold text-blue-950 uppercase tracking-wider">
                      Total da Folha de Pagamento
                    </span>
                  </div>
                  <p className="text-xs text-blue-800">
                    Soma de salários + INSS ({formatBRL(folha.inssValor)}) + FGTS (
                    {formatBRL(folha.fgtsValor)}) + outros + provisões
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Alimenta automaticamente o campo{' '}
                    <strong>(−) Despesas com Folha de Pagamento</strong> na aba Cálculo.
                  </p>
                </div>

                <div className="text-right sm:flex-shrink-0">
                  <div className="text-2xl sm:text-3xl font-extrabold text-[#1E3A5F] tabular-nums">
                    {formatBRL(folha.totalFolha)}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => onNavigateTab('calculo')}
                    className="p-0 h-auto text-xs text-blue-700 font-semibold inline-flex items-center gap-1 hover:underline mt-1"
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
                Cálculo Automático de Folha Desativado
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                Quando desativado, o total de despesas com folha de pagamento pode ser digitado
                livremente na aba <strong>Cálculo</strong>.
              </p>
              <Button
                type="button"
                onClick={() => onChange({ usarCalcFolha: 1 })}
                className="mt-4 bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs"
              >
                Ativar Cálculo de Folha
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
