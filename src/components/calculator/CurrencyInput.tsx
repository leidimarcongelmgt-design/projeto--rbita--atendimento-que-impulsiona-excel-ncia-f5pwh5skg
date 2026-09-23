import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  id?: string
  value: number
  onChange: (val: number) => void
  disabled?: boolean
  readOnly?: boolean
  className?: string
  placeholder?: string
  autoFocus?: boolean
}

function formatRawToDisplay(val: number): string {
  if (val === 0) return '0,00'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function parseDisplayToNumber(rawStr: string): number {
  if (!rawStr) return 0
  // Clean everything except digits, minus, and comma/period
  // Brazilian format: 1.234,56 -> remove dots, replace comma with dot
  const clean = rawStr
    .trim()
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  className,
  placeholder = '0,00',
  autoFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [localText, setLocalText] = useState(() => (value === 0 ? '' : String(value)))

  useEffect(() => {
    if (!isFocused) {
      setLocalText(value === 0 ? '' : formatRawToDisplay(value))
    }
  }, [value, isFocused])

  const handleFocus = () => {
    if (disabled || readOnly) return
    setIsFocused(true)
    setLocalText(value === 0 ? '' : String(value))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // allow typing numbers, dot, comma, negative
    if (/^[0-9.,-]*$/.test(val) || val === '') {
      setLocalText(val)
      const parsed = parseDisplayToNumber(val)
      onChange(parsed)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    const parsed = parseDisplayToNumber(localText)
    onChange(parsed)
    setLocalText(parsed === 0 ? '' : formatRawToDisplay(parsed))
  }

  return (
    <div
      className={cn(
        'relative flex items-center rounded-md border transition-all duration-150',
        readOnly || disabled
          ? 'bg-slate-100/80 border-slate-200 cursor-not-allowed opacity-90'
          : isFocused
            ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20 bg-white'
            : 'border-slate-300 bg-[#F9FAFB] hover:border-slate-400',
        className,
      )}
    >
      <span className="pl-3 pr-1 text-sm font-semibold text-slate-500 select-none">R$</span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={
          isFocused ? localText : value === 0 ? '0,00' : localText || formatRawToDisplay(value)
        }
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'border-0 bg-transparent shadow-none pl-1 pr-3 text-right tabular-nums text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 h-9',
          readOnly && 'text-slate-700 font-semibold',
        )}
      />
    </div>
  )
}
