const Router = require('@koa/router');
const { connection } = require('../mysql')
const axios = require('axios');
const router = new Router();

// 实时检测设备的状态
router.post('/devicesRealtimeValue', async (ctx) => {
    try {
        // 获取阈值
        const sql1 = `
            SELECT 
                c.d_no, d.value, c.t_name, e.device_name,c.direct_name
            FROM 
                t_direct_config c 
            LEFT JOIN 
                t_direct d ON c.id = d.config_id 
            LEFT JOIN
                t_device e ON c.d_no = e.number
            WHERE 
                c.auto = 1 and
                c.d_no != 0
            ORDER BY 
                c.order asc
        `
        const [result1] = await connection.promise().query(sql1);

        // 获取t_data映射表
        const sql2 = `
            select 
                db_name 
            from 
                t_field_mapper
            where 
                p_name = 'SD'
        `
        const [result2] = await connection.promise().query(sql2);

        const field = result2[0].db_name || ''

        // 获取湿度
        const sql3 = `
            select 
                ${field}
            from 
                t_data
            where
                d_no = ?
            order by 
                c_time desc 
            limit 
                1
        `

        const promiseArray = result1.map(async item => {
            // 湿度
            const [result3] = await connection.promise().query(sql3, item.d_no);

            // 人数
            const personCount = await getCount(item.d_no)

            let SDValue = '0'
            if (result3 && result3.length > 0) {
                if (field in result3[0]) {
                    SDValue = result3[0][field];
                }
            }

            // 判断加湿器的状态
            let status = SDValue < item.value && personCount > 0

            global.mqttClient.publish('send', {
                scene: item.d_no,
                device: item.direct_name,
                action: status ? 'on' : 'off',
            }, () => {
                console.log(`send 主题发送成功！`)
            }, (err) => {
                console.error(`send 主题发送失败:`, err)
            })

            return {
                device_name: item.device_name,
                personCount,
                SD: SDValue,
                status
            }
        })

        const devicesRealtimeValue = await Promise.all(promiseArray)

        ctx.body = {
            code: 200,
            data: {
                devicesRealtimeValue
            },
            message: '操作成功'
        }

    } catch (err) {
        console.error('devicesRealtimeValue出现错误:', err)
    }
})

// 获取人数
const getCount = async (sceneId) => {
    try {
        // 获取所有设备的配置
        const sql1 = `select * from t_device`
        let [allDevices] = await connection.promise().query(sql1);

        const deviceItem = allDevices.find(item => sceneId == item.number)
        if (!deviceItem) {
            console.error(`场景${sceneId}没有对应的摄像头配置`);
            return 0;
        }

        if (deviceItem.isUse == 0) {
            console.warn(`场景${sceneId}的摄像头没有启用`);
            return 0;
        }

        // 调用camera.js的截图接口获取base64图片
        const captureResponse = await axios.post(`http://localhost:3000/api/camera/${deviceItem?.cameraAddress}/capture`);

        if (!captureResponse.data.success || !captureResponse.data.data.base64Image) {
            console.error(`场景${sceneId}截图失败`);
            return 0;
        }

        const base64Image = captureResponse.data.data.base64Image;

        // 发送给YOLO识别接口
        const inferResponse = await axios.post('http://localhost:5000/infer', {
            image: base64Image
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30秒超时
        });

        // 统计person标签的数量
        let personCount = 0;
        if (inferResponse.data && inferResponse.data.inference_results) {
            const results = inferResponse.data.inference_results;
            personCount = results.filter(result => result.label === 'person').length;
        }

        console.log(`${sceneId}号冰箱检测到${personCount}个人`);
        return personCount;

    } catch (error) {
        console.error(`获取${sceneId}号冰箱人数失败:`, error.message);
        return 0;
    }
}

module.exports = router;
