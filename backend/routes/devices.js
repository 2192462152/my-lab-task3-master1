const Router = require('@koa/router');
const { connection } = require('../mysql')
const router = new Router();
const dayjs = require('dayjs')

// 获取所有设备（不分页）
router.get('/allDevices', async (ctx) => {
    try {
        const [results] = await connection.promise().query('select * from t_device order by id');
        ctx.body = {
            data: results
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 获取所有设备
router.get('/devices', async (ctx) => {
    const { page = 1, pageSize = 10 } = ctx.query;
    const offset = (page - 1) * pageSize;

    try {
        const [countResult] = await connection.promise().query('select COUNT(*) as total from t_device');
        const [result] = await connection.promise().query(`select * from t_device limit ${pageSize} offset ${offset}`);

        ctx.body = {
            total: countResult[0].total,
            data: result
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 获取单个机房详情
router.get('/room/:roomId', async (ctx) => {
    const { roomId } = ctx.params;

    try {
        const [results] = await connection.promise().query('select * from t_device where number = ?', [roomId]);

        if (results.length === 0) {
            ctx.status = 404;
            ctx.body = { error: '机房不存在' };
            return;
        }

        ctx.body = {
            data: results[0]
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 添加设备
router.post('/devices', async (ctx) => {
    const { device_name, number, remarks } = ctx.request.body;
    const ctime = dayjs().format('YYYY-MM-DD HH:mm:ss')

    try {
        const [results] = await connection.promise().query(
            'INSERT INTO t_device (device_name, remarks, number, ctime) VALUES (?, ?, ?, ?)',
            [device_name, remarks, number, ctime]
        );
        ctx.body = { id: results.insertId, device_name, remarks, number, ctime };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 更新设备
router.put('/devices/:id', async (ctx) => {
    const { device_name, number, remarks } = ctx.request.body;
    const { id } = ctx.params;

    try {
        await connection.promise().query(
            'UPDATE t_device SET device_name = ?, remarks = ?, number = ? WHERE id = ?',
            [device_name, remarks, number, id]
        );
        ctx.body = { id, device_name, remarks, number };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 删除设备
router.delete('/devices/:id', async (ctx) => {
    const { id } = ctx.params;

    try {
        await connection.promise().query('DELETE FROM t_device WHERE id = ?', [id]);
        ctx.body = { message: '删除成功' };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

module.exports = router;