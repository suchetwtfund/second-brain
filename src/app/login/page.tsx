'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Mail, ArrowRight, ArrowLeft } from 'lucide-react'

type ViewMode = 'signin' | 'signup' | 'forgot-password'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('signin')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (viewMode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        })
        if (error) throw error
        setMessage({
          type: 'success',
          text: 'Check your email for a password reset link!',
        })
      } else if (viewMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setMessage({
          type: 'success',
          text: 'Check your email for a confirmation link!',
        })
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Something went wrong',
      })
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {/* Background gradient effect */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-purple-500/20 blur-[100px]" />
      </div>

      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
            <img src="/telos-logo.png" alt="Telos" className="h-14 w-14 object-contain" />
          </div>
          <CardTitle className="text-2xl">Telos</CardTitle>
          <CardDescription>
            {viewMode === 'signup'
              ? 'Create an account to start saving your knowledge'
              : viewMode === 'forgot-password'
              ? 'Enter your email to reset your password'
              : 'Sign in to access your saved knowledge'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {viewMode !== 'forgot-password' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            )}

            {message && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  message.type === 'error'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-green-500/10 text-green-500'
                }`}
              >
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full gap-2 glow-sm" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {viewMode === 'signup' ? 'Creating account...' : viewMode === 'forgot-password' ? 'Sending...' : 'Signing in...'}
                </>
              ) : (
                <>
                  {viewMode === 'signup' ? 'Create account' : viewMode === 'forgot-password' ? 'Send reset link' : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {viewMode === 'forgot-password' ? (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setViewMode('signin')
                  setMessage(null)
                }}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3 text-center text-sm">
              {viewMode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('forgot-password')
                    setMessage(null)
                  }}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              )}
              <div>
                <span className="text-muted-foreground">
                  {viewMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
                </span>{' '}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode(viewMode === 'signup' ? 'signin' : 'signup')
                    setMessage(null)
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  {viewMode === 'signup' ? 'Sign in' : 'Sign up'}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
