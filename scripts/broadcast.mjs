#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 新文章 → Telegram / Discord / X 广播
 *
 * 设计要点：
 * 1. 以 RSS 的 <guid> 作为幂等键，按「平台」分别记录，某平台失败下次只补它；
 * 2. 首次运行 / 长期停机后恢复时，超过 MAX_AGE_HOURS 的老文章只记录不发送，
 *    避免一上来把历史文章刷屏（可用 --all 强制补发）；
 * 3. 零依赖：只用到 Node 内置模块，不需要额外安装任何包。
 *
 * 微博为什么不做：
 *   新浪 2017 年起收紧了 statuses/update（发微博）等接口，个人开发者拿不到权限；
 *   仅剩的 statuses/share 是「分享接口」，只能发一个链接 + 极少文案，
 *   且 access_token 30 天过期，需要长期维护 refresh 逻辑，收益极低。
 *
 * 用法：
 *   node scripts/broadcast.mjs                # 正常跑一次
 *   node scripts/broadcast.mjs --dry-run      # 只打印，不发送、不写状态
 *   node scripts/broadcast.mjs --all          # 忽略时效限制，强制补发
 *   node scripts/broadcast.mjs --limit=5      # 单次最多发 5 条（默认 3）
 *   node scripts/broadcast.mjs --platform=telegram
 *   node scripts/broadcast.mjs --reset        # 清空发送记录（慎用）
 */

import { createHmac, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_PATH = resolve(ROOT, '.data/broadcast-state.json')

const DEFAULT_FEED = 'https://kotae.cn/rss.xml'
const DEFAULT_MAX_AGE_HOURS = 72
const DEFAULT_LIMIT = 3
const KEEP_STATE_ENTRIES = 500

// ---------------------------------------------------------------- CLI

const parseArgs = argv => {
    const out = {
        dryRun: false,
        all: false,
        reset: false,
        limit: DEFAULT_LIMIT,
        platforms: null,
    }
    for (const arg of argv) {
        if (arg === '--dry-run') out.dryRun = true
        else if (arg === '--all') out.all = true
        else if (arg === '--reset') out.reset = true
        else if (arg === '--help' || arg === '-h') out.help = true
        else if (arg.startsWith('--limit='))
            out.limit = Number(arg.slice(8)) || DEFAULT_LIMIT
        else if (arg.startsWith('--platform=')) {
            out.platforms = arg
                .slice(11)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
        } else {
            console.error(`未知参数：${arg}（用 --help 查看用法）`)
            process.exit(1)
        }
    }
    return out
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
    console.log(
        [
            '用法：node scripts/broadcast.mjs [选项]',
            '',
            '  --dry-run            只打印将要发送的内容，不发送、不写状态',
            '  --all                忽略时效限制，强制补发历史文章',
            '  --limit=N            单次最多发送 N 条（默认 3）',
            '  --platform=a,b       只跑指定平台（telegram / discord / x）',
            '  --reset              清空发送记录后退出',
            '  -h, --help           显示本帮助',
        ].join('\n')
    )
    process.exit(0)
}

// ---------------------------------------------------------------- 环境变量

/**
 * 读 .env 但不覆盖已有的 process.env。
 * 这样 CI / 服务器上直接 export 的变量优先级更高，也支持不带 .env 运行。
 */
const loadDotEnv = async () => {
    const path = resolve(ROOT, '.env')
    if (!existsSync(path)) return
    const raw = await readFile(path, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (!m) continue
        const key = m[1]
        if (process.env[key] !== undefined) continue
        let value = m[2].trim()
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }
        process.env[key] = value
    }
}

await loadDotEnv()

const env = process.env
const FEED_URL = env.BROADCAST_FEED_URL || DEFAULT_FEED
const MAX_AGE_HOURS = Number(
    env.BROADCAST_MAX_AGE_HOURS || DEFAULT_MAX_AGE_HOURS
)

// ---------------------------------------------------------------- 日志

const log = (...parts) => {
    const t = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    console.log(`[${t}]`, ...parts)
}

/**
 * undici 的 fetch 出错时 message 只有一句 "fetch failed"，
 * 真正的原因藏在 error.cause 里，代理相关的还会再埋一层 cause.cause。
 * 不展开的话完全没法排查。
 */
const describeError = error => {
    const cause = error.cause
    if (!cause) return error.message

    const root = cause.cause?.message ?? ''
    const code = cause.code || cause.cause?.code || ''
    const hints = {
        ENOTFOUND: 'DNS 解析失败',
        ECONNREFUSED: '连接被拒绝',
        ECONNRESET: '连接被重置',
        ETIMEDOUT: '连接超时',
        UND_ERR_CONNECT_TIMEOUT: '连接超时',
        UND_ERR_SOCKET: 'socket 异常',
    }

    const hint = hints[code]
    if (hint) {
        return `${hint}（${code}）—— 若目标在墙外，需要配置 BROADCAST_PROXY`
    }
    if (root) return `${error.message}：${root}`
    return `${error.message}${code ? `（${code}）` : ''}`
}

// ---------------------------------------------------------------- 代理

/**
 * Node 内置的 fetch 不读 HTTP_PROXY / HTTPS_PROXY，必须显式挂 dispatcher。
 * 只认 BROADCAST_PROXY，不自动读系统代理变量——机器上那些变量可能来自
 * 别的工具（或已失效），静默生效反而更难排查。
 * 只给「墙外」的平台用，拉本站 RSS 走直连（国内反而更快）。
 */
let proxyDispatcher
let proxyFetch = fetch

const initProxy = async () => {
    const proxyUrl = env.BROADCAST_PROXY || ''
    if (!proxyUrl) return

    try {
        // 注意：Node 全局 fetch 不接受 dispatcher（会报 UND_ERR_INVALID_ARG），
        // 必须换成 undici 自己的 fetch，代理才真正生效
        const undici = await import('undici')
        proxyDispatcher = new undici.ProxyAgent(proxyUrl)
        proxyFetch = undici.fetch
        log(`代理已启用：${proxyUrl}`)
    } catch (error) {
        console.warn(
            `代理 ${proxyUrl} 初始化失败（${error.message}），本次直连。可先执行 npm i undici。`
        )
    }
}

/** 有代理就带上 dispatcher，没有就普通 fetch */
const outboundFetch = (url, options = {}) =>
    proxyDispatcher
        ? proxyFetch(url, { ...options, dispatcher: proxyDispatcher })
        : proxyFetch(url, options)

// ---------------------------------------------------------------- RSS 解析

const XML_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
}

const decodeXml = str =>
    str
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(
            /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,
            (whole, body) => {
                if (body.startsWith('#x'))
                    return String.fromCodePoint(parseInt(body.slice(2), 16))
                if (body.startsWith('#'))
                    return String.fromCodePoint(Number(body.slice(1)))
                return XML_ENTITIES[body] ?? whole
            }
        )

const pickTag = (name, src) => {
    // 允许带属性的标签，如 <guid isPermaLink="true">
    const m = src.match(
        new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)
    )
    return m ? decodeXml(m[1]).trim() : ''
}

/** CDATA 解一层后，正文里手写的 &nbsp; / &quot; 之类还会残留，这里再解一层 */
const HTML_ENTITIES = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
}

const decodeEntities = str =>
    str.replace(
        /&(?:nbsp|amp|lt|gt|quot|#39);/gi,
        m => HTML_ENTITIES[m.toLowerCase()] ?? m
    )

const stripTags = html =>
    html
        .replace(/<br\s*\/?>/gi, '\n')
        // 列表项补个短横线：去掉标签后 <li> 就只剩换行，读起来分不清层级
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, '\n')
        .replace(/<[^>]+>/g, '')

/**
 * 摘要优先取 content:encoded（全文），拿不到才退回 description。
 * 原因：description 通常是上游自己截好的短摘要（本站是 300 字硬截断），
 * 直接用它的话，Telegram 那条要 700 字也变不出更多内容，而且截断位置
 * 往往断在词中间、不带省略号，脚本这边没法补救。
 */
const toSummary = (item, max) => {
    const source = item.content || item.description || ''
    const text = decodeEntities(stripTags(source))
        .replace(/[ \t\u00A0]+/g, ' ')
        // 行首行尾的空白一并吃掉，否则 Discord / Telegram 里全是碎行
        .replace(/\s*\n\s*/g, '\n')
        // <li> 后面本来就跟着换行，补的短横线会被顶成单独一行，这里把内容提上来。
        // 注意此时上一步已经把 `- ` 尾部空格吃掉了，所以匹配的是 `-\n`
        .replace(/^-\n/gm, '- ')
        .trim()
    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

const parseFeed = xml => {
    const items = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m
    while ((m = itemRe.exec(xml))) {
        const block = m[1]
        const link = pickTag('link', block)
        const guid = pickTag('guid', block) || link
        if (!guid) continue
        items.push({
            guid,
            title: pickTag('title', block),
            link,
            pubDate: pickTag('pubDate', block),
            creator: pickTag('dc:creator', block),
            category: pickTag('category', block),
            description: pickTag('description', block),
            content: pickTag('content:encoded', block),
        })
    }
    return items
}

const fetchFeed = async () => {
    const res = await fetch(FEED_URL, {
        headers: {
            // 有些 CDN 会对无 UA 的请求返回 403
            'user-agent': 'kotae-broadcast/1.0 (+https://kotae.cn)',
            // 这个 accept 有两重作用：一是告诉 CDN 要的是 feed，
            // 二是 /rss.xml 会按 Accept 做内容协商 —— 带上 text/html 会拿到网页版，
            // parseFeed 直接解析失败。改之前先看 server/routes/rss.xml.ts。
            accept: 'application/rss+xml, application/xml, text/xml',
        },
    })
    if (!res.ok)
        throw new Error(`拉取 RSS 失败：HTTP ${res.status} ${res.statusText}`)
    return parseFeed(await res.text())
}

// ---------------------------------------------------------------- 平台适配器

const escapeHtml = s =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

/** Telegram：支持 HTML，可以直接发摘要 + 链接，阅读体验最好 */
const buildTelegramText = item =>
    [
        `<b>${escapeHtml(item.title)}</b>`,
        '',
        escapeHtml(toSummary(item, 700)),
        '',
        `<a href="${escapeHtml(item.link)}">阅读全文 →</a>`,
    ].join('\n')

const sendTelegram = async item => {
    const res = await outboundFetch(
        `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                chat_id: env.TG_CHAT_ID,
                text: buildTelegramText(item),
                parse_mode: 'HTML',
                disable_web_page_preview: false,
            }),
        }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
}

/** Discord：webhook + embed，卡片形态比纯文本好看 */
const buildDiscordPayload = item => ({
    embeds: [
        {
            title: item.title.slice(0, 256),
            url: item.link,
            description: toSummary(item, 300),
            color: 0x5b8def,
            footer: {
                text:
                    [item.creator, item.category].filter(Boolean).join(' · ') ||
                    'Kotae',
            },
            timestamp: item.pubDate
                ? new Date(item.pubDate).toISOString()
                : undefined,
        },
    ],
})

const sendDiscord = async item => {
    // 默认 webhook 成功时返回 204 空体，失败也只给一个状态码。
    // 带 wait=true 才会回 200 + 消息体，400 时能拿到具体的字段错误。
    const url = new URL(env.DISCORD_WEBHOOK_URL)
    url.searchParams.set('wait', 'true')

    const res = await outboundFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildDiscordPayload(item)),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
}

/**
 * X：v2 POST /2/tweets，OAuth 1.0a 签名。
 * 免费层是 write-only（500 条/月），足够博客同步。
 * 注意：JSON body 不参与签名，只有 oauth_* 参数进 base string。
 */
const percentEncode = s =>
    encodeURIComponent(s).replace(
        /[!*'()]/g,
        c => '%' + c.charCodeAt(0).toString(16).toUpperCase()
    )

const oauthHeader = ({ method, url }) => {
    const params = {
        oauth_consumer_key: env.X_API_KEY,
        oauth_nonce: randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: String(Math.floor(Date.now() / 1000)),
        oauth_token: env.X_ACCESS_TOKEN,
        oauth_version: '1.0',
    }
    const paramString = Object.keys(params)
        .sort()
        .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
        .join('&')
    const baseString = [
        method,
        percentEncode(url),
        percentEncode(paramString),
    ].join('&')
    const signingKey = `${percentEncode(env.X_API_SECRET)}&${percentEncode(
        env.X_ACCESS_SECRET
    )}`
    params.oauth_signature = createHmac('sha1', signingKey)
        .update(baseString)
        .digest('base64')

    return (
        'OAuth ' +
        Object.keys(params)
            .sort()
            .map(k => `${percentEncode(k)}="${percentEncode(params[k])}"`)
            .join(', ')
    )
}

/** X 的字符计数规则：CJK 记 2，URL 一律记 23 */
const tweetWeight = text => {
    const urls = text.match(/https?:\/\/\S+/g) ?? []
    let rest = text
    for (const url of urls) rest = rest.replace(url, '')
    let weight = urls.length * 23
    for (const ch of rest) {
        const cp = ch.codePointAt(0)
        const narrow =
            cp <= 4351 ||
            (cp >= 8192 && cp <= 8205) ||
            (cp >= 8208 && cp <= 8223) ||
            (cp >= 8242 && cp <= 8247)
        weight += narrow ? 1 : 2
    }
    return weight
}

const fitTweet = item => {
    const tail = `\n\n${item.link}`
    let title = item.title
    let truncated = false
    const build = () =>
        (title ? title.trimEnd() + (truncated ? '…' : '') : '') + tail

    // 直接按「最终文本」的权重收敛，避免省略号（U+2026 权重 2）这类边界算错
    while (title.length > 0 && tweetWeight(build()) > 280) {
        title = title.slice(0, -1)
        truncated = true
    }
    return build()
}

const sendX = async item => {
    const url = 'https://api.twitter.com/2/tweets'
    const res = await outboundFetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: oauthHeader({ method: 'POST', url }),
        },
        body: JSON.stringify({ text: fitTweet(item) }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
}

/**
 * 真实 webhook 形如 https://discord.com/api/webhooks/<数字 id>/<token>。
 * 用正则卡一下，避免把文档里的 `xxxx/yyyy` 占位符当成已配置，跑起来才报错。
 * 本地 mock 放行，否则没法脱网验证。
 */
const isValidDiscordWebhook = value => {
    if (!value) return false
    if (/^https?:\/\/(?:localhost|127\.0\.0\.1)[:/]/.test(value)) return true
    return /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(
        value
    )
}

const PLATFORMS = [
    {
        name: 'telegram',
        configured: () => Boolean(env.TG_BOT_TOKEN && env.TG_CHAT_ID),
        missing: 'TG_BOT_TOKEN / TG_CHAT_ID',
        send: sendTelegram,
        preview: buildTelegramText,
    },
    {
        name: 'discord',
        configured: () => isValidDiscordWebhook(env.DISCORD_WEBHOOK_URL),
        missing:
            'DISCORD_WEBHOOK_URL（形如 https://discord.com/api/webhooks/<id>/<token>）',
        send: sendDiscord,
        preview: item => {
            const { title, description, footer } =
                buildDiscordPayload(item).embeds[0]
            return `${title}\n${description}\n—— ${footer.text}`
        },
    },
    {
        name: 'x',
        configured: () =>
            Boolean(
                env.X_API_KEY &&
                    env.X_API_SECRET &&
                    env.X_ACCESS_TOKEN &&
                    env.X_ACCESS_SECRET
            ),
        missing: 'X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET',
        send: sendX,
        preview: item => {
            const text = fitTweet(item)
            return `${text}\n（字符权重 ${tweetWeight(text)}/280）`
        },
    },
]

const activePlatforms = PLATFORMS.filter(p => {
    if (args.platforms && !args.platforms.includes(p.name)) return false
    if (!p.configured()) return false
    return true
})

// ---------------------------------------------------------------- 状态

const emptyState = () => ({ version: 1, updatedAt: null, sent: {} })

const readState = async () => {
    if (!existsSync(STATE_PATH)) return emptyState()
    try {
        const parsed = JSON.parse(await readFile(STATE_PATH, 'utf8'))
        return { ...emptyState(), ...parsed, sent: parsed.sent ?? {} }
    } catch (error) {
        console.warn(`状态文件损坏，按空状态处理：${error.message}`)
        return emptyState()
    }
}

const writeState = async state => {
    // 只保留最近 N 条，避免文件无限膨胀
    const entries = Object.entries(state.sent)
    if (entries.length > KEEP_STATE_ENTRIES) {
        const trimmed = entries
            .sort((a, b) => new Date(b[1].at ?? 0) - new Date(a[1].at ?? 0))
            .slice(0, KEEP_STATE_ENTRIES)
        state.sent = Object.fromEntries(trimmed)
    }
    state.updatedAt = new Date().toISOString()
    await mkdir(dirname(STATE_PATH), { recursive: true })
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

// ---------------------------------------------------------------- 主流程

const ageInHours = pubDate => {
    const ts = Date.parse(pubDate)
    if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY
    return (Date.now() - ts) / 3600_000
}

const main = async () => {
    if (args.reset) {
        await writeState(emptyState())
        log('发送记录已清空。')
        return
    }

    if (activePlatforms.length === 0) {
        log('没有可用的平台配置，退出。')
        log(`请至少配置一组：${PLATFORMS.map(p => p.missing).join(' | ')}`)
        return
    }

    log(`平台：${activePlatforms.map(p => p.name).join(', ')}`)
    await initProxy()

    const skippedPlatforms = PLATFORMS.filter(
        p =>
            !p.configured() &&
            (!args.platforms || args.platforms.includes(p.name))
    )
    for (const p of skippedPlatforms) log(`跳过 ${p.name}：缺少 ${p.missing}`)

    log(`拉取 ${FEED_URL}`)
    const items = await fetchFeed()
    log(`共 ${items.length} 条`)

    const state = await readState()

    const pending = []
    for (const item of items) {
        const record = state.sent[item.guid] ?? {}
        const todo = activePlatforms.filter(p => !record[p.name])
        if (todo.length === 0) continue
        pending.push({ item, record, todo })
    }

    if (pending.length === 0) {
        log('没有新文章，退出。')
        return
    }

    let sent = 0
    let failed = 0
    let stale = 0

    // 先把过期的挑出去只做记录，剩下的才进入待发队列
    const batch = []
    for (const entry of pending) {
        const { item, record, todo } = entry
        const age = ageInHours(item.pubDate)

        if (age > MAX_AGE_HOURS && !args.all) {
            stale++
            const ageText = Number.isFinite(age)
                ? `${Math.floor(age / 24)} 天前`
                : '时间未知'
            log(`· ${item.title} —— 发布于 ${ageText}，仅记录不发送`)
            if (!args.dryRun) {
                for (const p of todo) {
                    record[p.name] = {
                        at: new Date().toISOString(),
                        stale: true,
                    }
                }
                state.sent[item.guid] = {
                    ...record,
                    at: record.at ?? new Date().toISOString(),
                }
            }
            continue
        }

        batch.push(entry)
    }

    // 取最新的 N 条，再按时间正序发送：积压时优先保证最新的能被推出去
    const toSend = batch
        .slice(0, args.limit)
        .sort((a, b) => Date.parse(a.item.pubDate) - Date.parse(b.item.pubDate))

    if (batch.length > args.limit) {
        log(
            `单次上限 ${args.limit} 条，剩余 ${batch.length - args.limit} 条留到下次。`
        )
    }

    for (const { item, record, todo } of toSend) {
        log(`· ${item.title}`)

        for (const platform of todo) {
            if (args.dryRun) {
                log(`    [dry-run] ${platform.name} 将发送：`)
                console.log(
                    platform
                        .preview(item)
                        .split('\n')
                        .map(line => `      │ ${line}`)
                        .join('\n')
                )
                continue
            }

            try {
                await platform.send(item)
                record[platform.name] = { at: new Date().toISOString() }
                sent++
                log(`    ✓ ${platform.name}`)
            } catch (error) {
                failed++
                log(`    ✗ ${platform.name} —— ${describeError(error)}`)
            }
        }

        if (!args.dryRun) {
            state.sent[item.guid] = {
                ...record,
                at: record.at ?? new Date().toISOString(),
            }
        }
    }

    if (!args.dryRun) await writeState(state)

    log(
        `完成：发送 ${sent} 次，过期跳过 ${stale} 条，失败 ${failed} 次${
            args.dryRun ? '（dry-run，未写入状态）' : ''
        }`
    )

    if (failed > 0) process.exitCode = 1
}

main().catch(error => {
    console.error('广播失败：', describeError(error))
    process.exitCode = 1
})
