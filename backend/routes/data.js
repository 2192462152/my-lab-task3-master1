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
        ctx.body = { error: error.message };
    }
});

module.exports = router;