import type { ActiveBets, CompletedBets } from '../bet-client'
import { sideLabel, type BetTerms } from '../bet-ledger'
import type { NetworkConfig } from '../networks'
import type { BetView } from './bet-views'
import { formatTime } from './format'

type Props = {
    view: BetView
    demo: boolean
    currency: string
    party: string
    connected: boolean
    walletConnected: boolean
    network?: NetworkConfig
    busy: boolean
    activeBets?: ActiveBets
    activeBetsError: string
    completedBets?: CompletedBets
    completedBetsError: string
    onRefresh: () => void
    onMake: () => void
    onOpen: (bet: BetTerms) => void
}

export function BetLists(props: Props) {
    const {
        view,
        demo,
        currency,
        party,
        connected,
        walletConnected,
        network,
        busy,
        activeBets,
        activeBetsError,
        completedBets,
        completedBetsError,
        onRefresh,
        onMake,
        onOpen,
    } = props
    const readyToJudge = new Set(activeBets?.readyToJudge)
    const visibleBets = (activeBets?.bets ?? [])
        .filter((bet) => view !== 'judge' || bet.judge === party)
        .sort((a, b) => Number(readyToJudge.has(b.id)) - Number(readyToJudge.has(a.id)))

    return (
        <>
            {view !== 'make' && (
                <section
                    className="panel bet-directory"
                    aria-labelledby="bet-directory-title"
                >
                    <header className="bet-directory-header">
                        <h2 id="bet-directory-title">
                            {view === 'judge' ? 'Judge' : 'Active bets'}
                        </h2>
                        {connected && (
                            <button
                                className="bet-tool"
                                disabled={busy}
                                onClick={onRefresh}
                            >
                                Refresh bets
                            </button>
                        )}
                    </header>
                    {!connected ? (
                        walletConnected ? (
                            <p>Loading your bets…</p>
                        ) : (
                            <p>
                                {view === 'judge'
                                    ? 'Connect your wallet to see the bets you judge.'
                                    : 'Connect your wallet to see your bets.'}
                            </p>
                        )
                    ) : (
                        <div aria-live="polite">
                            {activeBetsError ? (
                                <p role="alert">
                                    Could not load active bets: {activeBetsError}
                                </p>
                            ) : !activeBets ? (
                                <p>Loading bets…</p>
                            ) : (
                                <>
                                    {activeBets.invalid > 0 && (
                                        <p role="alert">
                                            Some stakes could not be verified. See Refresh
                                            bets to try again.
                                        </p>
                                    )}
                                    {visibleBets.length === 0 ? (
                                        <div className="bet-list-empty">
                                            <p>
                                                {view === 'judge'
                                                    ? 'No bets to judge.'
                                                    : 'No active bets.'}
                                            </p>
                                            <button
                                                className="primary-button"
                                                onClick={onMake}
                                            >
                                                Make a bet
                                            </button>
                                        </div>
                                    ) : (
                                        visibleBets.map((bet) => (
                                            <button
                                                className="bet-list-item"
                                                key={bet.id}
                                                onClick={() => onOpen(bet)}
                                            >
                                                <span>
                                                    <strong className="bet-title">
                                                        {bet.details?.title ||
                                                            'Untitled bet'}
                                                    </strong>
                                                    <span className="bet-list-meta">
                                                        {bet.stake} {currency} each · Ends{' '}
                                                        {formatTime(bet.deadline)}
                                                    </span>
                                                </span>
                                                <span
                                                    className={
                                                        readyToJudge.has(bet.id)
                                                            ? 'badge judge-badge'
                                                            : 'badge'
                                                    }
                                                >
                                                    {readyToJudge.has(bet.id)
                                                        ? 'Pick winner'
                                                        : view === 'judge'
                                                          ? demo
                                                              ? 'Waiting for both sides'
                                                              : 'Not ready to judge'
                                                          : 'View bet'}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </section>
            )}
            {view === 'bets' && connected && (
                <section className="panel bet-directory" aria-live="polite">
                    <h2>Completed bets</h2>
                    {completedBetsError ? (
                        <p role="alert">
                            Could not load completed bets: {completedBetsError}. Use
                            Refresh bets to try again.
                        </p>
                    ) : completedBets === undefined ? (
                        <p>Loading {demo ? 'demo results' : 'ledger history'}…</p>
                    ) : (
                        <>
                            {completedBets.pruned && (
                                <p>
                                    Older ledger history has been pruned, so some bets may
                                    be missing.
                                </p>
                            )}
                            {completedBets.invalid > 0 && (
                                <p role="alert">
                                    {completedBets.invalid} invalid historical
                                    allocation(s) were ignored.
                                </p>
                            )}
                            {completedBets.bets.length === 0 && <p>No completed bets.</p>}
                            {completedBets.bets.map((bet) => (
                                <article
                                    key={bet.terms.id}
                                    className="bet-list-item history-item"
                                >
                                    <span>
                                        <strong>
                                            {bet.terms.details?.title && (
                                                <span className="bet-title">
                                                    {bet.terms.details.title}
                                                </span>
                                            )}
                                            {bet.terms.stake} {currency} · Your side:{' '}
                                            {sideLabel(bet.terms, bet.side)}
                                        </strong>
                                        <span className="bet-list-meta">
                                            {bet.terms.judge === party
                                                ? 'You are the judge · '
                                                : ''}
                                            {formatTime(bet.time)}
                                        </span>
                                        <span className="bet-list-meta">
                                            {bet.status === 'cancelled'
                                                ? 'Your allocation was cancelled.'
                                                : bet.status === 'withdrawn'
                                                  ? 'Your stake was withdrawn.'
                                                  : bet.status === 'unknown'
                                                    ? 'Your allocation ended; the outcome is unavailable.'
                                                    : bet.outcome === 'won'
                                                      ? 'Your side won.'
                                                      : bet.outcome === 'lost'
                                                        ? 'Your side lost.'
                                                        : 'Settled; the outcome is unavailable.'}
                                        </span>
                                        {bet.updateId && network && (
                                            <a
                                                className="history-transaction-link"
                                                href={`${network.explorer}updates/${encodeURIComponent(bet.updateId)}/`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                View transaction on CCView ↗
                                            </a>
                                        )}
                                        <details className="history-details">
                                            <summary>Bet details</summary>
                                            <p>
                                                Options: {sideLabel(bet.terms, 'YES')} /{' '}
                                                {sideLabel(bet.terms, 'NO')}
                                            </p>
                                            <p>Bet ID: {bet.terms.id}</p>
                                            <p>Judge: {bet.terms.judge}</p>
                                            <p>
                                                Deadline: {formatTime(bet.terms.deadline)}
                                            </p>
                                        </details>
                                    </span>
                                    <span className="badge">
                                        {bet.status === 'settled'
                                            ? 'Settled'
                                            : bet.status === 'cancelled'
                                              ? 'Cancelled'
                                              : bet.status === 'withdrawn'
                                                ? 'Withdrawn'
                                                : 'Outcome unknown'}
                                    </span>
                                </article>
                            ))}
                        </>
                    )}
                </section>
            )}
        </>
    )
}
