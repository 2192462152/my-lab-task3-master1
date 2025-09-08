const Router = require('@koa/router');
const multer = require('@koa/multer');
const { connection } = require('../mysql')
const path = require('path');
const fs = require('fs');
const router = new Router();

// 确保AI检测图片目录存在
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// 创建AI检测图片存储目录
const aiImagesDir = path.join(__dirname, '../static/ai-detection');
ensureDirectoryExists(aiImagesDir);

// 用户行为数据(实时数据接口)
router.get('/behaviorData1', async (ctx) => {
    const { sceneId } = ctx.query;

    try {
        const [result] = await connection.promise().query('select f_name,db_name,unit from t_behavior_field_mapper');

        const header = result.map(row => row.f_name);
        const fields = result.map(field => field.db_name).join(',');
        const units = result.map(row => row.unit);

        let whereClause = '';
        const params = [];

        // 添加场景ID筛选条件
        if (sceneId) {
            whereClause = ' where d_no = ?';
            params.push(sceneId);
        }

        const [dataResult] = await connection.promise().query(`select d_no, ${fields ? `${fields},` : ``} c_time, is_saved from t_behavior_data${whereClause} order by c_time desc limit 1`, params);

        const newResult = dataResult.map(item => {
            const newObj = { d_no: item.d_no };
            const dbFields = fields.split(',');
            dbFields.forEach((dbField, index) => {
                newObj[header[index]] = item[dbField];
            });
            newObj['创建时间'] = new Date(new Date(item.c_time).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            newObj['is_saved'] = item['is_saved'];
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

// 历史数据接口
router.get('/behaviorData', async (ctx) => {
    const { startTime, endTime, sceneId, page = 1, pageSize = 5 } = ctx.query;
    const offset = (page - 1) * pageSize;

    try {
        const [result] = await connection.promise().query('select f_name,db_name,unit from t_behavior_field_mapper');

        const fields = result.map(item => item.db_name).join(',');
        const units = result.map(row => row.unit);
        const header = result.map(row => row.f_name);

        let whereClause = '';
        const params = [];

        // 添加筛选条件
        const conditions = [];

        // 时间筛选条件
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
        if (sceneId) {
            conditions.push('d_no = ?');
            params.push(sceneId);
        }

        if (conditions.length > 0) {
            whereClause = ' where ' + conditions.join(' and ');
        }

        // 查询总记录数
        const countSql = `SELECT COUNT(*) as total FROM t_behavior_data ${whereClause}`;

        const [countResult] = await connection.promise().query(countSql, params);
        const total = countResult[0].total;

        // 查询分页数据
        let sql = `select ${fields ? `${fields},` : ``} DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') as c_time, d_no, is_saved, id 
        from t_behavior_data ${whereClause} 
        order by DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') desc 
        limit ? offset ?`;
        const queryParams = [...params, parseInt(pageSize), offset];

        const [dataResult] = await connection.promise().query(sql, queryParams);

        const newResult = dataResult.map(item => {
            const newObj = {
                id: item.id,
                d_no: item.d_no,
                is_saved: item.is_saved,
            };
            Object.keys(item).forEach((key, index) => {
                if (key !== 'c_time' && key !== 'd_no' && key !== 'is_saved' && key !== 'id') {
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

// 添加AI检测结果到行为数据表
router.post('/behaviorData/add', async (ctx) => {
    const { d_no, originalImage, processedImage, detectionCount, results } = ctx.request.body;
    const c_time = new Date(new Date().getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    try {
        // 生成唯一文件名
        const timestamp = Date.now();
        const originalImageName = `original_${timestamp}_${d_no}.jpg`;
        const processedImageName = `processed_${timestamp}_${d_no}.jpg`;

        // 保存原始图像
        let originalImagePath = '';
        if (originalImage) {
            const originalImageBuffer = Buffer.from(originalImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const originalImageFullPath = path.join(aiImagesDir, originalImageName);
            fs.writeFileSync(originalImageFullPath, originalImageBuffer);
            originalImagePath = `static/ai-detection/${originalImageName}`;
        }

        // 保存处理后图像
        let processedImagePath = '';
        if (processedImage) {
            const processedImageBuffer = Buffer.from(processedImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const processedImageFullPath = path.join(aiImagesDir, processedImageName);
            fs.writeFileSync(processedImageFullPath, processedImageBuffer);
            processedImagePath = `static/ai-detection/${processedImageName}`;
        }

        // 插入数据到t_behavior_data表（存储文件路径而不是base64数据）
        const [insertResult] = await connection.promise().query(
            'INSERT INTO t_behavior_data (d_no, field1, field2, field3, field4, c_time) VALUES (?, ?, ?, ?, ?, ?)',
            [d_no, originalImagePath, processedImagePath, detectionCount, JSON.stringify(results), c_time]
        );

        ctx.body = {
            success: true,
            id: insertResult.insertId,
            message: 'AI检测结果保存成功',
            data: {
                originalImagePath,
                processedImagePath
            }
        };
    } catch (error) {
        console.error('保存AI检测结果失败:', error);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 删除行为数据记录
router.delete('/behaviorData/:id', async (ctx) => {
    const { id } = ctx.params;

    try {
        // 先获取记录信息，以便删除对应的图片文件
        const [rows] = await connection.promise().query('SELECT field1, field2 FROM t_behavior_data WHERE id = ?', [id]);

        if (rows.length > 0) {
            const record = rows[0];

            // 删除原始图片文件
            if (record.field1) {
                const originalImagePath = path.join(__dirname, '..', record.field1);
                if (fs.existsSync(originalImagePath)) {
                    fs.unlinkSync(originalImagePath);
                }
            }

            // 删除处理后图片文件
            if (record.field2) {
                const processedImagePath = path.join(__dirname, '..', record.field2);
                if (fs.existsSync(processedImagePath)) {
                    fs.unlinkSync(processedImagePath);
                }
            }
        }

        // 删除数据库记录
        await connection.promise().query('DELETE FROM t_behavior_data WHERE id = ?', [id]);

        ctx.body = {
            success: true,
            message: '删除成功'
        };
    } catch (error) {
        console.error('删除AI检测记录失败:', error);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 获取所有场景ID列表
router.get('/sceneIds', async (ctx) => {
    try {
        const [result] = await connection.promise().query('SELECT * FROM t_device');

        ctx.body = {
            data: result
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

module.exports = router;

// // 确保目录存在
// const ensureDirectoryExists = (dirPath) => {
//     if (!fs.existsSync(dirPath)) {
//         fs.mkdirSync(dirPath, { recursive: true });
//     }
// };

// // 创建static目录和子目录
// const staticDir = path.join(__dirname, '../static');
// const imagesDir = path.join(staticDir, 'images');
// const videosDir = path.join(staticDir, 'videos');

// ensureDirectoryExists(staticDir);
// ensureDirectoryExists(imagesDir);
// ensureDirectoryExists(videosDir);

// // 配置multer存储
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         // 根据文件类型决定存储目录
//         if (file.mimetype.startsWith('image/')) {
//             cb(null, imagesDir);
//         } else if (file.mimetype.startsWith('video/')) {
//             cb(null, videosDir);
//         } else {
//             cb(new Error('不支持的文件类型'), null);
//         }
//     },
//     filename: function (req, file, cb) {
//         // 生成唯一文件名：时间戳 + 原始文件名
//         const timestamp = Date.now();
//         const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
//         const ext = path.extname(originalName);
//         const nameWithoutExt = path.basename(originalName, ext);
//         cb(null, `${timestamp}_${nameWithoutExt}${ext}`);
//     }
// });

// const upload = multer({ 
//     storage: storage,
//     fileFilter: function (req, file, cb) {
//         // 检查文件类型
//         if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
//             cb(null, true);
//         } else {
//             cb(new Error('只支持图片和视频文件'), false);
//         }
//     },
//     limits: {
//         fileSize: 100 * 1024 * 1024 // 100MB限制
//     }
// });

// 文件上传接口
// router.post('/uploadFile', upload.single('file'), async (ctx) => {
//     try {
//         const { sceneId, fileType, time } = ctx.request.body;
//         const file = ctx.request.file;

//         if (!file) {
//             ctx.status = 400;
//             ctx.body = { error: '没有上传文件' };
//             return;
//         }

//         if (!sceneId) {
//             ctx.status = 400;
//             ctx.body = { error: '场景编号不能为空' };
//             return;
//         }

//         // 确定文件类型 (0: 图片, 1: 视频)
//         let fileTypeValue;
//         if (file.mimetype.startsWith('image/')) {
//             fileTypeValue = '0';
//         } else if (file.mimetype.startsWith('video/')) {
//             fileTypeValue = '1';
//         } else {
//             ctx.status = 400;
//             ctx.body = { error: '不支持的文件类型' };
//             return;
//         }

//         // 如果传递了fileType，使用传递值，否则使用自动检测的值
//         const finalFileType = fileType || fileTypeValue;

//         // 构建相对路径
//         const relativePath = file.mimetype.startsWith('image/') 
//             ? `static/images/${file.filename}`
//             : `static/videos/${file.filename}`;

//         // 使用传入的时间或当前时间
//         const createTime = time ? new Date(time) : new Date();

//         // 插入数据到t_behavior_data表
//         const insertSql = `
//             INSERT INTO t_behavior_data (d_no, field1, field2, c_time) 
//             VALUES (?, ?, ?, ?)
//         `;
        
//         await connection.promise().query(insertSql, [
//             sceneId,
//             relativePath,
//             finalFileType,
//             createTime
//         ]);

//         ctx.body = {
//             success: true,
//             message: '文件上传成功',
//             data: {
//                 sceneId: sceneId,
//                 filePath: relativePath,
//                 fileType: finalFileType,
//                 fileName: file.filename,
//                 originalName: file.originalname,
//                 size: file.size,
//                 createTime: createTime
//             }
//         };

//     } catch (error) {
//         console.error('文件上传错误:', error);
//         ctx.status = 500;
//         ctx.body = { error: error.message };
//     }
// });

// 用户行为数据(实时数据接口)
router.get('/behaviorData1', async (ctx) => {
    const { sceneId } = ctx.query;
    
    try {
        const [result] = await connection.promise().query('select f_name,db_name,unit from t_behavior_field_mapper');

        const header = result.map(row => row.f_name);
        const fields = result.map(field => field.db_name).join(',');
        const units = result.map(row => row.unit);

        let whereClause = '';
        const params = [];

        // 添加场景ID筛选条件
        if (sceneId) {
            whereClause = ' where d_no = ?';
            params.push(sceneId);
        }

        const [dataResult] = await connection.promise().query(`select d_no, ${fields}, c_time, is_saved from t_behavior_data${whereClause} order by c_time desc limit 1`, params);

        const newResult = dataResult.map(item => {
            const newObj = { d_no: item.d_no };
            const dbFields = fields.split(',');
            dbFields.forEach((dbField, index) => {
                newObj[header[index]] = item[dbField];
            });
            newObj['创建时间'] = new Date(new Date(item.c_time).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            newObj['is_saved'] = item['is_saved'];
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

// 历史数据接口
router.get('/behaviorData', async (ctx) => {
    const { startTime, endTime, sceneId, page = 1, pageSize = 5 } = ctx.query;
    const offset = (page - 1) * pageSize;

    try {
        const [result] = await connection.promise().query('select f_name,db_name,unit from t_behavior_field_mapper');

        const fields = result.map(item => item.db_name).join(',');
        const units = result.map(row => row.unit);
        const header = result.map(row => row.f_name);

        let whereClause = '';
        const params = [];

        // 添加筛选条件
        const conditions = [];
        
        // 时间筛选条件
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
        if (sceneId) {
            conditions.push('d_no = ?');
            params.push(sceneId);
        }

        if (conditions.length > 0) {
            whereClause = ' where ' + conditions.join(' and ');
        }

        // 查询总记录数
        const countSql = `SELECT COUNT(*) as total FROM t_behavior_data ${whereClause}`;

        const [countResult] = await connection.promise().query(countSql, params);
        const total = countResult[0].total;

        // 查询分页数据
        let sql = `select ${fields}, DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') as c_time, d_no, is_saved, id 
        from t_behavior_data ${whereClause} 
        order by DATE_FORMAT(c_time, '%Y-%m-%d %H:%i:%s') desc 
        limit ? offset ?`;
        const queryParams = [...params, parseInt(pageSize), offset];

        const [dataResult] = await connection.promise().query(sql, queryParams);

        const newResult = dataResult.map(item => {
            const newObj = {
                id: item.id,
                d_no: item.d_no,
                is_saved: item.is_saved,
            };
            Object.keys(item).forEach((key, index) => {
                if (key !== 'c_time' && key !== 'd_no' && key !== 'is_saved' && key !== 'id') {
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

// 添加AI检测结果到行为数据表
router.post('/behaviorData/add', async (ctx) => {
    const { d_no, originalImage, processedImage, detectionCount, results } = ctx.request.body;
    const c_time = new Date(new Date().getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    try {
        // 生成唯一文件名
        const timestamp = Date.now();
        const originalImageName = `original_${timestamp}_${d_no}.jpg`;
        const processedImageName = `processed_${timestamp}_${d_no}.jpg`;
        
        // 保存原始图像
        let originalImagePath = '';
        if (originalImage) {
            const originalImageBuffer = Buffer.from(originalImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const originalImageFullPath = path.join(aiImagesDir, originalImageName);
            fs.writeFileSync(originalImageFullPath, originalImageBuffer);
            originalImagePath = `static/ai-detection/${originalImageName}`;
        }
        
        // 保存处理后图像
        let processedImagePath = '';
        if (processedImage) {
            const processedImageBuffer = Buffer.from(processedImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const processedImageFullPath = path.join(aiImagesDir, processedImageName);
            fs.writeFileSync(processedImageFullPath, processedImageBuffer);
            processedImagePath = `static/ai-detection/${processedImageName}`;
        }
        
        // 插入数据到t_behavior_data表（存储文件路径而不是base64数据）
        const [insertResult] = await connection.promise().query(
            'INSERT INTO t_behavior_data (d_no, field1, field2, field3, field4, c_time) VALUES (?, ?, ?, ?, ?, ?)',
            [d_no, originalImagePath, processedImagePath, detectionCount, JSON.stringify(results), c_time]
        );
        
        ctx.body = {
            success: true,
            id: insertResult.insertId,
            message: 'AI检测结果保存成功',
            data: {
                originalImagePath,
                processedImagePath
            }
        };
    } catch (error) {
        console.error('保存AI检测结果失败:', error);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 删除行为数据记录
router.delete('/behaviorData/:id', async (ctx) => {
    const { id } = ctx.params;
    
    try {
        // 先获取记录信息，以便删除对应的图片文件
        const [rows] = await connection.promise().query('SELECT field1, field2 FROM t_behavior_data WHERE id = ?', [id]);
        
        if (rows.length > 0) {
            const record = rows[0];
            
            // 删除原始图片文件
            if (record.field1) {
                const originalImagePath = path.join(__dirname, '..', record.field1);
                if (fs.existsSync(originalImagePath)) {
                    fs.unlinkSync(originalImagePath);
                }
            }
            
            // 删除处理后图片文件
            if (record.field2) {
                const processedImagePath = path.join(__dirname, '..', record.field2);
                if (fs.existsSync(processedImagePath)) {
                    fs.unlinkSync(processedImagePath);
                }
            }
        }
        
        // 删除数据库记录
        await connection.promise().query('DELETE FROM t_behavior_data WHERE id = ?', [id]);
        
        ctx.body = {
            success: true,
            message: '删除成功'
        };
    } catch (error) {
        console.error('删除AI检测记录失败:', error);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

// 获取所有场景ID列表
router.get('/sceneIds', async (ctx) => {
    try {
        const [result] = await connection.promise().query('SELECT * FROM t_device');
        
        ctx.body = {
            data: result
        };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});

module.exports = router;
