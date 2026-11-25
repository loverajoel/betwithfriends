// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

import { ALLOCATION_INTERFACE_ID_V2 } from '@canton-network/core-token-standard-v2'

import {
    termsFromAllocation,
    validateAllocation,
    type BetTerms,
    type LedgerAllocation,
    type Side,
} from './bet-ledger'

type JsonObject = Record<string, unknown>

export type CompletedBet = {
    terms: BetTerms
    status: 'settled' | 'cancelled' | 'withdrawn' | 'unknown'
    outcome?: 'won' | 'lost'
    side: Side
    time: string
    updateId?: string
}

function object(value: unknown): JsonObject | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : undefined
}

function allocationView(value: unknown): boolean {
    const view = object(value)
    return !!view && !!object(view.allocation) && !!object(view.settlement)
}

function isAllocationInterface(id: unknown): boolean {
    return (
        typeof id === 'string' &&
        id.split(':').slice(-2).join(':') ===
            ALLOCATION_INTERFACE_ID_V2.split(':').slice(-2).join(':')
    )
}

export function reconstructHistory(
    transactions: unknown[],
    party: string,
    admin: string,
    activeIds: Set<string>
): { bets: CompletedBet[]; invalid: number } {
    const allocations = new Map<string, { terms: BetTerms; side: Side; owner: string }>()
    const completed = new Map<string, CompletedBet>()
    let invalid = 0

    for (const raw of transactions) {
        const tx = object(raw)
        if (
            !tx ||
            !Array.isArray(tx.events) ||
            typeof tx.recordTime !== 'string' ||
            !Number.isFinite(Date.parse(tx.recordTime))
        )
            throw new Error('Ledger returned an invalid history transaction.')
        const transactionResults = new Map<string, CompletedBet | null>()
        for (const rawEvent of tx.events) {
            const event = object(rawEvent)
            const created = object(event?.CreatedEvent)
            if (created && typeof created.contractId === 'string') {
                const views = Array.isArray(created.interfaceViews)
                    ? created.interfaceViews
                    : []
                const view = views
                    .map(object)
                    .find((v) => isAllocationInterface(v?.interfaceId))
                if (!view || !allocationView(view.viewValue)) {
                    invalid++
                    console.warn(
                        'Ignoring historical allocation without an interface view.'
                    )
                    continue
                }
                const value = object(view.viewValue)
                const settlement = object(value?.settlement)
                if (
                    typeof settlement?.id !== 'string' ||
                    !settlement.id.startsWith('dinner-bet-')
                )
                    continue
                try {
                    const contract = {
                        contractId: created.contractId,
                        interfaceViewValue: view.viewValue,
                    } as LedgerAllocation
                    const terms = termsFromAllocation(contract, admin)
                    const participant = validateAllocation(terms, admin, contract)
                    allocations.set(created.contractId, {
                        terms,
                        side: participant.side,
                        owner: participant.party,
                    })
                } catch (error) {
                    invalid++
                    console.warn('Ignoring invalid historical allocation:', error)
                }
            }
            const exercised = object(event?.ExercisedEvent)
            if (!exercised || typeof exercised.contractId !== 'string') continue
            const allocation = allocations.get(exercised.contractId)
            if (!allocation || allocation.owner !== party) continue
            const output = object(object(exercised.exerciseResult)?.output)
            let status: CompletedBet['status'] = 'unknown'
            if (
                exercised.choice === 'Allocation_Settle' &&
                output?.tag === 'AllocationResult_Settled'
            )
                status = 'settled'
            else if (
                exercised.choice === 'Allocation_Cancel' &&
                output?.tag === 'AllocationResult_Cancelled'
            )
                status = 'cancelled'
            else if (
                exercised.choice === 'Allocation_Withdraw' &&
                output?.tag === 'AllocationResult_Withdrawn'
            )
                status = 'withdrawn'
            else if (
                [
                    'Allocation_Settle',
                    'Allocation_Cancel',
                    'Allocation_Withdraw',
                ].includes(String(exercised.choice)) &&
                output?.tag === 'AllocationResult_Pending'
            ) {
                transactionResults.set(exercised.contractId, null)
                continue
            } else if (exercised.consuming !== true) continue

            if (status === 'unknown' && transactionResults.has(exercised.contractId))
                continue

            let outcome: CompletedBet['outcome']
            if (status === 'settled') {
                const argument = object(exercised.choiceArgument)
                const sides = argument?.extraTransferLegSides
                if (Array.isArray(sides) && sides.length === 1) {
                    const leg = object(sides[0])
                    if (
                        leg?.transferLegId === `${allocation.terms.id}/payout` &&
                        leg.instrumentId === 'Amulet' &&
                        typeof leg.amount === 'string' &&
                        new RegExp(`^${allocation.terms.stake}(?:\\.0{1,10})?$`).test(
                            leg.amount
                        )
                    ) {
                        if (leg.side === 'ReceiverSide') outcome = 'won'
                        if (leg.side === 'SenderSide') outcome = 'lost'
                    }
                }
            }
            transactionResults.set(exercised.contractId, {
                terms: allocation.terms,
                status,
                outcome,
                side: allocation.side,
                time: tx.recordTime,
                updateId:
                    typeof tx.updateId === 'string' && tx.updateId.length > 0
                        ? tx.updateId
                        : undefined,
            })
        }
        for (const result of transactionResults.values()) {
            if (result) completed.set(result.terms.id, result)
        }
    }
    return {
        bets: [...completed.values()]
            .filter((bet) => !activeIds.has(bet.terms.id))
            .sort((a, b) => Date.parse(b.time) - Date.parse(a.time)),
        invalid,
    }
}
