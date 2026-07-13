import { useEffect } from 'react'
import { useAppShell } from '../context/app-shell-context'
import { syncLocalStorageFromApi } from '../lib/storage'

export function ApiLocalStorageSync() {
  const { bumpData } = useAppShell()

  useEffect(() => {
    let cancelled = false

    async function sync() {
      try {
        await syncLocalStorageFromApi()
        if (!cancelled) bumpData()
      } catch (error) {
        console.warn('Falha ao carregar dados da API', error)
      }
    }

    void sync()

    return () => {
      cancelled = true
    }
  }, [bumpData])

  return null
}
