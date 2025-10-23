export const useDebounce = <T extends (...args: any[]) => void>(
    fn: T,
    delay = 300
) => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const debouncedFn = (...args: Parameters<T>) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }

    const cancel = () => {
        if (timer) clearTimeout(timer)
        timer = null
    }

    return { run: debouncedFn, cancel }
}
