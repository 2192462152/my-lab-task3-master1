<template>
  <view class="data-container">
    <!-- 设备选择器 -->
    <view class="device-selector">
      <view class="selector-label">选择场景：</view>
      <picker 
        mode="selector"
        :range="deviceList" 
        :value="currentIndex"
        range-key="device_name"
        @change="onDeviceChange"
        class="device-picker"
      >
        <view class="picker-value">
          <text>{{ currentIndex === -1 ? '请选择场景' : deviceList[currentIndex]?.device_name }}</text>
          <text class="picker-arrow">▼</text>
        </view>
      </picker>
    </view>

    <!-- 传感器数据卡片 -->
    <view class="data-card">
      <view class="card-header">
        <text class="title">传感器数据</text>
        <text class="time">{{ sensorData.time || '暂无数据' }}</text>
      </view>
      <view class="data-grid">
        <view v-for="(value, key, index) in sensorValues" :key="index" class="data-item">
          <text class="label">{{ key }}({{ sensorUnits[index] }})</text>
          <text class="value">{{ value }}</text>
        </view>
      </view>
    </view>

    <!-- 图表控制区域 -->
    <view class="chart-control">
      <view class="chart-type-selector">
        <text class="label">图表类型：</text>
        <view class="button-group">
          <button 
            :class="['type-btn', chartType === 'line' ? 'active' : '']"
            @click="changeChartType('line')"
          >曲线图</button>
          <button 
            :class="['type-btn', chartType === 'column' ? 'active' : '']"
            @click="changeChartType('column')"
          >柱状图</button>
        </view>
      </view>
    </view>

    <!-- 数据图表 -->
    <view class="chart-card">
      <view class="charts-box">
        <canvas 
          canvas-id="dataChart"
          id="dataChart"
          class="charts"
          @touchstart="tap"
        ></canvas>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import uCharts from '/uni_modules/qiun-data-charts/js_sdk/u-charts/u-charts.js';
import { onUnload } from '@dcloudio/uni-app';
import config from '@/utils/config.js'

// WebSocket连接
let ws = null;

// 轮询定时器
let pollingTimer = null
const pollingInterval = 3000 

let chart = null;
const chartType = ref('line');

// 传感器数据状态定义
const sensorData = ref({});
const sensorValues = ref({});
const sensorUnits = ref([]);

// 设备列表相关
const deviceList = ref([]);
const currentIndex = ref(-1);
const selectedDeviceId = ref(null);

// 图表点击事件
const tap = (e) => {
  chart.touchLegend(e);
  chart.showToolTip(e);
};

// 初始化WebSocket连接
const initWebSocket = () => {
  try {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      console.log('WebSocket连接已建立')
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('收到消息:', message);

        if (message.type === 'sensorDataUpdate') {
          console.log('传感器数据更新')
          fetchSensorData();
          fetchChartData();
        }
      } catch (error) {
        console.error('处理WebSocket消息失败:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket连接已关闭')
    };

    ws.onerror = (error) => {
      console.error('WebSocket连接错误:', error);
    };
  } catch (error) {
    console.error('初始化WebSocket连接失败:', error);
  }
};

// 初始化图表
const initChart = (categories, series) => {
  chart = new uCharts({
    type: chartType.value,
    context: uni.createCanvasContext('dataChart'),
    width: uni.upx2px(700),
    height: 300,
    categories,
    series,
    animation: true,
    background: '#FFFFFF',
    padding: [15, 15, 0, 15],
    legend: {
      show: true,
      position: 'top',
      float: 'center',
    },
    xAxis: {
      disableGrid: true,
      scrollShow: true,
      itemCount: 5,
      rotateLabel: true,
    },
    yAxis: {
      gridType: 'dash',
      splitNumber: 5,
      min: 0,
      max: 200,
      data: [{
        min: 0,
        max: 200,
        title: '数值',
        titleFontSize: 12,
      }],
      calibration: true,
      disabled: false,
      disableGrid: false,
    },
    extra: {
      line: {
        type: 'curve',
        width: 2,
      },
      column: {
        width: 20,
        activeBgColor: '#000000',
        activeBgOpacity: 0.1
      }
    }
  });
};

// 获取设备列表
const fetchDeviceList = async () => {
  try {
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/allDevices',
      method: 'GET'
    });

    if (result.statusCode === 200 && result.data.data) {
      deviceList.value = result.data.data;
    }
  } catch (error) {
    console.error('获取设备列表失败:', error);
    deviceList.value = [];
  }
};

// 设备选择改变事件
const onDeviceChange = (e) => {
  currentIndex.value = Number(e.detail.value);
  const selectedDevice = deviceList.value[currentIndex.value];
  if (selectedDevice) {
    selectedDeviceId.value = selectedDevice.number;
    console.log('选中设备ID:', selectedDeviceId.value);
    fetchSensorData();
  }
};

// 获取传感器数据
const fetchSensorData = async () => {
  try {
    const params = {};
    if (selectedDeviceId.value) {
      params.deviceId = selectedDeviceId.value;
    }
    
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/data1',
      method: 'GET',
      data: params
    });

    if (result.statusCode === 200) {
      const { header, units, data } = result.data;
      sensorUnits.value = units;
      
      if (data && data.length > 0) {
        const latestData = data[0];
        sensorValues.value = {};
        sensorData.value = {
          d_no: latestData.d_no,
          time: latestData['创建时间'],
          data_type: latestData.data_type
        };
        header.forEach((key, index) => {
          if (key !== '创建时间' && key !== '设备ID') {
            sensorValues.value[key] = latestData[key];
          }
        });
      }
    }
  } catch (error) {
    console.error('获取传感器数据失败:', error);
  }
};

// 获取图表数据
const fetchChartData = async () => {
  try {
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/data2',
      method: 'GET'
    });

    if (result.statusCode === 200) {
      const { data } = result.data;
      const sortedData = [...data].reverse();
      const categories = sortedData.map(item => item.c_time);
      const series = [
        {
          name: '烟雾浓度',
          data: sortedData.map(item => item['烟雾浓度']),
          color: '#1890FF'
        },
        {
          name: '空气温度',
          data: sortedData.map(item => item['空气温度']),
          color: '#91CB74'
        },
        {
          name: '水位',
          data: sortedData.map(item => item['水位']),
          color: '#FAC858'
        },
      ];

      initChart(categories, series);
    }
  } catch (error) {
    console.error('获取图表数据失败:', error);
  }
};

// 切换图表类型
const changeChartType = (type) => {
  chartType.value = type;
  fetchChartData();
};

// 开始轮询
const startPolling = () => {
  stopPolling()
  
  pollingTimer = setInterval(() => {
    fetchSensorData();
    fetchChartData();
  }, pollingInterval)
}

// 停止轮询
const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

onMounted(() => {
  // 初始化WebSocket连接
  // initWebSocket();
  
  fetchDeviceList();
  fetchSensorData();
  fetchChartData();
  
  startPolling()
});

onUnload(() => {
  if (ws) {
    ws.close();
    ws = null;
  }
  stopPolling()
})
</script>

<style lang="scss">
/* 状态标签基础样式 */
.status-tag, .saved-tag {
  padding: 2px 8px; /* 内边距设置 */
  border-radius: 4px; /* 圆角设置 */
  font-size: 12px; /* 文字大小 */
  margin-left: 10px; /* 左侧外边距 */
}
/* 传感器数据状态 - 激活样式 */
.sensor-active {
  background-color: #e8f5e9; /* 浅绿色背景 */
  color: #2e7d32; /* 深绿色文字 */
}
/* 用户行为数据状态 - 激活样式 */
.saved-active {
  background-color: #e3f2fd; /* 浅蓝色背景 */
  color: #2e7d32; /* 深绿色文字 */
}

/* 图表卡片样式 */
.chart-card {
  /* 图表容器样式 */
  .charts-box {
    width: 100%; /* 宽度100% */
    height: 300px; /* 固定高度 */
    
    /* 图表样式 */
    .charts {
      width: 100%; /* 宽度100% */
      height: 300px; /* 固定高度 */
    }
  }
}

/* 数据容器样式 */
.data-container { 
  padding: 20rpx; /* 内边距 */
  background: #f5f6fa; /* 背景色 */
  min-height: 100vh; /* 最小高度占满整个视窗 */
  /* 错误信息列表样式 */
  .error-list {
    /* 列表头部样式 */
    .list-header {
      padding: 20rpx; /* 内边距 */
      /* 标题样式 */
      .title {
        font-size: 32rpx; /* 文字大小 */
        color: #333; /* 文字颜色 */
        font-weight: bold; /* 粗体 */
      }
    }
  
    /* 错误项样式 */
    .error-item {
      background: #fff; /* 白色背景 */
      border-radius: 16rpx; /* 圆角设置 */
      padding: 20rpx; /* 内边距 */
      margin: 0 20rpx 20rpx; /* 上右下左外边距 */
      box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05); /* 阴影效果 */
  
      /* 项目头部样式 */
      .item-header {
        display: flex; /* 弹性布局 */
        justify-content: space-between; /* 两端对齐 */
        align-items: center; /* 垂直居中对齐 */
        padding-bottom: 20rpx; /* 底部内边距 */
        border-bottom: 1px solid #eee; /* 底部边框 */
  
        /* 设备信息样式 */
        .device-info {
          display: flex; /* 弹性布局 */
          align-items: center; /* 垂直居中对齐 */
          gap: 10rpx; /* 间隙 */
  
          /* 标签样式 */
          .label {
            font-size: 28rpx; /* 文字大小 */
            color: #666; /* 文字颜色 */
          }
  
          /* 值样式 */
          .value {
            font-size: 28rpx; /* 文字大小 */
            color: #333; /* 文字颜色 */
            font-weight: bold; /* 粗体 */
          }
  
          /* 消息标签样式 */
          .message-tag {
            padding: 4rpx 12rpx; /* 内边距 */
            border-radius: 6rpx; /* 圆角设置 */
            font-size: 24rpx; /* 文字大小 */
            
            /* 警告样式 */
            &.warning {
              background-color: #fffbe6; /* 浅黄色背景 */
              color: #faad14; /* 黄色文字 */
            }
            
            /* 错误样式 */
            &.error {
              background-color: #fff2f0; /* 浅红色背景 */
              color: #ff4d4f; /* 红色文字 */
            }
          }
        }
  
        /* 时间信息样式 */
        .time-info {
          /* 时间样式 */
          .time {
            font-size: 26rpx; /* 文字大小 */
            color: #999; /* 文字颜色 */
          }
        }
      }
  
      /* 项目内容样式 */
      .item-content {
        padding-top: 20rpx; /* 顶部内边距 */
  
        /* 信息行样式 */
        .info-row {
          margin-bottom: 16rpx; /* 底部外边距 */
  
          /* 最后一行取消底部外边距 */
          &:last-child {
            margin-bottom: 0;
          }
        }
  
        /* 错误编号和错误消息样式 */
        .error-number,
        .error-message {
          display: flex; /* 弹性布局 */
          align-items: flex-start; /* 顶部对齐 */
  
          /* 标签样式 */
          .label {
            font-size: 28rpx; /* 文字大小 */
            color: #666; /* 文字颜色 */
            margin-right: 10rpx; /* 右侧外边距 */
            white-space: nowrap; /* 不换行 */
          }
  
          /* 值样式 */
          .value {
            font-size: 28rpx; /* 文字大小 */
            color: #333; /* 文字颜色 */
            flex: 1; /* 弹性增长系数 */
            word-break: break-all; /* 词内断行 */
          }
        }
  
        /* 错误消息样式 */
        .error-message {
          /* 值样式 */
          .value {
            /* 警告文本样式 */
            &.warning-text {
              color: #faad14; /* 黄色文字 */
            }
            
            /* 错误文本样式 */
            &.error-text {
              color: #ff4d4f; /* 红色文字 */
            }
          }
        }
      }
    }
	}

  /* 设备选择器样式 */
  .device-selector {
    background: #fff; /* 白色背景 */
    border-radius: 16rpx; /* 圆角设置 */
    padding: 20rpx; /* 内边距 */
    margin-bottom: 20rpx; /* 底部外边距 */
    display: flex; /* 弹性布局 */
    align-items: center; /* 垂直居中对齐 */
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05); /* 阴影效果 */

    /* 选择器标签样式 */
    .selector-label {
      font-size: 28rpx; /* 文字大小 */
      color: #666; /* 文字颜色 */
      margin-right: 20rpx; /* 右侧外边距 */
      white-space: nowrap; /* 不换行 */
    }

    /* 设备选择器样式 */
    .device-picker {
      flex: 1; /* 弹性增长系数 */

      /* 选择器值样式 */
      .picker-value {
        font-size: 28rpx; /* 文字大小 */
        color: #333; /* 文字颜色 */
        padding: 15rpx 20rpx; /* 内边距 */
        background: #f5f6fa; /* 背景色 */
        border-radius: 8rpx; /* 圆角设置 */
        display: flex; /* 弹性布局 */
        justify-content: space-between; /* 两端对齐 */
        align-items: center; /* 垂直居中对齐 */

        /* 选择器箭头样式 */
        .picker-arrow {
          color: #999; /* 文字颜色 */
          margin-left: 10rpx; /* 左侧外边距 */
        }
      }
    }
  }

  /* 数据卡片样式 */
  .data-card {
    /* 数据信息样式 */
    .data-info {
      margin: 10rpx 0 20rpx; /* 上右下左外边距 */
      padding: 0 10rpx; /* 左右内边距 */
      
      /* 设备ID样式 */
      .device-id {
        font-size: 28rpx; /* 文字大小 */
        color: #666; /* 文字颜色 */
      }
    }
  }

  /* 行为列表样式 */
  .behavior-list {
    margin-top: 20rpx; /* 顶部外边距 */

    /* 列表头部样式 */
    .list-header {
      padding: 20rpx; /* 内边距 */
      /* 标题样式 */
      .title {
        font-size: 32rpx; /* 文字大小 */
        color: #333; /* 文字颜色 */
        font-weight: bold; /* 粗体 */
      }
    }

    /* 列表内容样式 */
    .list-content {
      max-height: 800rpx; /* 最大高度 */
    }

    /* 行为项样式 */
    .behavior-item {
      background: #fff; /* 白色背景 */
      border-radius: 16rpx; /* 圆角设置 */
      padding: 20rpx; /* 内边距 */
      margin: 0 20rpx 20rpx; /* 上右下左外边距 */
      box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05); /* 阴影效果 */

      /* 项目头部样式 */
      .item-header {
        display: flex; /* 弹性布局 */
        justify-content: space-between; /* 两端对齐 */
        align-items: center; /* 垂直居中对齐 */
        padding-bottom: 20rpx; /* 底部内边距 */
        border-bottom: 1px solid #eee; /* 底部边框 */

        /* 设备信息样式 */
        .device-info {
          display: flex; /* 弹性布局 */
          align-items: center; /* 垂直居中对齐 */
          gap: 10rpx; /* 间隙 */

          /* 标签样式 */
          .label {
            font-size: 28rpx; /* 文字大小 */
            color: #666; /* 文字颜色 */
          }

          /* 值样式 */
          .value {
            font-size: 28rpx; /* 文字大小 */
            color: #333; /* 文字颜色 */
            font-weight: bold; /* 粗体 */
          }

          /* 数据类型样式 */
          .data-type {
            padding: 4rpx 12rpx; /* 内边距 */
            border-radius: 6rpx; /* 圆角设置 */
            font-size: 24rpx; /* 文字大小 */
            
            /* 已保存数据样式 */
            &.saved {
              background-color: #e6f7ff; /* 浅蓝色背景 */
              color: #1890ff; /* 蓝色文字 */
            }
            
            /* 实时数据样式 */
            &.realtime {
              background-color: #f6ffed; /* 浅绿色背景 */
              color: #52c41a; /* 绿色文字 */
            }
          }
        }

        /* 时间信息样式 */
        .time-info {
          /* 时间样式 */
          .time {
            font-size: 26rpx; /* 文字大小 */
            color: #999; /* 文字颜色 */
          }
        }
      }

      /* 项目内容样式 */
      .item-content {
        padding-top: 20rpx; /* 顶部内边距 */
        display: grid; /* 网格布局 */
        grid-template-columns: repeat(2, 1fr); /* 两列布局，每列宽度相等 */
        gap: 20rpx; /* 网格间隙 */

        /* 数据行样式 */
        .data-row {
          display: flex; /* 弹性布局 */
          align-items: center; /* 垂直居中对齐 */

          /* 标签样式 */
          .label {
            font-size: 28rpx; /* 文字大小 */
            color: #666; /* 文字颜色 */
            margin-right: 10rpx; /* 右侧外边距 */
          }

          /* 值样式 */
          .value {
            font-size: 28rpx; /* 文字大小 */
            color: #333; /* 文字颜色 */
            font-weight: 500; /* 中等粗体 */
          }
        }
      }
    }
  }

  /* 图表控制样式 */
  .chart-control {
    background: #fff; /* 白色背景 */
    border-radius: 16rpx; /* 圆角设置 */
    padding: 20rpx; /* 内边距 */
    margin-bottom: 20rpx; /* 底部外边距 */

    /* 图表类型选择器样式 */
    .chart-type-selector {
      display: flex; /* 弹性布局 */
      align-items: center; /* 垂直居中对齐 */

      /* 标签样式 */
      .label {
        font-size: 28rpx; /* 文字大小 */
        color: #666; /* 文字颜色 */
        margin-right: 20rpx; /* 右侧外边距 */
      }

      /* 按钮组样式 */
      .button-group {
        display: flex; /* 弹性布局 */
        gap: 20rpx; /* 间隙 */

        /* 类型按钮样式 */
        .type-btn {
          padding: 10rpx 30rpx; /* 内边距 */
          font-size: 28rpx; /* 文字大小 */
          border-radius: 30rpx; /* 圆角设置 */
          background: #f5f6fa; /* 背景色 */
          color: #666; /* 文字颜色 */

          /* 激活状态样式 */
          &.active {
            background: #007AFF; /* 蓝色背景 */
            color: #fff; /* 白色文字 */
          }
        }
      }
    }
  }

  /* 数据网格样式 */
  .data-grid {
    display: grid; /* 网格布局 */
    grid-template-columns: repeat(2, 1fr); /* 两列布局，每列宽度相等 */
    gap: 20rpx; /* 网格间隙 */

    /* 数据项样式 */
    .data-item {
      background: #f8f9fa; /* 背景色 */
      padding: 20rpx; /* 内边距 */
      border-radius: 12rpx; /* 圆角设置 */

      /* 标签样式 */
      .label {
        font-size: 26rpx; /* 文字大小 */
        color: #666; /* 文字颜色 */
        margin-bottom: 10rpx; /* 底部外边距 */
      }

      /* 值样式 */
      .value {
        font-size: 36rpx; /* 文字大小 */
        color: #333; /* 文字颜色 */
        font-weight: bold; /* 粗体 */
      }
    }
  }
}
</style>