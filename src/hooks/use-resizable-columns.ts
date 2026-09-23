import React, { useState, useEffect, useCallback, useRef } from 'react'

export interface ColumnWidthConfig {
  [columnKey: string]: number
}

export const RESIZABLE_STORAGE_KEYS = {
  EMPRESAS: 'dossie_col_widths_empresas',
  DPTO_PESSOAL: 'dossie_col_widths_dpto_pessoal',
  DPTO_FISCAL: 'dossie_col_widths_dpto_fiscal',
  DPTO_CONTABIL: 'dossie_col_widths_dpto_contabil',
} as const

export function clearAllResizableColumnWidths(): void {
  try {
    sessionStorage.removeItem(RESIZABLE_STORAGE_KEYS.EMPRESAS)
    sessionStorage.removeItem(RESIZABLE_STORAGE_KEYS.DPTO_PESSOAL)
    sessionStorage.removeItem(RESIZABLE_STORAGE_KEYS.DPTO_FISCAL)
    sessionStorage.removeItem(RESIZABLE_STORAGE_KEYS.DPTO_CONTABIL)
    window.dispatchEvent(new CustomEvent('dossie:column-widths-reset'))
  } catch (err) {
    console.error('Erro ao limpar larguras das colunas do sessionStorage:', err)
  }
}

export function useResizableColumns(
  storageKey: string,
  defaultWidths: ColumnWidthConfig,
  minWidths: { [columnKey: string]: number } = {},
) {
  const [widths, setWidths] = useState<ColumnWidthConfig>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...defaultWidths, ...parsed }
      }
    } catch {
      // Ignora erro de parsing e usa o padrão
    }
    return defaultWidths
  })

  // Sincroniza quando houver evento de reset (ex: Nova Consulta)
  useEffect(() => {
    const handleResetEvent = () => {
      try {
        const stored = sessionStorage.getItem(storageKey)
        if (!stored) {
          setWidths(defaultWidths)
        }
      } catch {
        setWidths(defaultWidths)
      }
    }

    window.addEventListener('dossie:column-widths-reset', handleResetEvent)
    return () => {
      window.removeEventListener('dossie:column-widths-reset', handleResetEvent)
    }
  }, [storageKey, defaultWidths])

  // Salva no sessionStorage quando as larguras mudarem
  const persistWidths = useCallback(
    (newWidths: ColumnWidthConfig) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(newWidths))
      } catch (err) {
        console.error('Erro ao salvar larguras das colunas:', err)
      }
    },
    [storageKey],
  )

  const activeDragRef = useRef<{
    columnKey: string
    startX: number
    startWidth: number
    minW: number
  } | null>(null)

  // Flag para impedir que o clique de ordenação do <th> seja acionado ao terminar o arrasto
  const isDraggingRef = useRef(false)

  const startResize = useCallback(
    (e: React.MouseEvent, columnKey: string) => {
      e.stopPropagation()
      e.preventDefault()

      isDraggingRef.current = false
      const currentWidth = widths[columnKey] ?? defaultWidths[columnKey] ?? 120
      const minW = minWidths[columnKey] ?? 60

      activeDragRef.current = {
        columnKey,
        startX: e.clientX,
        startWidth: currentWidth,
        minW,
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!activeDragRef.current) return
        const deltaX = moveEvent.clientX - activeDragRef.current.startX
        if (Math.abs(deltaX) > 2) {
          isDraggingRef.current = true
        }

        const newWidth = Math.max(
          activeDragRef.current.minW,
          activeDragRef.current.startWidth + deltaX,
        )

        setWidths((prev) => {
          const updated = {
            ...prev,
            [activeDragRef.current!.columnKey]: Math.round(newWidth),
          }
          return updated
        })
      }

      const onMouseUp = () => {
        if (activeDragRef.current) {
          setWidths((latest) => {
            persistWidths(latest)
            return latest
          })
        }

        activeDragRef.current = null
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)

        // Reseta isDragging logo após um micro-tick para evitar clique acidental no th
        setTimeout(() => {
          isDraggingRef.current = false
        }, 50)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [widths, defaultWidths, minWidths, persistWidths],
  )

  const resetWidths = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // Ignora erro
    }
    setWidths(defaultWidths)
  }, [storageKey, defaultWidths])

  return {
    widths,
    startResize,
    isDraggingRef,
    resetWidths,
  }
}
