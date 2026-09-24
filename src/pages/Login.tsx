import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FolderOpen,
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const { login, signup, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('leidimar@congelcontabilidade.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [name, setName] = useState('Administrador')
  const [loading, setLoading] = useState(false)

  // Se já autenticado, redireciona para a home ou página anterior
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location.state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Preencha e-mail e senha.')
      return
    }

    if (password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        toast.success('Autenticado com sucesso!')
      } else {
        await signup(email, password, name)
        toast.success('Conta de administrador criada com sucesso!')
      }
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação'
      console.error('Erro de autenticação:', err)
      if (msg.includes('Failed to authenticate') || msg.includes('400')) {
        toast.error(
          'Credenciais inválidas ou usuário não cadastrado. Caso seja o primeiro acesso, clique em "Criar nova conta".',
        )
      } else {
        toast.error(`Não foi possível autenticar: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      {/* Cabeçalho do App */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#1E3A5F] flex items-center justify-center text-white shadow-md">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
            DOSSIÊ DO CLIENTE
          </h1>
          <p className="text-xs text-slate-500 mt-1">Atendimento que Impulsiona Excelência</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-lg border-slate-200 bg-white">
        <CardHeader className="space-y-1 text-center border-b border-slate-100 pb-5">
          <CardTitle className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-[#1E3A5F]" />
            {mode === 'login' ? 'Acesso ao Sistema' : 'Primeiro Acesso / Novo Usuário'}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {mode === 'login'
              ? 'Entre com suas credenciais para acessar os dados vinculados à sua conta.'
              : 'Cadastre o administrador do sistema para iniciar o uso seguro das tabelas.'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-5">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                  Nome Completo
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ex: Leidimar da Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 text-sm"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                E-mail Corporativo
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Senha
                </Label>
                {mode === 'login' && (
                  <span className="text-[11px] text-slate-400">Mínimo 8 dígitos</span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-sm"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Dados Seguros:</strong> As tabelas e importações da sua empresa ficam
                vinculadas ao seu login e sincronizadas com a nuvem.
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-slate-100 pt-4 pb-6">
            <Button
              type="submit"
              className="w-full bg-[#1E3A5F] hover:bg-[#152a45] text-white font-medium text-sm gap-2 h-10 shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Entrar no Dossiê' : 'Criar Conta e Acessar'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <div className="text-center">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-xs text-[#1E3A5F] hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Primeiro acesso? Crie a conta de administrador aqui
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-600 hover:text-slate-900 hover:underline font-medium"
                >
                  Já possui conta cadastrada? Faça login
                </button>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-8 text-center text-xs text-slate-400">
        DOSSIÊ DO CLIENTE • Versão 0.0.61 • Congel Contabilidade
      </div>
    </div>
  )
}
