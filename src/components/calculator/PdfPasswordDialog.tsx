import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Lock, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'

interface PdfPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfName?: string
  errorMessage?: string
  isSubmitting?: boolean
  onSubmitPassword: (password: string) => void
  onCancel?: () => void
}

export const PdfPasswordDialog: React.FC<PdfPasswordDialogProps> = ({
  open,
  onOpenChange,
  pdfName,
  errorMessage,
  isSubmitting = false,
  onSubmitPassword,
  onCancel,
}) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Clear password when dialog closes or opens
  useEffect(() => {
    if (open) {
      setPassword('')
      setShowPassword(false)
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || isSubmitting) return
    onSubmitPassword(password)
  }

  const handleClose = () => {
    onOpenChange(false)
    if (onCancel) {
      onCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white text-slate-900 border-slate-200">
        <form onSubmit={handleSubmit} className="m-0 p-0">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/70 via-white to-blue-50/40">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-100/80 border border-amber-200/80 flex items-center justify-center text-amber-800 shadow-2xs">
                <Lock className="w-4 h-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Arquivo PDF Protegido por Senha
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 mt-1">
              {pdfName ? (
                <span>
                  O documento <strong>{pdfName}</strong> está protegido. Informe a senha para
                  desprotegê-lo e prosseguir com a leitura dos dados cadastrais do cliente.
                </span>
              ) : (
                'Este documento PDF está protegido. Digite a senha para desbloquear e importar as informações cadastrais.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pdf-password-input" className="text-xs font-semibold text-slate-800">
                Senha do PDF
              </Label>
              <div className="relative">
                <Input
                  id="pdf-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite a senha do arquivo..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                  className="pr-10 h-10 text-sm bg-slate-50 border-slate-300 focus-visible:ring-[#1E3A5F]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error feedback if incorrect password or other error */}
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2 animate-in fade-in duration-200">
                <span className="font-bold text-red-800 shrink-0">Atenção:</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-500 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                A senha é utilizada apenas no seu navegador para ler o conteúdo do PDF e nunca é
                enviada ou gravada externamente.
              </span>
            </div>
          </div>

          <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={handleClose}
              className="w-full sm:w-auto text-xs h-9 text-slate-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!password.trim() || isSubmitting}
              className="w-full sm:w-auto bg-[#1E3A5F] hover:bg-[#16304F] text-white text-xs h-9 gap-1.5 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Desbloqueando...
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" /> Desbloquear e Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
