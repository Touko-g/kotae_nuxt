export function useRules() {
    const rules = reactive({
        nameRules: [
            (v: string) => (!!v && !!v.trim()) || 'Username is required',
        ],
        passwordRules: [
            (v: string) => (!!v && !!v.trim()) || 'New Password is required',
            (v: string) =>
                (v && v.length >= 8) ||
                'This password is too short. It must contain at least 8 characters.',
        ],
        emailRules: [
            (v: string) => (!!v && !!v.trim()) || 'Email is required',
            (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid',
        ],
        codeRules: [(v: string) => (!!v && !!v.trim()) || 'Code is required'],
    })

    return { rules }
}
