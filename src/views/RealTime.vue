<template>
  <div class="container">
    <el-card>
      <!-- 传感器数据 -->
      <div class="header">
        <div class="title-group">
          <h1>传感器数据</h1>
          <div class="filter-container">
            <el-select
              v-model="selectedDevice"
              placeholder="请选择场景"
              clearable
              style="width: 150px"
              @change="handleDeviceChange"
            >
              <el-option
                v-for="device in devices"
                :key="device.id"
                :label="device.device_name"
                :value="device.number"
              />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 数据列表 -->
      <el-table :data="data" style="width: 100%">
        <el-table-column prop="d_no" label="场景ID"></el-table-column>
        <el-table-column
          v-for="(item, index) in header"
          :key="item"
          :prop="item"
          :label="`${item}(${units[index]})`"
        ></el-table-column>
        <el-table-column prop="c_time" label="创建时间"></el-table-column>
        <!-- <el-table-column label="数据类型">
          <template #default="scope">
            <el-tag :type="scope.row.data_type=='1'?'success':'info'">
              {{ scope.row.data_type=='1'?'在线':'离线' }}
            </el-tag>
          </template>
        </el-table-column> -->
      </el-table>

      <!-- 图表组件 -->
      <time-series-chart
        :data="chartData"
        :header="chartHeader"
        :units="chartUnits"
      ></time-series-chart>

      <!-- 场景实时画面 -->
      <!-- <div class="header">
        <div class="title-group">
          <h1>场景实时画面</h1>
          <div class="filter-container"> -->
      <!-- <el-select
            v-model="selectedSceneId"
            placeholder="选择场景"
            clearable
            style="width: 150px;"
            @change="handleSceneIdChange"
          >
            <el-option
              v-for="sceneId in sceneIds"
              :key="sceneId.id"
              :label="sceneId.device_name"
              :value="sceneId.number"
            />
          </el-select> -->
      <!-- </div>
        </div>
      </div> -->

      <!-- 场景实时画面数据列表 -->
      <!-- <el-table :data="sceneIds" style="width: 100%">
        <el-table-column prop="device_name" label="场景名称"></el-table-column>
        <el-table-column label="实时画面">
          <template #default="scope">
            <el-button 
              type="primary" 
              size="small"
              @click="viewLiveStream(scope.row)"
              :disabled="!scope.row.remarks"
            >
              查看实时画面
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="number" label="场景编号"></el-table-column> -->
      <!-- <el-table-column
          v-for="(item, index) in behaviorHeader"
          :key="item"
          :prop="item"
          :label="item"
        > -->
      <!-- <template #default="scope"> -->
      <!-- 文件路径列显示按钮 -->
      <!-- <template v-if="item === '文件路径' || item === 'field1'">
              <el-button 
                type="primary" 
                size="small"
                @click="viewFile(scope.row)"
                :disabled="!scope.row[item]"
              >
                {{ getFileTypeText(scope.row) }}
              </el-button>
            </template> -->
      <!-- 文件类型列显示友好文本 -->
      <!-- <template v-else-if="item === '文件类型' || item === 'field2'">
              <el-tag :type="'success'">
                {{ scope.row[item] === '1' || scope.row[item] === 1 ? '视频' : '图片' }}
              </el-tag>
            </template> -->
      <!-- 其他列正常显示 -->
      <!-- <template v-else>
              {{ scope.row[item] }}
            </template> -->
      <!-- </template> -->
      <!-- </el-table-column> -->
      <!-- <el-table-column prop="创建时间" label="创建时间"></el-table-column> -->
      <!-- </el-table> -->

      <!-- 实时画面预览对话框 -->
      <el-dialog
        v-model="liveStreamDialogVisible"
        :title="`${currentSceneName} - 实时画面`"
        width="70%"
        center
        @close="closeLiveStream"
      >
        <div class="live-stream-preview">
          <iframe
            v-if="currentStreamUrl"
            :src="currentStreamUrl"
            frameborder="0"
            style="width: 100%; height: 600px"
            allowfullscreen
            @error="handleStreamError"
          >
          </iframe>
          <div v-else class="no-stream">
            <el-empty description="暂无实时画面"></el-empty>
          </div>
        </div>
      </el-dialog>

      <!-- 文件预览对话框 -->
      <el-dialog
        v-model="fileDialogVisible"
        :title="currentFileType === '0' ? '图片预览' : '视频预览'"
        width="80%"
        center
      >
        <div class="file-preview">
          <!-- 图片预览 -->
          <img
            v-if="currentFileType === '0'"
            :src="currentFilePath"
            alt="图片预览"
            style="max-width: 100%; max-height: 600px; object-fit: contain"
            @error="handleImageError"
          />
          <!-- 视频预览 -->
          <video
            v-else-if="currentFileType === '1'"
            :src="currentFilePath"
            controls
            style="max-width: 100%; max-height: 600px"
            @error="handleVideoError"
          >
            您的浏览器不支持视频播放
          </video>
          <div v-else class="no-file">
            <el-empty description="暂无文件"></el-empty>
          </div>
        </div>
      </el-dialog>

      <!-- 图表组件 -->
      <!--      <time-series-chart :data="behaviorChartData" :header="behaviorChartHeader" :units="behaviorChartUnits" v-if="false"/>-->
    </el-card>
  </div>
</template>

<script setup lang="ts">
import useUserStore from "@/stores"; // 引入仓库
import axios from "axios";
import { ElMessage } from "element-plus";
import { inject, onMounted, onUnmounted, ref } from "vue";
import TimeSeriesChart from "../components/TimeSeriesChart.vue";

const $baseUrl = inject("$baseUrl");

// 获取userStore仓库
const $store = useUserStore();

// WebSocket连接
let ws: WebSocket | null = null;

// 表格数据
let data = ref([]);
let header = ref([]);
let units = ref([]);
let behaviorData = ref([]);
let behaviorHeader = ref([]);
let behaviorUnits = ref([]);

// 设备选择
let selectedDevice = ref("");
let devices = ref([]);

// 场景ID相关
const selectedSceneId = ref("");
const sceneIds = ref([]);

// 图表数据
let chartData = ref([]);
let chartHeader = ref([]);
let chartUnits = ref([]);
let behaviorChartData = ref([]);
let behaviorChartHeader = ref([]);
let behaviorChartUnits = ref([]);

// 文件预览相关
const fileDialogVisible = ref(false);
const currentFilePath = ref("");
const currentFileType = ref("");

// 实时画面预览相关
const liveStreamDialogVisible = ref(false);
const currentStreamUrl = ref("");
const currentSceneName = ref("");

// 初始化WebSocket连接
const initWebSocket = () => {
  try {
    ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => {
      console.log("WebSocket连接已建立");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("收到消息:", message);

        if (message.type === "sensorDataUpdate") {
          // 传感器数据更新
          console.log("传感器数据更新");
          fetchData();
          fetchChartData();
        }
        // else if (message.type === 'behaviorDataUpdate') {
        //   // 用户行为数据更新
        //   console.log('用户行为数据更新')
        //   fetchBehaviorData();
        // }
      } catch (error) {
        console.error("处理WebSocket消息失败:", error);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket连接已关闭");
    };

    ws.onerror = (error) => {
      console.error("WebSocket连接错误:", error);
    };
  } catch (error) {
    console.error("初始化WebSocket连接失败:", error);
  }
};

// 获取传感器数据
const fetchData = async () => {
  try {
    const params = {};
    if (selectedDevice.value) {
      params.deviceId = selectedDevice.value;
    }
    const response = await axios.get($baseUrl + "/data1", {
      params,
    });
    data.value = response.data.data;
    header.value = response.data.header;
    units.value = response.data.units;
  } catch (error) {
    ElMessage.error("获取最新数据失败");
    console.error("获取数据失败:", error);
  }
};

// 获取用户行为数据
const fetchBehaviorData = async () => {
  try {
    const params = {};
    if (selectedSceneId.value) {
      params.sceneId = selectedSceneId.value;
    }
    const response = await axios.get($baseUrl + "/behaviorData1", {
      params,
    });
    behaviorData.value = response.data.data;
    behaviorHeader.value = response.data.header;
    behaviorUnits.value = response.data.units;
    // console.log('用户行为数据:', response.data)
  } catch (error) {
    ElMessage.error("获取用户行为数据失败");
    console.error("获取用户行为数据失败:", error);
  }
};

// 获取场景ID列表
const fetchSceneIds = async () => {
  try {
    const response = await axios.get($baseUrl + "/allDevices");
    sceneIds.value = response.data.data;
    devices.value = response.data.data;
  } catch (error) {
    ElMessage.error("获取场景ID列表失败");
    console.error("获取场景ID列表失败:", error);
  }
};

// 获取传感器图数据
// const fetchChartData = async () => {
//   try {
//     const response = await axios.get($baseUrl + "/data2");
//     chartData.value = response.data.data;
//     chartHeader.value = response.data.header;
//     chartUnits.value = response.data.units;
//   } catch (error) {
//     ElMessage.error("获取图表数据失败");
//     console.error("获取图表数据失败:", error);
//   }
// };
const fetchChartData = async () => {
  try {
    let params = {};
    if (selectedDevice.value) {
      params.deviceId = selectedDevice.value;
    }
    const response = await axios.get($baseUrl + "/realtimeChart", { params });
    chartData.value = response.data.data;
    chartHeader.value = response.data.header;
    chartUnits.value = response.data.units;
  } catch (error) {
    ElMessage.error("获取图表数据失败");
    console.error("获取图表数据失败:", error);
  }
};

// 场景ID变化处理
const handleSceneIdChange = () => {
  fetchBehaviorData();
};

const handleDeviceChange = () => {
  fetchData();
  fetchChartData()
};

// 获取文件类型文本
const getFileTypeText = (row: any) => {
  if (row["文件类型"] === "0") {
    return "查看图片";
  } else if (row["文件类型"] === "1") {
    return "查看视频";
  }
  return "查看文件";
};

// 查看文件
const viewFile = (row: any) => {
  const filePath = row["文件路径"];
  const fileType = row["文件类型"];

  if (!filePath) {
    ElMessage.warning("文件路径为空");
    return;
  }

  // 构建完整的文件URL
  currentFilePath.value = `${$baseUrl}/${filePath}`;
  currentFileType.value = String(fileType);
  fileDialogVisible.value = true;
};

// 查看实时画面
const viewLiveStream = (row: any) => {
  const streamUrl = row.remarks;
  const sceneName = row.device_name;

  if (!streamUrl) {
    ElMessage.warning("实时画面地址为空");
    return;
  }

  currentStreamUrl.value = streamUrl;
  currentSceneName.value = sceneName;
  liveStreamDialogVisible.value = true;
};

// 关闭实时画面
const closeLiveStream = () => {
  currentStreamUrl.value = "";
  currentSceneName.value = "";
};

// 实时画面加载错误处理
const handleStreamError = () => {
  ElMessage.error("实时画面加载失败，请检查网络连接或画面地址是否正确");
};

// 图片加载错误处理
const handleImageError = () => {
  ElMessage.error("图片加载失败，请检查文件路径是否正确");
};

// 视频加载错误处理
const handleVideoError = () => {
  ElMessage.error("视频加载失败，请检查文件路径是否正确");
};

// 获取用户行为图数据
// const fetchBehaviorChartData = async () => {
//   try {
//     const response = await axios.get($baseUrl + '/behaviorData')
//     behaviorChartData.value = response.data.data
//     behaviorChartHeader.value = response.data.header
//     behaviorChartUnits.value = response.data.units
//   } catch (error) {
//     ElMessage.error('获取图表数据失败')
//     console.error('获取图表数据失败:', error)
//   }
// }

// 开始轮询
// const startPolling = () => {
//   // 确保不会创建多个定时器
//   stopPolling()

//   // 创建新的定时器
//   pollingTimer = setInterval(() => {
//     fetchData()
//     fetchChartData()
//     // 如果需要也可以刷新其他数据
//     // fetchBehaviorData()
//     // fetchBehaviorChartData()
//   }, pollingInterval)
// }

// 停止轮询
// const stopPolling = () => {
//   if (pollingTimer) {
//     clearInterval(pollingTimer)
//     pollingTimer = null
//   }
// }

onMounted(() => {
  // 初始化WebSocket连接
  initWebSocket();

  fetchData();
  fetchSceneIds();
  // fetchBehaviorData()
  fetchChartData();
  // fetchBehaviorChartData()
  // fetchDevices()

  // 启动轮询
  // startPolling()
});

// 组件卸载时清除定时器
onUnmounted(() => {
  if (ws) {
    ws.close();
    ws = null;
  }
  // stopPolling()
});
</script>

<style scoped lang="scss">
.container {
  width: 1200px;
  margin: 20px auto;
  padding: 0 20px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    height: 32px;

    .title-group {
      display: flex;
      align-items: center;

      h1 {
        margin: 0;
      }
    }

    .filter-container {
      display: flex;
      margin-left: 20px;
      align-items: center;
    }
  }

  .userData {
    margin: 20px 0;
    display: flex;

    h2 {
      margin: 0;
      font-size: 18px;
    }
  }
}

.file-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;

  .no-file {
    width: 100%;
    text-align: center;
  }
}

.live-stream-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 600px;

  .no-stream {
    width: 100%;
    text-align: center;
  }
}
</style>