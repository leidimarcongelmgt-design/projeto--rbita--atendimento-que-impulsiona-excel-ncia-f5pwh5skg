import React, { useState, useRef, useMemo, useEffect } from 'react'
import {
  EmpresaRow,
  EMPRESA_COLUMNS,
  EmpresaColumnKey,
  EmpresaFixedColumnKey,
  CustomColumnDef,
} from '@/types/empresa'
import {
  parseEmpresasFile,
  mergeEmpresas,
  saveEmpresasToStorage,
  clearEmpresasStorage,
  deleteEmpresaRecord,
  saveEmpresaRecord,
  loadCustomColumnsFromStorage,
  saveCustomColumnsToStorage,
  sortEmpresasAlphabetically,
  loadEmpresasColumnOrderFromStorage,
  saveEmpresasColumnOrderToStorage,
  clearEmpresasColumnOrderStorage,
} from '@/lib/empresasService'
import { useResizableColumns, RESIZABLE_STORAGE_KEYS } from '@/hooks/use-resizable-columns'
import { ResizableTh } from '@/components/calculator/ResizableTh'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  FileSpreadsheet,
  Upload,
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Plus,
  Columns,
  Pencil,
  ArrowDownAZ,
  ArrowUpAZ,
  RotateCcw,
  GripHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'

interface EmpresasTabProps {
  empresas: EmpresaRow[]
  onEmpresasChange: (empresas: EmpresaRow[]) => void
}

type SortConfig = {
  key: EmpresaColumnKey
  direction: 'asc' | 'desc'
} | null

// Larguras padrão e mínimas recomendadas para as colunas da aba Empresas
const DEFAULT_EMPRESAS_COL_WIDTHS: { [key: string]: number } = {
  index: 48,
  empresas: 240,
  cnpj: 160,
  regimeTrib: 130,
  ramoAtividade: 180,
  filial: 90,
  grupo: 110,
  entrada: 105,
  zona: 90,
  contabil: 120,
  numFunc: 95,
  pesoFolha: 110,
  pesoFiscal: 110,
  receitas: 120,
  despCustos: 120,
  enviaSped: 110,
  observacoes: 180,
  lnk: 100,
  acoes: 64,
}

const MIN_EMPRESAS_COL_WIDTHS: { [key: string]: number } = {
  index: 40,
  empresas: 130,
  cnpj: 120,
  regimeTrib: 90,
  ramoAtividade: 110,
  filial: 60,
  grupo: 80,
  entrada: 80,
  zona: 70,
  contabil: 80,
  numFunc: 70,
  pesoFolha: 80,
  pesoFiscal: 80,
  receitas: 80,
  despCustos: 80,
  enviaSped: 80,
  observacoes: 100,
  lnk: 70,
  acoes: 50,
}

export const EmpresasTab: React.FC<EmpresasTabProps> = ({ empresas, onEmpresasChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Colunas personalizadas do usuário
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>(() => {
    return loadCustomColumnsFromStorage()
  })

  // Hook de controle de largura das colunas redimensionáveis com persistência em sessionStorage/localStorage
  const { widths, startResize, isDraggingRef } = useResizableColumns(
    RESIZABLE_STORAGE_KEYS.EMPRESAS,
    DEFAULT_EMPRESAS_COL_WIDTHS,
    MIN_EMPRESAS_COL_WIDTHS,
  )

  // Salva colunas customizadas
  useEffect(() => {
    saveCustomColumnsToStorage(customColumns)
  }, [customColumns])

  // Ordem salva das colunas móveis (chaves: 'empresas', 'cnpj', ..., ou col.id)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    return loadEmpresasColumnOrderFromStorage()
  })

  // Estados de Drag & Drop para reorganizar colunas
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null)
  const [dropTargetColKey, setDropTargetColKey] = useState<string | null>(null)
  const [dropSide, setDropSide] = useState<'left' | 'right' | null>(null)

  // Estados de busca e ordenação
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [alphabeticalDirection, setAlphabeticalDirection] = useState<'asc' | 'desc'>('asc')

  // Estado para diálogo de conflito (quando já existem empresas e o usuário faz novo upload)
  const [pendingFileRows, setPendingFileRows] = useState<{
    rows: EmpresaRow[]
    ignoredRowsCount: number
    unrecognizedColumns: string[]
  } | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)

  // Diálogo para confirmação de "Limpar Tudo"
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  // Mensagem/aviso de pós-importação
  const [lastImportSummary, setLastImportSummary] = useState<{
    added: number
    updated: number
    ignored: number
    unrecognized: string[]
  } | null>(null)

  // Diálogo para Adicionar Nova Empresa Manualmente
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newEmpresaNome, setNewEmpresaNome] = useState('')
  const [newCnpj, setNewCnpj] = useState('')
  const [newRegimeTrib, setNewRegimeTrib] = useState('')
  const [newRamoAtividade, setNewRamoAtividade] = useState('')
  const [newFilial, setNewFilial] = useState('')
  const [newGrupo, setNewGrupo] = useState('')
  const [newEntrada, setNewEntrada] = useState('')
  const [newZona, setNewZona] = useState('')
  const [newContabil, setNewContabil] = useState('')
  const [newNumFunc, setNewNumFunc] = useState('')
  const [newPesoFolha, setNewPesoFolha] = useState('')
  const [newPesoFiscal, setNewPesoFiscal] = useState('')
  const [newReceitas, setNewReceitas] = useState('')
  const [newDespCustos, setNewDespCustos] = useState('')
  const [newEnviaSped, setNewEnviaSped] = useState('')
  const [newObservacoes, setNewObservacoes] = useState('')
  const [newLnk, setNewLnk] = useState('')
  const [newCustomValues, setNewCustomValues] = useState<Record<string, string>>({})

  // Diálogo para Adicionar Coluna Personalizada
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')

  // Diálogo para Renomear Coluna Personalizada
  const [renameColumnModalOpen, setRenameColumnModalOpen] = useState(false)
  const [columnToRename, setColumnToRename] = useState<CustomColumnDef | null>(null)
  const [renamedColumnTitle, setRenamedColumnTitle] = useState('')

  // Diálogo de confirmação para Remover Coluna Personalizada
  const [deleteColumnModalOpen, setDeleteColumnModalOpen] = useState(false)
  const [columnToDelete, setColumnToDelete] = useState<CustomColumnDef | null>(null)

  // Máscara dinâmica de CNPJ: 00.000.000/0000-00
  const applyCnpjMask = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 14)
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
    if (digits.length <= 12)
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
  }

  // Salva permanentemente sempre que a lista de empresas mudar
  useEffect(() => {
    saveEmpresasToStorage(empresas)
  }, [empresas])

  // Tratamento do arquivo selecionado
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reseta o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''

    try {
      const parsed = await parseEmpresasFile(file)

      if (parsed.rows.length === 0) {
        toast.error('Nenhum registro válido encontrado na planilha.')
        if (parsed.ignoredRowsCount > 0) {
          toast.warning(
            `${parsed.ignoredRowsCount} linha(s) ignorada(s) por falta de EMPRESAS e CNPJ.`,
          )
        }
        return
      }

      // Se já existem empresas cadastradas, pergunta se quer Substituir ou Adicionar
      if (empresas.length > 0) {
        setPendingFileRows(parsed)
        setConflictDialogOpen(true)
      } else {
        // Importação direta quando a lista está vazia
        applyImport(parsed.rows, 'replace', parsed.ignoredRowsCount, parsed.unrecognizedColumns)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao ler a planilha. Verifique se o formato é .xlsx ou .xls válido.')
    }
  }

  const applyImport = (
    incomingRows: EmpresaRow[],
    mode: 'replace' | 'append',
    ignoredCount = 0,
    unrecognizedCols: string[] = [],
  ) => {
    const result = mergeEmpresas(empresas, incomingRows, mode)
    if (mode === 'replace') {
      clearEmpresasStorage()
    }
    onEmpresasChange(result.newRecords)
    saveEmpresasToStorage(result.newRecords)

    setLastImportSummary({
      added: result.addedCount,
      updated: result.updatedCount,
      ignored: ignoredCount,
      unrecognized: unrecognizedCols,
    })

    if (mode === 'replace') {
      toast.success(`${result.addedCount} empresa(s) importada(s) com sucesso.`)
    } else {
      let msg = `${result.addedCount} nova(s) empresa(s) adicionada(s)`
      if (result.updatedCount > 0) {
        msg += `, ${result.updatedCount} atualizada(s) por CNPJ existente`
      }
      toast.success(msg + '.')
    }

    if (ignoredCount > 0) {
      toast.warning(`${ignoredCount} linha(s) sem EMPRESAS e CNPJ foram ignoradas.`)
    }
    if (unrecognizedCols.length > 0) {
      toast.info(`Colunas não reconhecidas e descartadas: ${unrecognizedCols.join(', ')}`)
    }

    setPendingFileRows(null)
    setConflictDialogOpen(false)
  }

  // Ações de conflito
  const handleConfirmReplace = () => {
    if (!pendingFileRows) return
    applyImport(
      pendingFileRows.rows,
      'replace',
      pendingFileRows.ignoredRowsCount,
      pendingFileRows.unrecognizedColumns,
    )
  }

  const handleConfirmAppend = () => {
    if (!pendingFileRows) return
    applyImport(
      pendingFileRows.rows,
      'append',
      pendingFileRows.ignoredRowsCount,
      pendingFileRows.unrecognizedColumns,
    )
  }

  // Limpar tudo
  const handleClearAll = () => {
    clearEmpresasStorage()
    onEmpresasChange([])
    setLastImportSummary(null)
    setClearDialogOpen(false)
    toast.info('Lista de empresas limpa com sucesso.')
  }

  // Edição inline de campos fixos
  const handleFieldChange = (id: string, field: EmpresaFixedColumnKey, value: string) => {
    let changedRow: EmpresaRow | undefined
    const updated = empresas.map((r) => {
      if (r.id !== id) return r
      changedRow = {
        ...r,
        [field]: field === 'cnpj' ? applyCnpjMask(value) : value,
      }
      return changedRow
    })
    onEmpresasChange(updated)
    if (changedRow) saveEmpresaRecord(changedRow).catch(() => {})
  }

  // Edição inline de colunas personalizadas
  const handleCustomFieldChange = (id: string, colId: string, value: string) => {
    let changedRow: EmpresaRow | undefined
    const updated = empresas.map((r) => {
      if (r.id !== id) return r
      changedRow = {
        ...r,
        customFields: {
          ...(r.customFields || {}),
          [colId]: value,
        },
      }
      return changedRow
    })
    onEmpresasChange(updated)
    if (changedRow) saveEmpresaRecord(changedRow).catch(() => {})
  }

  // Adicionar linha manualmente
  const handleAddManualRow = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedNome = newEmpresaNome.trim()
    if (!trimmedNome) {
      toast.error('Informe o nome da EMPRESA.')
      return
    }

    const newRow: EmpresaRow = {
      id: `emp-manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      empresas: trimmedNome,
      cnpj: newCnpj.trim(),
      regimeTrib: newRegimeTrib.trim(),
      ramoAtividade: newRamoAtividade.trim(),
      filial: newFilial.trim(),
      grupo: newGrupo.trim(),
      entrada: newEntrada.trim(),
      zona: newZona.trim(),
      contabil: newContabil.trim(),
      numFunc: newNumFunc.trim(),
      pesoFolha: newPesoFolha.trim(),
      pesoFiscal: newPesoFiscal.trim(),
      receitas: newReceitas.trim(),
      despCustos: newDespCustos.trim(),
      enviaSped: newEnviaSped.trim(),
      observacoes: newObservacoes.trim(),
      lnk: newLnk.trim(),
      isManual: true,
      customFields: { ...newCustomValues },
    }

    const updated = [...empresas, newRow]
    onEmpresasChange(updated)
    saveEmpresasToStorage(updated)
    saveEmpresaRecord(newRow).catch(() => {})

    // Limpa formulário
    setNewEmpresaNome('')
    setNewCnpj('')
    setNewRegimeTrib('')
    setNewRamoAtividade('')
    setNewFilial('')
    setNewGrupo('')
    setNewEntrada('')
    setNewZona('')
    setNewContabil('')
    setNewNumFunc('')
    setNewPesoFolha('')
    setNewPesoFiscal('')
    setNewReceitas('')
    setNewDespCustos('')
    setNewEnviaSped('')
    setNewObservacoes('')
    setNewLnk('')
    setNewCustomValues({})
    setAddModalOpen(false)
    toast.success(`Empresa "${trimmedNome}" cadastrada com sucesso!`)
  }

  // Criar nova coluna personalizada
  const handleAddCustomColumn = (e: React.FormEvent) => {
    e.preventDefault()
    const label = newColumnTitle.trim()
    if (!label) {
      toast.error('Informe o título da coluna.')
      return
    }

    // Verifica se colisão com colunas fixas ou colunas já existentes
    const fixedConflict = EMPRESA_COLUMNS.some((c) => c.label.toLowerCase() === label.toLowerCase())
    const customConflict = customColumns.some((c) => c.label.toLowerCase() === label.toLowerCase())

    if (fixedConflict || customConflict) {
      toast.error('Já existe uma coluna com esse título.')
      return
    }

    const newCol: CustomColumnDef = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label,
      created: new Date().toISOString(),
    }

    const updatedCols = [...customColumns, newCol]
    setCustomColumns(updatedCols)
    saveCustomColumnsToStorage(updatedCols)
    setNewColumnTitle('')
    setAddColumnModalOpen(false)
    toast.success(`Coluna "${label}" adicionada com sucesso!`)
  }

  // Confirmar renomeação de coluna personalizada
  const handleConfirmRenameColumn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!columnToRename) return
    const newLabel = renamedColumnTitle.trim()
    if (!newLabel) {
      toast.error('Informe o novo título da coluna.')
      return
    }

    const fixedConflict = EMPRESA_COLUMNS.some(
      (c) => c.label.toLowerCase() === newLabel.toLowerCase(),
    )
    const customConflict = customColumns.some(
      (c) => c.id !== columnToRename.id && c.label.toLowerCase() === newLabel.toLowerCase(),
    )

    if (fixedConflict || customConflict) {
      toast.error('Já existe uma coluna com esse título.')
      return
    }

    const updatedCols = customColumns.map((c) =>
      c.id === columnToRename.id ? { ...c, label: newLabel } : c,
    )
    setCustomColumns(updatedCols)
    saveCustomColumnsToStorage(updatedCols)
    toast.success(`Coluna renomeada para "${newLabel}".`)
    setRenameColumnModalOpen(false)
    setColumnToRename(null)
    setRenamedColumnTitle('')
  }

  // Confirmar remoção de coluna personalizada
  const handleConfirmDeleteColumn = () => {
    if (!columnToDelete) return
    const colId = columnToDelete.id
    const colLabel = columnToDelete.label

    // Remove das definições de colunas
    const updatedCols = customColumns.filter((c) => c.id !== colId)
    setCustomColumns(updatedCols)
    saveCustomColumnsToStorage(updatedCols)

    // Remove da ordem das colunas
    const updatedOrder = columnOrder.filter((k) => k !== colId)
    setColumnOrder(updatedOrder)
    saveEmpresasColumnOrderToStorage(updatedOrder)

    // Remove os valores correspondentes de todas as linhas de empresa
    const updatedEmpresas = empresas.map((emp) => {
      if (!emp.customFields || !(colId in emp.customFields)) return emp
      const copyFields = { ...emp.customFields }
      delete copyFields[colId]
      return { ...emp, customFields: copyFields }
    })
    onEmpresasChange(updatedEmpresas)
    saveEmpresasToStorage(updatedEmpresas)

    // Se estiver ordenando por essa coluna, reseta a ordenação
    if (sortConfig?.key === colId) {
      setSortConfig(null)
    }

    toast.success(`Coluna "${colLabel}" e seus valores foram removidos.`)
    setDeleteColumnModalOpen(false)
    setColumnToDelete(null)
  }

  // Remover linha individual
  const handleDeleteRow = (id: string, empresaNome: string) => {
    deleteEmpresaRecord(id).catch(() => {})
    const updated = empresas.filter((row) => row.id !== id)
    onEmpresasChange(updated)
    saveEmpresasToStorage(updated)
    toast.success(`Empresa "${empresaNome || 'Sem Nome'}" removida.`)
  }

  // Alternar ordenação
  const handleSort = (columnKey: EmpresaColumnKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== columnKey) {
        return { key: columnKey, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { key: columnKey, direction: 'desc' }
      }
      return null // desativa ordenação no 3º clique
    })
  }

  // Ordenação permanente de todas as linhas pelo nome da empresa (A→Z / Z→A)
  const handleSortAlphabetically = () => {
    if (empresas.length === 0) {
      toast.info('Não há empresas para ordenar.')
      return
    }

    const nextDirection = alphabeticalDirection === 'asc' ? 'desc' : 'asc'
    const targetDirection = alphabeticalDirection // aplica a direção atual indicada no botão, depois alterna
    const sorted = sortEmpresasAlphabetically(empresas, targetDirection)

    // Atualiza permanentemente no estado e no storage
    onEmpresasChange(sorted)
    saveEmpresasToStorage(sorted)

    // Se houver sortConfig ativo na coluna 'empresas', alinha a indicação visual; se for em outra coluna, remove
    setSortConfig({ key: 'empresas', direction: targetDirection })
    setAlphabeticalDirection(nextDirection)

    toast.success(
      targetDirection === 'asc'
        ? 'Linhas reordenadas permanentemente em ordem alfabética (A → Z)!'
        : 'Linhas reordenadas permanentemente em ordem alfabética (Z → A)!',
    )
  }

  // Lista unificada e ordenada de colunas móveis (fixas + personalizadas)
  interface UnifiedColumnDef {
    key: string
    label: string
    isCustom: boolean
    numeric?: boolean
    tooltip?: string
  }

  // Mapa de todas as colunas disponíveis
  const availableColumnsMap = useMemo(() => {
    const map = new Map<string, UnifiedColumnDef>()
    EMPRESA_COLUMNS.forEach((col) => {
      map.set(col.key, {
        key: col.key,
        label: col.label,
        isCustom: false,
        numeric: col.numeric,
        tooltip: col.tooltip,
      })
    })
    customColumns.forEach((col) => {
      map.set(col.id, {
        key: col.id,
        label: col.label,
        isCustom: true,
      })
    })
    return map
  }, [customColumns])

  // Colunas ordenadas de acordo com columnOrder (ou padrão no final para novas)
  const orderedColumns = useMemo<UnifiedColumnDef[]>(() => {
    const list: UnifiedColumnDef[] = []
    const seen = new Set<string>()

    // 1. Aplica a ordem salva para as colunas existentes
    columnOrder.forEach((key) => {
      const col = availableColumnsMap.get(key)
      if (col) {
        list.push(col)
        seen.add(key)
      }
    })

    // 2. Adiciona colunas padrão que ainda não estavam no columnOrder
    EMPRESA_COLUMNS.forEach((col) => {
      if (!seen.has(col.key)) {
        list.push({
          key: col.key,
          label: col.label,
          isCustom: false,
          numeric: col.numeric,
          tooltip: col.tooltip,
        })
        seen.add(col.key)
      }
    })

    // 3. Adiciona colunas personalizadas que ainda não estavam na ordem
    customColumns.forEach((col) => {
      if (!seen.has(col.id)) {
        list.push({
          key: col.id,
          label: col.label,
          isCustom: true,
        })
        seen.add(col.id)
      }
    })

    return list
  }, [columnOrder, availableColumnsMap, customColumns])

  // Handlers para reordenação via Drag and Drop
  const handleColumnDragStart = (e: React.DragEvent<HTMLTableCellElement>, key: string) => {
    setDraggedColKey(key)
    e.dataTransfer.setData('text/plain', key)
  }

  const handleColumnDragOver = (e: React.DragEvent<HTMLTableCellElement>, targetKey: string) => {
    if (!draggedColKey || draggedColKey === targetKey) {
      setDropTargetColKey(null)
      setDropSide(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    const side = e.clientX < midX ? 'left' : 'right'
    setDropTargetColKey(targetKey)
    setDropSide(side)
  }

  const handleColumnDragLeave = (_e: React.DragEvent<HTMLTableCellElement>, targetKey: string) => {
    if (dropTargetColKey === targetKey) {
      setDropTargetColKey(null)
      setDropSide(null)
    }
  }

  const handleColumnDrop = (_e: React.DragEvent<HTMLTableCellElement>, targetKey: string) => {
    if (!draggedColKey || draggedColKey === targetKey) {
      setDraggedColKey(null)
      setDropTargetColKey(null)
      setDropSide(null)
      return
    }

    const currentKeys = orderedColumns.map((c) => c.key)
    const fromIndex = currentKeys.indexOf(draggedColKey)
    if (fromIndex === -1) return

    // Remove do índice de origem
    const remaining = currentKeys.filter((k) => k !== draggedColKey)
    const targetIdxInRemaining = remaining.indexOf(targetKey)

    const insertIdx = dropSide === 'right' ? targetIdxInRemaining + 1 : targetIdxInRemaining
    const newOrder = [...remaining]
    newOrder.splice(insertIdx, 0, draggedColKey)

    setColumnOrder(newOrder)
    saveEmpresasColumnOrderToStorage(newOrder)
    setDraggedColKey(null)
    setDropTargetColKey(null)
    setDropSide(null)

    const draggedDef = availableColumnsMap.get(draggedColKey)
    const targetDef = availableColumnsMap.get(targetKey)
    toast.success(
      `Coluna "${draggedDef?.label || draggedColKey}" reposicionada ${dropSide === 'right' ? 'após' : 'antes de'} "${targetDef?.label || targetKey}".`,
    )
  }

  const handleColumnDragEnd = () => {
    setDraggedColKey(null)
    setDropTargetColKey(null)
    setDropSide(null)
  }

  // Restaura ordem original padrão
  const handleResetColumnOrder = () => {
    clearEmpresasColumnOrderStorage()
    setColumnOrder([])
    toast.info('Ordem original das colunas restaurada!')
  }

  // Verifica se a ordem atual difere da ordem padrão original
  const isCustomOrderActive = useMemo(() => {
    if (columnOrder.length === 0) return false
    const defaultKeys = [...EMPRESA_COLUMNS.map((c) => c.key), ...customColumns.map((c) => c.id)]
    if (columnOrder.length !== defaultKeys.length) return true
    return columnOrder.some((key, idx) => key !== defaultKeys[idx])
  }, [columnOrder, customColumns])

  // Filtragem e ordenação memoizadas
  const filteredAndSortedEmpresas = useMemo(() => {
    let result = [...empresas]

    // Filtro por texto em tempo real (EMPRESAS, CNPJ ou colunas personalizadas)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const qDigits = q.replace(/\D/g, '')
      result = result.filter((item) => {
        const matchEmpresa = (item.empresas || '').toLowerCase().includes(q)
        const matchCnpj = (item.cnpj || '').toLowerCase().includes(q)
        const matchCnpjDigits = qDigits
          ? (item.cnpj || '').replace(/\D/g, '').includes(qDigits)
          : false
        const matchRegime = (item.regimeTrib || '').toLowerCase().includes(q)
        const matchRamo = (item.ramoAtividade || '').toLowerCase().includes(q)
        const matchFilial = (item.filial || '').toLowerCase().includes(q)
        const matchGrupo = (item.grupo || '').toLowerCase().includes(q)
        const matchEntrada = (item.entrada || '').toLowerCase().includes(q)
        const matchZona = (item.zona || '').toLowerCase().includes(q)
        const matchContabil = (item.contabil || '').toLowerCase().includes(q)
        const matchNumFunc = String(item.numFunc ?? '')
          .toLowerCase()
          .includes(q)
        const matchPesoFolha = String(item.pesoFolha ?? '')
          .toLowerCase()
          .includes(q)
        const matchPesoFiscal = String(item.pesoFiscal ?? '')
          .toLowerCase()
          .includes(q)
        const matchReceitas = String(item.receitas ?? '')
          .toLowerCase()
          .includes(q)
        const matchDespCustos = String(item.despCustos ?? '')
          .toLowerCase()
          .includes(q)
        const matchEnviaSped = (item.enviaSped || '').toLowerCase().includes(q)
        const matchObs = (item.observacoes || '').toLowerCase().includes(q)
        const matchLnk = (item.lnk || '').toLowerCase().includes(q)

        // Busca em colunas personalizadas
        let matchCustom = false
        if (item.customFields) {
          for (const val of Object.values(item.customFields)) {
            if (val && String(val).toLowerCase().includes(q)) {
              matchCustom = true
              break
            }
          }
        }

        return (
          matchEmpresa ||
          matchCnpj ||
          matchCnpjDigits ||
          matchRegime ||
          matchRamo ||
          matchFilial ||
          matchGrupo ||
          matchEntrada ||
          matchZona ||
          matchContabil ||
          matchNumFunc ||
          matchPesoFolha ||
          matchPesoFiscal ||
          matchReceitas ||
          matchDespCustos ||
          matchEnviaSped ||
          matchObs ||
          matchLnk ||
          matchCustom
        )
      })
    }

    // Ordenação
    if (sortConfig) {
      const { key, direction } = sortConfig
      const isFixedCol = EMPRESA_COLUMNS.some((c) => c.key === key)

      result.sort((a, b) => {
        let valA: unknown
        let valB: unknown

        if (isFixedCol) {
          valA = a[key as EmpresaFixedColumnKey]
          valB = b[key as EmpresaFixedColumnKey]
        } else {
          // Coluna personalizada
          valA = a.customFields?.[key] ?? ''
          valB = b.customFields?.[key] ?? ''
        }

        const strA = (valA ?? '').toString().toLowerCase()
        const strB = (valB ?? '').toString().toLowerCase()
        const cmp = strA.localeCompare(strB, 'pt-BR', { numeric: true })
        return direction === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [empresas, searchQuery, sortConfig])

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Card Principal: Importação e Gerenciamento */}
        <Card className="border border-slate-200 card-shadow bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#1E3A5F]" />
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Importação de Empresas
                  </CardTitle>
                </div>
                <CardDescription className="text-slate-500 mt-1">
                  Importe planilhas Excel (.xlsx ou .xls) com todas as colunas de dados da empresa
                  (EMPRESAS, CNPJ, REGIME TRIB., RAMO DE ATIVIDADE 2, FILIAL, GRUPO, ZONA, CONTÁBIL,
                  Nº FUNC., PESO FOLHA, PESO FISCAL, RECEITAS, DESP./CUSTOS, ENVIA SPED,
                  OBSERVAÇÕES, LNK).
                </CardDescription>
              </div>

              {/* Botões de Ação do Topo */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleFileSelected}
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(true)}
                  className="text-xs h-9 text-slate-700 hover:text-slate-900 border-slate-300 gap-1.5"
                  title="Cadastrar uma empresa manualmente"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  <span>Adicionar Linha</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddColumnModalOpen(true)}
                  className="text-xs h-9 text-purple-900 hover:bg-purple-50 border-purple-200 gap-1.5 font-medium"
                  title="Criar coluna personalizada na tabela"
                >
                  <Columns className="w-3.5 h-3.5 text-purple-800" />
                  <span>Adicionar Coluna</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSortAlphabetically}
                  disabled={empresas.length === 0}
                  className="text-xs h-9 text-[#1E3A5F] hover:bg-slate-100 hover:text-[#16304F] border-slate-300 gap-1.5 font-medium transition-colors disabled:opacity-50"
                  title={
                    alphabeticalDirection === 'asc'
                      ? 'Reordenar permanentemente as linhas de A a Z pelo nome da empresa'
                      : 'Reordenar permanentemente as linhas de Z a A pelo nome da empresa'
                  }
                >
                  {alphabeticalDirection === 'asc' ? (
                    <ArrowDownAZ className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  ) : (
                    <ArrowUpAZ className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  )}
                  <span>Ordem Alfabética ({alphabeticalDirection === 'asc' ? 'A→Z' : 'Z→A'})</span>
                </Button>

                {isCustomOrderActive && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetColumnOrder}
                    className="text-xs h-9 text-amber-800 hover:bg-amber-50 border-amber-300 gap-1.5 font-medium"
                    title="Restaurar as colunas para o posicionamento padrão original"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Restaurar Ordem Original das Colunas</span>
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 px-4 gap-2 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importar Planilha (XLSX)</span>
                </Button>

                {empresas.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClearDialogOpen(true)}
                    className="text-xs h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-slate-300 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Tudo</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Banner com cabeçalho de referência visual inspirado na imagem enviada */}
            <div className="rounded-lg border border-purple-900/20 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-900" />
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Estrutura esperada do cabeçalho da planilha ({EMPRESA_COLUMNS.length} colunas)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Todas as colunas da planilha são importadas e editáveis. Arraste as colunas para
                  reordenar.
                </span>
              </div>

              {/* Representação visual do cabeçalho (cores roxas como na imagem anexada) */}
              <div className="overflow-x-auto pb-1">
                <div className="inline-flex min-w-full text-[11px] font-bold text-white tracking-wider rounded overflow-hidden shadow-xs border border-purple-950">
                  {orderedColumns.map((col) => (
                    <div
                      key={col.key}
                      className={`${
                        col.isCustom ? 'bg-[#4a0d4a] text-purple-200' : 'bg-[#380638]'
                      } px-3 py-2 whitespace-nowrap text-center border-r border-purple-950/40`}
                    >
                      {col.label}
                      {col.isCustom ? ' (extra)' : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alerta de Resumo da Última Importação */}
            {lastImportSummary && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      Importação processada: {lastImportSummary.added} registro(s) adicionado(s)
                      {lastImportSummary.updated > 0 &&
                        `, ${lastImportSummary.updated} atualizado(s) por CNPJ`}
                      .
                    </p>
                    {lastImportSummary.ignored > 0 && (
                      <p className="text-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {lastImportSummary.ignored} linha(s) ignorada(s) por ausência de EMPRESAS e
                        CNPJ.
                      </p>
                    )}
                    {lastImportSummary.unrecognized.length > 0 && (
                      <p className="text-slate-500">
                        Colunas não mapeadas descartadas:{' '}
                        <span className="font-mono text-slate-700">
                          {lastImportSummary.unrecognized.join(', ')}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLastImportSummary(null)}
                  className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {/* Barra de Busca e Contador */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Filtrar por EMPRESAS ou CNPJ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-8 text-xs bg-[#F9FAFB]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Badge
                  variant="outline"
                  className="font-semibold px-2.5 py-1 text-slate-700 bg-slate-50"
                >
                  {empresas.length}{' '}
                  {empresas.length === 1 ? 'empresa importada' : 'empresas importadas'}
                </Badge>
                {searchQuery && (
                  <span className="text-slate-500">
                    ({filteredAndSortedEmpresas.length} exibida
                    {filteredAndSortedEmpresas.length === 1 ? '' : 's'})
                  </span>
                )}
                {customColumns.length > 0 && (
                  <Badge
                    variant="outline"
                    className="font-medium px-2 py-0.5 text-purple-800 bg-purple-50 border-purple-200"
                  >
                    {customColumns.length}{' '}
                    {customColumns.length === 1 ? 'coluna extra' : 'colunas extras'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Tabela com as 9 Colunas */}
            {empresas.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-12 text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-slate-200/80 flex items-center justify-center mx-auto mb-3 text-slate-500">
                  <Building className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Nenhuma empresa importada</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                  Clique no botão abaixo para carregar uma planilha Excel com as colunas da empresa
                  (EMPRESAS, CNPJ, REGIME TRIB., RAMO DE ATIVIDADE 2, FILIAL, GRUPO, ZONA, CONTÁBIL,
                  Nº FUNC., PESO FOLHA, PESO FISCAL, RECEITAS, DESP./CUSTOS, ENVIA SPED,
                  OBSERVAÇÕES, LNK).
                </p>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 px-4 gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Selecionar Planilha (.xlsx, .xls)</span>
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs table-fixed">
                    <thead>
                      <tr className="bg-[#380638] text-white select-none">
                        <ResizableTh
                          width={widths.index}
                          minWidth={MIN_EMPRESAS_COL_WIDTHS.index}
                          resizable={true}
                          onResizeStart={(e) => startResize(e, 'index')}
                          className="py-2.5 px-3 font-semibold text-center border-r border-purple-950/40"
                        >
                          #
                        </ResizableTh>
                        {orderedColumns.map((col) => {
                          const isSorted = sortConfig?.key === col.key
                          const colWidth = widths[col.key] || (col.isCustom ? 150 : 120)
                          const minColWidth =
                            MIN_EMPRESAS_COL_WIDTHS[col.key] || (col.isCustom ? 80 : 70)
                          const customColObj = col.isCustom
                            ? customColumns.find((c) => c.id === col.key)
                            : null

                          return (
                            <ResizableTh
                              key={col.key}
                              columnKey={col.key}
                              draggableColumn={true}
                              dropIndicator={dropTargetColKey === col.key ? dropSide : null}
                              onColumnDragStart={handleColumnDragStart}
                              onColumnDragOver={handleColumnDragOver}
                              onColumnDragLeave={handleColumnDragLeave}
                              onColumnDrop={handleColumnDrop}
                              onColumnDragEnd={handleColumnDragEnd}
                              width={colWidth}
                              minWidth={minColWidth}
                              resizable={true}
                              onResizeStart={(e) => startResize(e, col.key)}
                              onHeaderClick={() => handleSort(col.key)}
                              isDraggingRef={isDraggingRef}
                              className={`py-2.5 px-3 font-bold uppercase tracking-wider transition-colors border-r border-purple-950/40 whitespace-nowrap overflow-hidden ${
                                col.isCustom
                                  ? 'bg-[#420942] hover:bg-purple-900/60'
                                  : 'hover:bg-purple-900/60'
                              } ${col.numeric ? 'text-right' : 'text-left'}`}
                              title={
                                col.tooltip ||
                                (col.isCustom
                                  ? `Coluna personalizada: ${col.label}. Arraste para mover ou clique para ordenar.`
                                  : `Coluna ${col.label}. Arraste para mover ou clique para ordenar.`)
                              }
                            >
                              <div
                                className={`inline-flex items-center gap-1.5 w-full overflow-hidden ${
                                  col.isCustom
                                    ? 'justify-between'
                                    : col.numeric
                                      ? 'justify-end'
                                      : 'justify-start'
                                }`}
                              >
                                <div className="inline-flex items-center gap-1.5 truncate">
                                  <GripHorizontal className="w-3 h-3 text-purple-300 opacity-40 hover:opacity-100 flex-shrink-0 cursor-grab" />
                                  <span className="truncate">{col.label}</span>
                                  {isSorted ? (
                                    sortConfig.direction === 'asc' ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-purple-300 opacity-60 flex-shrink-0" />
                                  )}
                                </div>

                                {col.isCustom && customColObj && (
                                  <div
                                    className="inline-flex items-center gap-0.5 flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setColumnToRename(customColObj)
                                            setRenamedColumnTitle(customColObj.label)
                                            setRenameColumnModalOpen(true)
                                          }}
                                          className="h-5 w-5 rounded p-0 text-purple-300 hover:text-white hover:bg-purple-800/80 inline-flex items-center justify-center transition-colors"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <span>Renomear coluna</span>
                                      </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setColumnToDelete(customColObj)
                                            setDeleteColumnModalOpen(true)
                                          }}
                                          className="h-5 w-5 rounded p-0 text-purple-300 hover:text-red-300 hover:bg-red-950/60 inline-flex items-center justify-center transition-colors"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <span>Remover coluna</span>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}
                              </div>
                            </ResizableTh>
                          )
                        })}

                        <th
                          style={{
                            width: `${widths.acoes}px`,
                            minWidth: `${MIN_EMPRESAS_COL_WIDTHS.acoes}px`,
                          }}
                          className="py-2.5 px-3 font-semibold text-center select-none"
                        >
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredAndSortedEmpresas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2 + orderedColumns.length}
                            className="py-8 text-center text-slate-500"
                          >
                            Nenhum registro encontrado para o filtro "{searchQuery}".
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedEmpresas.map((empresa, index) => (
                          <tr
                            key={empresa.id}
                            className="hover:bg-slate-50 transition-colors group"
                          >
                            <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100 truncate">
                              <div className="flex items-center justify-center gap-1">
                                <span>{index + 1}</span>
                                {empresa.isManual && (
                                  <span
                                    title="Linha criada manualmente"
                                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                                  />
                                )}
                              </div>
                            </td>

                            {/* Células na ordem dinâmica de orderedColumns */}
                            {orderedColumns.map((col) => {
                              if (col.isCustom) {
                                const cellVal = empresa.customFields?.[col.key] ?? ''
                                return (
                                  <td
                                    key={col.key}
                                    className="py-1 px-1 border-r border-slate-100 overflow-hidden bg-purple-50/20"
                                  >
                                    <Input
                                      value={cellVal}
                                      onChange={(e) =>
                                        handleCustomFieldChange(empresa.id, col.key, e.target.value)
                                      }
                                      className="h-8 text-xs text-slate-800 border-transparent hover:border-purple-300 focus:border-purple-700 bg-transparent focus:bg-white w-full"
                                      placeholder="—"
                                    />
                                  </td>
                                )
                              }

                              const fixedKey = col.key as EmpresaFixedColumnKey
                              const rawVal = empresa[fixedKey]
                              const cellVal =
                                rawVal !== undefined && rawVal !== null ? String(rawVal) : ''
                              const isEmpresaName = fixedKey === 'empresas'
                              const isCnpj = fixedKey === 'cnpj'
                              const isNumeric = col.numeric

                              return (
                                <td
                                  key={col.key}
                                  className="py-1 px-1 border-r border-slate-100 overflow-hidden"
                                >
                                  <Input
                                    value={cellVal}
                                    onChange={(e) =>
                                      handleFieldChange(empresa.id, fixedKey, e.target.value)
                                    }
                                    className={`h-8 text-xs border-transparent hover:border-slate-300 focus:border-[#1E3A5F] bg-transparent focus:bg-white w-full ${
                                      isEmpresaName
                                        ? 'font-medium text-slate-900'
                                        : isCnpj
                                          ? 'font-mono text-slate-700'
                                          : isNumeric
                                            ? 'text-right font-mono text-slate-700'
                                            : 'text-slate-700'
                                    }`}
                                    placeholder={
                                      isEmpresaName
                                        ? 'Nome da empresa'
                                        : isCnpj
                                          ? '00.000.000/0000-00'
                                          : '—'
                                    }
                                  />
                                </td>
                              )
                            })}

                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRow(empresa.id, empresa.empresas)}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <span>Remover empresa</span>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diálogo de Conflito de Importação (Substituir vs Adicionar) */}
        <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Como deseja importar a nova planilha?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Já existem {empresas.length} empresa(s) cadastradas. A nova planilha contém{' '}
                {pendingFileRows?.rows.length ?? 0} empresa(s) válidas.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 text-xs text-slate-600 space-y-2">
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">Substituir tudo</span>
                Apaga os registros atuais e mantém apenas os {pendingFileRows?.rows.length ??
                  0}{' '}
                novos registros da planilha.
              </div>
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">
                  Adicionar às existentes
                </span>
                Acrescenta os novos registros. Caso um CNPJ já exista na tabela, a linha existente
                será atualizada com os novos dados sem duplicar.
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConflictDialogOpen(false)}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleConfirmReplace}
                className="text-xs h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-slate-300"
              >
                Substituir tudo
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAppend}
                className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9"
              >
                Adicionar às existentes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo para Adicionar Nova Linha / Empresa Manualmente */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Cadastrar Empresa Manualmente
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Preencha os dados da empresa. Apenas o nome da empresa é obrigatório; os demais
                campos são opcionais e podem ser preenchidos ou editados inline a qualquer momento.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddManualRow} className="space-y-3.5 pt-2">
              <div className="space-y-1">
                <Label htmlFor="manualEmpresaNome" className="text-xs font-semibold text-slate-700">
                  EMPRESAS (Razão Social / Nome) *
                </Label>
                <Input
                  id="manualEmpresaNome"
                  placeholder="Ex: Empresa Exemplo Ltda"
                  value={newEmpresaNome}
                  onChange={(e) => setNewEmpresaNome(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="manualEmpresaCnpj"
                    className="text-xs font-semibold text-slate-700"
                  >
                    CNPJ (com máscara)
                  </Label>
                  <Input
                    id="manualEmpresaCnpj"
                    placeholder="00.000.000/0000-00"
                    value={newCnpj}
                    onChange={(e) => setNewCnpj(applyCnpjMask(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="manualRegimeTrib"
                    className="text-xs font-semibold text-slate-700"
                  >
                    REGIME TRIB.
                  </Label>
                  <Input
                    id="manualRegimeTrib"
                    placeholder="Ex: Simples Nacional, Lucro Presumido"
                    value={newRegimeTrib}
                    onChange={(e) => setNewRegimeTrib(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manualRamo" className="text-xs font-semibold text-slate-700">
                    RAMO DE ATIVIDADE 2
                  </Label>
                  <Input
                    id="manualRamo"
                    placeholder="Ex: Comércio Varejista"
                    value={newRamoAtividade}
                    onChange={(e) => setNewRamoAtividade(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualFilial" className="text-xs font-semibold text-slate-700">
                    FILIAL
                  </Label>
                  <Input
                    id="manualFilial"
                    placeholder="Ex: Sim, Não, 001"
                    value={newFilial}
                    onChange={(e) => setNewFilial(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualGrupo" className="text-xs font-semibold text-slate-700">
                    GRUPO
                  </Label>
                  <Input
                    id="manualGrupo"
                    placeholder="Ex: Grupo A"
                    value={newGrupo}
                    onChange={(e) => setNewGrupo(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manualEntrada" className="text-xs font-semibold text-slate-700">
                    CLIENTE DESDE
                  </Label>
                  <Input
                    id="manualEntrada"
                    placeholder="DD/MM/AAAA"
                    value={newEntrada}
                    onChange={(e) => setNewEntrada(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="manualEmpresaZona"
                    className="text-xs font-semibold text-slate-700"
                  >
                    ZONA
                  </Label>
                  <Input
                    id="manualEmpresaZona"
                    placeholder="Ex: 01, Zona Sul"
                    value={newZona}
                    onChange={(e) => setNewZona(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualContabil" className="text-xs font-semibold text-slate-700">
                    CONTÁBIL
                  </Label>
                  <Input
                    id="manualContabil"
                    placeholder="Ex: Resp. Contábil"
                    value={newContabil}
                    onChange={(e) => setNewContabil(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manualNumFunc" className="text-xs font-semibold text-slate-700">
                    Nº FUNC.
                  </Label>
                  <Input
                    id="manualNumFunc"
                    placeholder="0"
                    value={newNumFunc}
                    onChange={(e) => setNewNumFunc(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualPesoFolha" className="text-xs font-semibold text-slate-700">
                    PESO FOLHA
                  </Label>
                  <Input
                    id="manualPesoFolha"
                    placeholder="0"
                    value={newPesoFolha}
                    onChange={(e) => setNewPesoFolha(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="manualPesoFiscal"
                    className="text-xs font-semibold text-slate-700"
                  >
                    PESO FISCAL
                  </Label>
                  <Input
                    id="manualPesoFiscal"
                    placeholder="0"
                    value={newPesoFiscal}
                    onChange={(e) => setNewPesoFiscal(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualReceitas" className="text-xs font-semibold text-slate-700">
                    RECEITAS
                  </Label>
                  <Input
                    id="manualReceitas"
                    placeholder="0"
                    value={newReceitas}
                    onChange={(e) => setNewReceitas(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="manualDespCustos"
                    className="text-xs font-semibold text-slate-700"
                  >
                    DESP./CUSTOS
                  </Label>
                  <Input
                    id="manualDespCustos"
                    placeholder="0"
                    value={newDespCustos}
                    onChange={(e) => setNewDespCustos(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualEnviaSped" className="text-xs font-semibold text-slate-700">
                    ENVIA SPED
                  </Label>
                  <Input
                    id="manualEnviaSped"
                    placeholder="Sim / Não"
                    value={newEnviaSped}
                    onChange={(e) => setNewEnviaSped(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualObs" className="text-xs font-semibold text-slate-700">
                    OBSERVAÇÕES
                  </Label>
                  <Input
                    id="manualObs"
                    placeholder="Notas..."
                    value={newObservacoes}
                    onChange={(e) => setNewObservacoes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manualLnk" className="text-xs font-semibold text-slate-700">
                    LNK
                  </Label>
                  <Input
                    id="manualLnk"
                    placeholder="https://..."
                    value={newLnk}
                    onChange={(e) => setNewLnk(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Se houver colunas personalizadas, permite preenchê-las também */}
              {customColumns.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <span className="text-xs font-semibold text-purple-900 block">
                    Colunas Personalizadas (Opcional)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customColumns.map((col) => (
                      <div key={col.id} className="space-y-1">
                        <Label
                          htmlFor={`manualCol_${col.id}`}
                          className="text-xs font-medium text-slate-700"
                        >
                          {col.label}
                        </Label>
                        <Input
                          id={`manualCol_${col.id}`}
                          placeholder={`Valor para ${col.label}`}
                          value={newCustomValues[col.id] || ''}
                          onChange={(e) =>
                            setNewCustomValues((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          className="h-9 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9"
                >
                  Cadastrar Empresa
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo para Adicionar Nova Coluna Personalizada */}
        <Dialog open={addColumnModalOpen} onOpenChange={setAddColumnModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Adicionar Coluna Personalizada
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Crie uma coluna extra na tabela da aba Empresas. A coluna aceita edição de texto
                livre em cada linha, pode ser redimensionada por arrasto, filtrada na busca e
                ordenada.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddCustomColumn} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="newColTitle" className="text-xs font-semibold text-slate-700">
                  Título da Coluna *
                </Label>
                <Input
                  id="newColTitle"
                  placeholder="Ex: Observações, Responsável, Telefone, Status..."
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddColumnModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-900 hover:bg-purple-950 text-white text-xs h-9"
                >
                  Criar Coluna
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo para Renomear Coluna Personalizada */}
        <Dialog open={renameColumnModalOpen} onOpenChange={setRenameColumnModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Renomear Coluna Personalizada
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Altere o nome da coluna exibido no cabeçalho. Os dados preenchidos nas linhas serão
                preservados.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmRenameColumn} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="renameColTitle" className="text-xs font-semibold text-slate-700">
                  Novo Título da Coluna *
                </Label>
                <Input
                  id="renameColTitle"
                  value={renamedColumnTitle}
                  onChange={(e) => setRenamedColumnTitle(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenameColumnModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-900 hover:bg-purple-950 text-white text-xs h-9"
                >
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Confirmação: Remover Coluna Personalizada */}
        <AlertDialog open={deleteColumnModalOpen} onOpenChange={setDeleteColumnModalOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                Remover a coluna "{columnToDelete?.label}"?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 pt-1">
                Essa ação excluirá a coluna personalizada da tabela e apagará todos os valores
                preenchidos nela para todas as empresas. Essa ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs h-9">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteColumn}
                className="text-xs h-9 bg-red-600 hover:bg-red-700 text-white"
              >
                Sim, Remover Coluna
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Diálogo de Confirmação: Limpar Tudo */}
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                Tem certeza que deseja limpar todas as empresas?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 pt-1">
                Essa ação removerá todas as {empresas.length} empresas importadas ou cadastradas
                nesta sessão. As colunas personalizadas configuradas serão mantidas. Essa ação não
                poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs h-9">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAll}
                className="text-xs h-9 bg-red-600 hover:bg-red-700 text-white"
              >
                Sim, Limpar Tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
