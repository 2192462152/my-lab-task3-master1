<template>
  <view class="room-detail-container">
    <!-- 返回按钮 -->
    <view class="header">
      <button class="back-btn" @click="goBack">← 返回</button>
      <text class="page-title">{{ roomInfo.device_name || '机房详情' }}</text>
    </view>

    <!-- 机房基本信息 -->
    <view class="info-card">
      <view class="card-header">
        <text class="card-title">机房基本信息</text>
        <view class="status-tag success">运行正常</view>
      </view>
      <view class="info-content">
        <view class="info-row">
          <text class="info-label">机房名称:</text>
          <text class="info-value">{{ roomInfo.device_name }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">机房编号:</text>
          <text class="info-value">{{ roomInfo.number }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">创建时间:</text>
          <text class="info-value">{{ formatDateTime(roomInfo.ctime) }}</text>
        </view>
        <view class="info-row full-width">
          <text class="info-label">描述:</text>
          <text class="info-value">{{ roomInfo.remarks || '暂无描述' }}</text>
        </view>
      </view>
    </view>

    <view class="content-row">
      <!-- 环境参数 -->
      <view class="env-card">
        <view class="card-header">
          <text class="card-title">实时环境参数</text>
          <button class="refresh-btn" @click="refreshSensorData">刷新</button>
        </view>
        <view class="env-content" v-if="sensorData.length > 0">
          <view v-for="(item, index) in sensorHeaders" :key="item" class="env-item">
            <text class="env-label">{{ item }}({{ sensorUnits[index] }}):</text>
            <text class="env-value">{{ sensorData[0][item] || '--' }}</text>
          </view>
          <view class="update-time">
            更新时间: {{ sensorData[0]['创建时间'] }}
          </view>
        </view>
        <view v-else class="no-data">
          <text>暂无传感器数据</text>
        </view>
      </view>

      <!-- 视频监控 -->
      <view class="video-card">
        <view class="card-header">
          <text class="card-title">视频监控</text>
          <picker 
            mode="selector"
            :range="cameras" 
            :value="cameraIndex"
            range-key="name"
            @change="onCameraChange"
            class="camera-picker"
          >
            <view class="picker-value">
              <text>{{ cameraIndex === -1 ? '选择摄像头' : cameras[cameraIndex]?.name }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>
        </view>
        <view class="video-content">
          <view v-if="selectedCamera" class="video-wrapper">
            <!-- 视频播放区域 - 使用web-view组件显示视频流 -->
            <view class="video-player">
              <image 
                v-if="currentStreamUrl && !streamLoading"
                :src="currentStreamUrl"
                class="video-stream"
                mode="aspectFill"
                @error="handleStreamError"
                @load="handleStreamLoad"
              />
              <view v-else-if="streamLoading" class="loading-stream">
                <view class="no-video-hint">
                  <text class="hint-icon">📹</text>
                  <text class="hint-text">正在连接摄像头...</text>
                </view>
              </view>
              <view v-else class="loading-stream">
                <view class="no-video-hint">
                  <text class="hint-icon">📹</text>
                  <text class="hint-text">请在上方选择摄像头查看实时画面</text>
                </view>
              </view>
              
              <!-- 连接状态显示 -->
              <view class="connection-status" v-if="connectionStatus">
                <text :class="['status-text', connectionStatus.type]">
                  {{ connectionStatus.text }}
                </text>
              </view>
            </view>
            
            <view class="video-controls">
              <button class="control-btn capture" @click="captureFrame" :disabled="captureLoading">
                📷 截图
              </button>
              <button class="control-btn ai-detect" @click="startAIDetection">
                🤖 AI检测
              </button>
              <button class="control-btn refresh" @click="refreshVideo">
                🔄 刷新画面
              </button>
            </view>
          </view>
          <view v-else class="no-camera">
            <text>请选择摄像头</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import config from '@/utils/config.js'

// 响应式数据
const roomInfo = ref({});
const sensorData = ref([]);
const sensorHeaders = ref([]);
const sensorUnits = ref([]);
const cameras = ref([]);
const cameraIndex = ref(-1);
const selectedCamera = ref('');
const connectionStatus = ref(null);
const currentStreamUrl = ref('');
const streamLoading = ref(false);
const captureLoading = ref(false);

// 房间ID
const roomId = ref('');

// 页面加载时获取参数
onLoad((options) => {
  if (options.roomId) {
    roomId.value = options.roomId;
  }
});

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

// 获取摄像头列表
const fetchCameras = async () => {
  try {
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/cameras',
      method: 'GET'
    });

    if (result.statusCode === 200) {
      cameras.value = result.data.data;
    }
  } catch (error) {
    console.error('获取摄像头列表失败:', error);
    uni.showToast({
      title: '获取摄像头列表失败',
      icon: 'none'
    });
  }
};

// 切换摄像头
const switchCamera = async (cameraAddress) => {
  streamLoading.value = true;
  connectionStatus.value = {
    type: 'warning',
    text: '切换中...'
  };

  try {
    const result = await uni.request({
      url: `${config.API_BASE_URL}/api/camera/${cameraAddress}/switch`,
      method: 'POST'
    });
    
    if (result.statusCode === 200 && result.data.success) {
      currentStreamUrl.value = result.data.streamUrl
      connectionStatus.value = {
        type: 'success',
        text: '连接成功'
      };
      console.log('摄像头切换成功');
    }
  } catch (error) {
    connectionStatus.value = {
      type: 'danger',
      text: '切换失败'
    };
    uni.showToast({
      title: '摄像头切换失败',
      icon: 'none'
    });
    console.error('摄像头切换失败:', error);
  } finally {
    streamLoading.value = false;
  }
};

// 停止所有摄像头流
const stopAllCameras = async () => {
  try {
    await uni.request({
      url: config.API_BASE_URL + '/api/cameras/stop-all',
      method: 'POST'
    });
    currentStreamUrl.value = '';
    connectionStatus.value = null;
    console.log('所有摄像头流已停止');
  } catch (error) {
    console.error('停止所有摄像头流失败:', error);
  }
};

// 摄像头切换处理
const onCameraChange = async (e) => {
  cameraIndex.value = Number(e.detail.value);
  const selectedCameraObj = cameras.value[cameraIndex.value];
  if (selectedCameraObj) {
    selectedCamera.value = selectedCameraObj.address;
	// console.log(selectedCamera.value)
    await switchCamera(selectedCamera.value);
  }
};

// 刷新视频
const refreshVideo = async () => {
  if (!selectedCamera.value) return;

  streamLoading.value = true;
  try {
    await switchCamera(selectedCamera.value);
  } finally {
    streamLoading.value = false;
  }
};

// 返回机房列表
const goBack = async () => {
  // await stopAllCameras();
  uni.navigateBack();
};

// 获取机房基本信息
const fetchRoomInfo = async () => {
  try {
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/allDevices',
      method: 'GET'
    });

    if (result.statusCode === 200) {
      const room = result.data.data.find(item => item.number === roomId.value);
      if (room) {
        roomInfo.value = room;
      } else {
        uni.showToast({
          title: '未找到该机房信息',
          icon: 'none'
        });
        goBack();
      }
    }
  } catch (error) {
    console.error('获取机房信息失败:', error);
    uni.showToast({
      title: '获取机房信息失败',
      icon: 'none'
    });
  }
};

// 获取实时传感器数据
const fetchSensorData = async () => {
  try {
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/data1',
      method: 'GET',
      data: { deviceId: roomId.value }
    });

    if (result.statusCode === 200) {
      sensorData.value = result.data.data;
      sensorHeaders.value = result.data.header;
      sensorUnits.value = result.data.units;
    }
  } catch (error) {
    console.error('获取传感器数据失败:', error);
    uni.showToast({
      title: '获取传感器数据失败',
      icon: 'none'
    });
  }
};

// 刷新传感器数据
const refreshSensorData = () => {
  fetchSensorData();
  uni.showToast({
    title: '数据已刷新',
    icon: 'success'
  });
};

// 截图功能
const captureFrame = async () => {
  if (!selectedCamera.value) {
    uni.showToast({
      title: '请先选择摄像头',
      icon: 'none'
    });
    return;
  }

  captureLoading.value = true;
  
  try {
    uni.showToast({
      title: '正在截取图像...',
      icon: 'loading'
    });
    
    const result = await uni.request({
      url: `${config.API_BASE_URL}/api/camera/${selectedCamera.value}/capture`,
      method: 'POST'
    });
    
    if (result.statusCode === 200 && result.data.success) {
      uni.showToast({
        title: '图像截取成功',
        icon: 'success'
      });
      return result.data.data.base64Image;
    }
  } catch (error) {
    uni.showToast({
      title: '图像截取失败',
      icon: 'none'
    });
    console.error('图像截取失败:', error);
    return null;
  } finally {
    captureLoading.value = false;
  }
};

// AI检测功能
const startAIDetection = async () => {
  try {
    uni.showToast({
      title: '正在进行AI检测...',
      icon: 'loading'
    });
    
    // 1. 首先截取图像
    const base64Image = await captureFrame();
    if (!base64Image) {
      throw new Error('截图失败');
    }
    
    // 2. 调用AI检测接口
    const aiResult = await uni.request({
      url: 'http://192.168.1.100:5000/infer',
      method: 'POST',
      data: {
        image: base64Image
      }
    });
    
    if (aiResult.statusCode === 200 && aiResult.data.inference_results) {
      // 3. 保存AI检测结果到数据库
      try {
        await uni.request({
          url: config.API_BASE_URL + '/api/behaviorData/add',
          method: 'POST',
          data: {
            d_no: roomId.value,
            originalImage: base64Image,
            processedImage: aiResult.data.processed_image,
            detectionCount: aiResult.data.inference_results.length,
            results: aiResult.data.inference_results
          }
        });
        
        // 5. 检查是否检测到人员
        const personDetected = aiResult.data.inference_results.some(item => item.label === 'person');
        
        if (personDetected) {
          // 向t_error_msg表插入报警数据
          try {
            await uni.request({
              url: config.API_BASE_URL + '/api/error-messages',
              method: 'POST',
              data: {
                d_no: roomId.value,
                e_msg: '人员报警'
              }
            });
            uni.showToast({
              title: `AI检测完成，检测到人员信息，已记录报警信息`,
              icon: 'none'
            });
          } catch (errorMsgError) {
            console.error('插入报警信息失败:', errorMsgError);
            uni.showToast({
              title: `AI检测完成，检测到 ${aiResult.data.inference_results.length} 个目标`,
              icon: 'success'
            });
          }
        } else {
          uni.showToast({
            title: `AI检测完成，检测到 ${aiResult.data.inference_results.length} 个目标`,
            icon: 'success'
          });
        }
      } catch (saveError) {
        console.error('保存AI检测结果失败:', saveError);
        uni.showToast({
          title: '保存检测结果失败',
          icon: 'none'
        });
      }
    }
  } catch (error) {
    uni.showToast({
      title: 'AI检测失败',
      icon: 'none'
    });
    console.error('AI检测失败:', error);
  }
};

// 处理视频流错误
const handleStreamError = () => {
  connectionStatus.value = {
    type: 'danger',
    text: '画面异常'
  };
  uni.showToast({
    title: '视频流加载失败',
    icon: 'none'
  });
};

// 处理视频流加载成功
const handleStreamLoad = () => {
  connectionStatus.value = {
    type: 'success',
    text: '画面正常'
  };
};

// 初始化
onMounted(async () => {
  await fetchRoomInfo();
  await fetchSensorData();
  await fetchCameras();
  
  // 注释掉自动启动摄像头，确保机房信息和环境参数优先显示
  // 用户需要手动选择摄像头才能查看视频流
  if (cameras.value.length > 0) {
    const roomNumber = roomId.value;
    let cameraIdx = 0;
    
    // 根据机房编号选择摄像头
    if (roomNumber === '01') cameraIdx = 0;
    else if (roomNumber === '02') cameraIdx = 1;
    else if (roomNumber === '03') cameraIdx = 2;
    
    if (cameras.value[cameraIdx]) {
      cameraIndex.value = cameraIdx;
      selectedCamera.value = cameras.value[cameraIdx].address;
      await switchCamera(selectedCamera.value);
    }
  }
});

// 页面卸载前清理
onUnload(async () => {
  console.log('页面卸载，停止所有摄像头流');
  // await stopAllCameras();
});
</script>

<style lang="scss">
.room-detail-container {
  padding: 20rpx;
  background: #f5f6fa;
  min-height: 100vh;

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
    padding: 20rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

    .back-btn {
      padding: 8rpx 16rpx;
      background: #f5f6fa;
      color: #666;
      border-radius: 6rpx;
      font-size: 28rpx;
      margin-right: 20rpx;
    }

    .page-title {
      font-size: 32rpx;
      color: #333;
      font-weight: bold;
    }
  }

  .info-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 20rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20rpx;
      padding-bottom: 15rpx;
      border-bottom: 1px solid #eee;

      .card-title {
        font-size: 32rpx;
        color: #333;
        font-weight: bold;
      }

      .status-tag {
        font-size: 24rpx;
        padding: 6rpx 12rpx;
        border-radius: 6rpx;

        &.success {
          background: #f6ffed;
          color: #52c41a;
        }
      }
    }

    .info-content {
      .info-row {
        display: flex;
        align-items: flex-start;
        margin-bottom: 15rpx;

        &.full-width {
          flex-direction: column;

          .info-label {
            margin-bottom: 8rpx;
          }
        }

        .info-label {
          font-size: 28rpx;
          color: #666;
          margin-right: 20rpx;
          white-space: nowrap;
          min-width: 120rpx;
        }

        .info-value {
          font-size: 28rpx;
          color: #333;
          flex: 1;
          word-break: break-all;
        }
      }
    }
  }

  .content-row {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }

  .env-card, .video-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 20rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20rpx;
      padding-bottom: 15rpx;
      border-bottom: 1px solid #eee;

      .card-title {
        font-size: 32rpx;
        color: #333;
        font-weight: bold;
      }

      .refresh-btn {
        padding: 8rpx 16rpx;
        background: #007AFF;
        color: #fff;
        border-radius: 6rpx;
        font-size: 26rpx;
      }

      .camera-picker {
        .picker-value {
          font-size: 26rpx;
          color: #333;
          padding: 8rpx 12rpx;
          background: #f5f6fa;
          border-radius: 6rpx;
          display: flex;
          align-items: center;
          min-width: 150rpx;

          .picker-arrow {
            color: #999;
            margin-left: 8rpx;
          }
        }
      }
    }
  }

  .env-content {
    .env-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15rpx;
      margin-bottom: 10rpx;
      background: #f8f9fa;
      border-radius: 8rpx;

      .env-label {
        font-size: 26rpx;
        color: #666;
      }

      .env-value {
        font-size: 32rpx;
        color: #007AFF;
        font-weight: bold;
      }
    }

    .update-time {
      margin-top: 15rpx;
      font-size: 24rpx;
      color: #999;
      text-align: right;
    }
  }

  .video-content {
    .video-wrapper {
      .video-player {
        position: relative;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 8rpx;
        overflow: hidden;
        min-height: 500rpx;
        margin-bottom: 15rpx;

        .video-stream {
           width: 100%;
           height: 500rpx;
           border-radius: 8rpx;
         }

        .loading-stream {
          height: 500rpx;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28rpx;
          color: #666;
          
          .no-video-hint {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10rpx;
            
            .hint-icon {
              font-size: 48rpx;
              opacity: 0.6;
            }
            
            .hint-text {
              font-size: 26rpx;
              color: #999;
              text-align: center;
            }
          }
        }

        .connection-status {
          position: absolute;
          top: 10rpx;
          right: 10rpx;
          z-index: 10;

          .status-text {
            font-size: 24rpx;
            padding: 4rpx 8rpx;
            border-radius: 4rpx;

            &.success {
              background: #f6ffed;
              color: #52c41a;
            }

            &.warning {
              background: #fffbe6;
              color: #faad14;
            }

            &.danger {
              background: #fff2f0;
              color: #ff4d4f;
            }
          }
        }
      }

      .video-controls {
        display: flex;
        gap: 15rpx;
        justify-content: center;

        .control-btn {
          padding: 12rpx 20rpx;
          font-size: 26rpx;
          border-radius: 8rpx;

          &.capture {
            background: #007AFF;
            color: #fff;
          }

          &.ai-detect {
            background: #52c41a;
            color: #fff;
          }

          &.refresh {
            background: #f5f6fa;
            color: #666;
          }

          &:disabled {
            opacity: 0.5;
          }
        }
      }
    }

    .no-camera {
      height: 500rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border-radius: 8rpx;
      font-size: 28rpx;
      color: #666;
    }
  }

  .no-data {
    height: 200rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    color: #666;
  }
}
</style>