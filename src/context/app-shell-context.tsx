import { createContext, useContext } from 'react'

export interface AppShellContextValue {
  month: string
  setMonth: (v: string) => void
  dataRevision: number
  bumpData: () => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  maisOpen: boolean
  setMaisOpen: (v: boolean) => void
}

export const AppShellContext = createContext<AppShellContextValue | null>(null)

export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell must be used within AppLayout')
  return ctx
}
