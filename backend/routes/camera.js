const Router = require('@koa/router');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = new Router();

// 存储活跃的流进程
const activeStreams = new Map();
// 存储客户端连接计数
const clientConnections = new Map();
// 存储重启计数器
const restartCounters = new Map();

// 服务器配置 - 方便修改IP地址
const serverConfig = {
  // 视频流服务器IP地址（手机访问时需要改为实际IP）
  VIDEO_SERVER_IP: 'localhost', // localhost改为实际IP地址
  // API服务器IP地址
  API_SERVER_IP: 'localhost'
};

// 摄像头配置
const cameraConfig = {
  '192.168.1.101:554': {
    id: 'camera1',
    name: '摄像头1',
    rtspUrl: 'rtsp://admin:admin@192.168.1.101:554/Streaming/Channels/101',
    httpPort: 7001
  },
  '192.168.1.14:554': {
    id: 'camera2',
    name: '摄像头2',
    rtspUrl: 'rtsp://admin:admin@192.168.1.14:554/Streaming/Channels/101',
    httpPort: 7002
  },
  '192.168.1.15:554': {
    id: 'camera3',
    name: '摄像头3',
    rtspUrl: 'rtsp://admin:admin@192.168.1.15:554/Streaming/Channels/101',
    httpPort: 7003
  }
};

// 启动FFmpeg流转换
const startFFmpegStream = (cameraId, rtspUrl, httpPort, isRestart = false) => {
  return new Promise((resolve, reject) => {
    // 停止已存在的流
    if (activeStreams.has(cameraId)) {
      const existingProcess = activeStreams.get(cameraId);
      existingProcess.kill('SIGTERM');
      activeStreams.delete(cameraId);
    }

    // 停止已存在的HTTP服务器
    if (activeStreams.has(`${cameraId}_server`)) {
      const existingServer = activeStreams.get(`${cameraId}_server`);
      existingServer.close();
      activeStreams.delete(`${cameraId}_server`);
    }

    // FFmpeg命令：将RTSP流转换为HTTP MJPEG流
    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',         // 使用TCP传输协议，更稳定
      '-buffer_size', '1024k',          // 增加缓冲区大小
      '-max_delay', '500000',           // 最大延迟500ms
      '-timeout', '30000000',           // 超时设置30秒
      '-i', rtspUrl,                    // 输入RTSP流
      '-f', 'mjpeg',                    // 输出格式为MJPEG
      '-vf', 'scale=640:480',           // 缩放到640x480
      '-q:v', '6',                      // 调整视频质量（降低一点以提高稳定性）
      '-r', '12',                       // 降低帧率到12fps提高稳定性
      '-reconnect', '1',                // 自动重连
      '-reconnect_streamed', '1',       // 流重连
      '-reconnect_delay_max', '5',      // 最大重连延迟5秒
      '-fflags', '+genpts',             // 生成时间戳
      '-avoid_negative_ts', 'make_zero', // 避免负时间戳
      '-'                               // 输出到stdout
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    activeStreams.set(cameraId, ffmpeg);

    // 只在非重启时重置重启计数器
    if (!isRestart) {
      restartCounters.delete(cameraId);
    }
    // 初始化客户端连接计数
    if (!clientConnections.has(cameraId)) {
      clientConnections.set(cameraId, 0);
    }

    // 创建HTTP服务器来提供MJPEG流
    const http = require('http');
    const server = http.createServer((req, res) => {
      // 设置CORS头
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/stream') {
        res.writeHead(200, {
          'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Connection': 'close',
          'Access-Control-Allow-Origin': '*'
        });

        // 增加客户端连接计数
        const currentConnections = clientConnections.get(cameraId) || 0;
        clientConnections.set(cameraId, currentConnections + 1);
        console.log(`客户端连接 ${cameraId}, 当前连接数: ${currentConnections + 1}`);

        // 处理FFmpeg输出
        const dataHandler = (data) => {
          try {
            res.write(`--myboundary\r\n`);
            res.write(`Content-Type: image/jpeg\r\n`);
            res.write(`Content-Length: ${data.length}\r\n\r\n`);
            res.write(data);
            res.write('\r\n');
          } catch (error) {
            console.error(`写入响应失败 ${cameraId}:`, error);
          }
        };

        ffmpeg.stdout.on('data', dataHandler);

        req.on('close', () => {
          const connections = clientConnections.get(cameraId) || 1;
          const newConnections = Math.max(0, connections - 1);
          clientConnections.set(cameraId, newConnections);
          console.log(`客户端断开连接: ${cameraId}, 剩余连接数: ${newConnections}`);
          ffmpeg.stdout.removeListener('data', dataHandler);

          // 如果没有客户端连接了，延迟停止FFmpeg进程
          if (newConnections === 0) {
            setTimeout(() => {
              const currentConnections = clientConnections.get(cameraId) || 0;
              if (currentConnections === 0 && activeStreams.has(cameraId)) {
                console.log(`无客户端连接，停止FFmpeg进程: ${cameraId}`);
                const ffmpegProcess = activeStreams.get(cameraId);
                if (ffmpegProcess) {
                  ffmpegProcess.kill('SIGTERM');
                }
              }
            }, 10000); // 10秒后检查，给新连接一些时间
          }
        });

        req.on('error', (error) => {
          console.error(`请求错误 ${cameraId}:`, error);
          const connections = clientConnections.get(cameraId) || 1;
          const newConnections = Math.max(0, connections - 1);
          clientConnections.set(cameraId, newConnections);
          ffmpeg.stdout.removeListener('data', dataHandler);

          // 如果没有客户端连接了，延迟停止FFmpeg进程
          if (newConnections === 0) {
            setTimeout(() => {
              const currentConnections = clientConnections.get(cameraId) || 0;
              if (currentConnections === 0 && activeStreams.has(cameraId)) {
                console.log(`无客户端连接，停止FFmpeg进程: ${cameraId}`);
                const ffmpegProcess = activeStreams.get(cameraId);
                if (ffmpegProcess) {
                  ffmpegProcess.kill('SIGTERM');
                }
              }
            }, 10000); // 10秒后检查，给新连接一些时间
          }
        });

      } else if (req.url === '/') {
        // 提供一个优化的HTML页面用于iframe
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>摄像头 ${cameraId}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                margin: 0; 
                padding: 0; 
                background: #000; 
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                overflow: hidden;
              }
              img { 
                max-width: 100%; 
                max-height: 100%; 
                object-fit: contain;
                border-radius: 4px;
              }
              .loading {
                color: white;
                font-family: Arial, sans-serif;
                text-align: center;
              }
              .error {
                color: #ff6b6b;
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
              }
            </style>
          </head>
          <body>
            <div class="loading" id="loading">正在加载摄像头画面...</div>
            <img id="stream" src="/stream" alt="摄像头实时画面" style="display: none;" 
                 onload="document.getElementById('loading').style.display='none'; this.style.display='block';"
                 onerror="document.getElementById('loading').innerHTML='<div class=error>摄像头连接失败<br>请检查网络连接</div>';" />
          </body>
          </html>
        `);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    // 监听服务器错误
    server.on('error', (error) => {
      console.error(`HTTP服务器错误 ${cameraId}:`, error);
      reject(error);
    });

    server.listen(httpPort, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`摄像头 ${cameraId} HTTP服务启动在端口 ${httpPort}`);
        resolve(httpPort);
      }
    });

    // 存储服务器引用以便后续关闭
    activeStreams.set(`${cameraId}_server`, server);

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString();
      // 只记录重要的错误信息，过滤掉正常的调试信息
      if (message.includes('error') || message.includes('failed') || message.includes('timeout')) {
        console.log(`FFmpeg ${cameraId} 错误:`, message);
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg进程 ${cameraId} 退出，代码: ${code}`);
      activeStreams.delete(cameraId);

      // 检查是否有客户端连接和重启次数
      const hasClients = (clientConnections.get(cameraId) || 0) > 0;
      const restartCount = restartCounters.get(cameraId) || 0;
      const maxRestarts = 3; // 最大重启次数

      // 如果是异常退出且有客户端连接且未超过重启限制，尝试重启
      if (code !== 0 && code !== null && hasClients && restartCount < maxRestarts) {
        restartCounters.set(cameraId, restartCount + 1);
        console.log(`尝试重启摄像头 ${cameraId}... (第${restartCount + 1}次)`);
        setTimeout(() => {
          startFFmpegStream(cameraId, rtspUrl, httpPort, true).catch(console.error);
        }, 5000); // 5秒后重试
      } else if (code !== 0 && code !== null) {
        if (!hasClients) {
          console.log(`摄像头 ${cameraId} 无客户端连接，停止重启`);
        } else if (restartCount >= maxRestarts) {
          console.log(`摄像头 ${cameraId} 重启次数已达上限，停止重启`);
          restartCounters.delete(cameraId);
        }
      } else {
        // 正常退出，重置重启计数器
        restartCounters.delete(cameraId);
      }
    });

    ffmpeg.on('error', (error) => {
      console.error(`FFmpeg错误 ${cameraId}:`, error);
      activeStreams.delete(cameraId);
      reject(error);
    });

    // 设置超时处理
    setTimeout(() => {
      if (activeStreams.has(cameraId)) {
        resolve(httpPort); // 即使没有立即成功，也先返回，让前端可以尝试连接
      }
    }, 3000);
  });
};

// 停止单个摄像头流的内部函数
const stopSingleCameraStream = (cameraAddress) => {
  const config = cameraConfig[cameraAddress];
  if (!config) return false;

  let stopped = false;

  // 停止FFmpeg进程
  if (activeStreams.has(config.id)) {
    const process = activeStreams.get(config.id);
    process.kill('SIGTERM');
    activeStreams.delete(config.id);
    stopped = true;
  }

  // 停止HTTP服务器
  if (activeStreams.has(`${config.id}_server`)) {
    const server = activeStreams.get(`${config.id}_server`);
    server.close();
    activeStreams.delete(`${config.id}_server`);
    stopped = true;
  }

  // 清理计数器
  clientConnections.delete(config.id);
  restartCounters.delete(config.id);

  if (stopped) {
    console.log(`摄像头 ${config.id} 流已停止`);
  }

  return stopped;
};

// 获取摄像头列表
router.get('/cameras', async (ctx) => {
  try {
    const cameras = Object.entries(cameraConfig).map(([key, config]) => ({
      id: config.id,
      name: config.name,
      address: key,
      status: activeStreams.has(config.id) ? 'active' : 'inactive',
      iframeUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/`
    }));

    ctx.body = {
      success: true,
      data: cameras
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
});

// 启动摄像头流
router.post('/camera/:cameraAddress/start', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {
    const config = cameraConfig[cameraAddress];
    if (!config) {
      ctx.status = 404;
      ctx.body = { error: '摄像头不存在' };
      return;
    }

    // 检查是否已经在运行
    if (activeStreams.has(config.id)) {
      ctx.body = {
        success: true,
        message: '摄像头流已在运行',
        iframeUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/`,
        streamUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/stream`
      };
      return;
    }

    await startFFmpegStream(config.id, config.rtspUrl, config.httpPort);

    ctx.body = {
      success: true,
      message: '摄像头流启动成功',
      iframeUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/`,
      streamUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/stream`
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: '启动摄像头流失败: ' + error.message
    };
  }
});

// 停止摄像头流
router.post('/camera/:cameraAddress/stop', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {
    const config = cameraConfig[cameraAddress];
    if (!config) {
      ctx.status = 404;
      ctx.body = { error: '摄像头不存在' };
      return;
    }

    const stopped = stopSingleCameraStream(cameraAddress);

    ctx.body = {
      success: true,
      message: stopped ? '摄像头流停止成功' : '摄像头流未在运行'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: '停止摄像头流失败: ' + error.message
    };
  }
});

// 切换摄像头（停止其他，启动指定的）
router.post('/camera/:cameraAddress/switch', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {
    const config = cameraConfig[cameraAddress];
    if (!config) {
      ctx.status = 404;
      ctx.body = { error: '摄像头不存在' };
      return;
    }

    // 停止其他所有摄像头流
    // Object.entries(cameraConfig).forEach(([address, cfg]) => {
    //   if (address !== cameraAddress) {
    //     stopSingleCameraStream(address);
    //   }
    // });

    // 启动指定的摄像头流（如果未运行）
    if (!activeStreams.has(config.id)) {
      await startFFmpegStream(config.id, config.rtspUrl, config.httpPort);
    }

    ctx.body = {
      success: true,
      message: '摄像头切换成功',
      iframeUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/`,
      streamUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/stream`
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: '切换摄像头失败: ' + error.message
    };
  }
});

// 停止所有摄像头流 **
router.post('/cameras/stop-all', async (ctx) => {
  try {
    let stoppedCount = 0;

    Object.keys(cameraConfig).forEach(cameraAddress => {
      if (stopSingleCameraStream(cameraAddress)) {
        stoppedCount++;
      }
    });

    ctx.body = {
      success: true,
      message: `成功停止 ${stoppedCount} 个摄像头流`
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: '停止所有摄像头流失败: ' + error.message
    };
  }
});

// 获取单个摄像头信息
router.get('/camera/:cameraAddress', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {
    const config = cameraConfig[cameraAddress];
    if (!config) {
      ctx.status = 404;
      ctx.body = { error: '摄像头不存在' };
      return;
    }

    const isActive = activeStreams.has(config.id);

    ctx.body = {
      success: true,
      data: {
        id: config.id,
        name: config.name,
        address: cameraAddress,
        status: isActive ? 'active' : 'inactive',
        iframeUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/`,
        streamUrl: `http://${serverConfig.VIDEO_SERVER_IP}:${config.httpPort}/stream`
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
});

// 截图功能 **
router.post('/camera/:cameraAddress/capture', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {
    const config = cameraConfig[cameraAddress];
    if (!config) {
      ctx.status = 404;
      ctx.body = { error: '摄像头不存在' };
      return;
    }

    // 创建截图目录
    const captureDir = path.join(__dirname, '../captures');
    if (!fs.existsSync(captureDir)) {
      fs.mkdirSync(captureDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `${config.id}_${timestamp}.png`;
    const filepath = path.join(captureDir, filename);

    // 使用FFmpeg截图，添加更多参数提高成功率
    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',
      '-i', config.rtspUrl,
      '-vframes', '1',
      '-q:v', '2',
      '-y', // 覆盖已存在的文件
      filepath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ffmpeg.kill('SIGTERM');
        reject(new Error('截图超时'));
      }, 10000); // 10秒超时

      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg截图失败，退出代码: ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // 检查文件是否存在
    if (!fs.existsSync(filepath)) {
      throw new Error('截图文件未生成');
    }

    // 读取截图文件并转换为base64
    const imageBuffer = fs.readFileSync(filepath);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    // 删除临时文件
    fs.unlinkSync(filepath);

    ctx.body = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        base64Image: base64Image,
        filename: filename
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: '截图失败: ' + error.message
    };
  }
});

// 健康检查接口
router.get('/camera/:cameraAddress/health', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {
    const config = cameraConfig[cameraAddress];
    if (!config) {
      ctx.status = 404;
      ctx.body = { error: '摄像头不存在' };
      return;
    }

    const isActive = activeStreams.has(config.id);
    const serverActive = activeStreams.has(`${config.id}_server`);

    ctx.body = {
      success: true,
      data: {
        cameraId: config.id,
        streamActive: isActive,
        serverActive: serverActive,
        status: (isActive && serverActive) ? 'healthy' : 'unhealthy'
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
});

// 清理所有活跃流（用于服务器关闭时）
const cleanup = () => {
  console.log('清理所有摄像头流...');
  activeStreams.forEach((process, key) => {
    try {
      if (key.endsWith('_server')) {
        process.close();
      } else {
        process.kill('SIGTERM');
      }
    } catch (error) {
      console.error(`清理流失败 ${key}:`, error);
    }
  });

  // 清理所有计数器和映射
  activeStreams.clear();
  clientConnections.clear();
  restartCounters.clear();
  console.log('摄像头资源清理完成');
};

// 监听进程退出事件
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

module.exports = router;