import COS from 'cos-js-sdk-v5'

interface CosUploadOptions {
    keyPrefix: string
}

export function useCosUpload(options: CosUploadOptions) {
    const { getCosKey } = useAuth()
    const { format } = useDayjs()
    const { show } = useSnackbar()

    const cosLoading = ref(false)

    const upload = async (file: File): Promise<string | null> => {
        try {
            cosLoading.value = true
            const { credentials } = await getCosKey()

            const cos = new COS({
                SecretId: credentials.tmpSecretId,
                SecretKey: credentials.tmpSecretKey,
                XCosSecurityToken: credentials.sessionToken,
            })

            const key = `${options.keyPrefix}${format(new Date(), 'YYYY-MM-DDTHH:mm:ss')}-${file.name}`

            const res = await cos.putObject({
                Bucket: 'chen-1302611521',
                Region: 'ap-nanjing',
                Key: key,
                StorageClass: 'STANDARD',
                Body: file,
            })

            return `https://${res.Location}`
        } catch (err: any) {
            show(err?.message || String(err), 'error')
            return null
        } finally {
            cosLoading.value = false
        }
    }

    return { cosLoading, upload }
}
