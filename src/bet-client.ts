import type { demoClient } from './demo-ledger'
import type { connectLedger } from './ledger-client'

export type LiveClient = Awaited<ReturnType<typeof connectLedger>>
export type Client = LiveClient | typeof demoClient
export type Allocations = Awaited<ReturnType<Client['allocations']>>
export type ActiveBets = Awaited<ReturnType<Client['activeBets']>>
export type CompletedBets = Awaited<ReturnType<Client['completedBets']>>
