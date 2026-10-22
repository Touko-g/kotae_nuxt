import COS from 'cos-js-sdk-v5'

/**
 * 腾讯云 COS 直传（前端拿临时密钥后直接 putObject）
 *
 * 收敛了原先散落在 ArticleForm / 用户主页 / 资料编辑三处的重复实现：
 * 桶名与地域改由 runtimeConfig 注入，密钥每次上传前重新拉取。
 */

export interface CosUploadOptions {
    /** 存储目录，如 blog/article、blog/avatar/xxx */
    dir: string
    /** 文件名，缺省取 File.name */
    name?: string
    /** 上传进度回调，0-100 */
    onProgress?: (percent: number) => void
}

export const useCosUpload = () => {
    const config = useRuntimeConfig()
    const { getCosKey } = useAuth()
    const { format } = useDayjs()

    const upload = async (file: File | Blob, options: CosUploadOptions) => {
        const { credentials } = await getCosKey()

        const cos = new COS({
            SecretId: credentials.tmpSecretId,
            SecretKey: credentials.tmpSecretKey,
            XCosSecurityToken: credentials.sessionToken,
        })

        const fileName = options.name || (file as File).name || 'file'
        const key = `/${options.dir}/${format(
            new Date(),
            'YYYY-MM-DDTHH:mm:ss'
        )}-${fileName}`

        const res = await cos.putObject({
            Bucket: config.public.cosBucket,
            Region: config.public.cosRegion,
            Key: key,
            StorageClass: 'STANDARD',
            Body: file,
            onProgress: info =>
                options.onProgress?.(Math.round(info.percent * 100)),
        })

        return `https://${res.Location}`
    }

    return { upload }
}
