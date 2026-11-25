import type { CompletedBet } from './bet-history'
import { validateTerms, type BetTerms, type Side } from './bet-ledger'

export const demoPlayers = [
    'Alex::bet-with-friends-demo',
    'Sam::bet-with-friends-demo',
    'Jordan::bet-with-friends-demo',
    'Mika::bet-with-friends-demo',
    'Taylor::bet-with-friends-demo',
    'Casey::bet-with-friends-demo',
] as const
export type DemoPlayer = (typeof demoPlayers)[number]
const starterBalance = 250
const unitsPerCC = 10_000_000_000
export const demoStorageKey = 'bet-with-friends:demo-ledger:v1'

type Stake = {
    id: string
    player: DemoPlayer
    side: Side
    result?: Pick<CompletedBet, 'status' | 'outcome' | 'time'> & { profitUnits?: number }
}

type DemoBet = {
    terms: BetTerms
    stakes: Stake[]
    closed?: 'settled' | 'cancelled'
}

export function isDemoPlayer(party: string): party is DemoPlayer {
    return demoPlayers.some((player) => player === party)
}

function requirePlayer(party: string): DemoPlayer {
    if (!isDemoPlayer(party)) throw new Error('Choose a demo player.')
    return party
}

function readBets(): DemoBet[] {
    const stored = localStorage.getItem(demoStorageKey)
    return stored ? (JSON.parse(stored) as DemoBet[]) : []
}

async function updateBets(change: (bets: DemoBet[]) => void) {
    const update = () => {
        const bets = readBets()
        change(bets)
        localStorage.setItem(demoStorageKey, JSON.stringify(bets))
    }
    if (navigator.locks) {
        await navigator.locks.request(demoStorageKey, update)
    } else {
        update()
    }
}

function checkTerms(bet: DemoBet | undefined, terms: BetTerms) {
    validateTerms(terms)
    requirePlayer(terms.creator)
    if (bet && JSON.stringify(bet.terms) !== JSON.stringify(terms)) {
        throw new Error('The invite terms do not match the saved demo bet.')
    }
}

function activeStakes(bet: DemoBet | undefined) {
    return bet?.stakes.filter((stake) => !stake.result) ?? []
}

function balanceOf(bets: DemoBet[], player: DemoPlayer) {
    return bets.reduce((balance, bet) => {
        const stake = bet.stakes.find((item) => item.player === player)
        if (!stake) return balance
        const stakeUnits = bet.terms.stake * unitsPerCC
        if (!stake.result || stake.result.outcome === 'lost') return balance - stakeUnits
        if (stake.result.outcome === 'won')
            return balance + (stake.result.profitUnits ?? stakeUnits)
        return balance
    }, starterBalance * unitsPerCC)
}

export function hasBothSides(stakes: readonly { side: Side }[]) {
    return new Set(stakes.map((stake) => stake.side)).size === 2
}

export function demoOverview(party: string, betId?: string) {
    const bets = readBets()
    const bet = bets.find((item) => item.terms.id === betId)
    return {
        betId,
        balance: balanceOf(bets, requirePlayer(party)) / unitsPerCC,
        closed: bet?.closed,
        winningSide:
            bet?.closed === 'settled'
                ? bet.stakes.find((stake) => stake.result?.outcome === 'won')?.side
                : undefined,
    }
}

export const demoClient = {
    async ensureWallet(party: string) {
        requirePlayer(party)
    },

    async allocations(terms: BetTerms, party: string) {
        requirePlayer(party)
        const bet = readBets().find((item) => item.terms.id === terms.id)
        checkTerms(bet, terms)
        return activeStakes(bet).map((stake) => ({
            contractId: stake.id,
            participant: { party: stake.player, side: stake.side },
            interfaceViewValue: { expiresAt: terms.deadline },
        }))
    },

    async activeBets(party: string) {
        const player = requirePlayer(party)
        const bets = readBets().filter((bet) =>
            activeStakes(bet).some(
                (stake) => bet.terms.judge === player || stake.player === player
            )
        )
        return {
            bets: bets.map((bet) => bet.terms),
            invalid: 0,
            readyToJudge: bets
                .filter(
                    (bet) => bet.terms.judge === player && hasBothSides(activeStakes(bet))
                )
                .map((bet) => bet.terms.id),
        }
    },

    async completedBets(party: string) {
        const player = requirePlayer(party)
        const bets: CompletedBet[] = []
        for (const bet of readBets()) {
            const stake = bet.stakes.find((item) => item.player === player)
            if (stake?.result) {
                const { status, outcome, time } = stake.result
                bets.push({ terms: bet.terms, side: stake.side, status, outcome, time })
            }
        }
        bets.sort((a, b) => b.time.localeCompare(a.time))
        return { bets, invalid: 0, pruned: false }
    },

    async allocate(terms: BetTerms, party: string, side: Side) {
        const player = requirePlayer(party)
        await updateBets((bets) => {
            const existing = bets.find((bet) => bet.terms.id === terms.id)
            checkTerms(existing, terms)
            if (existing?.closed) throw new Error('This demo bet has already ended.')
            if (Date.parse(terms.deadline) <= Date.now())
                throw new Error('The deadline has passed.')
            if (side !== 'YES' && side !== 'NO') throw new Error('Pick a side first.')
            if (existing?.stakes.some((stake) => stake.player === player)) {
                throw new Error('You already have a stake in this demo bet.')
            }
            if (balanceOf(bets, player) < terms.stake * unitsPerCC)
                throw new Error('Not enough demo CC.')
            const bet = existing ?? { terms, stakes: [] }
            bet.stakes.push({ id: crypto.randomUUID(), player, side })
            if (!existing) bets.push(bet)
        })
    },

    async settle(terms: BetTerms, judge: string, result: Side) {
        await updateBets((bets) => {
            const bet = judgedBet(bets, terms, judge)
            const stakes = activeStakes(bet)
            if (result !== 'YES' && result !== 'NO')
                throw new Error('Pick the winning side.')
            if (!hasBothSides(stakes))
                throw new Error('At least one player must pick each side.')
            const winners = stakes.filter((stake) => stake.side === result)
            const losers = stakes.filter((stake) => stake.side !== result)
            const pot = losers.length * terms.stake * unitsPerCC
            const share = Math.floor(pot / winners.length)
            const remainder = pot % winners.length
            const time = new Date().toISOString()
            winners.forEach((stake, index) => {
                stake.result = {
                    status: 'settled',
                    outcome: 'won',
                    time,
                    profitUnits: share + (index < remainder ? 1 : 0),
                }
            })
            for (const stake of losers)
                stake.result = { status: 'settled', outcome: 'lost', time }
            bet.closed = 'settled'
        })
    },

    async void(terms: BetTerms, judge: string) {
        await updateBets((bets) => {
            const bet = judgedBet(bets, terms, judge)
            const time = new Date().toISOString()
            for (const stake of activeStakes(bet))
                stake.result = { status: 'cancelled', time }
            bet.closed = 'cancelled'
        })
    },

    async withdraw(terms: BetTerms, party: string, allocationId: string) {
        const player = requirePlayer(party)
        await updateBets((bets) => {
            const bet = bets.find((item) => item.terms.id === terms.id)
            checkTerms(bet, terms)
            const stake = activeStakes(bet).find(
                (item) => item.id === allocationId && item.player === player
            )
            if (!stake) throw new Error('Your demo stake is not active.')
            if (Date.now() < Date.parse(terms.deadline))
                throw new Error('The deadline has not passed.')
            stake.result = { status: 'withdrawn', time: new Date().toISOString() }
        })
    },

    async releaseDuplicate(_terms: BetTerms, _judge: string, _allocationId: string) {
        throw new Error('Demo bets allow one stake per player.')
    },
}

function judgedBet(bets: DemoBet[], terms: BetTerms, judge: string) {
    if (requirePlayer(judge) !== terms.judge)
        throw new Error('Only the judge can do that.')
    const bet = bets.find((item) => item.terms.id === terms.id)
    checkTerms(bet, terms)
    if (!bet || bet.closed || !activeStakes(bet).length) {
        throw new Error('This demo bet has no active stakes.')
    }
    return bet
}
