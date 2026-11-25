// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

import * as dapp from '@canton-network/dapp-sdk'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import { prompts } from './ui/BetPoster'
import { AppHeader } from './ui/AppHeader'
import { BetComposer, type BetDraft } from './ui/BetComposer'
import { BetDetail } from './ui/BetDetail'
import { BetLists } from './ui/BetLists'
import { betViews, type BetView } from './ui/bet-views'
import type { ActiveBets, Allocations, CompletedBets, LiveClient } from './bet-client'
import {
    CoinCelebration,
    coinShowDuration,
    makeCoinShow,
    type CoinMoment,
    type CoinShow,
} from './ui/CoinCelebration'
import { saveChallengeCard } from './challenge-card'
import { readTerms, validateTerms, type BetTerms, type Side } from './bet-ledger'
import { connectLedger } from './ledger-client'
import {
    demoClient,
    demoOverview,
    demoPlayers,
    demoStorageKey,
    isDemoPlayer,
} from './demo-ledger'
import { primaryParty } from './primary-wallet'
import { networkConfig } from './networks'
import { playSound, saveSoundPreference, soundEnabled, type SoundCue } from './sounds'
import './App.css'
import { appUrl } from './app-url'

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

const playerKey = 'bet-with-friends:demo-player'

function initialDemoPlayer() {
    const saved = sessionStorage.getItem(playerKey)
    if (saved && isDemoPlayer(saved)) return saved
    const invite = new URLSearchParams(location.search).get('bet')
    if (invite) {
        try {
            if (readTerms(invite).creator === demoPlayers[0]) return demoPlayers[1]
        } catch {}
    }
    return demoPlayers[0]
}

export default function App({ demo }: { demo: boolean }) {
    const [status, setStatus] = useState<dapp.dappAPI.StatusEvent>()
    const [walletParty, setParty] = useState('')
    const [demoParty, setDemoParty] = useState(() =>
        demo ? initialDemoPlayer() : demoPlayers[0]
    )
    const [accountsVersion, setAccountsVersion] = useState(0)
    const [liveClient, setClient] = useState<LiveClient>()
    const client = demo ? demoClient : liveClient
    const party = demo ? demoParty : walletParty
    const [terms, setTerms] = useState<BetTerms>()
    const [lastSettlement, setLastSettlement] = useState<{ id: string; side: Side }>()
    const [demoPick, setDemoPick] = useState<{
        betId: string
        player: string
        side: Side
    }>()
    const [view, setView] = useState<BetView>(() =>
        new URLSearchParams(location.search).has('bet') ? 'bets' : 'make'
    )
    const [allocations, setAllocations] = useState<Allocations>()
    const [allocationsError, setAllocationsError] = useState('')
    const [activeBets, setActiveBets] = useState<ActiveBets>()
    const [activeBetsError, setActiveBetsError] = useState('')
    const [completedBets, setCompletedBets] = useState<CompletedBets>()
    const [completedBetsError, setCompletedBetsError] = useState('')
    const [betsVersion, setBetsVersion] = useState(0)
    const [draft, setDraft] = useState<BetDraft>({
        title: '',
        optionOne: 'YES',
        optionTwo: 'NO',
        stake: 5,
        hours: 6,
        side: 'YES',
        promptIndex: -1,
    })
    const [busy, setBusy] = useState(false)
    const operationInProgress = useRef(false)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')
    const [soundOn, setSoundOn] = useState(soundEnabled)
    const soundPreference = useRef(soundOn)
    const lastTypingSound = useRef(-Infinity)
    const [coinShow, setCoinShow] = useState<CoinShow>()
    const celebrationId = useRef(0)
    const lastRain = useRef<CoinShow['pattern']>(undefined)

    useEffect(() => {
        if (!coinShow) return
        const timer = window.setTimeout(() => setCoinShow(undefined), coinShowDuration)
        return () => window.clearTimeout(timer)
    }, [coinShow])
    const [demoSummary, setDemoSummary] = useState<ReturnType<typeof demoOverview>>()
    const betId = terms?.id

    useEffect(() => {
        if (!demo) return
        try {
            setDemoSummary(demoOverview(demoParty, betId))
        } catch (cause) {
            setError(errorText(cause))
        }
    }, [demo, demoParty, betId, betsVersion])

    function sound(cue: SoundCue) {
        if (soundPreference.current) playSound(cue)
    }

    function playControlSound(event: MouseEvent<HTMLElement>) {
        if (!(event.target instanceof Element)) return
        const control = event.target.closest<HTMLElement>(
            'button:not(:disabled), a[href], summary'
        )
        const cue = control?.dataset.sound
        if (control && cue !== 'toggle') sound((cue ?? 'tap') as SoundCue)
    }

    function toggleSound() {
        const enabled = !soundPreference.current
        soundPreference.current = enabled
        setSoundOn(enabled)
        saveSoundPreference(enabled)
        sound('tap')
    }

    function playTypingSound() {
        const now = performance.now()
        if (now - lastTypingSound.current < 65) return
        lastTypingSound.current = now
        sound('type')
    }

    function updateDraft(changes: Partial<BetDraft>) {
        setDraft((previous) => ({ ...previous, ...changes }))
    }

    function shufflePrompt() {
        const { promptIndex } = draft
        const available = prompts.length - (promptIndex < 0 ? 0 : 1)
        const draw = Math.floor(Math.random() * available)
        const next = promptIndex >= 0 && draw >= promptIndex ? draw + 1 : draw
        const [title, optionOne, optionTwo] = prompts[next]
        updateDraft({ title, optionOne, optionTwo, promptIndex: next })
    }

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const invite = params.get('bet')
        try {
            if (params.has('invite')) {
                throw new Error(
                    'This is an old prototype link, not a ledger bet. Create a new bet or open a ledger bet link.'
                )
            }
            if (invite) {
                const incoming = readTerms(invite)
                if (demo !== isDemoPlayer(incoming.creator)) {
                    throw new Error(
                        'Open this invite in its original demo or wallet mode.'
                    )
                }
                setTerms(incoming)
            }
        } catch (cause) {
            setError(errorText(cause))
        }
    }, [demo])

    useEffect(() => {
        if (demo) return
        let disposed = false
        let subscribed = false
        let accountsSubscribed = false
        const onStatus = (next: dapp.dappAPI.StatusEvent) => setStatus(next)
        const onAccountsChanged = () => {
            setParty('')
            setAccountsVersion((version) => version + 1)
        }
        const initialize = async () => {
            try {
                await dapp.init()
                if (disposed) return
                if (!dapp.getConnectedProvider()) return
                await dapp.onStatusChanged(onStatus)
                subscribed = true
                if (disposed) {
                    await dapp.removeOnStatusChanged(onStatus)
                    return
                }
                await dapp.onAccountsChanged(onAccountsChanged)
                accountsSubscribed = true
                if (disposed) {
                    await dapp.removeOnAccountsChanged(onAccountsChanged)
                    return
                }
                if (!disposed) setStatus(await dapp.status())
            } catch (cause) {
                if (!disposed) setError(errorText(cause))
            }
        }
        void initialize()
        return () => {
            disposed = true
            if (subscribed) void dapp.removeOnStatusChanged(onStatus).catch(console.error)
            if (accountsSubscribed)
                void dapp.removeOnAccountsChanged(onAccountsChanged).catch(console.error)
        }
    }, [demo, status?.connection.isConnected])

    useEffect(() => {
        if (demo) return
        let disposed = false
        setClient(undefined)
        setParty('')
        setAllocations(undefined)
        setAllocationsError('')
        setActiveBets(undefined)
        setActiveBetsError('')
        setCompletedBets(undefined)
        setCompletedBetsError('')
        if (!status?.connection.isConnected) return
        const setup = async () => {
            try {
                const [nextAccounts, nextClient] = await Promise.all([
                    dapp.listAccounts(),
                    connectLedger(status),
                ])
                if (disposed) return
                setParty(primaryParty(nextAccounts, status.network?.networkId))
                setClient(nextClient)
                setError('')
            } catch (cause) {
                if (!disposed) setError(errorText(cause))
            }
        }
        void setup()
        return () => {
            disposed = true
        }
    }, [demo, status, accountsVersion])

    useEffect(() => {
        let disposed = false
        if (!client || !party) return
        setActiveBets(undefined)
        setActiveBetsError('')
        void client.activeBets(party).then(
            (result) => {
                if (!disposed) setActiveBets(result)
            },
            (cause: unknown) => {
                if (!disposed) setActiveBetsError(errorText(cause))
            }
        )
        return () => {
            disposed = true
        }
    }, [client, party, betsVersion])

    useEffect(() => {
        let disposed = false
        if (!client || !party) return
        setCompletedBets(undefined)
        setCompletedBetsError('')
        void client.completedBets(party).then(
            (result) => {
                if (!disposed) setCompletedBets(result)
            },
            (cause: unknown) => {
                if (!disposed) setCompletedBetsError(errorText(cause))
            }
        )
        return () => {
            disposed = true
        }
    }, [client, party, betsVersion])

    const refresh = useCallback(async () => {
        if (!terms || !client || !party) return
        setAllocations(undefined)
        setAllocationsError('')
        try {
            setAllocations(await client.allocations(terms, party))
        } catch (cause) {
            setAllocationsError(errorText(cause))
            throw cause
        }
    }, [client, party, terms])

    useEffect(() => {
        if (!demo) return
        function syncDemo(event: StorageEvent) {
            if (event.key !== demoStorageKey && event.key !== null) return
            setBetsVersion((version) => version + 1)
            void refresh().catch(() => {})
        }
        window.addEventListener('storage', syncDemo)
        return () => window.removeEventListener('storage', syncDemo)
    }, [demo, refresh])

    useEffect(() => {
        let disposed = false
        if (!terms || !client || !party) return
        setAllocations(undefined)
        setAllocationsError('')
        void client.allocations(terms, party).then(
            (result) => {
                if (!disposed) setAllocations(result)
            },
            (cause: unknown) => {
                if (!disposed) setAllocationsError(errorText(cause))
            }
        )
        return () => {
            disposed = true
        }
    }, [client, party, terms])

    const run = async (operation: () => Promise<void>) => {
        if (operationInProgress.current) return
        operationInProgress.current = true
        setBusy(true)
        setError('')
        setNotice('')
        try {
            await operation()
        } catch (cause) {
            sound('error')
            setError(errorText(cause))
        } finally {
            operationInProgress.current = false
            setBusy(false)
        }
    }

    const connect = () =>
        run(async () => {
            if (demo) return
            await dapp.connect()
            setStatus(await dapp.status())
            sound('success')
        })

    const start = () =>
        run(async () => {
            if (!client || !party) throw new Error('Connect a wallet first.')
            const { title, optionOne, optionTwo, stake, hours, side } = draft
            if (!title.trim()) throw new Error('Enter a title for your bet.')
            await client.ensureWallet(party)
            const next: BetTerms = {
                id: crypto.randomUUID(),
                creator: party,
                judge: party,
                creatorSide: demo ? 'YES' : side,
                stake,
                deadline: new Date(Date.now() + hours * 3600000).toISOString(),
                details: {
                    title: title.trim(),
                    options: [optionOne.trim(), optionTwo.trim()],
                },
            }
            validateTerms(next)
            setTerms(next)
            window.scrollTo(0, 0)
        })

    const execute = (operation: () => Promise<unknown>, moment?: CoinMoment) =>
        run(async () => {
            await operation()
            sound(
                moment?.kind === 'toss'
                    ? 'coinToss'
                    : moment?.kind === 'rain'
                      ? 'coinRain'
                      : 'success'
            )
            if (
                moment &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ) {
                const show = makeCoinShow(
                    moment,
                    ++celebrationId.current,
                    lastRain.current
                )
                if (moment.kind === 'rain') lastRain.current = show.pattern
                setCoinShow(show)
            }
            if (view === 'make') setView('bets')
            if (!demo) setNotice('Transaction confirmed.')
            setBetsVersion((version) => version + 1)
            await refresh()
        })

    function inviteLink(bet: BetTerms) {
        const url = appUrl(demo)
        url.searchParams.set('bet', JSON.stringify(bet))
        return url.toString()
    }

    const copyLink = (bet: BetTerms) =>
        run(async () => {
            await navigator.clipboard.writeText(inviteLink(bet))
            sound('copy')
            setNotice('Link copied. Send the dare.')
        })

    const downloadCard = (bet: BetTerms) =>
        run(async () => {
            await saveChallengeCard(bet, demo)
            sound('copy')
            setNotice('Meme card saved.')
        })

    const walletConnected = status?.connection.isConnected ?? false
    const network = networkConfig(status?.network?.networkId)
    const currency = demo ? 'demo CC' : 'CC'
    const readyCount = activeBets?.readyToJudge.length ?? 0

    function navigateTo(next: BetView) {
        if (terms) history.replaceState(null, '', appUrl(demo))
        setView(next)
        setTerms(undefined)
        setDemoPick(undefined)
        setAllocations(undefined)
        setNotice('')
        if (terms) setError('')
        window.scrollTo(0, 0)
    }

    function openBet(bet: BetTerms) {
        setTerms(bet)
        setAllocations(undefined)
        setAllocationsError('')
        setError('')
        setNotice('')
        window.scrollTo(0, 0)
    }

    return (
        <main className="app-shell" onClickCapture={playControlSound}>
            {coinShow && <CoinCelebration key={coinShow.id} show={coinShow} />}
            <AppHeader
                demo={demo}
                demoParty={demoParty}
                balance={demoSummary?.balance}
                soundOn={soundOn}
                walletConnected={walletConnected}
                busy={busy}
                onToggleSound={toggleSound}
                onPlayerChange={(player) => {
                    sessionStorage.setItem(playerKey, player)
                    setDemoParty(player)
                    setAllocations(undefined)
                    setNotice('')
                    setError('')
                    sound('side')
                }}
                onConnect={() => void connect()}
                onDisconnect={() =>
                    void run(async () => {
                        await dapp.disconnect()
                        setStatus(undefined)
                    })
                }
            />
            <nav className="bet-nav" aria-label="Bets">
                {betViews.map(({ id, label }) => (
                    <button
                        key={id}
                        className="bet-nav-button"
                        aria-current={view === id ? 'page' : undefined}
                        disabled={busy}
                        onClick={() => navigateTo(id)}
                    >
                        {label}
                        {id === 'judge' && readyCount > 0 && (
                            <span
                                className="bet-nav-count"
                                aria-label={`${readyCount} ready`}
                            >
                                {readyCount}
                            </span>
                        )}
                    </button>
                ))}
            </nav>
            {error && !terms && (
                <div className="error-banner" role="alert">
                    {error}
                </div>
            )}
            {notice && !terms && (
                <div className="prototype-note" role="status">
                    {notice}
                </div>
            )}
            {!terms ? (
                <>
                    {view === 'make' && (
                        <BetComposer
                            draft={draft}
                            demo={demo}
                            walletConnected={walletConnected}
                            canReview={!!client && !!party}
                            busy={busy}
                            onChange={updateDraft}
                            onType={playTypingSound}
                            onShuffle={shufflePrompt}
                            onReview={() => void start()}
                        />
                    )}
                    {view !== 'make' && (
                        <BetLists
                            view={view}
                            demo={demo}
                            currency={currency}
                            party={party}
                            connected={!!client && !!party}
                            walletConnected={walletConnected}
                            network={network}
                            busy={busy}
                            activeBets={activeBets}
                            activeBetsError={activeBetsError}
                            completedBets={completedBets}
                            completedBetsError={completedBetsError}
                            onRefresh={() => setBetsVersion((version) => version + 1)}
                            onMake={() => navigateTo('make')}
                            onOpen={openBet}
                        />
                    )}
                </>
            ) : (
                <BetDetail
                    terms={terms}
                    view={view}
                    demo={demo}
                    party={party}
                    client={client}
                    network={network}
                    walletConnected={walletConnected}
                    currency={currency}
                    allocations={allocations}
                    allocationsError={allocationsError}
                    demoClosed={
                        demoSummary?.betId === betId ? demoSummary?.closed : undefined
                    }
                    demoWinningSide={demoSummary?.winningSide}
                    completedBet={completedBets?.bets.find(
                        (bet) => bet.terms.id === betId
                    )}
                    confirmedWinner={
                        lastSettlement?.id === betId ? lastSettlement?.side : undefined
                    }
                    demoPick={demoPick}
                    busy={busy}
                    notice={notice}
                    error={error}
                    onBack={() => navigateTo(view)}
                    onPick={(side) =>
                        setDemoPick({ betId: terms.id, player: party, side })
                    }
                    onExecute={execute}
                    onSettled={(side) => setLastSettlement({ id: terms.id, side })}
                    onCopy={() => void copyLink(terms)}
                    onDownload={() => void downloadCard(terms)}
                    onRefresh={() => void run(refresh)}
                />
            )}
            {!demo && network && (
                <footer>
                    <a href={network.explorer} target="_blank" rel="noopener noreferrer">
                        Open CCView ↗
                    </a>
                </footer>
            )}
        </main>
    )
}
