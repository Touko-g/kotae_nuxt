export function useRules() {
    const { t } = useLocale()

    const rules = reactive({
        nameRules: [
            (v: string) => (!!v && !!v.trim()) || t('username_required'),
        ],
        passwordRules: [
            (v: string) => (!!v && !!v.trim()) || t('new_password_required'),
            (v: string) => (v && v.length >= 8) || t('password_too_short'),
        ],
        emailRules: [
            (v: string) => (!!v && !!v.trim()) || t('email_required'),
            (v: string) => /.+@.+\..+/.test(v) || t('email_invalid'),
        ],
        codeRules: [(v: string) => (!!v && !!v.trim()) || t('code_required')],
        titleRules: [(v: string) => (!!v && !!v.trim()) || t('title_required')],
        tagRules: [(v: []) => !!v.length || t('tag_required')],
    })

    return { rules }
}
