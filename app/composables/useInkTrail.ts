/**
 * 光标墨迹：鼠标划过时拖出一串淡墨，停下后自己洇开消散。
 *
 * 纯装饰，不参与任何业务逻辑，所以这里只管三件事：采样、绘制、收摊。
 *
 * 几个刻意的取舍：
 * - **只认鼠标**（`pointerType === 'mouse'`）。触摸屏滚动时同样会派发 pointermove，
 *   手指一路划过去满屏墨点，那不是惊喜是事故。
 * - **轨迹用「按年龄衰减」的短片段画，不存粒子**。粒子方案每帧要遍历、排序、
 *   还要处理碰撞，这里只要一条尾巴：片段越老越淡越细，视觉上就是墨迹在收干。
 * - **片段在段的中点切开、用平头相接**。两次 `stroke()` 一旦几何重叠，alpha 就
 *   会混合两次（0.5 变 0.75），每个采样点都会变成一颗更深的圆珠 —— 也就是
 *   「满屏小点」；把圆头收到相切又会在接缝处掐出细腰。中点处两侧方向相同、
 *   端面共面，平头贴平头，既不重叠也不留缝。详见 `pass()` 上的注释。
 * - **空闲即停**。点阵淡完就退出 rAF，不留一个常驻的 60fps 循环 —— 这个效果
 *   大部分时间都是关着的（用户不动鼠标），常驻循环纯烧电。
 * - **颜色每帧现取**，换主题立刻跟上，不需要监听主题变化。
 */

export interface InkPoint {
    x: number
    y: number
    t: number
}

export interface UseInkTrailOptions {
    /** 墨色，每帧读一次（换主题要立刻跟上）；返回任意 CSS 颜色 */
    color: () => string
    /** 关掉时不再采样，并立刻清空画布 */
    enabled: () => boolean
}

/** 一滴墨从落笔到散尽的时间 */
const LIFE_MS = 900

/** 最多保留多少个采样点，超了丢最早的（约等于一条 150px 的尾巴） */
const MAX_POINTS = 48

/** 采样间距：太小会堆点，太大尾巴会断成一段一段 */
const MIN_DIST = 3

/** 墨色浓淡上限。0.5 在浅底上是淡红、暗底上是淡绿，盖在正文上仍读得清 */
const MAX_ALPHA = 0.5

/**
 * 淡出曲线：alpha = (1 - age) ** FADE_EXP。
 * 1.7 衰减太快 —— 停手 300ms 后整条尾巴只剩笔尖一截，看着像「闪了一下就没了」；
 * 1.2 让前 2/3 条尾巴都有可见的浓度差，才像墨在纸上慢慢收干。
 */
const FADE_EXP = 1.2

/** 笔触基础宽度（刚落下时）与随年龄收细的量 */
const WIDTH_BASE = 0.9
const WIDTH_SPREAD = 3.2

/** 光晕层相对主线的宽度倍数与浓淡倍数 */
const HALO_WIDTH = 2.2
const HALO_ALPHA = 0.28

export const useInkTrail = (
    canvas: Ref<HTMLCanvasElement | null>,
    options: UseInkTrailOptions
) => {
    let ctx: CanvasRenderingContext2D | null = null
    let points: InkPoint[] = []
    let raf = 0
    let w = 0
    let h = 0

    const resize = () => {
        const el = canvas.value
        if (!el) return
        // 上限卡在 2：3x 屏上画布会大到 4 倍面积，这点墨迹不值这个代价
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        w = window.innerWidth
        h = window.innerHeight
        el.width = Math.floor(w * dpr)
        el.height = Math.floor(h * dpr)
        ctx = el.getContext('2d')
        // 之后所有绘制都用 CSS 像素坐标，不用自己乘 dpr
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const clear = () => {
        points = []
        ctx?.clearRect(0, 0, w, h)
    }

    const frame = () => {
        raf = 0
        if (!ctx) return

        const now = performance.now()
        points = points.filter(p => now - p.t < LIFE_MS)
        ctx.clearRect(0, 0, w, h)

        // 墨全干了：退出循环，等下一次 pointermove 再唤醒
        if (!points.length) return

        const color = options.color()
        // 平头 + 圆角折线：相邻两片在中点处以平头端面贴合，既不重叠也不留缝
        ctx.lineCap = 'butt'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = color

        // 一遍画一层，而不是每段画两层：否则后一段的光晕会盖住前一段的主线，
        // 整条尾巴看起来像一串「亮头暗尾」的虚线。
        //
        // 为什么是「中点切片 + 平头」而不是「按采样点分段 + 圆头」——
        // 两次 stroke() 只要几何上有重叠，alpha 就会混合两次（实测 0.5 → 0.75），
        // 于是每个采样点都变成一颗更深的圆珠，串起来就是满屏的「点」。
        // 而让圆头彼此相切又会留下掐痕（圆相切处宽度为 0，尾巴串成香肠）。
        // 唯一两头不占的切法是在**段的中点**下刀：相邻两片在那里的方向相同、
        // 端面共面，平头贴平头 —— 重叠面积为 0，缝隙也为 0。
        const mid = (a: InkPoint, b: InkPoint) => ({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
        })

        const pass = (widthScale: number, alphaScale: number) => {
            const last = points.length - 1
            for (let i = 0; i <= last; i++) {
                const p = points[i]!
                const age = Math.min(1, (now - p.t) / LIFE_MS)
                const alpha = (1 - age) ** FADE_EXP * MAX_ALPHA * alphaScale
                // 太淡的片直接跳过，省得每帧描一堆看不见的线
                if (alpha < 0.004) continue

                // 每片以顶点 i 为中心：从上一段中点画到下一段中点；
                // 首尾两片收在真实端点上，尾巴才有明确的起止
                const start = i === 0 ? p : mid(points[i - 1]!, p)
                const end = i === last ? p : mid(p, points[i + 1]!)

                ctx!.globalAlpha = alpha
                ctx!.lineWidth =
                    (WIDTH_BASE + WIDTH_SPREAD * (1 - age)) * widthScale
                ctx!.beginPath()
                ctx!.moveTo(start.x, start.y)
                ctx!.lineTo(p.x, p.y)
                ctx!.lineTo(end.x, end.y)
                ctx!.stroke()
            }

            // 笔尖：只补**朝前的半个圆**，接在最后一片的平头端面上，拼成圆角笔尖。
            // 补整颗圆会盖住那个端面，alpha 再混一次，最前端就多一颗更深的珠子。
            if (last >= 1) {
                const p = points[last]!
                const q = points[last - 1]!
                const dx = p.x - q.x
                const dy = p.y - q.y
                const age = Math.min(1, (now - p.t) / LIFE_MS)
                const alpha = (1 - age) ** FADE_EXP * MAX_ALPHA * alphaScale
                if ((dx || dy) && alpha >= 0.004) {
                    const width =
                        (WIDTH_BASE + WIDTH_SPREAD * (1 - age)) * widthScale
                    const angle = Math.atan2(dy, dx)
                    ctx!.globalAlpha = alpha
                    ctx!.fillStyle = color
                    ctx!.beginPath()
                    ctx!.arc(
                        p.x,
                        p.y,
                        width / 2,
                        angle - Math.PI / 2,
                        angle + Math.PI / 2
                    )
                    ctx!.closePath()
                    ctx!.fill()
                }
            }
        }

        // 光晕：宽而淡，给墨迹一圈「洇到纸纤维里」的湿边
        pass(HALO_WIDTH, HALO_ALPHA)
        // 主线：细而实，定住笔锋
        pass(1, 1)

        // 这里原来还补一颗笔尖实心圆，去掉了：它和最新那段的圆头重叠，
        // 又是一次 alpha 叠加，于是整条线上最浓的反而是最前端那颗「珠」。
        // 最新段的 round cap 本身就是圆的，够用。
        ctx.globalAlpha = 1

        raf = requestAnimationFrame(frame)
    }

    const kick = () => {
        if (!raf) raf = requestAnimationFrame(frame)
    }

    const onMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return
        if (!options.enabled()) return

        const last = points[points.length - 1]
        if (
            last &&
            Math.hypot(event.clientX - last.x, event.clientY - last.y) <
                MIN_DIST
        ) {
            return
        }

        points.push({
            x: event.clientX,
            y: event.clientY,
            t: performance.now(),
        })
        if (points.length > MAX_POINTS) points.shift()
        kick()
    }

    onMounted(() => {
        if (!import.meta.client) return
        // 系统开了「减少动态效果」就不画：这类装饰是最该让位的
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            return

        resize()
        window.addEventListener('resize', resize)
        window.addEventListener('pointermove', onMove, { passive: true })
    })

    // 进编辑器这类不该有墨迹的页面：立刻收摊，别让残留的墨点挂在那儿
    watch(options.enabled, on => {
        if (!on) clear()
    })

    onBeforeUnmount(() => {
        if (!import.meta.client) return
        window.removeEventListener('resize', resize)
        window.removeEventListener('pointermove', onMove)
        if (raf) cancelAnimationFrame(raf)
        points = []
    })
}
