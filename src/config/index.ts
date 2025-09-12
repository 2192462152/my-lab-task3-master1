import type { App } from 'vue'

const baseUrl = 'http://localhost:3000/api'
const aiUrl = 'http://localhost:5000'
const aiImageUrl = 'http://localhost:3000'

// 统一注册函数（供main.ts调用，集中挂载全局参数）
export const registerGlobalConfig = (app: App) => {
    // 挂载配置项
    app.config.globalProperties.$baseUrl = baseUrl
    app.config.globalProperties.$aiUrl = aiUrl
    app.config.globalProperties.$aiImageUrl = aiImageUrl

    // 通过 Provide 注入
    app.provide('$baseUrl', baseUrl)
    app.provide('$aiUrl', aiUrl)
    app.provide('$aiImageUrl', aiImageUrl)
}