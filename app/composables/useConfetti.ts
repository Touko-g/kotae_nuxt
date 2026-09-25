// 撒花彩带：零依赖，基于原生 Web Animations API 逐粒生成并动画
// SSR 安全：仅在客户端执行；跟随主题色；尊重 prefers-reduced-motion
const DEFAULT_COLORS = [
    '#e41b23',
    '#349d17',
    '#f7c948',
    '#4c6ef5',
    '#ff6b6b',
    '#4ecdc4',
]

// 读取主题强调色（定义在 .v-application 上的 --k-accent-*），失败则回落固定调色板
const readPalette = (): string[] => {
    const host =
        document.querySelector('.v-application') ?? document.documentElement
    const cs = getComputedStyle(host)
    const accents = [
        '--k-accent-a',
        '--k-accent-b',
        '--k-accent-c',
        '--k-accent-d',
    ]
        .map(v => cs.getPropertyValue(v).trim())
        .filter(Boolean)
    return accents.length ? [...accents, ...DEFAULT_COLORS] : DEFAULT_COLORS
}

export const useConfetti = () => {
    const fire = (origin?: { x?: number; y?: number }, count = 90) => {
        if (!import.meta.client) return
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
            return

        const palette = readPalette()
        const x = origin?.x ?? window.innerWidth / 2
        const y = origin?.y ?? window.innerHeight / 3

        for (let i = 0; i < count; i++) {
            const bit = document.createElement('span')
            const size = 6 + Math.random() * 8
            const round = Math.random() > 0.5
            bit.style.cssText = [
                'position:fixed',
                `left:${x}px`,
                `top:${y}px`,
                `width:${size}px`,
                `height:${round ? size : size * 0.5}px`,
                `background:${palette[i % palette.length]}`,
                `border-radius:${round ? '50%' : '2px'}`,
                'pointer-events:none',
                'z-index:9999',
                'will-change:transform,opacity',
            ].join(';')
            document.body.appendChild(bit)

            // 抛射：随机方向扩散 + 向下重力 + 自旋 + 淡出
            const angle = Math.random() * Math.PI * 2
            const dist = 80 + Math.random() * 260
            const dx = Math.cos(angle) * dist
            const dy =
                Math.sin(angle) * dist * 0.6 + (120 + Math.random() * 260)
            const rotate = Math.random() * 720 - 360
            const duration = 900 + Math.random() * 700

            const anim = bit.animate(
                [
                    {
                        transform: 'translate(-50%, -50%) rotate(0deg)',
                        opacity: 1,
                    },
                    {
                        transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rotate}deg)`,
                        opacity: 0,
                    },
                ],
                {
                    duration,
                    easing: 'cubic-bezier(0.15, 0.6, 0.4, 1)',
                    fill: 'forwards',
                }
            )
            anim.finished.then(() => bit.remove()).catch(() => bit.remove())
        }
    }

    return { fire }
}
