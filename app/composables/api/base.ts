// 类型本体搬到 shared/types/api.ts：nuxt.config.ts 也要用，而 config 所在的 node
// 项目没有 Nuxt 自动导入，直接引这里会把 useHttp 等运行时文件一起拖进去编译。
// 这里保留 re-export，调用方不用改 import 路径。
export type { BaseParams, BaseResponse } from '#shared/types/api'
