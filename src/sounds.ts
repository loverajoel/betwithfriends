type Tone = {
    from: number
    to: number
    length: number
    delay?: number
    wave?: OscillatorType
    gain?: number
}

const cues = {
    tap: [{ from: 620, to: 340, length: 0.055 }],
    type: [{ from: 540, to: 290, length: 0.04, gain: 0.022 }],
    chip: [
        { from: 500, to: 210, length: 0.06, wave: 'triangle' },
        { from: 900, to: 480, length: 0.045, delay: 0.045 },
    ],
    clock: [{ from: 820, to: 700, length: 0.065, wave: 'triangle' }],
    side: [{ from: 310, to: 730, length: 0.13, wave: 'triangle' }],
    pigeon: [
        { from: 290, to: 190, length: 0.14, wave: 'triangle' },
        { from: 260, to: 175, length: 0.22, delay: 0.105, wave: 'triangle' },
        { from: 450, to: 300, length: 0.08, delay: 0.16, gain: 0.025 },
    ],
    shuffle: [
        { from: 260, to: 90, length: 0.09, wave: 'sawtooth', gain: 0.03 },
        { from: 440, to: 190, length: 0.08, delay: 0.055 },
        { from: 180, to: 770, length: 0.23, delay: 0.115, wave: 'triangle' },
    ],
    connect: [
        { from: 392, to: 400, length: 0.1, wave: 'triangle' },
        { from: 587, to: 600, length: 0.14, delay: 0.075 },
    ],
    review: [
        { from: 390, to: 240, length: 0.1, wave: 'triangle' },
        { from: 350, to: 170, length: 0.13, delay: 0.08, wave: 'triangle' },
    ],
    copy: [
        { from: 630, to: 930, length: 0.1 },
        { from: 1130, to: 930, length: 0.13, delay: 0.075 },
    ],
    submit: [{ from: 190, to: 58, length: 0.19, wave: 'triangle' }],
    coinToss: [
        { from: 690, to: 1240, length: 0.12, wave: 'triangle' },
        { from: 1650, to: 1080, length: 0.11, delay: 0.12 },
        { from: 960, to: 720, length: 0.11, delay: 0.19, gain: 0.04 },
    ],
    coinRain: [
        { from: 392, to: 392, length: 0.14, wave: 'triangle' },
        { from: 494, to: 494, length: 0.15, delay: 0.07, wave: 'triangle' },
        { from: 587, to: 587, length: 0.16, delay: 0.14, wave: 'triangle' },
        { from: 784, to: 784, length: 0.36, delay: 0.22, wave: 'triangle' },
        { from: 1760, to: 1480, length: 0.18, delay: 0.31, gain: 0.05 },
        { from: 2349, to: 1760, length: 0.24, delay: 0.43, gain: 0.035 },
    ],
    success: [
        { from: 523, to: 523, length: 0.16, wave: 'triangle' },
        { from: 659, to: 659, length: 0.16, delay: 0.07, wave: 'triangle' },
        { from: 784, to: 784, length: 0.18, delay: 0.14, wave: 'triangle' },
        { from: 1047, to: 1047, length: 0.34, delay: 0.22, wave: 'triangle' },
    ],
    error: [
        { from: 240, to: 175, length: 0.14, wave: 'triangle' },
        { from: 170, to: 85, length: 0.23, delay: 0.1, wave: 'triangle' },
    ],
} satisfies Record<string, Tone[]>

export type SoundCue = keyof typeof cues

let audio: AudioContext | undefined

export function playSound(cue: SoundCue) {
    if (!Object.prototype.hasOwnProperty.call(cues, cue)) return
    try {
        const context = (audio ??= new AudioContext())
        if (context.state !== 'running') {
            void context
                .resume()
                .then(() => playTones(context, cues[cue]))
                .catch(() => {})
        } else {
            playTones(context, cues[cue])
        }
    } catch {}
}

function playTones(context: AudioContext, tones: Tone[]) {
    const now = context.currentTime
    for (const { from, to, length, delay = 0, wave = 'sine', gain = 0.075 } of tones) {
        const start = now + delay
        const end = start + length
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        oscillator.type = wave
        oscillator.frequency.setValueAtTime(from, start)
        oscillator.frequency.exponentialRampToValueAtTime(to, end)
        envelope.gain.setValueAtTime(0.001, start)
        envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008)
        envelope.gain.exponentialRampToValueAtTime(0.001, end)
        oscillator.connect(envelope).connect(context.destination)
        oscillator.start(start)
        oscillator.stop(end)
        oscillator.onended = () => {
            oscillator.disconnect()
            envelope.disconnect()
        }
    }
}

const preferenceKey = 'bet-with-friends:sound'

export function soundEnabled() {
    try {
        return localStorage.getItem(preferenceKey) !== 'off'
    } catch {
        return true
    }
}

export function saveSoundPreference(enabled: boolean) {
    try {
        localStorage.setItem(preferenceKey, enabled ? 'on' : 'off')
    } catch {}
}
