/**
 * 主题轮换：light → dark → terminal（终端）→ light …
 * AppBar 与 CommandPalette 共用同一套顺序、图标与 i18n 标签
 */
export const THEME_ORDER = ['light', 'dark', 'terminal'] as const

const THEME_ICONS: Record<string, string> = {
    light: 'mdi-weather-sunny',
    dark: 'mdi-weather-night',
    terminal: 'mdi-console',
}

const THEME_LABEL_KEYS: Record<string, string> = {
    light: 'theme_light',
    dark: 'theme_dark',
    terminal: 'theme_terminal',
}

export function useThemeCycle() {
    const theme = useTheme()

    const cycleTheme = () => {
        const index = THEME_ORDER.indexOf(
            theme.global.name.value as (typeof THEME_ORDER)[number]
        )
        // 未知主题名时 indexOf 返回 -1，(-1 + 1) % length = 0 → 正好回到第一项
        // （比如旧版 cookie 里存着已下线的主题名，这里自然落回 light）
        const next = THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? 'light'
        theme.global.name.value = next
    }

    // 当前主题的图标/名称词条 key（未知主题名回退到通用切换图标）
    const themeIcon = computed(
        () => THEME_ICONS[theme.global.name.value] ?? 'mdi-theme-light-dark'
    )
    const themeLabelKey = computed(
        () => THEME_LABEL_KEYS[theme.global.name.value] ?? 'cmd_toggle_theme'
    )

    return { cycleTheme, themeIcon, themeLabelKey }
}
