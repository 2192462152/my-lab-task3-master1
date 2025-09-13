const Router = require('@koa/router');
const multer = require('koa-multer');
const path = require('path');
const fs = require('fs');
const { connection } = require('../mysql');
const dayjs = require('dayjs')
const axios = require('axios')

const router = new Router();

let fileName = ''

// 配置文件存储规则（重点：定义图片保存路径和文件名）
const storage = multer.diskStorage({
    // 配置保存路径（不存在则自动创建）
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads'); // 图片保存到项目根目录的 uploads 文件夹
        // 检查文件夹是否存在，不存在则创建（recursive: true 支持嵌套目录）
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // 第一个参数是错误信息（null 表示无错），第二个是保存路径
    },

    // 配置文件名
    filename: (req, file, cb) => {
        const originalName = file.originalname; // 前端传来的原始文件名
        const uniqueFileName = `${originalName}_${dayjs().format('YYYYMMDDHHmmss')}`; // 最终保存的文件名
        fileName = uniqueFileName;
        cb(null, uniqueFileName);
    }
});

// 配置上传限制
const upload = multer({
    storage: storage, // 绑定上面的存储规则
});

// upload.single('file')：处理单文件上传，'file' 必须与前端 el-upload 的 name 属性一致
router.post('/uploadFile', upload.single('file'), async (ctx) => {
    try {
        // 检查是否获取到文件（ctx.file 是 multer 解析后的文件信息）
        const uploadedFile = ctx.req.file;
        if (!uploadedFile) {
            ctx.status = 400; // 状态码：400 表示请求参数错误
            ctx.body = {
                code: 400,
                message: '未获取到上传的文件，请检查前端配置'
            };
            return;
        }

        const uploadDir = path.join(__dirname, '../uploads');
        const filepath = path.join(uploadDir, fileName);

        const imageBuffer = fs.readFileSync(filepath);
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        await axios.post('http://localhost:3000/api/behaviorData/add', { d_no: '01', originalImage: base64Image, processedImage: base64Image, detectionCount: 10, results: JSON.stringify({ a: 1 }) })

        // 构造成功响应（返回文件信息给前端）
        ctx.status = 200; // 状态码：200 表示成功
        ctx.body = {
            code: 200,
            message: '图片上传成功',
            data: {
                originalName: uploadedFile.originalname, // 原始文件名（如 "cat.jpg"）
                savedName: uploadedFile.filename, // 服务器保存的文件名（如 "1699999999999-cat.jpg"）
                savedPath: uploadedFile.path, // 服务器保存的完整路径（如 "./uploads/1699999999999-cat.jpg"）
                fileSize: uploadedFile.size, // 文件大小（字节）
                fileType: uploadedFile.mimetype // 文件类型（如 "image/jpeg"）
            }
        };

    } catch (error) {
        console.error('文件上传失败：', error.message);
        ctx.status = 500;
        ctx.body = {
            code: 500,
            message: `上传失败：${error.message}`
        };
    }
});


module.exports = router;

