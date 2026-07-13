/** Motoristas fixos do app */
export type DriverFineMotoristaId = 'edson' | 'bispo'

export type FineRecordStatus = 'ativa' | 'quitada' | 'cancelada'

export type FineParcelStatus = 'pendente' | 'descontada' | 'cancelada'

/** Multa / desconto parcelado no contra-cheque semanal */
export interface DriverFineRecord {
  id: string
  motoristaId: DriverFineMotoristaId
  motoristaNome: string
  dataMulta: string
  descricao: string
  valorTotal: number
  quantidadeParcelas: number
  valorParcela: number
  parcelasPagas: number
  parcelasRestantes: number
  status: FineRecordStatus
  /** Quitada por decisão sua, mesmo com saldo/parcelas em aberto (ex.: acordo com motorista). */
  quitadaManual?: boolean
  /** Força status ativa (ex.: reabrir após quitada automática) para voltar a aparecer no repasse. */
  ativaManual?: boolean
  dataInicioDesconto: string
  observacao: string
  createdAt: string
  updatedAt: string
}

/** Parcela programada vinculada a uma semana (segunda-feira ISO) */
export interface FineParcelRecord {
  id: string
  multaId: string
  motoristaId: DriverFineMotoristaId
  numeroParcela: number
  valor: number
  semanaReferencia: string
  dataDesconto: string | null
  status: FineParcelStatus
  createdAt: string
  updatedAt: string
}

export interface DriverFinesDb {
  fines: DriverFineRecord[]
  installments: FineParcelRecord[]
}
