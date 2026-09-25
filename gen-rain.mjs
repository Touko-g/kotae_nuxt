// 生成随机雨丝 SVG 文件到 public/，供主题 CSS 以 url() 引用
import { writeFileSync } from 'node:fs'

function mulberry32(seed) {
    return function () {
        seed |= 0
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function makeSvg(seed, W, H, N, color) {
    const rnd = mulberry32(seed)
    const rand = (min, max) => rnd() * (max - min) + min
    let lines = ''
    for (let i = 0; i < N; i++) {
        const x = rand(0, W)
        const y = rand(0, H)
        const len = rand(16, 46)
        const dx = len * 0.18
        const op = rand(0.15, 0.5).toFixed(2)
        const sw = rand(0.6, 1.4).toFixed(2)
        lines +=
            `<line x1='${x.toFixed(1)}' y1='${y.toFixed(1)}' ` +
            `x2='${(x + dx).toFixed(1)}' y2='${(y + len).toFixed(1)}' ` +
            `stroke='${color}' stroke-opacity='${op}' stroke-width='${sw}' stroke-linecap='round'/>`
    }
    return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>${lines}</svg>`
}

// 近景层：更大更长更亮；远景层：更密更淡更小
writeFileSync('public/rain-a.svg', makeSvg(20260924, 320, 480, 60, 'rgb(210,225,250)'))
writeFileSync('public/rain-b.svg', makeSvg(987654321, 260, 400, 90, 'rgb(180,200,236)'))
console.log('written public/rain-a.svg, public/rain-b.svg')
