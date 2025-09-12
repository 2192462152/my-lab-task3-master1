const mysql = require('mysql2')

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'ytb@2003',  // 改了下数据库账号密码
    database: '2025test'
});

connection.connect((err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
        return;
    }
    console.log('数据库连接成功!');
});

module.exports = {
    connection
} 