const params = new URLSearchParams(location.search)
const demoParam = params.get('demo')

export const demoMode = demoParam === '' || demoParam === '1'
export const retroTheme = params.get('theme') !== 'modern'

export function appUrl(demo: boolean) {
    const url = new URL(location.pathname, location.origin)
    if (demo) url.searchParams.set('demo', '1')
    if (!retroTheme) url.searchParams.set('theme', 'modern')
    return url
}
