import type { CSSProperties } from 'react'

type Origin = { x: number; y: number }

export type CoinMoment = { kind: 'toss'; origin: Origin } | { kind: 'rain' }

type Pattern = 'toss' | 'downpour' | 'crosswind' | 'pigeon'

export type CoinShow = {
    id: number
    pattern: Pattern
    particles: CSSProperties[]
}

const rainPatterns = ['downpour', 'crosswind', 'pigeon'] as const
export const coinShowDuration = 2350

const random = (min: number, max: number) => min + Math.random() * (max - min)

export function buttonOrigin(button: HTMLButtonElement): Origin {
    const rect = button.getBoundingClientRect()
    return {
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
    }
}

export function makeCoinShow(
    moment: CoinMoment,
    id: number,
    lastRain?: Pattern
): CoinShow {
    const patterns = rainPatterns.filter((pattern) => pattern !== lastRain)
    const pattern =
        moment.kind === 'toss' ? 'toss' : patterns[Math.floor(random(0, patterns.length))]
    const count = moment.kind === 'toss' ? 11 : 30

    const particles = Array.from({ length: count }, (_, index): CSSProperties => {
        const band = (index + random(0.15, 0.85)) / count
        const x = moment.kind === 'toss' ? moment.origin.x : band * 100
        const y = moment.kind === 'toss' ? moment.origin.y : -6
        const drift =
            pattern === 'crosswind'
                ? random(11, 28) * (index % 2 ? 1 : -1)
                : random(-13, 13)
        return {
            '--coin-x': `${x}vw`,
            '--coin-y': `${y}vh`,
            '--coin-drift': `${drift}vw`,
            '--coin-rise': `${random(11, 29)}vh`,
            '--coin-fall': `${115 - y}vh`,
            '--coin-size': `${random(17, 32)}px`,
            '--coin-delay': `${random(0, moment.kind === 'toss' ? 105 : 480)}ms`,
            '--coin-duration': `${random(880, moment.kind === 'toss' ? 1180 : 1570)}ms`,
            '--coin-turn': `${random(270, 930) * (index % 2 ? -1 : 1)}deg`,
            '--coin-tilt': `${random(-55, 55)}deg`,
        } as CSSProperties
    })
    return { id, pattern, particles }
}

export function CoinCelebration({ show }: { show: CoinShow }) {
    return (
        <div className="coin-celebration" data-pattern={show.pattern} aria-hidden="true">
            {show.particles.map((style, index) => (
                <span className="coin-flight" key={index} style={style}>
                    <i className="celebration-coin">{index % 4 === 0 ? '✦' : 'CC'}</i>
                </span>
            ))}
            {show.pattern === 'pigeon' && (
                <div className="coin-pigeon">
                    <img src="/bet-pigeon.webp" width="960" height="640" alt="" />
                    <span>PIGEON PAYDAY</span>
                </div>
            )}
        </div>
    )
}
