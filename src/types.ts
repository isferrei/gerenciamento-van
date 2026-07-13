export type MotoristaDomingo = 'Edson' | 'Bispo'

export interface DailyEntry {
  id: string
  date: string
  km: number
  valeTransQtd: number
  valeTransValor: number
  combustivel: number
  outrasDespesas: number
  lucroLiquido: number
  viagensEdson: number
  viagensBispo: number
  salarioEdson: number
  salarioBispo: number
  salarioTotal: number
  /** Domingo: se true, motorista quitou por conta — repasse não entra no lucro (salários zerados). */
  domingoMotoristaSePagou: boolean
  /** Domingo: quando não se pagou, valor do repasse; 0 = usar viagens × valor da viagem do motorista ativo. */
  domingoValorRepasse: number
  /** Domingo: motorista para repasse/viagens; null = usar «motorista do domingo» nas configurações. */
  domingoMotoristaAtivo: MotoristaDomingo | null
  observacoes?: string
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  /** Valor unitário a receber da Riocard por cartão (ex.: 13,79). */
  valorRiocardPorCartao: number
  valorValeTrans: number
  valorViagemEdson: number
  valorViagemBispo: number
  viagensPadraoEdson: number
  viagensPadraoBispo: number
  viagensDomingoPadrao: number
  motoristaDomingoPadrao: MotoristaDomingo
  kmUltimaTrocaOleo: number
  intervaloTrocaOleoKm: number
  /** Despesas fixas de referência por semana (R$). */
  despesaAptran: number
  despesaMorro: number
  despesaFiscal: number
  /** Parcela do veículo por mês (R$). */
  despesaMensalParcelaCarro: number
  /** Aluguel da linha por mês (R$). */
  despesaMensalAluguelLinha: number
}

export const defaultSettings: AppSettings = {
  valorRiocardPorCartao: 13.79,
  valorValeTrans: 15.32,
  valorViagemEdson: 50,
  valorViagemBispo: 70,
  viagensPadraoEdson: 3,
  viagensPadraoBispo: 3,
  viagensDomingoPadrao: 4,
  motoristaDomingoPadrao: 'Bispo',
  kmUltimaTrocaOleo: 0,
  intervaloTrocaOleoKm: 10000,
  despesaAptran: 80,
  despesaMorro: 400,
  despesaFiscal: 225,
  despesaMensalParcelaCarro: 6700,
  despesaMensalAluguelLinha: 15000,
}
