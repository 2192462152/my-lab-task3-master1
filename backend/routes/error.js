const Router = require('@koa/router');
const { connection } = require('../mysql')
const router = new Router();
const dayjs = require('dayjs')
const initMqttPromise = require('../utils/mqtt');

(async () => {
    try {
        await initMqttPromise
        // 订阅error主题，并处理其消息
        global.mqttClient.subscribe('error', async (message) => {
            try {
                const errorData = JSON.parse(message);
                const sql = `insert into t_error_msg(d_no, c_time, e_msg, type)
                             values (?, ?, ?, ?)`;
                const values = [
                    errorData.d_no || null,
                    errorData.time || dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    errorData.msg || '数据异常',
                    errorData.type || "2",
                ];
                await connection.promise().query(sql, values);
            } catch (err) {
                console.error('处理error主题数据发生错误:', err)
            }
        }, (err) => {
            console.error('error主题订阅失败:', err)
        })

    } catch (err) {
        console.error('error处的MQTT初始化发生错误:', err)
    }
})()

// 获取错误消息列表
router.get('/error-messages', async (ctx) => {
    const { page = 1, pageSize = 5, startTime, endTime, deviceId } = ctx.query;
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
        ctx.body = { error: error.message };
    }
});

// 简化：获取错误信息统计
router.get('/error-statistics', async (ctx) => {
    try {
        const { deviceId } = ctx.query
        // 获取总条数
        const [totalResult] = await connection.promise().query(
            `SELECT COUNT(*) as total FROM t_error_msg ${deviceId ? `where d_no = ${deviceId}` : ''}`
        );

        // 获取各类型统计
        const [typeResult] = await connection.promise().query(
            `SELECT type, COUNT(*) as count FROM t_error_msg ${deviceId ? `where d_no = ${deviceId}` : ''} GROUP BY type ORDER BY type`
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
                default: return `其它类型`;
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

module.exports = router