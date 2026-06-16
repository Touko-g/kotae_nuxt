import { describe, it, expect } from 'vitest'
import { useExtractText } from '../../app/composables/useExtractText'

describe('useExtractText', () => {
    const { extractText } = useExtractText()

    it('returns empty string for empty input', () => {
        expect(extractText('')).toBe('')
    })

    it('returns empty string for null-ish input', () => {
        expect(extractText(undefined as any)).toBe('')
        expect(extractText(null as any)).toBe('')
    })

    it('extracts text from simple HTML', () => {
        expect(extractText('<p>Hello World</p>')).toBe('Hello World')
    })

    it('strips nested tags', () => {
        const html = '<div><p>Hello <strong>bold</strong> text</p></div>'
        expect(extractText(html)).toContain('Hello')
        expect(extractText(html)).toContain('bold')
        expect(extractText(html)).toContain('text')
        expect(extractText(html)).not.toContain('<')
    })

    it('handles HTML with links', () => {
        const html = '<a href="https://example.com">Click here</a>'
        const result = extractText(html)
        expect(result).toContain('Click here')
    })

    it('handles HTML with multiple paragraphs', () => {
        const html = '<p>First</p><p>Second</p>'
        const result = extractText(html)
        expect(result).toContain('First')
        expect(result).toContain('Second')
    })

    it('handles HTML with list items', () => {
        const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
        const result = extractText(html)
        expect(result).toContain('Item 1')
        expect(result).toContain('Item 2')
    })

    it('returns plain text as-is', () => {
        expect(extractText('plain text')).toBe('plain text')
    })

    it('handles HTML entities', () => {
        const result = extractText('<p>Hello &amp; World</p>')
        expect(result).toContain('Hello')
        expect(result).toContain('World')
    })
})
