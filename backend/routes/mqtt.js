const Router = require('@koa/router');
const mqtt = require('mqtt');
const { connection } = require('../mysql')

const router = new Router();


// 单个设备的心跳监控类
class DeviceHeartbeatMonitor {
    constructor() {
        this.lastHeartbeat = null;
        this.isAlive = false;
        this.heartbeatTimeout = 60000;  // 5秒超时
        this.backupQueue = [];  // 备份的指令队列
    }

    updateHeartbeat() {
        this.lastHeartbeat = Date.now();

        // 如果之前没有心跳，现在心跳恢复，处理备份队列
        if (!this.isAlive) {
            this.isAlive = true;
            console.log(`物理层心跳恢复，处理备份指令`);

            // 物理层恢复心跳，发送时间
            // const topic = 'send'
            // const message = {
            //     time: new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11,19)
            // }
            // client.publish(topic,JSON.stringify(message),(err) => {
            //     if (err) {
            //         console.error('发送时间失败：',err);
            //     } else {
            //         console.log(`发送时间成功，主题：${topic},消息：${JSON.stringify(message)}`)
            //     }
            // })

            this.processBackupQueue();
        } else {
            this.isAlive = true;
        }
    }

    checkHeartbeat() {
        if (!this.lastHeartbeat) return false;

        const now = Date.now();
        if (now - this.lastHeartbeat > this.heartbeatTimeout) {
            this.isAlive = false;
            return false;
        }
        return true;
    }

    backupDirect(topic, message) {
        this.backupQueue.push({ topic, message });
        console.log(`物理层心跳丢失，指令已备份, 当前备份队列长度:`, this.backupQueue.length);
    }

    processBackupQueue() {
        if (this.backupQueue.length === 0) return;

        console.log(`开始处理备份指令，共${this.backupQueue.length}条`);

        // 将备份队列中的指令添加到主队列
        while (this.backupQueue.length > 0) {
            const direct = this.backupQueue.shift();
            directQueue.addDirect(direct.topic, direct.message);
        }
    }
}

// 指令队列类
class DirectQueue {
    constructor() {
        this.queue = []
        this.isProcessing = false
    }

    addDirect(topic, message) {
        this.queue.push({ topic, message })
        // console.log('当前指令列队：',this.queue)
        this.processQueue()
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return

        if (!deviceHeartbeatMonitor.checkHeartbeat()) {
            console.log('物理层心跳丢失，指令将被备份')
            const direct = this.queue.shift()
            deviceHeartbeatMonitor.backupDirect(direct.topic, direct.message);
            this.processQueue(); // 继续处理下一条
            return;
        }

        this.isProcessing = true
        const direct = this.queue[0]

        try {
            // 发送两次间隔1秒
            await this.publishMessage(direct.topic, direct.message);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.publishMessage(direct.topic, direct.message);

            // 发送成功，从队列中移除
            this.queue.shift()
            console.log('指令发送成功：', direct)
        } catch (error) {
            console.log('指令发送失败：', error)
        } finally {
            this.isProcessing = false
            if (this.queue.length > 0) {
                this.processQueue()
            }
        }
    }

    publishMessage(topic, message) {
        return new Promise((resolve, reject) => {
            if (!client.connected) {
                reject(new Error('MQTT未连接'));
                return;
            }

            const messageString = typeof message === 'string' ? message : JSON.stringify(message);

            client.publish(topic, messageString, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}

const deviceHeartbeatMonitor = new DeviceHeartbeatMonitor();
const directQueue = new DirectQueue();
let heartbeatTimer = null

// 与mqtt服务器创建连接，心跳设置60s
const client = mqtt.connect('mqtt://127.0.0.1:1883', {
    keepalive: 60,
    reconnectPeriod: 5000, // 自动重连间隔(默认1秒)
});

client.on('connect', () => {
    console.log('MQTT 连接成功!');

    // 订阅传感器数据主题
    client.subscribe('sensorData', (err) => {
        if (err) {
            console.error('订阅失败：', err);
        } else {
            console.log('订阅成功：sensorData');
        }
    });

    // 订阅设备心跳主题
    client.subscribe('heartbeat', (err) => {
        if (err) {
            console.error('订阅失败：', err);
        } else {
            console.log('订阅成功：heartbeat');
        }
    });

    // 订阅错误信息主题
    client.subscribe('error', (err) => {
        if (err) {
            console.error('订阅失败：', err);
        } else {
            console.log('订阅成功：error');
        }
    });

    // 向物理层发送心跳
    // heartbeatTimer = setInterval(() => {
    //     const heartbeatMessage = {
    //         status: 'alive',
    //     }
    //     client.publish('heartbeat', JSON.stringify(heartbeatMessage), (err) => {
    //         if (err) {
    //             console.error('发送心跳失败：', err)
    //         } else {
    //             // console.log('发送心跳成功')
    //         }
    //     })
    // }, 3000) // 3秒发送一次心跳

    // 开始处理队列中的指令
    directQueue.processQueue();
});

// 接收数据
client.on('message', async (topic, message) => {
    // 处理心跳消息
    // if (topic === 'heartbeat') {
    //     deviceHeartbeatMonitor.checkHeartbeat() // 更新心跳前先检查心跳，将isAlive改为false
    //     deviceHeartbeatMonitor.updateHeartbeat()
    //     console.log('收到物理层心跳')
    //     return;
    // }

    if (topic === 'sensorData') {
        try {
            const sensorData = JSON.parse(message.toString());

            // 初始化一个用于存储数据库字段值的对象
            const dbValues = {
                d_no: sensorData.d_no || null,
                c_time: sensorData.time || new Date(),
                // data_type: sensorData.data_type || null,
                field1: null,
                field2: null,
                field3: null,
                field4: null,
                field5: null,
                // field3: null,
            };

            // 查询p_name和db_name的映射关系
            const [mapperRows] = await connection.promise().query('SELECT p_name, db_name FROM t_field_mapper');

            // 遍历所有物理量
            mapperRows.forEach(row => {
                // 如果传入的数据中包含该物理量，则赋值给对应的数据库字段
                if (sensorData[row.p_name] !== undefined) {
                    dbValues[row.db_name] = sensorData[row.p_name];
                }
            });

            // 执行SQL插入
            const sql = `INSERT INTO t_data(d_no, field1, field2, field3, field4, field5, c_time)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const values = [
                dbValues.d_no,
                dbValues.field1,
                dbValues.field2,
                dbValues.field3,
                dbValues.field4,
                dbValues.field5,
                dbValues.c_time,
                // dbValues.data_type
            ];

            await connection.promise().query(sql, values);
            console.log('传感器数据存储成功');

            // 广播传感器数据更新消息
            if (global.wsManager) {
                global.wsManager.broadcast({
                    type: 'sensorDataUpdate',
                    message: '传感器数据',
                    data: {
                        d_no: dbValues.d_no,
                        field1: dbValues.field1,
                        field2: dbValues.field2,
                        field3: dbValues.field3,
                        field4: dbValues.field4,
                        field5: dbValues.field5,
                        c_time: dbValues.c_time,
                        // data_type: dbValues.data_type
                    }
                });

                // 广播实时耗电量信息
                if (sensorData.electricity !== undefined) {
                    global.wsManager.broadcast({
                        type: 'electricityUpdate',
                        message: '实时耗电量更新',
                        data: {
                            d_no: sensorData.d_no,
                            electricity: sensorData.electricity,
                            time: sensorData.time || new Date().toISOString()
                        }
                    });
                }
            }
        } catch (err) {
            console.error('存储传感器数据错误：', err);
        }
    }



    if (topic === 'error') {
        const errorData = JSON.parse(message.toString());
        const sql = `insert into t_error_msg(d_no, c_time, e_msg, type)
                     values (?, ?, ?, ?)`;
        const values = [
            errorData.d_no || null,
            errorData.time || new Date(),
            errorData.msg || '数据异常',
            errorData.type || "2",
        ];
        try {
            await connection.promise().query(sql, values);
            console.log('错误数据存储成功');
        } catch (err) {
            console.error('存储错误数据失败：', err);
        }
    }
});

// 连接断开
client.on('close', () => {
    clearInterval(heartbeatTimer)
    console.log('连接断开，尝试重连...');
});

// MQTT相关的API路由
router.post('/send-direct', async (ctx) => {
    const { topic, message } = ctx.request.body;

    if (!topic || !message) {
        ctx.status = 400;
        ctx.body = { error: '缺少 topic 或 message 参数' };
        return;
    }

    // 既无断连场景，直接调这个，简单直接；若有，则恢复注释就行
    client.publish(topic, JSON.stringify(message), (err) => {
        if (err) {
            console.error(`${topic}主题发送指令失败：`, err)
        } else {
            console.log(`${topic}主题发送指令成功！`)
        }
    })

    // directQueue.addDirect(topic, message);
    ctx.body = { status: '指令已发送' };
});

module.exports = router;