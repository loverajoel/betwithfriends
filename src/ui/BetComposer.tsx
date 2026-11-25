import type { Side } from '../bet-ledger'
import { appUrl } from '../app-url'
import { BetPoster } from './BetPoster'

export type BetDraft = {
    title: string
    optionOne: string
    optionTwo: string
    stake: number
    hours: number
    side: Side
    promptIndex: number
}

type Props = {
    draft: BetDraft
    demo: boolean
    walletConnected: boolean
    canReview: boolean
    busy: boolean
    onChange: (changes: Partial<BetDraft>) => void
    onType: () => void
    onShuffle: () => void
    onReview: () => void
}

export function BetComposer(props: Props) {
    const {
        draft,
        demo,
        walletConnected,
        canReview,
        busy,
        onChange,
        onType,
        onShuffle,
        onReview,
    } = props
    const { title, optionOne, optionTwo, stake, hours, side, promptIndex } = draft

    return (
        <div className="bet-workbench">
            <BetPoster />
            <section className="panel wizard" aria-labelledby="new-bet-heading">
                <div className="wizard-heading">
                    <h2 id="new-bet-heading">Make a bet</h2>
                    <button
                        className="shuffle-button"
                        data-sound="shuffle"
                        disabled={busy}
                        onClick={onShuffle}
                    >
                        <span aria-hidden="true">⤨</span> Random bet
                    </button>
                </div>
                <div className="bet-fields" onInputCapture={onType}>
                    <label htmlFor="bet-title">What are we betting on?</label>
                    <textarea
                        id="bet-title"
                        className={promptIndex >= 0 ? 'shuffled' : undefined}
                        key={promptIndex}
                        value={title}
                        onChange={(event) => onChange({ title: event.target.value })}
                        maxLength={120}
                        rows={2}
                        required
                        placeholder="Will Sam actually be on time?"
                    />
                    <div className="option-fields">
                        <div>
                            <label htmlFor="option-one">Option 1</label>
                            <input
                                id="option-one"
                                value={optionOne}
                                onChange={(event) =>
                                    onChange({ optionOne: event.target.value })
                                }
                                maxLength={80}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="option-two">Option 2</label>
                            <input
                                id="option-two"
                                value={optionTwo}
                                onChange={(event) =>
                                    onChange({ optionTwo: event.target.value })
                                }
                                maxLength={80}
                                required
                            />
                        </div>
                    </div>
                </div>
                <p id="stake-label">How much each?</p>
                <div
                    className="hero-actions stake-options"
                    role="group"
                    aria-labelledby="stake-label"
                >
                    {[5, 10, 25, 50, 100].map((value) => (
                        <button
                            key={value}
                            data-sound="chip"
                            aria-pressed={stake === value}
                            className={
                                stake === value
                                    ? 'primary-button compact'
                                    : 'secondary-button'
                            }
                            onClick={() => onChange({ stake: value })}
                        >
                            {value} CC
                        </button>
                    ))}
                </div>
                <p id="deadline-label">Deadline</p>
                <div
                    className="hero-actions time-options"
                    role="group"
                    aria-labelledby="deadline-label"
                >
                    {[6, 24, 168].map((value) => (
                        <button
                            key={value}
                            data-sound="clock"
                            aria-pressed={hours === value}
                            className={
                                hours === value
                                    ? 'primary-button compact'
                                    : 'secondary-button'
                            }
                            onClick={() => onChange({ hours: value })}
                        >
                            {value === 6 ? '6 hours' : value === 24 ? '1 day' : '1 week'}
                        </button>
                    ))}
                </div>
                {!demo && (
                    <>
                        <p id="side-label">Your side</p>
                        <div
                            className="hero-actions side-options"
                            role="group"
                            aria-labelledby="side-label"
                        >
                            {(['YES', 'NO'] as const).map((value) => (
                                <button
                                    key={value}
                                    data-sound="side"
                                    aria-pressed={side === value}
                                    className={
                                        side === value
                                            ? 'primary-button compact'
                                            : 'secondary-button'
                                    }
                                    onClick={() => onChange({ side: value })}
                                >
                                    {value === 'YES'
                                        ? optionOne || 'Option 1'
                                        : optionTwo || 'Option 2'}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                <p className="judge-note">You’ll pick the winner.</p>
                {demo || walletConnected ? (
                    <button
                        className="primary-button review-button"
                        data-sound="review"
                        disabled={busy || !canReview}
                        onClick={() => onReview()}
                    >
                        Review bet
                    </button>
                ) : (
                    <p className="judge-note">Connect your wallet to review your bet.</p>
                )}
                {!demo && (
                    <a className="mode-link demo-entry" href={appUrl(true).href}>
                        Try demo without a wallet
                    </a>
                )}
            </section>
        </div>
    )
}
