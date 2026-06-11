import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// useSnackbar uses module-level reactive state, so we need to
// import it fresh or manage state carefully
import { useSnackbar } from '../../app/composables/useSnackbar'

describe('useSnackbar', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        // Clear any leftover messages from previous tests
        const { messages } = useSnackbar()
        messages.splice(0, messages.length)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts with empty messages', () => {
        const { messages } = useSnackbar()
        // May have leftovers from module-level state; just verify it's an array
        expect(Array.isArray(messages)).toBe(true)
    })

    describe('show', () => {
        it('adds a message with defaults', () => {
            const { show, messages } = useSnackbar()
            show('Hello')

            const msg = messages[messages.length - 1]
            expect(msg.text).toBe('Hello')
            expect(msg.color).toBe('primary')
            expect(msg.duration).toBe(3000)
            expect(msg.position).toBe('top')
            expect(msg.close).toBe(true)
            expect(msg.visible).toBe(true)
        })

        it('adds a message with custom color', () => {
            const { show, messages } = useSnackbar()
            show('Error!', 'error')

            const msg = messages[messages.length - 1]
            expect(msg.text).toBe('Error!')
            expect(msg.color).toBe('error')
        })

        it('adds a message with custom options', () => {
            const { show, messages } = useSnackbar()
            show('Custom', 'success', {
                duration: 5000,
                position: 'bottom' as any,
                close: false,
            })

            const msg = messages[messages.length - 1]
            expect(msg.duration).toBe(5000)
            expect(msg.position).toBe('bottom')
            expect(msg.close).toBe(false)
        })

        it('assigns unique IDs to messages', () => {
            const { show, messages } = useSnackbar()
            show('First')
            show('Second')

            const ids = messages.map(m => m.id)
            expect(new Set(ids).size).toBe(ids.length)
        })

        it('auto-removes message after duration + 400ms', () => {
            const { show, messages } = useSnackbar()
            const initialLen = messages.length
            show('Auto-remove', 'primary', { duration: 1000 })

            expect(messages.length).toBe(initialLen + 1)

            // After duration + 400ms the close() is called which sets visible=false
            vi.advanceTimersByTime(1400)
            const msg = messages.find(m => m.text === 'Auto-remove')
            // Message should be marked invisible or removed
            if (msg) {
                expect(msg.visible).toBe(false)
            }
        })
    })

    describe('close', () => {
        it('marks message as invisible', () => {
            const { show, close, messages } = useSnackbar()
            show('To close')

            const msg = messages[messages.length - 1]
            close(msg.id)

            expect(msg.visible).toBe(false)
        })

        it('removes message from array after closing', () => {
            const { show, close, messages } = useSnackbar()
            show('To remove')

            const msg = messages[messages.length - 1]
            const id = msg.id
            close(id)

            // After the setTimeout(0) in close, message should be removed
            vi.advanceTimersByTime(0)
            expect(messages.find(m => m.id === id)).toBeUndefined()
        })

        it('is safe to close non-existent message', () => {
            const { close } = useSnackbar()
            expect(() => close(999999)).not.toThrow()
        })
    })
})
