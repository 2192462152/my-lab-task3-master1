const Router = require('@koa/router');
const { connection } = require('../mysql')
const fs = require('fs');
const path = require('path');
const router = new Router();
const { spawn, activeStreams,
  clientConnections,
  restartCounters,
  startFFmpegStream } = require('../utils/ffmpeg')

// 服务器配置 - 方便修改IP地址
const serverConfig = {
  // 视频流服务器IP地址（手机访问时需要改为实际IP）
  VIDEO_SERVER_IP: 'localhost', // localhost改为实际IP地址
  // API服务器IP地址
  API_SERVER_IP: 'localhost'
};

// 获取摄像头配置信息
const getCameraConfigs = async () => {
  try {
    sql1 = `select
      camera_id,
      cameraAddress, 
      rtsp_path, 
      http_port
      from t_device
    `
    const [result1] = await connection.promise().query(sql1);
    let configs = {}
    result1.forEach(item => {
      configs[item.cameraAddress] = {
        id: item.camera_id,
        rtspUrl: `rtsp://admin:admin@${item.cameraAddress}` + item.rtsp_path,
        httpPort: item.http_port
      }
    })
    return configs;
  } catch (error) {
    console.error('获取摄像头配置失败:', error);
    return {};
  }
}

// 切换摄像头（停止其他，启动指定的）
router.post('/camera/:cameraAddress/switch', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {

    const cameraConfig = await getCameraConfigs();

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
    console.error('1111', error)
  }
});

// 截图功能 **
router.post('/camera/:cameraAddress/capture', async (ctx) => {
  const { cameraAddress } = ctx.params;

  try {
    const cameraConfig = await getCameraConfigs()
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

// 清理所有活跃流（用于服务器关闭时）
const cleanup = () => {
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