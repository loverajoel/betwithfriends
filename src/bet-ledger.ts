// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

import type {
    AllocationSpecification,
    SettlementInfo,
    TransferLeg,
    TransferLegSide,
} from '@canton-network/core-token-standard-v2'

export type Side = 'YES' | 'NO'

export type BetDetails = {
    title: string
    options: [string, string]
}

export type BetTerms = {
    id: string
    creator: string
    judge: string
    creatorSide: Side
    stake: number
    deadline: string
    details?: BetDetails
}

export type LedgerAllocation = {
    contractId: string
    interfaceViewValue: {
        settlement: SettlementInfo
        allocation: AllocationSpecification
        holdingCids: readonly string[]
        expiresAt: string | null
    }
}

const META_PREFIX = 'wallet.canton.network/dinner-bets/'
const emptyMeta = () => ({ values: {} })
const account = (owner: string) => ({ owner, provider: null, id: '' })
const sideKey = `${META_PREFIX}side`
const betKey = `${META_PREFIX}id`
const creatorKey = `${META_PREFIX}creator`
const creatorSideKey = `${META_PREFIX}creator-side`
const detailsKey = `${META_PREFIX}details`

export function readBetDetails(value: unknown): BetDetails {
    if (
        !value ||
        typeof value !== 'object' ||
        !('title' in value) ||
        typeof value.title !== 'string' ||
        value.title.length > 120 ||
        value.title !== value.title.trim() ||
        !('options' in value) ||
        !Array.isArray(value.options) ||
        value.options.length !== 2 ||
        !value.options.every(
            (option: unknown) =>
                typeof option === 'string' &&
                option.length > 0 &&
                option.length <= 80 &&
                option === option.trim()
        ) ||
        value.options[0].toLowerCase() === value.options[1].toLowerCase()
    )
        throw new Error(
            'Use a title up to 120 characters and two different options of 1–80 characters.'
        )
    return {
        title: value.title,
        options: [value.options[0], value.options[1]],
    }
}

export function sideLabel(terms: BetTerms, side: Side): string {
    return terms.details?.options[side === 'YES' ? 0 : 1] ?? side
}

export function readTerms(value: string): BetTerms {
    const parsed: unknown = JSON.parse(value)
    if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('id' in parsed) ||
        typeof parsed.id !== 'string' ||
        !('creator' in parsed) ||
        typeof parsed.creator !== 'string' ||
        !('judge' in parsed) ||
        typeof parsed.judge !== 'string' ||
        !('creatorSide' in parsed) ||
        (parsed.creatorSide !== 'YES' && parsed.creatorSide !== 'NO') ||
        !('stake' in parsed) ||
        typeof parsed.stake !== 'number' ||
        !('deadline' in parsed) ||
        typeof parsed.deadline !== 'string'
    )
        throw new Error('Invalid bet link.')
    const terms: BetTerms = {
        id: parsed.id,
        creator: parsed.creator,
        judge: parsed.judge,
        creatorSide: parsed.creatorSide,
        stake: parsed.stake,
        deadline: parsed.deadline,
        ...('details' in parsed ? { details: readBetDetails(parsed.details) } : {}),
    }
    validateTerms(terms)
    return terms
}

export function validateTerms(terms: BetTerms): void {
    if (terms.details !== undefined) readBetDetails(terms.details)
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            terms.id
        ) ||
        !terms.creator.includes('::') ||
        !terms.judge.includes('::') ||
        terms.judge !== terms.creator ||
        !['YES', 'NO'].includes(terms.creatorSide) ||
        ![5, 10, 25, 50, 100].includes(terms.stake) ||
        !Number.isFinite(Date.parse(terms.deadline)) ||
        new Date(terms.deadline).toISOString() !== terms.deadline
    ) {
        throw new Error('Invalid bet terms.')
    }
}

export function settlementFor(terms: BetTerms): SettlementInfo {
    validateTerms(terms)
    return {
        id: `dinner-bet-${terms.id}`,
        executors: [terms.judge],
        cid: null,
        meta: {
            values: {
                [betKey]: terms.id,
                [creatorKey]: terms.creator,
                [creatorSideKey]: terms.creatorSide,
                ...(terms.details
                    ? {
                          [detailsKey]: JSON.stringify(readBetDetails(terms.details)),
                      }
                    : {}),
            },
        },
    }
}

export function allocationFor(
    terms: BetTerms,
    admin: string,
    party: string,
    side: Side
): AllocationSpecification {
    validateTerms(terms)
    if (
        !admin.includes('::') ||
        !party.includes('::') ||
        (side !== 'YES' && side !== 'NO') ||
        (party === terms.creator && side !== terms.creatorSide) ||
        (party !== terms.creator && side === terms.creatorSide)
    ) {
        throw new Error('Invalid party or side for this bet.')
    }
    return {
        admin,
        authorizer: account(party),
        transferLegSides: [],
        settlementDeadline: terms.deadline,
        nextIterationFunding: { Amulet: String(terms.stake) },
        committed: true,
        meta: { values: { [betKey]: terms.id, [sideKey]: side } },
    }
}

export function validateAllocation(
    terms: BetTerms,
    admin: string,
    contract: LedgerAllocation
): { party: string; side: Side } {
    const view = contract.interfaceViewValue
    const spec = view.allocation
    const party = spec.authorizer.owner
    const side = spec.meta.values[sideKey]
    if (!contract.contractId || !party || (side !== 'YES' && side !== 'NO')) {
        throw new Error('Allocation is missing its party, side, or contract ID.')
    }
    const expected = allocationFor(terms, admin, party, side)
    const expectedSettlement = settlementFor(terms)
    const funding = spec.nextIterationFunding
    if (
        spec.admin !== expected.admin ||
        spec.authorizer.provider !== null ||
        spec.authorizer.id !== '' ||
        !spec.committed ||
        spec.transferLegSides.length !== 0 ||
        !spec.settlementDeadline ||
        Date.parse(spec.settlementDeadline) !== Date.parse(terms.deadline) ||
        !funding ||
        Object.keys(funding).length !== 1 ||
        !new RegExp(`^${terms.stake}(?:\\.0{1,10})?$`).test(funding.Amulet ?? '') ||
        Object.keys(spec.meta.values).length !== 2 ||
        spec.meta.values[betKey] !== terms.id ||
        view.settlement.id !== expectedSettlement.id ||
        view.settlement.cid !== null ||
        view.settlement.executors.length !== 1 ||
        view.settlement.executors[0] !== terms.judge ||
        Object.keys(view.settlement.meta.values).length !==
            Object.keys(expectedSettlement.meta.values).length ||
        view.settlement.meta.values[betKey] !== terms.id ||
        view.settlement.meta.values[creatorKey] !== terms.creator ||
        view.settlement.meta.values[creatorSideKey] !== terms.creatorSide ||
        view.settlement.meta.values[detailsKey] !==
            expectedSettlement.meta.values[detailsKey] ||
        view.holdingCids.length === 0 ||
        !view.expiresAt ||
        !Number.isFinite(Date.parse(view.expiresAt))
    ) {
        throw new Error('Allocation does not match the bet terms.')
    }
    return { party, side }
}

export function termsFromAllocation(contract: LedgerAllocation, admin: string): BetTerms {
    const { allocation, settlement } = contract.interfaceViewValue
    const id = settlement.meta.values[betKey]
    const creator = settlement.meta.values[creatorKey]
    const creatorSide = settlement.meta.values[creatorSideKey]
    const judge = settlement.executors[0]
    const deadline = allocation.settlementDeadline
    const funding = allocation.nextIterationFunding?.Amulet
    if (
        !id ||
        !creator ||
        (creatorSide !== 'YES' && creatorSide !== 'NO') ||
        !judge ||
        !deadline ||
        !funding ||
        !Number.isFinite(Date.parse(deadline))
    ) {
        throw new Error('Allocation is missing bet terms.')
    }
    const terms: BetTerms = {
        id,
        creator,
        judge,
        creatorSide,
        stake: Number(funding),
        deadline: new Date(deadline).toISOString(),
        ...(settlement.meta.values[detailsKey] !== undefined
            ? {
                  details: readBetDetails(JSON.parse(settlement.meta.values[detailsKey])),
              }
            : {}),
    }
    validateTerms(terms)
    validateAllocation(terms, admin, contract)
    return terms
}

export function payoutFor(
    terms: BetTerms,
    admin: string,
    allocations: LedgerAllocation[],
    result: Side,
    now = Date.now()
): { leg: TransferLeg; sides: TransferLegSide[] } {
    validateTerms(terms)
    if (result !== 'YES' && result !== 'NO') throw new Error('Invalid result.')
    if (Date.parse(terms.deadline) - now < 10 * 60 * 1000)
        throw new Error('Settlement requires at least 10 minutes remaining.')
    if (allocations.length !== 2) throw new Error('Exactly two allocations are required.')
    const players = allocations.map((allocation) => ({
        allocation,
        ...validateAllocation(terms, admin, allocation),
    }))
    if (
        players[0].party === players[1].party ||
        players[0].allocation.contractId === players[1].allocation.contractId
    )
        throw new Error(
            'Both allocations belong to the same wallet. Release the extra stake and invite another wallet.'
        )
    if (
        !players.some((player) => player.party === terms.creator) ||
        players[0].side === players[1].side
    )
        throw new Error('A creator and an opponent on opposite sides are required.')
    if (
        players.some(
            (player) =>
                Date.parse(player.allocation.interfaceViewValue.expiresAt!) <=
                now + 10 * 60 * 1000
        )
    )
        throw new Error(
            'An allocation has expired or has less than 10 minutes remaining. The judge can void and release the stakes.'
        )
    const winner = players.find((player) => player.side === result)!
    const loser = players.find((player) => player.side !== result)!
    const transferLegId = `${terms.id}/payout`
    const common = {
        transferLegId,
        amount: String(terms.stake),
        instrumentId: 'Amulet',
        meta: emptyMeta(),
    }
    return {
        leg: {
            ...common,
            sender: account(loser.party),
            receiver: account(winner.party),
        },
        sides: players.map((player) => ({
            ...common,
            side: player.party === loser.party ? 'SenderSide' : 'ReceiverSide',
            otherside: account(player.party === loser.party ? winner.party : loser.party),
        })),
    }
}
