const Router = require('@koa/router');
const { connection } = require('../mysql')
const router = new Router();


router.get('/data1', async (ctx) => {
    const { deviceId } = ctx.query;

    try {
        const [result] = await connection.promise().query('select f_name,db_name,unit from t_field_mapper');
        
        const header = result.map(row => row.f_name);
        const fields = result.map(field => field.db_name).join(',');
        const units = result.map(row => row.unit);

        let whereClause = '';
        const params = [];

        if (deviceId) {
            whereClause = ' where d_no = ?';
            params.push(deviceId);
        }

        const [dataResult] = await connection.promise().query(`select d_no, ${fields ? `${fields},` : ``} c_time, data_type from t_data${whereClause} order by c_time desc limit 1`, params);

        const newResult = dataResult.map(item => {
            const newObj = { d_no: item.d_no };
            const dbFields = fields.split(',');
            dbFields.forEach((dbField, index) => {
                newObj[header[index]] = item[dbField];
            });
            newObj['创建时间'] = new Date(new Date(item.c_time).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            newObj['data_type'] = item['data_type'];
            return newObj;
        });
        ctx.body = {
            header,
            units,
            data: newResult,
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

router.get('/data2', async (ctx) => {
    const { startTime, endTime, deviceId, page = 1, pageSize = 5 } = ctx.query;
    const offset = (page - 1) * pageSize;

    try {
        const [result] = await connection.promise().query('select f_name,db_name,unit from t_field_mapper');

        const fields = result.map(item => item.db_name).join(',');
        const units = result.map(row => row.unit);
        const header = result.map(row => row.f_name);

        let whereClause = '';
        const params = [];

        // 添加筛选条件
        const conditions = [];

        // 添加时间筛选条件
        if (startTime && endTime) {
            conditions.push('c_time between ? and ?');
            params.push(startTime, endTime);
        } else if (startTime) {
            conditions.push('c_time >= ?');
            params.push(startTime);
        } else if (endTime) {
            conditions.push('c_time <= ?');
            params.push(endTime);
        }

        // 场景ID筛选条件
        if (deviceId) {
            conditions.push('d_no = ?');
            params.push(deviceId);
        }

        if (conditions.length > 0) {
            whereClause = ' where ' + conditions.join(' and '); 
        }

        // 首先查询总记录数
        const countSql = `SELECT COUNT(*) as total FROM t_data ${whereClause}`;
        const [countResult] = await connection.promise().query(countSql, params);
        const total = countResult[0].total;

        // 然后查询分页数据
        let sql = `select ${fields ? `${fields},` : ``} DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') as c_time, d_no, data_type from t_data ${whereClause} order by DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') desc limit ? offset ?`;
        const queryParams = [...params, parseInt(pageSize), offset];

        const [dataResult] = await connection.promise().query(sql, queryParams);

        const newResult = dataResult.map(item => {
            const newObj = {
                d_no: item.d_no,
                data_type: item.data_type
            };
            Object.keys(item).forEach((key, index) => {
                if (key !== 'c_time' && key !== 'd_no' && key !== 'data_type') {
                    newObj[header[index]] = item[key];
                }
            });
            newObj['c_time'] = item['c_time'];
            return newObj;
        });
        
        ctx.body = {
            header,
            units,
            data: newResult,
            total: total
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = {error: error.message};
    }
});

// 获取功率数据接口
router.get('/power-data', async (ctx) => {
    const { deviceId, limit = 20 } = ctx.query;
    
    try {
        // 获取电流和电压字段映射
        const [fieldResult] = await connection.promise().query(
            "select f_name, db_name from t_field_mapper where f_name in ('电流', '电压')"
        );
        
        if (fieldResult.length < 2) {
            ctx.status = 400;
            ctx.body = { error: '缺少电流或电压字段配置' };
            return;
        }
        
        const currentField = fieldResult.find(f => f.f_name === '电流')?.db_name;
        const voltageField = fieldResult.find(f => f.f_name === '电压')?.db_name;
        
        if (!currentField || !voltageField) {
            ctx.status = 400;
            ctx.body = { error: '电流或电压字段配置不完整' };
            return;
        }
        
        let whereClause = '';
        const params = [];
        
        if (deviceId) {
            whereClause = ' where d_no = ?';
            params.push(deviceId);
        }
        
        // 查询数据并计算功率
        const sql = `
            select 
                d_no,
                ${currentField} as current_value,
                ${voltageField} as voltage_value,
                (${currentField} * ${voltageField}) as power,
                DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') as c_time
            from t_data 
            ${whereClause}
            order by c_time desc 
            limit ?
        `;
        
        const queryParams = [...params, parseInt(limit)];
        const [dataResult] = await connection.promise().query(sql, queryParams);
        
        // 按时间正序排列（图表显示需要）
        const sortedData = dataResult.reverse();
        
        ctx.body = {
            data: sortedData,
            total: sortedData.length
        };
        
    } catch (error) {
        console.error('获取功率数据失败:', error);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 获取三个冰箱的功率对比数据接口
router.get('/power-comparison', async (ctx) => {
    const { limit = 50 } = ctx.query;
    
    try {
        // 获取电流和电压字段映射
        const [fieldResult] = await connection.promise().query(
            "select f_name, db_name from t_field_mapper where f_name in ('电流', '电压')"
        );
        
        if (fieldResult.length < 2) {
            ctx.status = 400;
            ctx.body = { error: '缺少电流或电压字段配置' };
            return;
        }
        
        const currentField = fieldResult.find(f => f.f_name === '电流')?.db_name;
        const voltageField = fieldResult.find(f => f.f_name === '电压')?.db_name;
        
        if (!currentField || !voltageField) {
            ctx.status = 400;
            ctx.body = { error: '电流或电压字段配置不完整' };
            return;
        }
        
        // 查询三个冰箱的功率数据
        const sql = `
            select 
                d_no,
                ${currentField} as current_value,
                ${voltageField} as voltage_value,
                (${currentField} * ${voltageField}) as power,
                DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') as c_time
            from t_data 
            where d_no in ('01', '02', '03')
            order by c_time desc 
            limit ?
        `;
        
        const [dataResult] = await connection.promise().query(sql, [parseInt(limit)]);
        
        // 按冰箱分组数据
        const fridgeData = {
            '01': [],
            '02': [],
            '03': []
        };
        
        dataResult.forEach(item => {
            if (fridgeData[item.d_no]) {
                fridgeData[item.d_no].push(item);
            }
        });
        
        // 计算每个冰箱的统计信息
        const statistics = {};
        Object.keys(fridgeData).forEach(fridgeId => {
            const data = fridgeData[fridgeId];
            if (data.length > 0) {
                const powers = data.map(item => item.power);
                statistics[fridgeId] = {
                    maxPower: parseFloat(Math.max(...powers).toFixed(3)),
                    minPower: parseFloat(Math.min(...powers).toFixed(3)),
                    avgPower: parseFloat((powers.reduce((sum, power) => sum + power, 0) / powers.length).toFixed(3))
                };
            } else {
                statistics[fridgeId] = {
                    maxPower: 0,
                    minPower: 0,
                    avgPower: 0
                };
            }
        });
        
        // 找出平均功率最低和最高的冰箱
        const avgPowers = Object.entries(statistics)
            .filter(([fridgeId, stats]) => stats.avgPower > 0)
            .map(([fridgeId, stats]) => ({ fridgeId, avgPower: stats.avgPower }));
        
        let lowestAvgPowerFridge = null;
        let highestAvgPowerFridge = null;
        
        if (avgPowers.length > 0) {
            lowestAvgPowerFridge = avgPowers.reduce((lowest, current) => 
                current.avgPower < lowest.avgPower ? current : lowest
            );
            highestAvgPowerFridge = avgPowers.reduce((highest, current) => 
                current.avgPower > highest.avgPower ? current : highest
            );
        }
        
        // 按时间正序排列（图表显示需要）
        Object.keys(fridgeData).forEach(fridgeId => {
            fridgeData[fridgeId] = fridgeData[fridgeId].reverse();
        });
        
        ctx.body = {
            data: fridgeData,
            statistics: statistics,
            lowestAvgPowerFridge: lowestAvgPowerFridge,
            highestAvgPowerFridge: highestAvgPowerFridge,
            total: dataResult.length
        };
        
    } catch (error) {
        console.error('获取功率对比数据失败:', error);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

module.exports = router;