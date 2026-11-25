import { pigeonLogo } from '../assets'
import { useRef } from 'react'
import { demoPlayers, isDemoPlayer, type DemoPlayer } from '../demo-ledger'
import { partyLabel } from './format'

type Props = {
    demo: boolean
    demoParty: DemoPlayer
    balance?: number
    soundOn: boolean
    walletConnected: boolean
    busy: boolean
    onToggleSound: () => void
    onPlayerChange: (party: DemoPlayer) => void
    onConnect: () => void
    onDisconnect: () => void
}

export function AppHeader(props: Props) {
    const {
        demo,
        demoParty,
        balance,
        soundOn,
        walletConnected,
        busy,
        onToggleSound,
        onPlayerChange,
        onConnect,
        onDisconnect,
    } = props
    const demoAccount = useRef<HTMLDetailsElement>(null)

    return (
        <header className="topbar">
            <span className="brand">
                <img
                    className="brand-icon"
                    src={pigeonLogo}
                    alt=""
                    width="48"
                    height="48"
                />
                <span>
                    Bet with <strong>friends</strong>
                </span>
            </span>
            <div className="header-actions">
                <button
                    className="sound-toggle"
                    data-sound="toggle"
                    aria-label="Sound effects"
                    aria-pressed={soundOn}
                    onClick={onToggleSound}
                >
                    <span aria-hidden="true">{soundOn ? '♫' : '×'}</span>
                    <span>SFX {soundOn ? 'ON' : 'OFF'}</span>
                </button>
                {demo ? (
                    <details
                        className="demo-account"
                        ref={demoAccount}
                        onBlur={(event) => {
                            if (
                                event.relatedTarget &&
                                !event.currentTarget.contains(event.relatedTarget)
                            ) {
                                event.currentTarget.open = false
                            }
                        }}
                        onKeyDown={(event) => {
                            if (event.key !== 'Escape' || !event.currentTarget.open)
                                return
                            event.currentTarget.open = false
                            event.currentTarget.querySelector('summary')?.focus()
                        }}
                    >
                        <summary>
                            <span className="demo-account-name">
                                {partyLabel(demoParty)}
                            </span>
                            <span
                                className="demo-account-balance"
                                title={
                                    balance === undefined
                                        ? undefined
                                        : `${balance} demo CC`
                                }
                            >
                                {balance?.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                }) ?? '—'}{' '}
                                demo CC
                            </span>
                        </summary>
                        <div className="demo-account-panel">
                            <label htmlFor="demo-player">Play as</label>
                            <select
                                id="demo-player"
                                aria-label="Demo player"
                                value={demoParty}
                                disabled={busy}
                                onChange={(event) => {
                                    const player = event.target.value
                                    if (!isDemoPlayer(player) || player === demoParty)
                                        return
                                    onPlayerChange(player)
                                    if (demoAccount.current) {
                                        demoAccount.current.open = false
                                        demoAccount.current
                                            .querySelector('summary')
                                            ?.focus()
                                    }
                                }}
                            >
                                {demoPlayers.map((player) => (
                                    <option key={player} value={player}>
                                        {partyLabel(player)}
                                    </option>
                                ))}
                            </select>
                            <a className="mode-link" href={location.pathname}>
                                Exit demo
                            </a>
                        </div>
                    </details>
                ) : !walletConnected ? (
                    <button
                        className="primary-button compact"
                        data-sound="connect"
                        disabled={busy}
                        onClick={onConnect}
                    >
                        Connect wallet
                    </button>
                ) : (
                    <button
                        className="quiet-button"
                        disabled={busy}
                        onClick={onDisconnect}
                    >
                        Disconnect
                    </button>
                )}
            </div>
        </header>
    )
}
