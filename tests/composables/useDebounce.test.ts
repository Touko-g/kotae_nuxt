import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebounce } from '../../app/composables/useDebounce'

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('delays function execution by default 300ms', () => {
        const fn = vi.fn()
        const { run } = useDebounce(fn)

        run()
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(299)
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(fn).toHaveBeenCalledOnce()
    })

    it('uses custom delay', () => {
        const fn = vi.fn()
        const { run } = useDebounce(fn, 500)

        run()
        vi.advanceTimersByTime(499)
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(fn).toHaveBeenCalledOnce()
    })

    it('resets timer on subsequent calls', () => {
        const fn = vi.fn()
        const { run } = useDebounce(fn, 300)

        run()
        vi.advanceTimersByTime(200)
        run() // reset
        vi.advanceTimersByTime(200)
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenCalledOnce()
    })

    it('passes arguments to the debounced function', () => {
        const fn = vi.fn()
        const { run } = useDebounce(fn, 100)

        run('a', 'b')
        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenCalledWith('a', 'b')
    })

    it('only calls with latest arguments when called multiple times', () => {
        const fn = vi.fn()
        const { run } = useDebounce(fn, 100)

        run('first')
        run('second')
        run('third')
        vi.advanceTimersByTime(100)

        expect(fn).toHaveBeenCalledOnce()
        expect(fn).toHaveBeenCalledWith('third')
    })

    it('cancel() prevents execution', () => {
        const fn = vi.fn()
        const { run, cancel } = useDebounce(fn, 300)

        run()
        vi.advanceTimersByTime(100)
        cancel()
        vi.advanceTimersByTime(300)

        expect(fn).not.toHaveBeenCalled()
    })

    it('cancel() is safe to call when no timer is pending', () => {
        const fn = vi.fn()
        const { cancel } = useDebounce(fn)
        expect(() => cancel()).not.toThrow()
    })
})
