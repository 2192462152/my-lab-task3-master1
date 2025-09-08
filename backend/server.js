const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const Router = require('@koa/router');
const serve = require('koa-static');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const chokidar = require('chokidar');
const devicesRouter = require('./routes/devices');
const dataRouter = require('./routes/data');
const directRouter = require('./routes/direct');
const behaviorDataRouter = require('./routes/behavior');
const mqttRouter = require('./routes/mqtt');
const operationLogRouter = require('./routes/operationLog');
const cameraRouter = require('./routes/camera'); // 新增摄像头路由
const WebSocket = require('ws');


// WebSocket管理器
class WebSocketManager {
    constructor() {
        this.clients = new Set();
        this.wss = null;
    }

    initialize(port = 8080) {
        this.wss = new WebSocket.Server({ port });

        this.wss.on('connection', (ws) => {
            console.log('新的WebSocket连接!');
            this.clients.add(ws);

            ws.on('close', () => {
                console.log('WebSocket连接关闭!');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket错误:', error);
                this.clients.delete(ws);
            });
        });

        console.log(`WebSocket服务已启动，端口: ${port}!`);
    }

    broadcast(message) {
        const messageString = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageString);
            }
        });
    }
}

// 创建全局WebSocket管理器示例
const wsManager = new WebSocketManager();

const app = new Koa();
const router = new Router();

// 中间件
app.use(cors());
app.use(bodyParser({
    jsonLimit: '50mb',
    formLimit: '50mb',
    textLimit: '50mb'
}));

// 静态文件
app.use(serve(path.join(__dirname)));

// 路由
router.use('/api', devicesRouter.routes(), devicesRouter.allowedMethods());
router.use('/api', dataRouter.routes(), dataRouter.allowedMethods());
router.use('/api', directRouter.routes(), directRouter.allowedMethods());
router.use('/api', behaviorDataRouter.routes(), behaviorDataRouter.allowedMethods());
router.use('/api', mqttRouter.routes(), mqttRouter.allowedMethods());
router.use('/api', operationLogRouter.routes(), operationLogRouter.allowedMethods());
router.use('/api', cameraRouter.routes(), cameraRouter.allowedMethods()); // 新增摄像头路由

app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
const port = 3000;
app.listen(port, () => {
    console.log(`服务器运行在端口 ${port}!`);

    // 初始化WebSocket服务器
    wsManager.initialize(8080);

    console.log('MQTT服务已启动!');
});

// 导出WebSocket管理器实例
global.wsManager = wsManager;