import { useState } from 'react'

export const prompts = [
    [
        'Will the group chat pick a restaurant in under 10 minutes?',
        'Decision made',
        'Still typing',
    ],
    [
        'Will the first person to say “on my way” arrive last?',
        'Absolutely',
        'Character growth',
    ],
    ['Will someone say “one quick game” and play five?', 'Five minimum', 'One and done'],
    [
        'Will the office plant outlive the office group chat?',
        'Plant wins',
        'Chat survives',
    ],
    ['Will the aux cord cause a formal complaint?', 'Skip that song', 'Certified banger'],
    [
        'Will anyone remember why we walked into the kitchen?',
        'Memory unlocked',
        'Mysterious fridge visit',
    ],
    [
        'Will the seagull get a fry before anyone sits down?',
        'Bird heist',
        'Fries secured',
    ],
] as const

export function BetPoster() {
    const [boops, setBoops] = useState(0)

    return (
        <aside className="bet-poster" aria-label="Bet with friends">
            <div className="poster-copy">
                <h1>
                    Talk big.
                    <br />
                    <em>Bet small.</em>
                </h1>
                <p>Settle the group chat on Canton.</p>
            </div>
            <img
                key={boops}
                className={boops ? 'poster-art booped' : 'poster-art'}
                src="/bet-pigeon.webp"
                alt=""
                width="960"
                height="640"
            />
            <button
                className="poster-ticket"
                data-sound="pigeon"
                aria-label="Boop the pigeon"
                onClick={() => setBoops((count) => count + 1)}
            >
                ✦ BOOP!
            </button>
        </aside>
    )
}
