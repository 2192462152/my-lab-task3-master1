const Router = require('@koa/router');
const mysql = require('mysql2');
const axios = require('axios');
const router = new Router();

// 创建数据库连接
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '520199',
    database: 'test7'
});

// 场景配置
const SCENE_CONFIG = {
    "01": {
        devices: [
            {
                name: 'humidifier',
                sensor: 'humidity',
                threshold_name: '1号冰箱湿度阈值',
                control_name: '1号冰箱加湿器开关',
                description: '加湿器控制'
            },
        ]
    },
    "02": {
        devices: [
            {
                name: 'humidifier',
                sensor: 'humidity',
                threshold_name: '2号冰箱湿度阈值',
                control_name: '2号冰箱加湿器开关',
                description: '加湿器控制'
            }
        ]
    },
    "03": {
        devices: [
            {
                name: 'humidifier',
                sensor: 'humidity',
                threshold_name: '3号冰箱湿度阈值',
                control_name: '3号冰箱加湿器开关',
                description: '加湿器控制'
            }
        ]
    }
};

// 自动控制类
class AutoDeviceController {
    constructor() {
        this.isRunning = false;
        this.checkInterval = 10000; // 5秒检查一次
        this.timer = null;
        this.deviceStatus = {
            "01": { humidifier: false },
            "02": { humidifier: false },
            "03": { humidifier: false }
        };
    }

    // 启动自动控制
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('自动设备控制已启动');
        
        this.timer = setInterval(() => {
            this.checkAndControlDevices();
        }, this.checkInterval);
    }

    // 停止自动控制
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('自动设备控制已停止');
    }

    // 检查并控制设备
    async checkAndControlDevices() {
        try {
            // 检查每个场景
            for (const sceneId of ["01", "02", "03"]) {
                await this.checkScene(sceneId);
            }
        } catch (error) {
            console.error('自动控制检查失败:', error);
        }
    }

    // 检查单个场景
    async checkScene(sceneId) {
        try {
            const sceneConfig = SCENE_CONFIG[sceneId];
            if (!sceneConfig) return;

            // 获取该场景的物品数
            const personCount = await this.getCount(sceneId);
            
            // 检查每个设备
            for (const deviceConfig of sceneConfig.devices) {
                await this.checkDevice(sceneId, deviceConfig, personCount);
            }
            
        } catch (error) {
            console.error(`检查场景${sceneId}失败:`, error);
        }
    }

    // 检查单个设备
    async checkDevice(sceneId, deviceConfig, personCount) {
        try {
            // 获取传感器阈值
            const threshold = await this.getThreshold(sceneId, deviceConfig.threshold_name);
            
            // 获取当前传感器数值
            const currentValue = await this.getCurrentSensorValue(sceneId, deviceConfig.sensor);
            
            // 判断是否需要控制设备
            const shouldTurnOn = personCount >= 1 && this.shouldActivateDevice(deviceConfig.sensor, currentValue, threshold);
            const shouldTurnOff = personCount === 0;
            
            const currentStatus = this.deviceStatus[sceneId][deviceConfig.name];
            
            // 执行设备控制
            if (shouldTurnOn && !currentStatus) {
                await this.turnOnDevice(sceneId, deviceConfig);
                this.deviceStatus[sceneId][deviceConfig.name] = true;
                console.log(`${sceneId}号冰箱自动开启${deviceConfig.description} - 人数:${personCount}, ${deviceConfig.sensor}:${currentValue}, 阈值:${threshold}`);
            } else if (shouldTurnOff && currentStatus) {
                await this.turnOffDevice(sceneId, deviceConfig);
                this.deviceStatus[sceneId][deviceConfig.name] = false;
                console.log(`${sceneId}号冰箱自动关闭${deviceConfig.description} - 人数:${personCount}`);
            }
            
            // 广播当前场景状态到WebSocket客户端
            this.broadcastSceneStatus(sceneId, {
                personCount: personCount,
                humidityValue: currentValue,
                devices: this.deviceStatus[sceneId],
                threshold: threshold
            });
            
        } catch (error) {
            console.error(`${sceneId}号冰箱检查${deviceConfig.name}失败:`, error);
        }
    }

    // 判断是否应该激活设备
    shouldActivateDevice(sensorType, currentValue, threshold) {
        switch (sensorType) {
            case 'light':
                return currentValue < threshold; // 光照低于阈值
            case 'temperature':
                return currentValue > threshold; // 温度高于阈值
            case 'humidity':
                return currentValue < threshold; // 湿度低于阈值
            default:
                return false;
        }
    }

    // 获取阈值
    async getThreshold(sceneId, thresholdName) {
        const [result] = await connection.promise().query(`
            SELECT d.value 
            FROM t_direct_config c 
            JOIN t_direct d ON c.id = d.config_id 
            WHERE c.t_name = ? AND d.d_no = ?
        `, [thresholdName, sceneId]);
        
        return result.length > 0 ? parseFloat(result[0].value) : 30; // 默认阈值30
    }

    // 获取当前传感器值
    async getCurrentSensorValue(sceneId, sensorType) {
        // 传感器类型到数据库字段的映射
        const sensorMapping = {
            'light': 'light',
            'temperature': 'temperature',
            'humidity': 'humidity'
        };
        
        const sensorField = sensorMapping[sensorType];
        if (!sensorField) return 0;
        
        // 从t_field_mapper获取传感器对应的数据库字段
        const [mapperResult] = await connection.promise().query(`
            SELECT db_name FROM t_field_mapper WHERE p_name = ?
        `, [sensorField]);
        
        if (mapperResult.length === 0) {
            throw new Error(`未找到${sensorType}字段映射`);
        }
        
        const dbField = mapperResult[0].db_name;
        
        // 获取最新的传感器数据
        const [dataResult] = await connection.promise().query(`
            SELECT ${dbField} as sensor_value 
            FROM t_data 
            WHERE d_no = ? 
            ORDER BY c_time DESC 
            LIMIT 1
        `, [sceneId]);
        
        return dataResult.length > 0 ? parseFloat(dataResult[0].sensor_value) || 0 : 0;
    }

    // 获取物品统计
    async getCount(sceneId) {
        try {
            // 根据sceneId获取对应的摄像头地址
            const cameraAddresses = {
                "01": '192.168.1.13:554',
                "02": '192.168.1.14:554', 
                "03": '192.168.1.15:554'
            };
            
            const cameraAddress = cameraAddresses[sceneId];
            if (!cameraAddress) {
                console.error(`场景${sceneId}没有对应的摄像头配置`);
                return 0;
            }
            
            // 调用camera.js的截图接口获取base64图片
            const captureResponse = await axios.post(`http://localhost:3000/api/camera/${cameraAddress}/capture`);
            
            if (!captureResponse.data.success || !captureResponse.data.data.base64Image) {
                console.error(`场景${sceneId}截图失败`);
                return 0;
            }
            
            const base64Image = captureResponse.data.data.base64Image;
            
            // 发送给YOLO识别接口
            const inferResponse = await axios.post('http://localhost:5000/infer', {
                image: base64Image
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30秒超时
            });
            
            // 统计person标签的数量
            let personCount = 0;
            if (inferResponse.data && inferResponse.data.inference_results) {
                const results = inferResponse.data.inference_results;
                personCount = results.filter(result => result.label === 'person').length;
            }
            
            console.log(`${sceneId}号冰箱检测到${personCount}个人`);
            return personCount;
            
        } catch (error) {
            console.error(`获取${sceneId}号冰箱人数失败:`, error.message);
            return 0;
        }
    }

    // 开启设备
    async turnOnDevice(sceneId, deviceConfig) {
        try {
            await this.updateDeviceStatus(sceneId, deviceConfig.control_name, 'on');
            await this.sendMQTTCommand(sceneId, deviceConfig.name, 'on');
        } catch (error) {
            console.error(`场景${sceneId}开启${deviceConfig.name}失败:`, error);
        }
    }

    // 关闭设备
    async turnOffDevice(sceneId, deviceConfig) {
        try {
            await this.updateDeviceStatus(sceneId, deviceConfig.control_name, 'off');
            await this.sendMQTTCommand(sceneId, deviceConfig.name, 'off');
        } catch (error) {
            console.error(`场景${sceneId}关闭${deviceConfig.name}失败:`, error);
        }
    }

    // 更新设备状态到数据库
    async updateDeviceStatus(sceneId, controlName, status) {
        const value = status === 'on' ? 'on' : 'off';
        
        await connection.promise().query(`
            UPDATE t_direct d 
            JOIN t_direct_config c ON d.config_id = c.id 
            SET d.value = ? 
            WHERE c.t_name = ? AND d.d_no = ?
        `, [value, controlName, sceneId]);
    }

    // 发送MQTT指令
    async sendMQTTCommand(sceneId, deviceType, action) {
        try {
            const message = {
                scene: sceneId,
                device: deviceType,
                action: action,
                timestamp: new Date().toISOString()
            };
            
            await axios.post('http://localhost:3000/api/send-direct', {
                topic: 'send',
                message: message
            });
            
        } catch (error) {
            console.error(`发送MQTT指令失败:`, error);
        }
    }

    // 获取所有场景状态
    getSceneStatus() {
        const result = {};
        for (const sceneId of ["01", "02", "03"]) {
            result[sceneId] = {
                devices: this.deviceStatus[sceneId],
                config: SCENE_CONFIG[sceneId]
            };
        }
        return result;
    }

    // 广播场景状态到WebSocket客户端
    broadcastSceneStatus(sceneId, statusData) {
        try {
            if (global.wsManager) {
                const message = {
                    type: 'sceneStatus',
                    sceneId: sceneId,
                    data: statusData,
                    timestamp: new Date().toISOString()
                };
                global.wsManager.broadcast(message);
            }
        } catch (error) {
            console.error('WebSocket广播失败:', error);
        }
    }
}

// 创建自动控制实例
const autoController = new AutoDeviceController();

// API路由
router.post('/start', async (ctx) => {
    try {
        autoController.start();
        ctx.body = { 
            success: true, 
            message: '自动设备控制已启动' 
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { 
            success: false, 
            message: '启动失败', 
            error: error.message 
        };
    }
});

router.post('/stop', async (ctx) => {
    try {
        autoController.stop();
        ctx.body = { 
            success: true, 
            message: '自动设备控制已停止' 
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { 
            success: false, 
            message: '停止失败', 
            error: error.message 
        };
    }
});

router.get('/status', async (ctx) => {
    ctx.body = {
        isRunning: autoController.isRunning,
        sceneStatus: autoController.getSceneStatus()
    };
});

// 更新阈值
router.put('/threshold/:sceneId/:sensorType', async (ctx) => {
    let { sceneId, sensorType } = ctx.params;
    const { threshold } = ctx.request.body;
    
    try {
        // 修正阈值名称格式，与SCENE_CONFIG中的保持一致
        const thresholdName = `${parseInt(sceneId)}号冰箱${sensorType}阈值`;

        // 确保sceneId为"01","02","03"格式
        if (sceneId.length === 1) {
            sceneId = sceneId.padStart(2, '0');
        }
        
        await connection.promise().query(`
            UPDATE t_direct d 
            JOIN t_direct_config c ON d.config_id = c.id 
            SET d.value = ? 
            WHERE c.t_name = ? AND d.d_no = ?
        `, [threshold.toString(), thresholdName, sceneId]);
        
        ctx.body = { 
            success: true, 
            message: `${parseInt(sceneId)}号冰箱${sensorType}阈值已更新为${threshold}` 
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { 
            success: false, 
            message: '更新阈值失败', 
            error: error.message 
        };
    }
});

// 获取所有阈值
router.get('/thresholds', async (ctx) => {
    try {
        const [result] = await connection.promise().query(`
            SELECT d.d_no, d.value, c.t_name
            FROM t_direct_config c 
            JOIN t_direct d ON c.id = d.config_id 
            WHERE c.t_name LIKE '%阈值'
            ORDER BY d.d_no, c.t_name
        `);
        
        const thresholds = {};
        result.forEach(row => {
            if (!thresholds[row.d_no]) {
                thresholds[row.d_no] = {};
            }
            
            // 解析阈值名称
            const match = row.t_name.match(/(\d+)号冰箱(\w+)阈值/);
            if (match) {
                const sensorType = match[2];
                thresholds[row.d_no][sensorType] = parseFloat(row.value);
            }
        });
        
        ctx.body = { 
            success: true, 
            thresholds: thresholds 
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { 
            success: false, 
            message: '获取阈值失败', 
            error: error.message 
        };
    }
});

module.exports = router;
