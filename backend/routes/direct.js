const Router = require('@koa/router');
const { connection } = require('../mysql')
const router = new Router();

router.get('/config', async (ctx) => {
    try {
        const [configs] = await connection.promise().query(`
            SELECT
                c.*,
                d.value as direct_value,
                rd.value as ref_actual_value
            FROM t_direct_config c
                     LEFT JOIN t_direct d ON c.id = d.config_id
                     LEFT JOIN t_direct rd ON c.ref_id = rd.config_id
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

router.put('/direct/:id', async (ctx) => {
    const { id } = ctx.params;
    const { value } = ctx.request.body;

    try {
        await connection.promise().query(
            'update t_direct set value = ? where config_id = ?',
            [value, id]
        );
        ctx.body = {
            message: '更新成功'
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

module.exports = router;