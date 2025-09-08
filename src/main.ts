import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
// 引入svg组件
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// 引入 video.js 样式
import 'video.js/dist/video-js.css'
import { registerGlobalConfig } from './config'

import '@/styles/index.scss'
import App from './App.vue'
import router from './router'

const app = createApp(App)
// 注册svg全局组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

// 注册全局配置
registerGlobalConfig(app)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')