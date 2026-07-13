import { useSearchParams } from 'react-router-dom'
import { LancamentoForm } from '../components/lancamento-form'
import { todayIso } from '../lib/dates'

export function LancamentoPage() {
  const [params] = useSearchParams()
  const seedDate = params.get('date') ?? params.get('data') ?? todayIso()
  return <LancamentoForm key={seedDate} seedDate={seedDate} variant="page" />
}
