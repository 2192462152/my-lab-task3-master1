const WebSocket = require('ws');

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

const wsManager = new WebSocketManager();
wsManager.initialize(8080);
// 挂载全局websocket实例
global.wsManager = wsManager;

module.exports = wsManager;