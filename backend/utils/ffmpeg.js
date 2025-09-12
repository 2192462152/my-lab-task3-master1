const { spawn } = require('child_process');

// 存储活跃的流进程
const activeStreams = new Map();
// 存储客户端连接计数
const clientConnections = new Map();
// 存储重启计数器
const restartCounters = new Map();

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


module.exports = {
    spawn,
    activeStreams,
    clientConnections,
    restartCounters,
    startFFmpegStream
}