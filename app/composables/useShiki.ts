import { createHighlighter, type Highlighter } from 'shiki'

let highlighter: Highlighter | null = null

export const useShiki = async () => {
    if (!highlighter) {
        highlighter = await createHighlighter({
            themes: ['github-light', 'github-dark'],
            langs: [
                'javascript',
                'typescript',
                'html',
                'css',
                'json',
                'python',
                'java',
                'c',
            ],
        })
    }
    return highlighter
}
