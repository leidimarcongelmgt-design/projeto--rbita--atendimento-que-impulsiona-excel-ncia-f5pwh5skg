import React from 'react'
import { cn } from '@/lib/utils'

interface ResizableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: number
  minWidth?: number
  resizable?: boolean
  onResizeStart?: (e: React.MouseEvent) => void
  onHeaderClick?: (e: React.MouseEvent) => void
  isDraggingRef?: React.RefObject<boolean>
  children: React.ReactNode
}

/**
 * Célula de cabeçalho (th) com suporte a redimensionamento por arrasto.
 * - Inclui uma alça transparente/destacada no canto direito com cursor `col-resize`.
 * - Impede o disparo de eventos de clique / ordenação se houver arrasto recente.
 * - Aplica style de largura fixa e min-width explícitos.
 */
export const ResizableTh: React.FC<ResizableThProps> = ({
  width,
  minWidth = 60,
  resizable = true,
  onResizeStart,
  onHeaderClick,
  isDraggingRef,
  className,
  style,
  children,
  ...rest
}) => {
  const handleClick = (e: React.MouseEvent) => {
    // Se o usuário acabou de arrastar para redimensionar, não dispara o clique de ordenação
    if (isDraggingRef?.current) {
      e.stopPropagation()
      return
    }
    onHeaderClick?.(e)
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
      onClick={handleClick}
      style={computedStyle}
      className={cn('relative select-none', className)}
    >
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
