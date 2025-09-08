<template>
  <view class="error-container">
    <!-- 筛选区域 -->
    <view class="filter-section">
      <view class="filter-row">
        <view class="filter-item">
          <text class="filter-label">选择场景：</text>
          <picker 
            mode="selector"
            :range="deviceList" 
            :value="deviceIndex"
            range-key="device_name"
            @change="onDeviceChange"
            class="filter-picker"
          >
            <view class="picker-value">
              <text>{{ deviceIndex === -1 ? '请选择场景' : deviceList[deviceIndex]?.device_name }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>
        </view>
      </view>

      <view class="filter-row">
        <view class="time-filter">
          <view class="time-item">
            <text class="time-label">开始时间：</text>
            <picker mode="date" :value="startDate" @change="onStartDateChange">
              <view class="time-picker">
                <text>{{ startDate || '选择日期' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
            <picker mode="time" :value="startTime" @change="onStartTimeChange">
              <view class="time-picker">
                <text>{{ startTime || '选择时间' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
          <view class="time-item">
            <text class="time-label">结束时间：</text>
            <picker mode="date" :value="endDate" @change="onEndDateChange">
              <view class="time-picker">
                <text>{{ endDate || '选择日期' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
            <picker mode="time" :value="endTime" @change="onEndTimeChange">
              <view class="time-picker">
                <text>{{ endTime || '选择时间' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
        </view>
      </view>

      <view class="filter-actions">
        <button class="query-btn" @click="handleSearch">查询</button>
      </view>
    </view>

    <!-- 错误消息列表 -->
    <view class="error-list">
      <view class="list-header">
        <text class="title">错误消息列表</text>
      </view>
      
      <scroll-view scroll-y class="list-content">
        <view v-for="(item, index) in errorMessages" :key="index" class="error-item">
          <view class="item-header">
            <view class="error-info">
              <text class="scene-id">场景ID: {{ item.d_no }}</text>
              <view :class="['error-type', item.type === '1' ? 'warning' : 'error']">
                {{ item.type === '1' ? '告警' : '错误' }}
              </view>
            </view>
            <view class="time-info">
              <text class="time">{{ formatDateTime(item.c_time) }}</text>
            </view>
          </view>
          <view class="item-content">
            <view class="error-message">
              <text class="message-label">错误信息:</text>
              <text :class="['message-text', item.type === '1' ? 'warning-text' : 'error-text']">
                {{ item.e_msg }}
              </text>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 分页 -->
      <view class="pagination">
        <button :disabled="currentPage <= 1" @click="prevPage" class="page-btn">上一页</button>
        <text class="page-info">第 {{ currentPage }} 页，共 {{ Math.ceil(total / pageSize) }} 页</text>
        <button :disabled="currentPage >= Math.ceil(total / pageSize)" @click="nextPage" class="page-btn">下一页</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import config from '@/utils/config.js'

// 响应式数据
const errorMessages = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(5);

// 设备选择
const deviceList = ref([]);
const deviceIndex = ref(-1);
const selectedDeviceId = ref(null);

// 时间选择
const startDate = ref('');
const startTime = ref('');
const endDate = ref('');
const endTime = ref('');

// 获取设备列表
const fetchDeviceList = async () => {
  try {
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/sceneIds',
      method: 'GET'
    });

    if (result.statusCode === 200 && result.data.data) {
      deviceList.value = result.data.data;
    }
  } catch (error) {
    console.error('获取设备列表失败:', error);
    uni.showToast({
      title: '获取设备列表失败',
      icon: 'none'
    });
  }
};

// 获取错误消息列表
const fetchErrorMessages = async () => {
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value
    };
    
    if (startDate.value && startTime.value) {
      params.startTime = `${startDate.value} ${startTime.value}:00`;
    }
    if (endDate.value && endTime.value) {
      params.endTime = `${endDate.value} ${endTime.value}:00`;
    }
    if (selectedDeviceId.value) {
      params.deviceId = selectedDeviceId.value;
    }

    const result = await uni.request({
      url: config.API_BASE_URL + '/api/error-messages',
      method: 'GET',
      data: params
    });

    if (result.statusCode === 200) {
      errorMessages.value = result.data.data;
      total.value = result.data.total;
    }
  } catch (error) {
    console.error('获取错误消息失败:', error);
    uni.showToast({
      title: '获取错误消息失败',
      icon: 'none'
    });
  }
};

// 设备选择改变事件
const onDeviceChange = (e) => {
  deviceIndex.value = Number(e.detail.value);
  const selectedDevice = deviceList.value[deviceIndex.value];
  if (selectedDevice) {
    selectedDeviceId.value = selectedDevice.number;
  }
};

// 时间选择处理
const onStartDateChange = (e) => {
  startDate.value = e.detail.value;
};

const onStartTimeChange = (e) => {
  startTime.value = e.detail.value;
};

const onEndDateChange = (e) => {
  endDate.value = e.detail.value;
};

const onEndTimeChange = (e) => {
  endTime.value = e.detail.value;
};

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1;
  fetchErrorMessages();
};

// 分页处理
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    fetchErrorMessages();
  }
};

const nextPage = () => {
  if (currentPage.value < Math.ceil(total.value / pageSize.value)) {
    currentPage.value++;
    fetchErrorMessages();
  }
};

// 格式化时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

onMounted(() => {
  fetchDeviceList();
  fetchErrorMessages();
});
</script>

<style lang="scss">
.error-container {
  padding: 20rpx;
  background: #f5f6fa;
  min-height: 100vh;

  .filter-section {
    background: #fff;
    border-radius: 16rpx;
    padding: 20rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

    .filter-row {
      margin-bottom: 20rpx;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .filter-item {
      display: flex;
      align-items: center;

      .filter-label {
        font-size: 28rpx;
        color: #666;
        margin-right: 20rpx;
        white-space: nowrap;
      }

      .filter-picker {
        flex: 1;

        .picker-value {
          font-size: 28rpx;
          color: #333;
          padding: 15rpx 20rpx;
          background: #f5f6fa;
          border-radius: 8rpx;
          display: flex;
          justify-content: space-between;
          align-items: center;

          .picker-arrow {
            color: #999;
            margin-left: 10rpx;
          }
        }
      }
    }

    .time-filter {
      .time-item {
        display: flex;
        align-items: center;
        margin-bottom: 15rpx;
        gap: 10rpx;

        .time-label {
          font-size: 26rpx;
          color: #666;
          white-space: nowrap;
        }

        .time-picker {
          flex: 1;
          padding: 12rpx 15rpx;
          background: #f5f6fa;
          border-radius: 6rpx;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 26rpx;

          .picker-arrow {
            color: #999;
          }
        }
      }
    }

    .filter-actions {
      display: flex;
      justify-content: flex-end;

      .query-btn {
        padding: 15rpx 30rpx;
        background: #007AFF;
        color: #fff;
        border-radius: 8rpx;
        font-size: 28rpx;
      }
    }
  }

  .error-list {
    background: #fff;
    border-radius: 16rpx;
    padding: 20rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

    .list-header {
      margin-bottom: 20rpx;
      padding-bottom: 15rpx;
      border-bottom: 1px solid #eee;

      .title {
        font-size: 32rpx;
        color: #333;
        font-weight: bold;
      }
    }

    .list-content {
      max-height: 800rpx;
    }

    .error-item {
      margin-bottom: 20rpx;
      padding: 20rpx;
      background: #f8f9fa;
      border-radius: 12rpx;

      .item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15rpx;
        padding-bottom: 10rpx;
        border-bottom: 1px solid #eee;

        .error-info {
          display: flex;
          align-items: center;
          gap: 15rpx;

          .scene-id {
            font-size: 28rpx;
            color: #333;
            font-weight: bold;
          }

          .error-type {
            font-size: 24rpx;
            padding: 4rpx 8rpx;
            border-radius: 4rpx;

            &.warning {
              background: #fffbe6;
              color: #faad14;
            }

            &.error {
              background: #fff2f0;
              color: #ff4d4f;
            }
          }
        }

        .time-info {
          .time {
            font-size: 26rpx;
            color: #999;
          }
        }
      }

      .item-content {
        .error-message {
          display: flex;
          align-items: flex-start;

          .message-label {
            font-size: 26rpx;
            color: #666;
            margin-right: 10rpx;
            white-space: nowrap;
          }

          .message-text {
            font-size: 28rpx;
            flex: 1;
            word-break: break-all;

            &.warning-text {
              color: #faad14;
            }

            &.error-text {
              color: #ff4d4f;
            }
          }
        }
      }
    }

    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20rpx;
      padding-top: 15rpx;
      border-top: 1px solid #eee;

      .page-btn {
        padding: 10rpx 20rpx;
        font-size: 26rpx;
        border-radius: 6rpx;
        background: #f5f6fa;
        color: #666;

        &:disabled {
          opacity: 0.5;
        }
      }

      .page-info {
        font-size: 26rpx;
        color: #666;
      }
    }
  }
}
</style>