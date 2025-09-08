const Router = require('@koa/router');
const { connection } = require('../mysql')
const router = new Router();

// 获取所有设备（不分页）
router.get('/allDevices', async (ctx) => {
    try {
        const [results] = await connection.promise().query('select * from t_device order by id');
        ctx.body = {
            data: results
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = {error: error.message};
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

// 获取所有设备
router.get('/devices', async (ctx) => {
    const {page = 1, pageSize = 10} = ctx.query;
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
        ctx.body = {error: error.message};
    }
});

// 添加设备
router.post('/devices', async (ctx) => {
    const {device_name, number, remarks} = ctx.request.body;
    const ctime = new Date(new Date().getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    try {
        const [results] = await connection.promise().query(
            'INSERT INTO t_device (device_name, remarks, number, ctime) VALUES (?, ?, ?, ?)',
            [device_name, remarks, number, ctime]
        );
        ctx.body = {id: results.insertId, device_name, remarks, number, ctime};
    } catch (error) {
        ctx.status = 500;
        ctx.body = {error: error.message};
    }
});

// 更新设备
router.put('/devices/:id', async (ctx) => {
    const {device_name, number, remarks} = ctx.request.body;
    const {id} = ctx.params;

    try {
        await connection.promise().query(
            'UPDATE t_device SET device_name = ?, remarks = ?, number = ? WHERE id = ?',
            [device_name, remarks, number, id]
        );
        ctx.body = {id, device_name, remarks, number};
    } catch (error) {
        ctx.status = 500;
        ctx.body = {error: error.message};
    }
});

// 删除设备
router.delete('/devices/:id', async (ctx) => {
    const {id} = ctx.params;
    
    try {
        await connection.promise().query('DELETE FROM t_device WHERE id = ?', [id]);
        ctx.body = {message: '删除成功'};
    } catch (error) {
        ctx.status = 500;
        ctx.body = {error: error.message};
    }
});

// 添加错误消息
router.post('/error-messages', async (ctx) => {
    const {d_no, e_msg} = ctx.request.body;
    const c_time = new Date(new Date().getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const type = '1';

    try {
        const [results] = await connection.promise().query(
            'INSERT INTO t_error_msg (d_no, c_time, e_msg, type) VALUES (?, ?, ?, ?)',
            [d_no, c_time, e_msg, type]
        );
        ctx.body = {
            success: true,
            id: results.insertId,
            d_no,
            c_time,
            e_msg,
            type
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = {error: error.message};
    }
});

// 获取错误消息列表
router.get('/error-messages', async (ctx) => {
    const {page = 1, pageSize = 5, startTime, endTime, deviceId} = ctx.query;
    const offset = (page - 1) * pageSize;

    let countQuery = 'SELECT COUNT(*) as total FROM t_error_msg';
    let dataQuery = 'SELECT * FROM t_error_msg';
    const countParams = [];
    const dataParams = [];

    // 构建筛选条件数组
    const conditions = [];

    // 添加时间筛选条件
    if (startTime && endTime) {
        conditions.push('c_time BETWEEN ? AND ?');
        countParams.push(startTime, endTime);
        dataParams.push(startTime, endTime);
    } else if (startTime) {
        conditions.push('c_time >= ?');
        countParams.push(startTime);
        dataParams.push(startTime);
    } else if (endTime) {
        conditions.push('c_time <= ?');
        countParams.push(endTime);
        dataParams.push(endTime);
    }

    // 添加场景ID筛选条件
    if (deviceId) {
        conditions.push('d_no = ?');
        countParams.push(deviceId);
        dataParams.push(deviceId);
    }

    // 如果有筛选条件，添加WHERE子句
    if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        countQuery += whereClause;
        dataQuery += whereClause;
    }

    dataQuery += ' ORDER BY c_time DESC LIMIT ? OFFSET ?';
    dataParams.push(parseInt(pageSize), offset);

    try {
        const [countResults] = await connection.promise().query(countQuery, countParams);
        const [results] = await connection.promise().query(dataQuery, dataParams);
        
        ctx.body = {
            total: countResults[0].total,
            data: results
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = {error: error.message};
    }
});

// 简化：获取错误信息统计
router.get('/error-statistics', async (ctx) => {
    try {
        // 获取总条数
        const [totalResult] = await connection.promise().query(
            `SELECT COUNT(*) as total FROM t_error_msg`
        );
        
        // 获取各类型统计
        const [typeResult] = await connection.promise().query(
            `SELECT type, COUNT(*) as count FROM t_error_msg GROUP BY type ORDER BY type`
        );
        
        // 处理类型统计数据
        const typeStatistics = {};
        let warningCount = 0;
        let errorCount = 0;
        let otherTypesCount = 0;
        
        typeResult.forEach(row => {
            typeStatistics[row.type] = row.count;
            if (row.type === '1') {
                warningCount = row.count;
            } else if (row.type === '2') {
                errorCount = row.count;
            } else {
                otherTypesCount += row.count;
            }
        });
        
        // 获取类型名称映射
        const getTypeName = (type) => {
            switch (type) {
                case '1': return '告警';
                case '2': return '错误';
                default: return `类型${type}`;
            }
        };
        
        // 构建饼图数据
        const pieChartData = typeResult.map(row => ({
            name: getTypeName(row.type),
            value: row.count,
            type: row.type
        }));
        
        ctx.body = {
            success: true,
            data: {
                total: totalResult[0].total,
                warningCount: warningCount,
                errorCount: errorCount,
                otherTypesCount: otherTypesCount,
                typeStatistics: typeStatistics,
                pieChartData: pieChartData
            }
        };
        
    } catch (error) {
        ctx.status = 500;
        ctx.body = {
            success: false,
            error: error.message
        };
    }
});

module.exports = router;