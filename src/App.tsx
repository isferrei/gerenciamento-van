import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { AppLayout } from './components/app-layout'
import { DashboardPage } from './pages/dashboard'
import { LancamentoSemanalPage } from './pages/lancamento-semanal'
import { LancamentoPage } from './pages/lancamento'
import { ListaPage } from './pages/lista'
import { ResumoPage } from './pages/resumo'
import { ConferenciaSemanalPage } from './pages/conferencia-semanal'
import { RepasseMotoristasPage } from './pages/repasse-motoristas'
import { MultasMotoristasPage } from './pages/multas-motoristas'
import { ConfigPage } from './pages/config'
import { RelatoriosPage } from './pages/relatorios'
import { ImportarCsvPage } from './pages/importar-csv'

function LancamentoDiarioRedirect() {
  const [params] = useSearchParams()
  const next = new URLSearchParams()
  for (const [k, v] of params.entries()) next.set(k === 'data' ? 'date' : k, v)
  const q = next.toString()
  return <Navigate to={q ? `/lancamento?${q}` : '/lancamento'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/lancamento-semanal" element={<LancamentoSemanalPage />} />
          <Route path="/lancamento" element={<LancamentoPage />} />
          <Route path="/lancamento-diario" element={<LancamentoDiarioRedirect />} />
          <Route path="/lista" element={<ListaPage />} />
          <Route path="/resumo" element={<ResumoPage />} />
          <Route path="/conferencia-semanal" element={<ConferenciaSemanalPage />} />
          <Route path="/repasse-motoristas" element={<RepasseMotoristasPage />} />
          <Route path="/multas-motoristas" element={<MultasMotoristasPage />} />
          <Route path="/pagamento-semanal" element={<Navigate to="/repasse-motoristas" replace />} />
          <Route path="/salario" element={<Navigate to="/repasse-motoristas" replace />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/importar-csv" element={<ImportarCsvPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
