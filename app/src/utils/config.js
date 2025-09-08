// src/utils/config.js
// API接口配置文件

// 服务器IP地址配置
const SERVER_IP = '192.168.1.100';

// 后端API服务地址（数据服务）
const API_BASE_URL = `http://${SERVER_IP}:3000`; 

// 视频流服务器地址配置
const VIDEO_SERVER_IP = SERVER_IP; // 视频流服务器IP，通常与API服务器相同

export default {
  API_BASE_URL,
  SERVER_IP,
  VIDEO_SERVER_IP,
}