export const retroTheme = new URLSearchParams(location.search).get('theme') !== 'modern'

export function appUrl(demo: boolean) {
    const url = new URL(location.pathname, location.origin)
    if (demo) url.searchParams.set('demo', '1')
    if (!retroTheme) url.searchParams.set('theme', 'modern')
    return url
}
