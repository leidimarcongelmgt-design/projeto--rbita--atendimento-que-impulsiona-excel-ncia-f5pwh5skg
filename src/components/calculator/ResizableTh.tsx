import React from 'react'
import { cn } from '@/lib/utils'

interface ResizableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: number
  minWidth?: number
  resizable?: boolean
  onResizeStart?: (e: React.MouseEvent) => void
  onHeaderClick?: (e: React.MouseEvent) => void
  isDraggingRef?: React.RefObject<boolean>
  columnKey?: string
  draggableColumn?: boolean
  dropIndicator?: 'left' | 'right' | null
  onColumnDragStart?: (e: React.DragEvent<HTMLTableCellElement>, columnKey: string) => void
  onColumnDragOver?: (e: React.DragEvent<HTMLTableCellElement>, columnKey: string) => void
  onColumnDragLeave?: (e: React.DragEvent<HTMLTableCellElement>, columnKey: string) => void
  onColumnDrop?: (e: React.DragEvent<HTMLTableCellElement>, columnKey: string) => void
  onColumnDragEnd?: (e: React.DragEvent<HTMLTableCellElement>) => void
  children: React.ReactNode
}

/**
 * Célula de cabeçalho (th) com suporte a redimensionamento por arrasto e reordenação (drag and drop).
 * - Inclui uma alça transparente/destacada no canto direito com cursor `col-resize`.
 * - Impede o disparo de eventos de clique / ordenação se houver arrasto recente de redimensionamento ou drop de coluna.
 * - Mostra indicador visual vertical (linha guia azul/amarela) à esquerda ou direita durante arrasto.
 * - Aplica style de largura fixa e min-width explícitos.
 */
export const ResizableTh: React.FC<ResizableThProps> = ({
  width,
  minWidth = 60,
  resizable = true,
  onResizeStart,
  onHeaderClick,
  isDraggingRef,
  columnKey,
  draggableColumn = false,
  dropIndicator = null,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onColumnDragEnd,
  className,
  style,
  children,
  ...rest
}) => {
  const isColumnDraggingRef = React.useRef(false)

  const handleClick = (e: React.MouseEvent) => {
    // Se o usuário acabou de arrastar para redimensionar ou mover a coluna, não dispara o clique de ordenação
    if (isDraggingRef?.current || isColumnDraggingRef.current) {
      e.stopPropagation()
      return
    }
    onHeaderClick?.(e)
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>) => {
    // Se o redimensionamento estiver ocorrendo, aborta DnD de coluna
    if (isDraggingRef?.current) {
      e.preventDefault()
      return
    }
    isColumnDraggingRef.current = true
    if (columnKey) {
      e.dataTransfer.setData('text/plain', columnKey)
      e.dataTransfer.effectAllowed = 'move'
      onColumnDragStart?.(e, columnKey)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    if (!draggableColumn || !columnKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onColumnDragOver?.(e, columnKey)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLTableCellElement>) => {
    if (!draggableColumn || !columnKey) return
    onColumnDragLeave?.(e, columnKey)
  }

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>) => {
    if (!draggableColumn || !columnKey) return
    e.preventDefault()
    onColumnDrop?.(e, columnKey)
    // Pequeno timeout para evitar que o clique dispare imediatamente após o drop
    setTimeout(() => {
      isColumnDraggingRef.current = false
    }, 150)
  }

  const handleDragEnd = (e: React.DragEvent<HTMLTableCellElement>) => {
    onColumnDragEnd?.(e)
    setTimeout(() => {
      isColumnDraggingRef.current = false
    }, 150)
  }

  const computedStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined
      ? {
          width: `${width}px`,
          minWidth: `${minWidth}px`,
          maxWidth: `${Math.max(width, minWidth)}px`,
        }
      : {}),
  }

  return (
    <th
      {...rest}
      draggable={draggableColumn}
      onDragStart={draggableColumn ? handleDragStart : undefined}
      onDragOver={draggableColumn ? handleDragOver : undefined}
      onDragLeave={draggableColumn ? handleDragLeave : undefined}
      onDrop={draggableColumn ? handleDrop : undefined}
      onDragEnd={draggableColumn ? handleDragEnd : undefined}
      onClick={handleClick}
      style={computedStyle}
      className={cn(
        'relative select-none',
        draggableColumn && 'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      {/* Indicador visual de Drop (linha guia destacada na borda esquerda ou direita) */}
      {dropIndicator === 'left' && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 z-30 shadow-[0_0_8px_rgba(251,191,36,0.9)] pointer-events-none animate-pulse" />
      )}
      {dropIndicator === 'right' && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-amber-400 z-30 shadow-[0_0_8px_rgba(251,191,36,0.9)] pointer-events-none animate-pulse" />
      )}

      {children}

      {resizable && onResizeStart && (
        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={-1}
          title="Arrastar para ajustar largura da coluna"
          onMouseDown={(e) => {
            e.stopPropagation()
            onResizeStart(e)
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group flex items-center justify-center select-none z-10 hover:w-2.5"
        >
          {/* Linha indicadora visual sutil que ganha destaque no hover/active */}
          <div className="w-[2px] h-full bg-transparent group-hover:bg-yellow-300/80 active:bg-yellow-400 transition-colors" />
        </div>
      )}
    </th>
  )
}
