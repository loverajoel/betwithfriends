// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

type Operation =
    | 'connect-registry'
    | 'check-wallet-status'
    | 'check-primary-wallet'
    | 'load-bet-allocations'
    | 'load-active-bets'
    | 'load-history-pruned-offset'
    | 'load-history-ledger-end'
    | 'load-history-active-allocations'
    | 'load-history-page'
    | 'ledger-end-request'
    | 'active-contracts-request'
    | 'other-provider-request'
    | 'prepare-allocation'
    | 'submit-transaction'

export async function traceLedger<T>(
    operation: Operation,
    action: () => Promise<T>
): Promise<T> {
    const start = performance.now()
    console.info('[Bet with friends]', operation, 'started')
    try {
        const result = await action()
        console.info('[Bet with friends]', operation, 'succeeded', {
            durationMs: Math.round(performance.now() - start),
        })
        return result
    } catch (error) {
        const message = error instanceof Error ? error.message : ''
        console.warn('[Bet with friends]', operation, 'failed', {
            durationMs: Math.round(performance.now() - start),
            category: /ledger request limit exceeded/i.test(message)
                ? 'ledger-request-limit'
                : 'other',
        })
        throw error
    }
}
