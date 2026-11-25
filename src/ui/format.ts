import { isDemoPlayer } from '../demo-ledger'

export function partyLabel(party: string): string {
    const [name, namespace] = party.split('::')
    if (!namespace || isDemoPlayer(party)) return name
    const shortName = name.length > 24 ? `${name.slice(0, 21)}…` : name
    return `${shortName} · ${namespace.slice(0, 6)}…${namespace.slice(-4)}`
}

export function formatTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value))
}
