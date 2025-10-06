// app/page.tsx (or wherever your login component is)
"use client"
import { useState, useEffect, useMemo } from "react"
import axios from 'axios'
import { getApiClient } from '@/lib/http-client'
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { user, loading, setUser } = useAuth()
  const client = useMemo(() => getApiClient(), [])

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') {
        router.push('/dashboard')
      } else {
        // Non-admin users can access limited dashboard or redirect elsewhere
        router.push('/dashboard')
      }
    }
  }, [user, loading, router])

  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
  
    try {
      const { data } = await client.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      })

      setUser(data.user)
      toast.success(`Welcome back, ${data.user.email}!`)

      if (data.role === 'admin') {
        router.push('/dashboard')
      } else {
        router.push('/dashboard')
      }

    } catch (err) {
      console.error('Login error:', err)
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error as string) || err.message || 'Invalid email or password'
        : err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cwt-plum"></div>
      </div>
    )
  }

  // Don't render login form if already authenticated
  if (user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-6">
          <div className="mx-auto">
            <div className="w-16 h-16 mx-auto bg-cwt-plum rounded-lg flex items-center justify-center">
              <span className="text-2xl font-mono font-bold text-white">CWT</span>
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-mono">Sign in to CWT Studio</CardTitle>
            <CardDescription>
              Enter your credentials to access the outbound automation dashboard
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                className="lowercase" // Ensures email is displayed in lowercase
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Error message display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              variant="default" 
              className="w-full" 
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Development helper - Remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Development Mode
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  client.post('/api/init-admin')
                    .then(({ data }) => {
                      if (data.success) {
                        alert(`Admin initialized! ${data.message}`)
                      } else {
                        alert(`Error: ${data.message}`)
                      }
                    })
                    .catch((err) => {
                      console.error('Init admin error:', err)
                      alert('Failed to initialise admin user')
                    })
                }}
              >
                Initialize Admin
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}