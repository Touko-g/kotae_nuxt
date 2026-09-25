/**
 * 预计阅读时间 / 字数统计
 * 纯函数、无 DOM 依赖，SSR 与客户端结果一致（不会水合错乱）
 */
export const useReadingTime = () => {
    // CJK 逐字计数 + 西文按词计数，兼顾中英混排正文
    // 用 Unicode 属性转义命中汉字 / 假名 / 谚文，无需手写码段
    const cjkRe = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]/gu

    const countWords = (text: string): number => {
        if (!text) return 0
        const clean = text.replace(/\s+/g, ' ').trim()
        if (!clean) return 0
        const cjk = (clean.match(cjkRe) || []).length
        const latin = clean
            .replace(cjkRe, ' ')
            .split(' ')
            .filter(Boolean).length
        return cjk + latin
    }

    // 中文约 300 字/分、英文约 220 词/分，这里取折中 350/分，至少 1 分钟
    const readingMinutes = (words: number, cpm = 350): number =>
        Math.max(1, Math.round(words / cpm))

    return { countWords, readingMinutes }
}
