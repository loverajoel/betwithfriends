import type { Allocations, Client, CompletedBets } from '../bet-client'
import { sideLabel, type BetTerms, type Side } from '../bet-ledger'
import { hasBothSides } from '../demo-ledger'
import type { NetworkConfig } from '../networks'
import type { BetView } from './bet-views'
import { buttonOrigin, type CoinMoment } from './CoinCelebration'
import { formatTime, partyLabel } from './format'

type Props = {
    terms: BetTerms
    view: BetView
    demo: boolean
    party: string
    client?: Client
    network?: NetworkConfig
    walletConnected: boolean
    currency: string
    allocations?: Allocations
    allocationsError: string
    demoClosed?: 'settled' | 'cancelled'
    demoWinningSide?: Side
    completedBet?: CompletedBets['bets'][number]
    confirmedWinner?: Side
    demoPick?: { betId: string; player: string; side: Side }
    busy: boolean
    notice: string
    error: string
    onBack: () => void
    onPick: (side: Side) => void
    onExecute: (operation: () => Promise<unknown>, moment?: CoinMoment) => Promise<void>
    onSettled: (side: Side) => void
    onCopy: () => void
    onDownload: () => void
    onRefresh: () => void
}

export function BetDetail(props: Props) {
    const {
        terms,
        view,
        demo,
        party,
        client,
        network,
        walletConnected,
        currency,
        allocations,
        allocationsError,
        demoClosed,
        demoWinningSide,
        completedBet,
        confirmedWinner,
        demoPick,
        busy,
        notice,
        error,
        onBack,
        onPick,
        onExecute,
        onSettled,
        onCopy,
        onDownload,
        onRefresh,
    } = props
    const own = allocations?.filter((a) => a.participant.party === party) ?? []
    const settled =
        !!confirmedWinner ||
        demoClosed === 'settled' ||
        completedBet?.status === 'settled'
    const winningSide =
        confirmedWinner ??
        (demoClosed === 'settled'
            ? demoWinningSide
            : completedBet?.outcome === 'won'
              ? completedBet.side
              : completedBet?.outcome === 'lost'
                ? completedBet.side === 'YES'
                    ? 'NO'
                    : 'YES'
                : undefined)
    const closed = settled || demoClosed === 'cancelled'
    const judge = terms.judge === party
    const otherSide = terms.creatorSide === 'YES' ? 'NO' : 'YES'
    const demoSelection =
        demoPick && demoPick.betId === terms.id && demoPick.player === party
            ? demoPick.side
            : undefined
    const placedSide = own[0]?.participant.side ?? completedBet?.side
    const ownSide = demo
        ? (placedSide ?? demoSelection)
        : party === terms.creator
          ? terms.creatorSide
          : otherSide
    const seenParties = new Set<string>()
    const duplicateIds = new Set<string>()
    for (const allocation of allocations ?? []) {
        const owner = allocation.participant.party
        if (seenParties.has(owner)) duplicateIds.add(allocation.contractId)
        seenParties.add(owner)
    }
    const pastDeadline = Date.now() >= Date.parse(terms.deadline)
    const canLock = !!(
        client &&
        party &&
        allocations &&
        !allocationsError &&
        !closed &&
        !own.length &&
        !pastDeadline
    )
    const bothSides =
        demo &&
        hasBothSides((allocations ?? []).map((allocation) => allocation.participant))
    const canSettle = !!(
        client &&
        judge &&
        !closed &&
        !duplicateIds.size &&
        (demo ? bothSides : allocations?.length === 2 && own.length === 1)
    )
    const inviteFirst =
        judge &&
        own.length > 0 &&
        (demo ? !bothSides : allocations?.length === 1) &&
        !pastDeadline &&
        !closed
    function describeBetStep() {
        if (settled) return {}
        if (demoClosed === 'cancelled')
            return { title: 'Bet cancelled', text: 'Locked stakes were returned.' }
        if (!demo && !walletConnected)
            return { text: 'Connect your wallet to check the stakes and join.' }
        if (allocationsError)
            return { title: 'Stakes unavailable', text: allocationsError }
        if (!allocations) return { title: 'Checking stakes…' }
        if (canSettle) return { title: 'Who got it right?' }
        if (judge && duplicateIds.size)
            return {
                title: 'Release the extra stake',
                text: 'Find the extra stake in the list below.',
            }
        if (pastDeadline) {
            return own.length
                ? { title: 'Withdraw your stake', text: 'The deadline has passed.' }
                : { title: 'Deadline passed' }
        }
        if (canLock) return {}
        if (inviteFirst)
            return { title: demo ? 'Send it to the group chat' : 'Your friend’s turn' }
        if (own.length) return { title: 'Waiting for the judge' }
        return {
            title: 'Waiting for the creator',
            text: 'They need to put up their share first.',
        }
    }
    const betStep = describeBetStep()

    return (
        <section className="panel bet-detail" aria-labelledby="bet-detail-title">
            <button className="bet-back" disabled={busy} onClick={() => onBack()}>
                <span aria-hidden="true">←</span>
                {view === 'judge'
                    ? 'Back to Judge'
                    : view === 'make'
                      ? 'Edit bet'
                      : 'Back to My bets'}
            </button>
            <header className="bet-detail-header">
                <h2 id="bet-detail-title">
                    {terms.details?.title || (judge ? 'Your bet' : 'Bet invitation')}
                </h2>
                {settled && (
                    <p className="bet-result" role="status">
                        {winningSide
                            ? `${sideLabel(terms, winningSide)} won!`
                            : 'Bet settled'}
                    </p>
                )}
                <p className="bet-meta">
                    Each player puts up{' '}
                    <strong>
                        {terms.stake} {currency}
                    </strong>
                    .{' '}
                    {judge ? (
                        'You’ll pick the winner.'
                    ) : (
                        <>
                            <span title={terms.judge}>{partyLabel(terms.judge)}</span>{' '}
                            will pick the winner.
                        </>
                    )}
                </p>
                <p className="bet-deadline">
                    Deadline:{' '}
                    <time dateTime={terms.deadline}>{formatTime(terms.deadline)}</time>
                </p>
                {demo && !closed && (
                    <p className="group-payout-note">
                        Winners split the other side’s CC.
                    </p>
                )}
            </header>
            <div
                className="bet-sides"
                role="group"
                aria-label={demo && canLock ? 'Pick a side' : 'Bet sides'}
            >
                {demo && canLock && <p className="bet-pick-label">Pick a side</p>}
                {(['YES', 'NO'] as const).map((side) => {
                    const label = sideLabel(terms, side)
                    if (demo && canLock) {
                        return (
                            <button
                                key={side}
                                className="bet-side bet-side-picker"
                                aria-pressed={ownSide === side}
                                data-own={ownSide === side}
                                data-sound="side"
                                disabled={busy}
                                onClick={() => onPick(side)}
                            >
                                <strong>{label}</strong>
                            </button>
                        )
                    }
                    return (
                        <div
                            className="bet-side"
                            key={side}
                            data-own={!!party && (demo ? placedSide : ownSide) === side}
                        >
                            {demo ? (
                                placedSide === side && <span>Your side</span>
                            ) : (
                                <span>
                                    {party && ownSide === side
                                        ? 'Your side'
                                        : side === terms.creatorSide
                                          ? 'Creator’s side'
                                          : 'Opposing side'}
                                </span>
                            )}
                            <strong>{label}</strong>
                        </div>
                    )
                })}
            </div>

            <section className="bet-next" aria-label="Bet actions">
                {betStep.title && <h3>{betStep.title}</h3>}
                {betStep.text && <p>{betStep.text}</p>}
                {!demo && !judge && canLock && (
                    <p>
                        Verify the creator’s stake with the judge before joining. Your
                        wallet may have limited visibility.
                    </p>
                )}
                {canLock && client && (
                    <button
                        className="primary-button"
                        data-sound="submit"
                        disabled={busy || !ownSide}
                        onClick={(event) => {
                            if (!ownSide) return
                            void onExecute(() => client.allocate(terms, party, ownSide), {
                                kind: 'toss',
                                origin: buttonOrigin(event.currentTarget),
                            })
                        }}
                    >
                        I’m in. Put up my share
                    </button>
                )}
                {canSettle && client && (
                    <div className="bet-winner-actions">
                        {(['YES', 'NO'] as const).map((result) => (
                            <button
                                key={result}
                                className="primary-button"
                                data-sound="submit"
                                disabled={busy}
                                aria-label={`Declare ${sideLabel(terms, result)} the winner`}
                                onClick={() =>
                                    void onExecute(
                                        async () => {
                                            await client.settle(terms, party, result)
                                            onSettled(result)
                                        },
                                        { kind: 'rain' }
                                    )
                                }
                            >
                                {sideLabel(terms, result)}
                            </button>
                        ))}
                    </div>
                )}
                {!closed &&
                    pastDeadline &&
                    client &&
                    own.map((allocation) => (
                        <button
                            key={allocation.contractId}
                            className={canSettle ? 'secondary-button' : 'primary-button'}
                            data-sound="submit"
                            disabled={busy}
                            onClick={() =>
                                void onExecute(() =>
                                    client.withdraw(terms, party, allocation.contractId)
                                )
                            }
                        >
                            Withdraw my stake
                        </button>
                    ))}
                <div className="bet-share">
                    {!closed && (
                        <button
                            className={inviteFirst ? 'primary-button' : 'bet-tool'}
                            disabled={busy}
                            onClick={() => onCopy()}
                        >
                            Copy invite link
                        </button>
                    )}
                    <button
                        className="bet-tool"
                        disabled={busy}
                        onClick={() => onDownload()}
                    >
                        Save meme card
                    </button>
                </div>
                {!demo && !closed && (
                    <p className="invite-privacy">
                        Anyone with the invite link can read the bet terms.
                    </p>
                )}
                {notice && (
                    <p className="bet-feedback" role="status">
                        {notice}
                    </p>
                )}
                {error && (
                    <p className="bet-feedback bet-action-error" role="alert">
                        {error}
                    </p>
                )}
            </section>

            {!!allocations?.length && (
                <section className="bet-stakes" aria-labelledby="bet-stakes-title">
                    <h3 id="bet-stakes-title">
                        {demo ? 'Locked stakes' : 'Locked stakes you can see'}
                    </h3>
                    {duplicateIds.size > 0 && judge && (
                        <p role="alert">
                            A player has more than one stake. Release the extra stake
                            before settling.
                        </p>
                    )}
                    <ul className="stake-list">
                        {allocations.map((allocation) => (
                            <li className="stake-row" key={allocation.contractId}>
                                <span>
                                    <strong title={allocation.participant.party}>
                                        {allocation.participant.party === party
                                            ? 'You'
                                            : partyLabel(allocation.participant.party)}
                                    </strong>
                                    {allocation.interfaceViewValue.expiresAt && (
                                        <span className="stake-expiry">
                                            Expires{' '}
                                            {formatTime(
                                                allocation.interfaceViewValue.expiresAt
                                            )}
                                        </span>
                                    )}
                                </span>
                                <span className="side-chip">
                                    {sideLabel(terms, allocation.participant.side)}
                                </span>
                                {judge &&
                                    client &&
                                    duplicateIds.has(allocation.contractId) && (
                                        <button
                                            className="secondary-button"
                                            data-sound="submit"
                                            disabled={busy}
                                            onClick={() =>
                                                void onExecute(() =>
                                                    client.releaseDuplicate(
                                                        terms,
                                                        party,
                                                        allocation.contractId
                                                    )
                                                )
                                            }
                                        >
                                            Release extra stake
                                        </button>
                                    )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="bet-tools">
                <details className="technical-details">
                    <summary>Bet and ledger details</summary>
                    <dl>
                        <dt>Bet ID</dt>
                        <dd>{terms.id}</dd>
                        <dt>Creator / judge party</dt>
                        <dd>{terms.creator}</dd>
                        {!demo && (
                            <>
                                <dt>Creator’s side</dt>
                                <dd>{sideLabel(terms, terms.creatorSide)}</dd>
                            </>
                        )}
                        {allocations?.map((allocation) => (
                            <div key={allocation.contractId}>
                                <dt>
                                    Participant ·{' '}
                                    {sideLabel(terms, allocation.participant.side)}
                                </dt>
                                <dd>{allocation.participant.party}</dd>
                                <dt>
                                    Allocation ·{' '}
                                    {sideLabel(terms, allocation.participant.side)}
                                </dt>
                                <dd>{allocation.contractId}</dd>
                            </div>
                        ))}
                    </dl>
                    {network && (
                        <>
                            <a
                                href={network.explorer}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open {network.name} CCView
                            </a>
                            <p>Copy an ID above to look it up on CCView.</p>
                        </>
                    )}
                </details>
                <div className="bet-tool-actions">
                    <button
                        className="bet-tool"
                        data-sound="clock"
                        disabled={!client || busy}
                        onClick={() => onRefresh()}
                    >
                        Refresh stakes
                    </button>
                    {client && judge && !!allocations?.length && (
                        <button
                            className="bet-tool bet-void"
                            data-sound="submit"
                            disabled={busy}
                            onClick={() =>
                                void onExecute(() => client.void(terms, party))
                            }
                        >
                            Void bet and release stakes
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
