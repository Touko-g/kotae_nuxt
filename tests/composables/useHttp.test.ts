import { describe, it, expect } from 'vitest'
import { HttpError } from '../../app/composables/useHttp'

describe('HttpError', () => {
    it('creates an error with message', () => {
        const err = new HttpError('Not found')
        expect(err.message).toBe('Not found')
        expect(err.name).toBe('HttpError')
        expect(err.status).toBeUndefined()
    })

    it('creates an error with message and status', () => {
        const err = new HttpError('Not found', 404)
        expect(err.message).toBe('Not found')
        expect(err.status).toBe(404)
    })

    it('is an instance of Error', () => {
        const err = new HttpError('Server error', 500)
        expect(err).toBeInstanceOf(Error)
        expect(err).toBeInstanceOf(HttpError)
    })

    it('has correct name property', () => {
        const err = new HttpError('Unauthorized', 401)
        expect(err.name).toBe('HttpError')
    })

    it('works with different status codes', () => {
        const cases = [
            { msg: 'Bad Request', status: 400 },
            { msg: 'Unauthorized', status: 401 },
            { msg: 'Forbidden', status: 403 },
            { msg: 'Not Found', status: 404 },
            { msg: 'Internal Server Error', status: 500 },
        ]

        cases.forEach(({ msg, status }) => {
            const err = new HttpError(msg, status)
            expect(err.message).toBe(msg)
            expect(err.status).toBe(status)
        })
    })

    it('can be caught as an Error', () => {
        expect(() => {
            throw new HttpError('test', 500)
        }).toThrow(Error)
    })

    it('can be caught as HttpError', () => {
        expect(() => {
            throw new HttpError('test', 500)
        }).toThrow(HttpError)
    })

    it('includes message in stack trace', () => {
        const err = new HttpError('Something went wrong', 500)
        expect(err.stack).toContain('Something went wrong')
    })
})
