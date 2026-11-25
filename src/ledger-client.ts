// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

import {
    ALLOCATION_INTERFACE_ID_V2,
    SETTLEMENT_FACTORY_INTERFACE_ID,
    type AllocationView,
    type FinalizedAllocation,
    type SettlementFactory_SettleBatch,
} from '@canton-network/core-token-standard-v2'
import {
    resolveCapabilities,
    TokenStandardService,
    type DisclosedContract,
} from '@canton-network/core-token-standard-service'
import * as dapp from '@canton-network/dapp-sdk'

import {
    allocationFor,
    payoutFor,
    settlementFor,
    termsFromAllocation,
    validateAllocation,
    type BetTerms,
    type Side,
} from './bet-ledger'
import { reconstructHistory } from './bet-history'
import { networkConfig } from './networks'
import { traceLedger } from './diagnostics'
import { primaryParty } from './primary-wallet'

type PreparedCommand = [
    dapp.PrepareExecuteParams['commands'][number],
    DisclosedContract[],
]

export async function connectLedger(status: dapp.dappAPI.StatusEvent) {
    const networkId = status.network?.networkId
    const config = networkConfig(networkId)
    if (
        !status.connection.isConnected ||
        !networkId ||
        !config ||
        !status.session?.accessToken
    ) {
        throw new Error('Connect a wallet on Canton DevNet or TestNet.')
    }
    const provider = dapp.getConnectedProvider()
    if (!provider) throw new Error('Wallet provider is unavailable.')

    const tracedProvider = {
        request: (args: Parameters<typeof provider.request>[0]) => {
            const resource =
                args.method === 'ledgerApi' ? args.params.resource : undefined
            const operation =
                resource === '/v2/state/ledger-end'
                    ? 'ledger-end-request'
                    : resource === '/v2/state/active-contracts'
                      ? 'active-contracts-request'
                      : 'other-provider-request'
            return traceLedger(operation, () => provider.request(args))
        },
    }

    const service = new TokenStandardService(
        tracedProvider as never,
        {
            async getAccessToken() {
                return ''
            },
            async getAuthContext() {
                return { accessToken: '', userId: '' }
            },
        },
        false
    )
    const registry = new URL(config.registry)
    const [instrument, admin] = await traceLedger('connect-registry', () =>
        Promise.all([
            service.getInstrumentById(registry, 'Amulet'),
            service.getInstrumentAdmin(registry),
        ])
    )
    const capabilities = resolveCapabilities({
        supportedApis: instrument.supportedApis,
    })
    if (
        instrument.id !== 'Amulet' ||
        !admin ||
        !capabilities.allocation.includes('v2') ||
        !capabilities.allocationInstruction.includes('v2')
    ) {
        throw new Error(`The ${config.name} registry does not support V2 allocations.`)
    }
    return new LedgerClient(service, registry, admin, networkId)
}

class LedgerClient {
    private readonly service: TokenStandardService
    private readonly registry: URL
    private readonly admin: string
    private readonly networkId: string

    constructor(
        service: TokenStandardService,
        registry: URL,
        admin: string,
        networkId: string
    ) {
        this.service = service
        this.registry = registry
        this.admin = admin
        this.networkId = networkId
    }

    async ensureWallet(party: string) {
        await ensureWallet(party, this.networkId)
    }

    async allocations(terms: BetTerms, party: string) {
        await this.ensureWallet(party)
        const all = await traceLedger('load-bet-allocations', () =>
            this.service.listContractsByInterface<AllocationView>(
                ALLOCATION_INTERFACE_ID_V2,
                party
            )
        )
        const matching = all.filter(
            (allocation) =>
                allocation.interfaceViewValue.settlement.id === settlementFor(terms).id
        )
        return matching.map((allocation) => ({
            ...allocation,
            participant: validateAllocation(terms, this.admin, allocation),
        }))
    }

    async activeBets(party: string) {
        await this.ensureWallet(party)
        const all = await traceLedger('load-active-bets', () =>
            this.service.listContractsByInterface<AllocationView>(
                ALLOCATION_INTERFACE_ID_V2,
                party
            )
        )
        const bets = new Map<string, BetTerms>()
        const playersByBet = new Map<string, string[]>()
        const invalidSettlements = new Set<string>()
        let invalid = 0
        for (const contract of all) {
            const settlementId = contract.interfaceViewValue.settlement.id
            if (!settlementId.startsWith('dinner-bet-')) continue
            try {
                const terms = termsFromAllocation(contract, this.admin)
                const existing = bets.get(terms.id)
                if (existing && JSON.stringify(existing) !== JSON.stringify(terms))
                    throw new Error('Conflicting terms for the same bet.')
                bets.set(terms.id, terms)
                const owner = contract.interfaceViewValue.allocation.authorizer.owner
                if (owner) {
                    const players = playersByBet.get(terms.id) ?? []
                    players.push(owner)
                    playersByBet.set(terms.id, players)
                }
            } catch (error) {
                invalidSettlements.add(settlementId)
                invalid++
                console.warn('Ignoring invalid Bet with friends allocation:', error)
            }
        }
        const readyToJudge = [...bets.values()]
            .filter((bet) => {
                if (bet.judge !== party || invalidSettlements.has(settlementFor(bet).id))
                    return false
                const players = playersByBet.get(bet.id) ?? []
                return (
                    players.length === 2 &&
                    new Set(players).size === 2 &&
                    players.includes(party)
                )
            })
            .map((bet) => bet.id)
        return { bets: [...bets.values()], invalid, readyToJudge }
    }

    async completedBets(party: string) {
        await this.ensureWallet(party)
        const [pruned, end, active] = await Promise.all([
            traceLedger('load-history-pruned-offset', () =>
                dapp.ledgerApi({
                    resource: '/v2/state/latest-pruned-offsets',
                    requestMethod: 'get',
                })
            ),
            traceLedger('load-history-ledger-end', () =>
                dapp.ledgerApi({
                    resource: '/v2/state/ledger-end',
                    requestMethod: 'get',
                    query: {},
                })
            ),
            traceLedger('load-history-active-allocations', () =>
                this.service.listContractsByInterface<AllocationView>(
                    ALLOCATION_INTERFACE_ID_V2,
                    party
                )
            ),
        ])
        const start: unknown = pruned.participantPrunedUpToInclusive ?? 0
        const ledgerEnd: unknown = end.offset
        if (
            typeof start !== 'number' ||
            typeof ledgerEnd !== 'number' ||
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(ledgerEnd) ||
            start < 0 ||
            ledgerEnd < start
        )
            throw new Error('Ledger returned invalid history offsets.')

        const transactions: unknown[] = []
        let offset = start
        while (offset < ledgerEnd) {
            await this.ensureWallet(party)
            const response: unknown = await traceLedger('load-history-page', () =>
                dapp.ledgerApi({
                    resource: '/v2/updates',
                    requestMethod: 'post',
                    query: { limit: 200 },
                    body: {
                        beginExclusive: offset,
                        endInclusive: ledgerEnd,
                        updateFormat: {
                            includeTransactions: {
                                eventFormat: {
                                    filtersByParty: {
                                        [party]: {
                                            cumulative: [
                                                {
                                                    identifierFilter: {
                                                        InterfaceFilter: {
                                                            value: {
                                                                interfaceId:
                                                                    ALLOCATION_INTERFACE_ID_V2,
                                                                includeInterfaceView: true,
                                                            },
                                                        },
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                    verbose: true,
                                },
                                transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
                            },
                        },
                    },
                })
            )
            if (!Array.isArray(response))
                throw new Error('Ledger returned an invalid history page.')
            if (response.length === 0) {
                offset = ledgerEnd
                break
            }
            let nextOffset = offset
            for (const entry of response) {
                const update = entry?.update
                const tx: unknown = update?.Transaction?.value
                if (
                    tx &&
                    typeof tx === 'object' &&
                    'offset' in tx &&
                    typeof tx.offset === 'number'
                ) {
                    transactions.push(tx)
                    nextOffset = Math.max(nextOffset, tx.offset)
                } else {
                    const checkpoint: unknown = update?.OffsetCheckpoint?.value?.offset
                    if (typeof checkpoint === 'number')
                        nextOffset = Math.max(nextOffset, checkpoint)
                }
            }
            if (nextOffset <= offset || nextOffset > ledgerEnd)
                throw new Error('Ledger history did not advance correctly.')
            offset = nextOffset
        }
        await this.ensureWallet(party)
        const activeOwnIds = new Set<string>()
        for (const contract of active) {
            if (!contract.interfaceViewValue.settlement.id.startsWith('dinner-bet-'))
                continue
            try {
                const terms = termsFromAllocation(contract, this.admin)
                if (validateAllocation(terms, this.admin, contract).party === party)
                    activeOwnIds.add(terms.id)
            } catch (error) {
                console.warn('Ignoring invalid active allocation:', error)
            }
        }
        return {
            ...reconstructHistory(transactions, party, this.admin, activeOwnIds),
            pruned: start > 0,
        }
    }

    async allocate(terms: BetTerms, party: string, side: Side) {
        if (Date.parse(terms.deadline) - Date.now() < 10 * 60 * 1000)
            throw new Error('Not enough time remains to create this allocation.')
        const existing = await this.allocations(terms, party)
        if (existing.some((allocation) => allocation.participant.party === party))
            throw new Error('This wallet already has an allocation for this bet.')

        const [command, disclosed] = await traceLedger('prepare-allocation', () =>
            this.service.v2.allocation.createAllocation(
                {
                    settlement: settlementFor(terms),
                    spec: allocationFor(terms, this.admin, party, side),
                    admin: this.admin,
                    actors: [party],
                },
                this.registry
            )
        )
        return submit([[{ ExerciseCommand: command }, disclosed]], party, this.networkId)
    }

    async withdraw(terms: BetTerms, party: string, allocationId: string) {
        const allocation = (await this.allocations(terms, party)).find(
            (item) => item.contractId === allocationId
        )
        if (!allocation || allocation.participant.party !== party)
            throw new Error('Your allocation is not active.')
        if (Date.now() < Date.parse(terms.deadline))
            throw new Error('The deadline has not passed.')
        const [command, disclosed] =
            await this.service.v2.allocation.createAllocationChoice(
                'withdraw',
                allocation.contractId,
                [party],
                this.registry
            )
        return submit([[{ ExerciseCommand: command }, disclosed]], party, this.networkId)
    }

    async void(terms: BetTerms, judge: string) {
        if (judge !== terms.judge) throw new Error('Only the judge can void.')
        const allocations = await this.allocations(terms, judge)
        if (!allocations.length) throw new Error('No active allocations found.')
        const commands = await Promise.all(
            allocations.map(async (allocation): Promise<PreparedCommand> => {
                const [command, disclosed] =
                    await this.service.v2.allocation.createAllocationChoice(
                        'cancel',
                        allocation.contractId,
                        [judge],
                        this.registry
                    )
                return [{ ExerciseCommand: command }, disclosed]
            })
        )
        return submit(commands, judge, this.networkId)
    }

    async releaseDuplicate(terms: BetTerms, judge: string, allocationId: string) {
        if (judge !== terms.judge)
            throw new Error('Only the judge can release a duplicate stake.')
        const allocations = await this.allocations(terms, judge)
        const target = allocations.find(
            (allocation) => allocation.contractId === allocationId
        )
        if (
            !target ||
            !allocations.some(
                (allocation) =>
                    allocation.contractId !== allocationId &&
                    allocation.participant.party === target.participant.party
            )
        )
            throw new Error(
                'This allocation is no longer a duplicate. Refresh the ledger.'
            )
        const [command, disclosed] =
            await this.service.v2.allocation.createAllocationChoice(
                'cancel',
                allocationId,
                [judge],
                this.registry
            )
        return submit([[{ ExerciseCommand: command }, disclosed]], judge, this.networkId)
    }

    async settle(terms: BetTerms, judge: string, result: Side) {
        if (judge !== terms.judge) throw new Error('Only the judge can settle.')
        const allocations = await this.allocations(terms, judge)
        const { leg, sides } = payoutFor(terms, this.admin, allocations, result)
        const args: SettlementFactory_SettleBatch = {
            settlement: settlementFor(terms),
            transferLegs: [leg],
            allocations: allocations.map(
                (allocation, index): FinalizedAllocation => ({
                    allocationCid:
                        allocation.contractId as FinalizedAllocation['allocationCid'],
                    extraTransferLegSides: [sides[index]],
                    nextIterationFunding: null,
                })
            ),
            actors: [judge],
            extraArgs: { context: { values: {} }, meta: { values: {} } },
        }
        const { factoryId, choiceContext } =
            await this.service.v2.allocation.fetchSettlementFactory(args, this.registry)
        args.extraArgs.context = {
            ...choiceContext.choiceContextData,
            values: choiceContext.choiceContextData?.values ?? {},
        }
        return submit(
            [
                [
                    {
                        ExerciseCommand: {
                            templateId: SETTLEMENT_FACTORY_INTERFACE_ID,
                            contractId: factoryId,
                            choice: 'SettlementFactory_SettleBatch',
                            choiceArgument: args,
                        },
                    },
                    choiceContext.disclosedContracts,
                ],
            ],
            judge,
            this.networkId
        )
    }
}

async function submit(commands: PreparedCommand[], party: string, networkId: string) {
    await ensureWallet(party, networkId)
    const disclosed = new Map(
        commands.flatMap(([, contracts]) =>
            contracts.map((contract) => {
                const disclosure: dapp.dappAPI.DisclosedContract = {
                    createdEventBlob: contract.createdEventBlob,
                    ...(contract.templateId !== undefined
                        ? { templateId: contract.templateId }
                        : {}),
                    ...(contract.contractId !== undefined
                        ? { contractId: contract.contractId }
                        : {}),
                    ...(contract.synchronizerId !== undefined
                        ? { synchronizerId: contract.synchronizerId }
                        : {}),
                }
                return [
                    contract.contractId ?? contract.createdEventBlob,
                    disclosure,
                ] as const
            })
        )
    )
    return traceLedger('submit-transaction', () =>
        dapp.prepareExecuteAndWait({
            commands: commands.map(([command]) => command),
            disclosedContracts: [...disclosed.values()],
            commandId: crypto.randomUUID(),
            actAs: [party],
        })
    )
}

async function ensureWallet(party: string, networkId: string) {
    const status = await traceLedger('check-wallet-status', () => dapp.status())
    if (
        !status.connection.isConnected ||
        status.network?.networkId !== networkId ||
        !networkConfig(status.network?.networkId)
    ) {
        throw new Error(
            'The wallet network changed or is no longer connected to DevNet or TestNet. Reconnect and try again.'
        )
    }
    if (
        primaryParty(
            await traceLedger('check-primary-wallet', () => dapp.listAccounts()),
            networkId
        ) !== party
    )
        throw new Error('The primary wallet changed. Please try again.')
}
