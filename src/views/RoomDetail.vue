<template>
  <div class="container">
    <!-- 面包屑导航 -->
    <el-breadcrumb separator="/" style="margin-bottom: 20px">
      <el-breadcrumb-item @click="goBack" style="cursor: pointer"
        >机房导航</el-breadcrumb-item
      >
      <el-breadcrumb-item>{{
        roomInfo.device_name || "机房详情"
      }}</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 机房基本信息 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>机房基本信息</span>
          <el-tag :type="getRoomStatusType()" size="large">
            {{ getRoomStatusText() }}
          </el-tag>
        </div>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="机房名称">{{
          roomInfo.device_name
        }}</el-descriptions-item>
        <el-descriptions-item label="机房编号">{{
          roomInfo.number
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatDateTime(roomInfo.ctime)
        }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="3">{{
          roomInfo.remarks || "暂无描述"
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-row :gutter="20">
      <!-- 环境参数 -->
      <el-col :span="12">
        <el-card style="margin-bottom: 20px">
          <template #header>
            <div class="card-header">
              <span>实时环境参数</span>
              <el-button type="primary" size="small" @click="refreshSensorData">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <div v-if="sensorData.length > 0">
            <el-descriptions :column="1" border>
              <el-descriptions-item
                v-for="(item, index) in sensorHeaders"
                :key="item"
                :label="`${item}(${sensorUnits[index]})`"
              >
                <span class="sensor-value">
                  {{ sensorData[0][item] || "--" }}
                </span>
              </el-descriptions-item>
            </el-descriptions>
            <div class="update-time">
              更新时间: {{ sensorData[0]["创建时间"] }}
            </div>
          </div>
          <el-empty v-else description="暂无传感器数据" />
        </el-card>
      </el-col>

      <!-- 视频监控 -->
      <el-col :span="12">
        <el-card style="margin-bottom: 20px">
          <template #header>
            <div class="card-header">
              <span>视频监控</span>
              <el-select
                v-model="selectedCamera"
                placeholder="选择摄像头"
                size="small"
                style="width: 150px"
                @change="handleCameraChange"
              >
                <el-option
                  v-for="camera in cameras"
                  :key="camera.id"
                  :label="camera.name"
                  :value="camera.address"
                />
              </el-select>
            </div>
          </template>
          <div class="video-container">
            <div v-if="selectedCamera" class="video-wrapper">
              <!-- 使用iframe显示摄像头流 -->
              <div class="video-player">
                <iframe
                  v-if="currentIframeUrl"
                  :src="currentIframeUrl"
                  frameborder="0"
                  style="width: 100%; height: 350px"
                  allowfullscreen
                  @load="handleIframeLoad"
                  @error="handleIframeError"
                >
                </iframe>

                <!-- 修复加载状态显示 -->
                <div
                  v-else
                  class="loading-stream"
                  v-loading="streamLoading"
                  element-loading-text="正在连接摄像头..."
                  element-loading-background="rgba(0, 0, 0, 0.8)"
                >
                  <div
                    style="
                      height: 350px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      background-color: #f5f5f5;
                    "
                  >
                    <span v-if="!streamLoading">选择摄像头查看实时画面</span>
                  </div>
                </div>

                <!-- 连接状态显示 -->
                <div class="connection-status" v-if="connectionStatus">
                  <el-tag :type="connectionStatus.type" size="small">
                    {{ connectionStatus.text }}
                  </el-tag>
                </div>
              </div>

              <div class="video-controls">
                <el-button
                  type="primary"
                  size="small"
                  @click="captureFrame"
                  :loading="captureLoading"
                >
                  <el-icon><Camera /></el-icon>
                  截图
                </el-button>
                <el-button
                  type="success"
                  size="small"
                  @click="startAIDetection"
                >
                  <el-icon><View /></el-icon>
                  AI检测
                </el-button>
                <el-button type="info" size="small" @click="refreshVideo">
                  <el-icon><Refresh /></el-icon>
                  刷新画面
                </el-button>
              </div>
            </div>
            <el-empty v-else description="请选择摄像头" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import axios from "axios";
import { ElMessage } from "element-plus";
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const $baseUrl = inject("$baseUrl");

const route = useRoute();
const router = useRouter();

// 响应式数据
const roomInfo = ref({});
const sensorData = ref([]);
const sensorHeaders = ref([]);
const sensorUnits = ref([]);
const selectedCamera = ref("");
const connectionStatus = ref(null);
const currentIframeUrl = ref("");
const streamLoading = ref(false);
const captureLoading = ref(false);

// 摄像头列表
const cameras = ref([]);

// 计算属性
const roomId = computed(() => route.params.roomId);

// 格式化时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN");
};

// 获取机房状态类型
const getRoomStatusType = () => {
  return "success";
};

// 获取机房状态文本
const getRoomStatusText = () => {
  return "运行正常";
};

// 获取摄像头列表
const fetchCameras = async () => {
  try {
    const response = await axios.get($baseUrl + "/api/cameras");
    cameras.value = response.data.data;
  } catch (error) {
    ElMessage.error("获取摄像头列表失败");
    console.error("获取摄像头列表失败:", error);
  }
};

// 切换摄像头（停止其他，启动指定的）
const switchCamera = async (cameraAddress) => {
  streamLoading.value = true;
  connectionStatus.value = {
    type: "warning",
    text: "切换中...",
  };

  try {
    const response = await axios.post(
      $baseUrl + `/api/camera/${cameraAddress}/switch`
    );

    if (response.data.success) {
      currentIframeUrl.value = response.data.iframeUrl;
      connectionStatus.value = {
        type: "success",
        text: "连接成功",
      };
      console.log("摄像头切换成功");
    }
  } catch (error) {
    connectionStatus.value = {
      type: "danger",
      text: "切换失败",
    };
    ElMessage.error("摄像头切换失败");
    console.error("摄像头切换失败:", error);
  } finally {
    streamLoading.value = false;
  }
};

// 停止所有摄像头流
const stopAllCameras = async () => {
  try {
    await axios.post($baseUrl + "/api/cameras/stop-all");
    currentIframeUrl.value = "";
    connectionStatus.value = null;
    console.log("所有摄像头流已停止");
  } catch (error) {
    console.error("停止所有摄像头流失败:", error);
  }
};

// 摄像头切换处理
const handleCameraChange = async () => {
  if (!selectedCamera.value) {
    currentIframeUrl.value = "";
    connectionStatus.value = null;
    return;
  }

  // 使用新的切换接口
  await switchCamera(selectedCamera.value);
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

// iframe加载处理
const handleIframeLoad = () => {
  connectionStatus.value = {
    type: "success",
    text: "画面正常",
  };
};

// iframe错误处理
const handleIframeError = () => {
  connectionStatus.value = {
    type: "danger",
    text: "画面异常",
  };
};

// 返回机房列表
const goBack = async () => {
  // 离开页面前停止所有摄像头流
  // await stopAllCameras()
  router.push("/device");
};

// 获取机房基本信息
const fetchRoomInfo = async () => {
  try {
    const response = await axios.get($baseUrl + "/api/allDevices");
    const room = response.data.data.find(
      (item) => item.number === roomId.value
    );
    if (room) {
      roomInfo.value = room;
    } else {
      ElMessage.error("未找到该机房信息");
      goBack();
    }
  } catch (error) {
    ElMessage.error("获取机房信息失败");
    console.error("获取机房信息失败:", error);
  }
};

// 获取实时传感器数据
const fetchSensorData = async () => {
  try {
    const response = await axios.get($baseUrl + "/api/data1", {
      params: { deviceId: roomId.value },
    });
    sensorData.value = response.data.data;
    sensorHeaders.value = response.data.header;
    sensorUnits.value = response.data.units;
  } catch (error) {
    ElMessage.error("获取传感器数据失败");
    console.error("获取传感器数据失败:", error);
  }
};

// 刷新传感器数据
const refreshSensorData = () => {
  fetchSensorData();
  ElMessage.success("数据已刷新");
};

// 截图功能
const captureFrame = async () => {
  if (!selectedCamera.value) {
    ElMessage.warning("请先选择摄像头");
    return;
  }

  captureLoading.value = true;

  try {
    ElMessage.info("正在截取图像...");

    const response = await axios.post(
      $baseUrl + `/api/camera/${selectedCamera.value}/capture`
    );

    if (response.data.success) {
      ElMessage.success("图像截取成功");
      return response.data.data.base64Image;
    }
  } catch (error) {
    ElMessage.error("图像截取失败: " + error.message);
    console.error("图像截取失败:", error);
    return null;
  } finally {
    captureLoading.value = false;
  }
};

// AI检测功能
const startAIDetection = async () => {
  try {
    ElMessage.info("正在进行AI检测...");

    // 1. 首先截取图像
    const base64Image = await captureFrame();
    if (!base64Image) {
      throw new Error("截图失败");
    }

    // 2. 调用AI检测接口
    const response = await axios.post($baseUrl + "/infer", {
      // 组委会提供接口
      image: base64Image,
    });

    if (response.data.inference_results) {
      // 3. 保存AI检测结果到数据库
      try {
        await axios.post($baseUrl + "/api/behaviorData/add", {
          d_no: roomId.value,
          originalImage: base64Image,
          processedImage: response.data.processed_image,
          detectionCount: response.data.inference_results.length,
          results: response.data.inference_results,
        });

        // 5. 检查是否检测到人员（label为person）
        const personDetected = response.data.inference_results.some(
          (item) => item.label === "person"
        );

        if (personDetected) {
          // 向t_error_msg表插入报警数据
          try {
            await axios.post($baseUrl + "/api/error-messages", {
              d_no: roomId.value,
              e_msg: "人员报警",
            });
            ElMessage.warning(`AI检测完成，检测到人员信息，已记录报警信息`);
          } catch (errorMsgError) {
            console.error("插入报警信息失败:", errorMsgError);
            ElMessage.success(
              `AI检测完成，检测到 ${response.data.inference_results.length} 个目标`
            );
          }
        } else {
          ElMessage.success(
            `AI检测完成，检测到 ${response.data.inference_results.length} 个目标`
          );
        }
      } catch (saveError) {
        console.error("保存AI检测结果失败:", saveError);
        ElMessage.error("保存检测结果失败");
      }
    }
  } catch (error) {
    ElMessage.error("AI检测失败: " + error.message);
    console.error("AI检测失败:", error);
  }
};

// 监听摄像头选择变化
// watch(selectedCamera, (newCamera, oldCamera) => {
//   if (newCamera && newCamera !== oldCamera) {
//     handleCameraChange()
//   }
// }, { immediate: false })

// 页面卸载前清理
onBeforeUnmount(async () => {
  // console.log('页面卸载，停止所有摄像头流')
  // await stopAllCameras()
});

// 监听浏览器页面关闭/刷新
const handleBeforeUnload = async () => {
  // await stopAllCameras()
};

// 初始化
onMounted(async () => {
  await fetchRoomInfo();
  await fetchSensorData();
  await fetchCameras();

  // 根据机房编号自动选择对应的摄像头
  if (cameras.value.length > 0) {
    const roomNumber = roomId.value;
    let cameraIndex = 0;

    // 根据机房编号选择摄像头
    if (roomNumber === "01") cameraIndex = 0;
    else if (roomNumber === "02") cameraIndex = 1;
    else if (roomNumber === "03") cameraIndex = 2;

    if (cameras.value[cameraIndex]) {
      selectedCamera.value = cameras.value[cameraIndex].address;
      // handleCameraChange() 会通过 watch 自动触发
      switchCamera(selectedCamera.value);
    }
  }

  // 监听页面关闭事件
  window.addEventListener("beforeunload", handleBeforeUnload);
});

// 清理事件监听器
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<style lang="scss" scoped>
.container {
  width: 1200px;
  margin: 20px auto;
  padding: 0 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sensor-value {
  font-size: 18px;
  font-weight: 600;
  color: #409eff;
}

.update-time {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
  text-align: right;
}

.video-container {
  .video-wrapper {
    position: relative;

    .video-player {
      position: relative;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
      min-height: 350px;

      .connection-status {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 10;
      }

      .loading-stream {
        height: 350px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f5f5f5;
        border-radius: 4px;
      }
    }

    .video-controls {
      margin-top: 10px;
      display: flex;
      gap: 10px;
      justify-content: center;
    }
  }
}

.el-breadcrumb {
  :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
    color: #303133;
    font-weight: 600;
  }
}

// 加载状态样式
:deep(.el-loading-mask) {
  border-radius: 4px;
}
</style>