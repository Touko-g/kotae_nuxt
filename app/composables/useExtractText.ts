import { convert } from 'html-to-text'

export const useExtractText = () => {
    /**
     * SSR 安全提取纯文本
     * - 客户端：可以用 DOM
     * - SSR：用 html-to-text
     */
    const extractText = (html: string): string => {
        if (!html) return ''

        // SSR + Client 通用
        try {
            return convert(html, { wordwrap: false })
        } catch (e) {
            // 如果 html-to-text 出问题，在客户端 fallback DOM 方案
            if (process.client) {
                const div = document.createElement('div')
                div.innerHTML = html
                return div.textContent || div.innerText || ''
            }
            return html
        }
    }

    return { extractText }
}
