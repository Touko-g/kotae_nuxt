import { ref, computed } from 'vue'
import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

// 响应式存储当前语言
const localeRef = ref('en')
dayjs.locale(localeRef.value)

export const useDayjs = () => {
    /**
     * 设置全局语言
     */
    const setLocale = (locale: string) => {
        localeRef.value = locale
        dayjs.locale(locale)
    }

    /**
     * 创建 Dayjs 对象
     */
    const create = (date?: string | number | Date | Dayjs) => dayjs(date)

    /**
     * 格式化日期
     */
    const format = (
        date: string | number | Date | Dayjs,
        fmt = 'YYYY-MM-DD HH:mm:ss'
    ) => dayjs(date).format(fmt)

    /**
     * 加/减时间
     */
    const add = (
        date: string | number | Date | Dayjs,
        value: number,
        unit: dayjs.ManipulateType
    ) => dayjs(date).add(value, unit)

    const subtract = (
        date: string | number | Date | Dayjs,
        value: number,
        unit: dayjs.ManipulateType
    ) => dayjs(date).subtract(value, unit)

    /**
     * 响应式相对时间
     */
    const fromNow = (date: string | number | Date | Dayjs) => {
        return computed(() => dayjs(date).locale(localeRef.value).fromNow())
    }

    const formatNow = (date: string | number | Date | Dayjs) => {
        const now = new Date().getFullYear()
        const year = format(date, 'YYYY')
        if (now.toString() === year) {
            return format(date, 'MM-DD HH:mm')
        } else {
            return format(date, 'YYYY-MM-DD')
        }
    }

    return {
        dayjs,
        create,
        format,
        add,
        subtract,
        fromNow,
        formatNow,
        setLocale,
        localeRef, // 可用于模板显示当前语言
    }
}
