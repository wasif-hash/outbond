"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getApiClient } from '@/lib/http-client'
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  BarChart3,
  Users,
  Send,
  MessageSquare,
  Calendar,
  Settings,
  User,
  UserCircle,
  Menu,
  X,
  LogOut,
  Lock,
  Bookmark,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import "../../globals.css"
import { toast } from "sonner"
import { LoaderThree } from "@/components/ui/loader"
import { useAuth } from "@/hooks/useAuth"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type NavItem = {
  name: string
  href: string
  icon: LucideIcon
  requiresAdmin?: boolean
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Outreach", href: "/dashboard/outreach", icon: Users },
  { name: "Leads", href: "/dashboard/leads", icon: Send },
  { name: "Replies", href: "/dashboard/replies", icon: MessageSquare },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Saved", href: "/dashboard/saved", icon: Bookmark },
  { name: "Users", href: "/dashboard/users", icon: User, requiresAdmin: true },
  { name: "Integrations", href: "/dashboard/settings", icon: Settings },
]

const accountNavigation: NavItem = { name: "Account", href: "/dashboard/account", icon: UserCircle }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showRestrictedDialog, setShowRestrictedDialog] = useState(false)
  const client = useMemo(() => getApiClient(), [])

  const pathname = usePathname()
  const router = useRouter()
  const { isAdmin, loading: authLoading } = useAuth()

  const handleNavigation = useCallback((item: NavItem) => {
    const isRestricted = !authLoading && item.requiresAdmin && !isAdmin
    if (isRestricted) {
      setSidebarOpen(false)
      setShowRestrictedDialog(true)
      return
    }

    if (item.href === pathname) {
      setSidebarOpen(false)
      return
    }

    startTransition(() => {
      setSidebarOpen(false)
      router.push(item.href)
    })
  }, [authLoading, isAdmin, pathname, router, startTransition])

  const handleLogout = async () => {
    try {
      setSigningOut(true)

      await client.post('/api/auth/logout')

      localStorage.removeItem('auth-token')
      toast.success('You have been logged out')
      setTimeout(() => {
        router.replace('/login')
      }, 150)
    } catch (err) {
      console.error('Logout error:', err)
      toast.error('Failed to log out. Please try again.')
      router.replace('/login')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-foreground/20" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border">
            <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-border">
              <div className="text-xl font-mono font-bold text-primary">CWT</div>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="mt-6 px-3 pb-6 flex flex-col gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                const isRestricted = !authLoading && item.requiresAdmin && !isAdmin
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-disabled={isRestricted}
                    onClick={(event) => {
                      event.preventDefault()
                      handleNavigation(item)
                    }}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isRestricted && !isActive ? "opacity-70" : "",
                    )}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span className="flex items-center gap-2">
                      {item.name}
                      {isRestricted ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                    </span>
                  </Link>
                )
              })}
              <div className="mt-4 border-t border-sidebar-border pt-4">
                <Link
                  href={accountNavigation.href}
                  onClick={(event) => {
                    event.preventDefault()
                    handleNavigation(accountNavigation)
                  }}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    pathname === accountNavigation.href
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <accountNavigation.icon className="mr-3 h-4 w-4" />
                  {accountNavigation.name}
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-sidebar border-r border-sidebar-border">
          <div className="flex items-center h-16 px-6 border-b border-sidebar-border">
            <div className="text-xl font-mono font-bold text-primary">CWT</div>
          </div>
          <nav className="mt-6 flex-1 px-3 pb-6 flex flex-col gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const isRestricted = !authLoading && item.requiresAdmin && !isAdmin
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-disabled={isRestricted}
                  onClick={(event) => {
                    event.preventDefault()
                    handleNavigation(item)
                  }}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isRestricted && !isActive ? "opacity-70" : "",
                  )}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  <span className="flex items-center gap-2">
                    {item.name}
                    {isRestricted ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                  </span>
                </Link>
              )
            })}
            <div className="mt-auto border-t border-sidebar-border pt-4">
              <Link
                href={accountNavigation.href}
                onClick={(event) => {
                  event.preventDefault()
                  handleNavigation(accountNavigation)
                }}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  pathname === accountNavigation.href
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <accountNavigation.icon className="mr-3 h-4 w-4" />
                {accountNavigation.name}
              </Link>
            </div>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navbar */}
        <div className="h-16 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden mr-3"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="lg:hidden">
              <div className="text-xl font-mono font-bold text-primary">CWT</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* <span className="text-sm text-muted-foreground hidden sm:block">shannon@creatorwealthtools.com</span>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground  sm:flex">
              <User className="h-4 w-4" />
              <span>User</span>
            </div> */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex items-center space-x-2 text-sm text-foreground hover:bg-primary transition-colors"
            >
              {signingOut ? (
                <span>Logging out...</span>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)]">
      {children}
    </main>
  </div>

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <LoaderThree />
          <span className="sr-only">Loading dashboard view…</span>
        </div>
      )}
    </div>

    <AlertDialog open={showRestrictedDialog} onOpenChange={setShowRestrictedDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Admin access required</AlertDialogTitle>
          <AlertDialogDescription>
            Only administrators can view and manage the user directory.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setShowRestrictedDialog(false)}>Understood</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </QueryClientProvider>
  )
}
