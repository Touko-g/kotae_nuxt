import { describe, it, expect } from 'vitest'
import { useRules } from '../../app/composables/useRules'

describe('useRules', () => {
    const { rules } = useRules()

    describe('nameRules', () => {
        const [required] = rules.nameRules

        it('rejects empty string', () => {
            expect(required('')).toBe('Username is required')
        })

        it('rejects whitespace-only string', () => {
            expect(required('   ')).toBe('Username is required')
        })

        it('accepts valid username', () => {
            expect(required('alice')).toBe(true)
        })
    })

    describe('passwordRules', () => {
        const [required, minLength] = rules.passwordRules

        it('rejects empty password', () => {
            expect(required('')).toBe('New Password is required')
        })

        it('rejects whitespace-only password', () => {
            expect(required('   ')).toBe('New Password is required')
        })

        it('rejects password shorter than 8 chars', () => {
            expect(minLength('abc')).toBe(
                'This password is too short. It must contain at least 8 characters.'
            )
        })

        it('rejects 7-char password', () => {
            expect(minLength('1234567')).toBe(
                'This password is too short. It must contain at least 8 characters.'
            )
        })

        it('accepts 8-char password', () => {
            expect(minLength('12345678')).toBe(true)
        })

        it('accepts longer password', () => {
            expect(minLength('mySecurePassword123')).toBe(true)
        })
    })

    describe('emailRules', () => {
        const [required, format] = rules.emailRules

        it('rejects empty email', () => {
            expect(required('')).toBe('Email is required')
        })

        it('rejects whitespace-only email', () => {
            expect(required('   ')).toBe('Email is required')
        })

        it('rejects invalid email without @', () => {
            expect(format('notanemail')).toBe('E-mail must be valid')
        })

        it('rejects email without domain', () => {
            expect(format('user@')).toBe('E-mail must be valid')
        })

        it('rejects email without TLD', () => {
            expect(format('user@host')).toBe('E-mail must be valid')
        })

        it('accepts valid email', () => {
            expect(format('user@example.com')).toBe(true)
        })

        it('accepts email with subdomain', () => {
            expect(format('user@mail.example.com')).toBe(true)
        })
    })

    describe('codeRules', () => {
        const [required] = rules.codeRules

        it('rejects empty code', () => {
            expect(required('')).toBe('Code is required')
        })

        it('rejects whitespace-only code', () => {
            expect(required('   ')).toBe('Code is required')
        })

        it('accepts valid code', () => {
            expect(required('123456')).toBe(true)
        })
    })

    describe('titleRules', () => {
        const [required] = rules.titleRules

        it('rejects empty title', () => {
            expect(required('')).toBe('Title is required')
        })

        it('accepts valid title', () => {
            expect(required('My Article')).toBe(true)
        })
    })

    describe('tagRules', () => {
        const [required] = rules.tagRules

        it('rejects empty array', () => {
            expect(required([] as never)).toBe('Tag is required')
        })

        it('accepts non-empty array', () => {
            expect(required(['vue'] as never)).toBe(true)
        })
    })
})
