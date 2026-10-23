/**
 * 第三方包只有 JS、没有类型声明的副作用导入，在这里补声明。
 *
 * TS 5.6 起 `noUncheckedSideEffectImports` 默认会对「找不到类型」的
 * 纯副作用 import 报 TS2882（Nuxt 的 tsconfig 就打开了它）。
 * `vue3-emoji-picker` 的 package.json 只把 `./css` 映射到 dist/style.css，
 * 没有对应的 .d.ts，所以单独补一条。
 */
declare module 'vue3-emoji-picker/css'
