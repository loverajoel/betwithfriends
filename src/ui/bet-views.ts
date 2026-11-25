export const betViews = [
    { id: 'make', label: 'Make a bet' },
    { id: 'bets', label: 'My bets' },
    { id: 'judge', label: 'Judge' },
] as const
export type BetView = (typeof betViews)[number]['id']
