const Router = require('@koa/router');
const mysql = require('mysql2');
const router = new Router();

// 创建数据库连接
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '520199',
    database: 'test7'
});

// 记录操作日志
router.post('/operation-log', async (ctx) => {
    const {
        operation_type,
        target_name,
        old_value,
        new_value,
        status = 1
    } = ctx.request.body;

    try {
        const operation_time = new Date(new Date().getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        
        const [result] = await connection.promise().query(
            `INSERT INTO t_operation_log 
            (operation_type, target_name, old_value, new_value, operation_time, status) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [operation_type, target_name, old_value, new_value, operation_time, status]
        );

        ctx.body = {
            success: true,
            message: '操作日志记录成功',
            id: result.insertId
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 获取操作日志列表
router.get('/operation-logs', async (ctx) => {
    const { page = 1, pageSize = 10, startTime, endTime, operationType, targetName } = ctx.query;
    const offset = (page - 1) * pageSize;

    let countQuery = 'SELECT COUNT(*) as total FROM t_operation_log';
    let dataQuery = 'SELECT * FROM t_operation_log';
    const countParams = [];
    const dataParams = [];

    // 构建筛选条件
    const conditions = [];

    if (startTime && endTime) {
        conditions.push('operation_time BETWEEN ? AND ?');
        countParams.push(startTime, endTime);
        dataParams.push(startTime, endTime);
    } else if (startTime) {
        conditions.push('operation_time >= ?');
        countParams.push(startTime);
        dataParams.push(startTime);
    } else if (endTime) {
        conditions.push('operation_time <= ?');
        countParams.push(endTime);
        dataParams.push(endTime);
    }

    if (operationType) {
        conditions.push('operation_type = ?');
        countParams.push(operationType);
        dataParams.push(operationType);
    }

    if (targetName) {
        conditions.push('target_name LIKE ?');
        countParams.push(`%${targetName}%`);
        dataParams.push(`%${targetName}%`);
    }

    if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        countQuery += whereClause;
        dataQuery += whereClause;
    }

    dataQuery += ' ORDER BY operation_time DESC LIMIT ? OFFSET ?';
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
        ctx.body = { error: error.message };
    }
});

// 清空操作日志
router.delete('/operation-logs', async (ctx) => {
    try {
        await connection.promise().query('DELETE FROM t_operation_log');
        ctx.body = { message: '清空成功' };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

module.exports = router;