const mqtt = require('mqtt')

class MqttClient {
    constructor(url) {
        this.url = url;
        this.client = null;
        this.connected = false;
    }

    connect(onSuccess, onError) {
        // 关闭已有连接
        if (this.client) {
            this.client.end();
        }

        // 创建客户端
        this.client = mqtt.connect(this.url, {
            clientId: `mqtt_${Math.random().toString(16).slice(2)}`,
            keepalive: 60,
            reconnectPeriod: 5000
        });

        // 连接成功
        this.client.on('connect', () => {
            this.connected = true;
            onSuccess && onSuccess();
        });

        // 连接错误
        this.client.on('error', (err) => {
            this.connected = false;
            onError && onError(err);
        });

        // 断开连接时更新状态
        this.client.on('close', () => {
            this.connected = false;
        });
    }

    /**
     * 订阅主题
     * @param {string} topic - 要订阅的主题
     * @param {Function} onMessage - 收到该主题消息的回调（参数：message, topic）
     * @param {Function} onError - 订阅失败回调
     */
    subscribe(topic, onMessage, onError) {
        if (!this.connected) {
            onError && onError(new Error('未连接到服务器!'));
            return;
        }

        this.client.subscribe(topic, (err) => {
            if (err) {
                onError && onError(err);
                return;
            }

            console.log(`${topic}已订阅成功！`)

            // 监听该主题的消息
            this.client.on('message', (recvTopic, message) => {
                if (recvTopic === topic) {
                    onMessage && onMessage(message.toString(), topic);
                }
            });
        });
    }

    /**
     * 发布消息
     * @param {string} topic - 发布的主题
     * @param {string} message - 消息内容
     * @param {Function} onSuccess - 发布成功回调
     * @param {Function} onError - 发布失败回调
     */
    publish(topic, message, onSuccess, onError) {
        if (!this.connected) {
            onError && onError(new Error('未连接到服务器'));
            return;
        }

        this.client.publish(topic, JSON.stringify(message), (err) => {
            if (err) {
                onError && onError(err);
            } else {
                onSuccess && onSuccess();
            }
        });
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.client) {
            this.client.end();
            this.connected = false;
        }
    }
}

// 创建mqtt实例
const mqttClient = new MqttClient('http://127.0.0.1:1883');

const initMqttPromise = new Promise((resolve, reject) => {
  mqttClient.connect(
    () => {
      console.log('MQTT连接成功！');
      global.mqttClient = mqttClient;
      resolve();
    },
    (err) => {
      reject(err);
    }
  );
});

module.exports = initMqttPromise;
