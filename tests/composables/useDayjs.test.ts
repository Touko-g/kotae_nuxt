import { describe, it, expect, beforeEach } from 'vitest'
import { useDayjs } from '../../app/composables/useDayjs'

describe('useDayjs', () => {
    const { create, format, add, subtract, formatNow, setLocale } = useDayjs()

    describe('create', () => {
        it('creates a dayjs object from a date string', () => {
            const d = create('2024-01-15')
            expect(d.isValid()).toBe(true)
            expect(d.year()).toBe(2024)
            expect(d.month()).toBe(0) // 0-indexed
            expect(d.date()).toBe(15)
        })

        it('creates from current time when no arg', () => {
            const d = create()
            expect(d.isValid()).toBe(true)
        })

        it('creates from Date object', () => {
            const d = create(new Date(2023, 5, 1))
            expect(d.year()).toBe(2023)
            expect(d.month()).toBe(5)
        })
    })

    describe('format', () => {
        it('formats with default pattern', () => {
            const result = format('2024-06-15T10:30:00')
            expect(result).toMatch(/2024-06-15 10:30:00/)
        })

        it('formats with custom pattern', () => {
            const result = format('2024-06-15', 'YYYY/MM/DD')
            expect(result).toBe('2024/06/15')
        })

        it('formats date-only string', () => {
            const result = format('2024-01-01', 'YYYY')
            expect(result).toBe('2024')
        })
    })

    describe('add', () => {
        it('adds days', () => {
            const result = add('2024-01-01', 5, 'day')
            expect(result.format('YYYY-MM-DD')).toBe('2024-01-06')
        })

        it('adds months', () => {
            const result = add('2024-01-15', 2, 'month')
            expect(result.format('YYYY-MM-DD')).toBe('2024-03-15')
        })

        it('adds years', () => {
            const result = add('2024-06-01', 1, 'year')
            expect(result.format('YYYY-MM-DD')).toBe('2025-06-01')
        })
    })

    describe('subtract', () => {
        it('subtracts days', () => {
            const result = subtract('2024-01-10', 3, 'day')
            expect(result.format('YYYY-MM-DD')).toBe('2024-01-07')
        })

        it('subtracts months', () => {
            const result = subtract('2024-06-15', 1, 'month')
            expect(result.format('YYYY-MM-DD')).toBe('2024-05-15')
        })
    })

    describe('formatNow', () => {
        it('returns MM-DD HH:mm for dates in the current year', () => {
            const currentYear = new Date().getFullYear()
            const date = `${currentYear}-03-15T14:30:00`
            const result = formatNow(date)
            expect(result).toBe('03-15 14:30')
        })

        it('returns YYYY-MM-DD for dates in a different year', () => {
            const result = formatNow('2020-03-15T14:30:00')
            expect(result).toBe('2020-03-15')
        })
    })

    describe('setLocale', () => {
        beforeEach(() => {
            setLocale('en')
        })

        it('changes locale to zh-cn', () => {
            setLocale('zh-cn')
            const { localeRef } = useDayjs()
            expect(localeRef.value).toBe('zh-cn')
        })

        it('changes locale back to en', () => {
            setLocale('en')
            const { localeRef } = useDayjs()
            expect(localeRef.value).toBe('en')
        })
    })
})
