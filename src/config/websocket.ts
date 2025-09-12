export class SimpleWebSocket {
    private ws: WebSocket | null = null;
    private isConnected = false;
    private reconnectTimer: number | null = null;

    // 事件回调存储
    private handlers: {
        message?: (data: any) => void;
        open?: () => void;
        error?: (err: Event) => void;
        close?: (event: CloseEvent) => void;
    } = {};

    constructor(
        private url: string,
        private reconnectInterval: number = 5000
    ) {
        this.connect();
    }

    // 建立连接
    connect() {
        if (this.isConnected) return;

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.isConnected = true;
            this.handlers.open?.();
            console.log('WebSocket连接成功!');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data as string);
                this.handlers.message?.(data);
            } catch {
                this.handlers.message?.(event.data);
            }
        };

        this.ws.onerror = (err) => {
            this.handlers.error?.(err);
            console.error('WebSocket错误');
        };

        this.ws.onclose = (event) => {
            this.isConnected = false;
            this.handlers.close?.(event);

            if (event.code === 1000) {
                console.log('已手动关闭连接！');
            }

            if (event.code !== 1000) {
                console.log('连接关闭，尝试重连...');
                // 浏览器中 setTimeout 返回 number 类型
                this.reconnectTimer = window.setTimeout(() => this.connect(), this.reconnectInterval);
            }
        };
    }

    // 发送消息
    send(data: any) {
        if (!this.isConnected || !this.ws) {
            console.warn('未连接，无法发送消息');
            return;
        }

        try {
            const message = typeof data === 'object' ? JSON.stringify(data) : String(data);
            this.ws.send(message);
        } catch (err) {
            console.error('发送失败:', err);
        }
    }

    // 关闭连接
    close() {
        if (this.ws) {
            this.ws.close(1000, '手动关闭');
            this.isConnected = false;
            if (this.reconnectTimer) {
                window.clearTimeout(this.reconnectTimer); // 使用 window.clearTimeout
            }
        }
    }

    // 注册事件回调
    onMessage(handler: (data: any) => void) {
        this.handlers.message = handler;
    }

    onOpen(handler: () => void) {
        this.handlers.open = handler;
    }

    onError(handler: (err: Event) => void) {
        this.handlers.error = handler;
    }

    onClose(handler: (event: CloseEvent) => void) {
        this.handlers.close = handler;
    }
}
