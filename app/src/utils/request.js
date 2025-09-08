import axios from 'axios'

const instance = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 10000
})

// 响应拦截器
instance.interceptors.response.use(
  response => response.data,
  error => {
    uni.showToast({
      title: error.message || '请求失败',
      icon: 'none'
    })
    return Promise.reject(error)
  }
)

export const request = instance