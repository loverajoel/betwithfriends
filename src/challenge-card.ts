import { pigeonPoster } from './assets'
import type { BetTerms } from './bet-ledger'
import { sideLabel } from './bet-ledger'

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
    const lines: string[] = []
    let line = ''
    for (const word of text.trim().split(/\s+/)) {
        if (line && ctx.measureText(`${line} ${word}`).width > width) {
            lines.push(line)
            line = ''
        }
        if (ctx.measureText(word).width <= width) {
            line = line ? `${line} ${word}` : word
            continue
        }
        for (const char of word) {
            if (line && ctx.measureText(line + char).width > width) {
                lines.push(line)
                line = ''
            }
            line += char
        }
    }
    return line ? [...lines, line] : lines
}

function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    area: { x: number; y: number; width: number; height: number },
    maxSize: number,
    family: string,
    color: string
) {
    let size = maxSize
    let lines: string[]
    do {
        ctx.font = `700 ${size}px ${family}`
        lines = wrap(ctx, text, area.width)
        if (lines.length * size * 1.14 <= area.height) break
        size -= 2
    } while (size > 12)

    const leading = size * 1.14
    const top = area.y + (area.height - lines.length * leading) / 2
    ctx.fillStyle = color
    ctx.textBaseline = 'top'
    lines.forEach((line, index) => {
        ctx.fillText(line, area.x, top + index * leading, area.width)
    })
}

export async function saveChallengeCard(terms: BetTerms, demo = false) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 960
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser could not create a challenge card.')

    const bird = new Image()
    bird.src = pigeonPoster
    const headline = '"Pixelify Sans Variable", monospace'
    await Promise.all([bird.decode(), document.fonts.load(`700 64px ${headline}`)])

    const ink = '#21182c'
    const paper = '#fffdf7'
    const violet = '#672bf5'
    ctx.fillStyle = violet
    ctx.fillRect(0, 0, 960, 960)
    ctx.drawImage(bird, 15, 0, 930, 620)
    ctx.fillStyle = ink
    ctx.fillRect(35, 426, 905, 507)
    ctx.fillStyle = paper
    ctx.fillRect(25, 416, 905, 507)

    drawText(
        ctx,
        'BET WITH FRIENDS',
        { x: 61, y: 446, width: 774, height: 45 },
        38,
        headline,
        violet
    )
    drawText(
        ctx,
        terms.details?.title ?? 'You’ve been challenged.',
        { x: 61, y: 494, width: 836, height: 185 },
        72,
        headline,
        ink
    )

    const choices = [
        { side: 'YES', x: 61, color: '#dcff58' },
        { side: 'NO', x: 491, color: '#ff879b' },
    ] as const
    for (const { side, x, color } of choices) {
        ctx.fillStyle = ink
        ctx.fillRect(x, 699, 408, 126)
        ctx.fillStyle = color
        ctx.fillRect(x + 4, 703, 400, 118)
        drawText(
            ctx,
            sideLabel(terms, side),
            { x: x + 20, y: 710, width: 368, height: 104 },
            36,
            'system-ui, sans-serif',
            ink
        )
    }
    drawText(
        ctx,
        `${terms.stake} ${demo ? 'demo CC' : 'CC'} per friend  •  Pick a side`,
        { x: 61, y: 845, width: 836, height: 49 },
        31,
        'system-ui, sans-serif',
        ink
    )

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve))
    if (!blob) throw new Error('This browser could not save the challenge card.')
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bet-with-friends.png'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
