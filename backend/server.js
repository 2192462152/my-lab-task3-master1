const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const Router = require('@koa/router');
const serve = require('koa-static');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const chokidar = require('chokidar');
const Websocket = require('./utils/websocket');
const initMqttPromise = require('./utils/mqtt');
const devicesRouter = require('./routes/devices');
const dataRouter = require('./routes/data');
const errorRouter = require('./routes/error');
const directRouter = require('./routes/direct');
const behaviorDataRouter = require('./routes/behavior');
const operationLogRouter = require('./routes/operationLog');
const cameraRouter = require('./routes/camera'); // 新增摄像头路由
const autoControlRouter = require('./routes/autoControl');
const otherRouter = require('./routes/other');

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
router.use('/api', errorRouter.routes(), errorRouter.allowedMethods());
router.use('/api', directRouter.routes(), directRouter.allowedMethods());
router.use('/api', behaviorDataRouter.routes(), behaviorDataRouter.allowedMethods());
router.use('/api', operationLogRouter.routes(), operationLogRouter.allowedMethods());
router.use('/api', cameraRouter.routes(), cameraRouter.allowedMethods()); // 新增摄像头路由
router.use('/api', autoControlRouter.routes(), autoControlRouter.allowedMethods()); // 新增自动控制路由
router.use('/api', otherRouter.routes(), otherRouter.allowedMethods());

app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
const port = 3000;
const host = '0.0.0.0'
app.listen(port, host, () => {
    console.log(`服务器运行在 http://${host}:${port}!`);
});