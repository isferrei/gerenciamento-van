import { useMemo, useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { AppShellContext } from '../context/app-shell-context'
import { currentYearMonth } from '../lib/dates'
import { AppSidebar } from './app-sidebar'
import { AppTopBar } from './app-top-bar'
import { ApiLocalStorageSync } from './api-local-storage-sync'
import { MobileBottomNav } from './mobile-bottom-nav'
import { MaisSheet } from './mais-sheet'

export function AppLayout() {
  const [month, setMonth] = useState(currentYearMonth())
  const [dataRevision, setDataRevision] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [maisOpen, setMaisOpen] = useState(false)

  const bumpData = useCallback(() => setDataRevision((r) => r + 1), [])

  const shell = useMemo(
    () => ({
      month,
      setMonth,
      dataRevision,
      bumpData,
      sidebarOpen,
      setSidebarOpen,
      maisOpen,
      setMaisOpen,
    }),
    [month, dataRevision, bumpData, sidebarOpen, maisOpen],
  )

  return (
    <AppShellContext.Provider value={shell}>
      <ApiLocalStorageSync />
      <div className="min-h-dvh bg-slate-100">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 overflow-hidden border-r border-white/10 shadow-2xl lg:block">
          <AppSidebar />
        </aside>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Fechar menu"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 z-50 w-[min(20rem,92vw)] shadow-2xl">
              <AppSidebar onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>
        ) : null}

        <div className="flex min-h-dvh flex-col lg:pl-64">
          <AppTopBar />
          <main className="flex-1 px-4 pb-28 pt-4 lg:px-8 lg:pb-12">
            <Outlet />
          </main>
          <MobileBottomNav />
          <MaisSheet />
        </div>
      </div>
    </AppShellContext.Provider>
  )
}
