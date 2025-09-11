const Router = require('@koa/router');
const { connection } = require('../mysql')
const router = new Router();

// 获取指令列表
router.get('/config', async (ctx) => {
    try {
        const { deviceId, auto } = ctx.query
        const [configs] = await connection.promise().query(`
            SELECT
                c.*,
                d.value as direct_value,
                rd.value as ref_actual_value
            FROM t_direct_config c
                     LEFT JOIN t_direct d ON c.id = d.config_id
                     LEFT JOIN t_direct rd ON c.ref_id = rd.config_id
            WHERE
                c.auto = ${auto}
                ${deviceId ? `and c.d_no = ${deviceId}` : `and c.mode = 1`}
            ORDER BY c.\`order\`, c.id
        `);

        const processedConfigs = configs.map(config => {
            let shouldShow = config.ref_id === null;

            if (!shouldShow && config.ref_value) {
                if (config.ref_value.includes('&')) {
                    const validValues = config.ref_value.split('&');
                    shouldShow = validValues.includes(config.ref_actual_value);
                } else {
                    shouldShow = config.ref_value === config.ref_actual_value;
                }
            }

            if (config.f_type === '3') {
                config.direct_value = Number(config.direct_value)
            }

            return {
                ...config,
                visible: shouldShow
            };
        });

        ctx.body = {
            data: processedConfigs
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 跟新指令值
router.put('/direct/:id', async (ctx) => {
    const { id } = ctx.params;
    const { value, deviceId } = ctx.request.body;

    try {
        if (deviceId == '0') {
            const [ref_type] = await connection.promise().query(
                'select ref_type from t_direct where config_id = ?',
                [id]
            );

            await connection.promise().query(
                'update t_direct set value = ? where ref_type = ?',
                [value, ref_type[0].ref_type]
            );

        } else {
            await connection.promise().query(
                'update t_direct set value = ? where config_id = ?',
                [value, id]
            );
        }
        ctx.body = {
            message: '更新成功'
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 指令发送接口
router.post('/send-direct', async (ctx) => {
    const { topic, message } = ctx.request.body;

    if (!topic || !message) {
        ctx.status = 400;
        ctx.body = { error: '缺少 topic 或 message 参数' };
        return;
    }

    global.mqttClient.publish(topic, message, () => {
        console.log(`${topic} 主题发布成功！`)
    }, () => {
        console.log(`${topic} 主题发布失败！`)
    })

    ctx.body = { status: '指令已发送' };
});

module.exports = router;