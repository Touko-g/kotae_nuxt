// i18n.config.ts
import en from './locales/en'
import zh from './locales/zh'

export default defineI18nConfig(() => {
    return {
        locale: 'en',
        fallbackLocale: 'zh',
        messages: {
            en,
            zh,
        },
    }
})
