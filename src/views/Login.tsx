'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ChevronLeft } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { GoogleGIcon } from '@/components/icons/GoogleGIcon'
import { safeAuthRedirectPath } from '@/lib/auth/safe-redirect'
import { toast } from 'sonner'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading || !user) return
    const params = new URLSearchParams(window.location.search)
    router.replace(safeAuthRedirectPath(params.get('redirect')))
  }, [user, authLoading, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('oauth_error') !== '1') return
    toast.error('Não foi possível entrar com o Google. Tente de novo.')
    params.delete('oauth_error')
    const q = params.toString()
    router.replace(q ? `/login?${q}` : '/login')
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    setLoading(false)
    if (error) {
      const msg = error.message ?? ''
      const isCred =
        /invalid login credentials|invalid_credentials|credenciais inválidas/i.test(
          msg
        )
      if (isCred) {
        toast.error(
          'E-mail ou senha incorretos — ou o cadastro ainda não foi confirmado. Abra o link que enviamos por e-mail (e a pasta spam) e tente entrar de novo.',
          { duration: 8000 }
        )
      } else {
        toast.error(msg)
      }
    } else {
      const params = new URLSearchParams(window.location.search)
      router.push(safeAuthRedirectPath(params.get('redirect')))
    }
  }

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    const params = new URLSearchParams(window.location.search)
    const next = safeAuthRedirectPath(params.get('redirect'))
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      }
    })
    setGoogleLoading(false)
    if (error) {
      toast.error(error.message)
    }
  }

  const resendConfirmation = async () => {
    const addr = email.trim()
    if (!addr) {
      toast.error('Digite seu e-mail acima.')
      return
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/login` }
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(
        'Se existir cadastro pendente, enviamos outro e-mail de confirmação.'
      )
    }
  }

  if (authLoading || user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground text-sm">
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-emerald-500">
      <div className="w-full max-w-lg bg-white p-12 rounded-2xl">
        <div className="mb-8 font-display grid grid-cols-3 items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Link>
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
          Bem-vindo
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Entre na sua conta para gerenciar campanhas.
        </p>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={googleLoading}
          onClick={signInWithGoogle}
        >
          <GoogleGIcon className="size-4" />
          {googleLoading ? 'Redirecionando...' : 'Continuar com Google'}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="mt-1.5"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Não recebeu o e-mail de confirmação?{' '}
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={resendConfirmation}
          >
            Reenviar link
          </button>
        </p>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Não tem conta?{' '}
          <Link
            href="/register"
            className="text-primary font-medium hover:underline"
          >
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  )
}
