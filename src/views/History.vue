<template>
  <div class="container">
    <el-card>
      <div class="header">
        <div class="title-group">
          <h1>传感器数据</h1>
          <el-select
            v-model="selectedDevice"
            placeholder="请选择场景"
            style="width: 200px; margin-left: 20px"
            clearable
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
        <!-- 添加传感器选择框 -->
        <!-- <div class="filter-container">
          <el-select
            v-model="selectedSensorType"
            placeholder="传感器类型"
            style="width: 120px;"
          >
            <el-option label="全部" value=""></el-option>
            <el-option label="温度" value="温度"></el-option>
            <el-option label="湿度" value="湿度"></el-option>
            <el-option label="光照度" value="光照度"></el-option>
          </el-select>
        </div> -->
        <div class="filter-container">
          <el-date-picker
            v-model="startTime"
            type="datetime"
            placeholder="开始时间"
            :default-time="defaultStartTime"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <el-date-picker
            v-model="endTime"
            type="datetime"
            placeholder="结束时间"
            :default-time="defaultEndTime"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <el-button type="primary" @click="handleSearch">搜索</el-button>
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

      <!-- 分页组件 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="handleCurrentChange"
        ></el-pagination>
      </div>

      <!-- 图表组件 -->
      <time-series-chart :data="data" :header="header" :units="units" />

      <!-- AI检测结果 -->
      <div class="header" style="margin-top: 40px">
        <div class="title-group">
          <h1>AI检测结果</h1>
        </div>
        <div class="filter-container">
          <el-select
            v-model="selectedSceneId"
            placeholder="选择机房"
            clearable
            style="width: 150px"
            @change="handleSceneIdChange"
          >
            <el-option
              v-for="sceneId in sceneIds"
              :key="sceneId.id"
              :label="sceneId.device_name"
              :value="sceneId.number"
            />
          </el-select>
          <el-date-picker
            v-model="behaviorStartTime"
            type="datetime"
            placeholder="开始时间"
            :default-time="defaultStartTime"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <el-date-picker
            v-model="behaviorEndTime"
            type="datetime"
            placeholder="结束时间"
            :default-time="defaultEndTime"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <el-button type="primary" @click="behaviorHandleSearch"
            >搜索</el-button
          >
        </div>
      </div>

      <!-- AI检测结果列表 -->
      <el-table :data="behaviorData" style="width: 100%" stripe>
        <el-table-column
          prop="d_no"
          label="机房编号"
          width="120"
        ></el-table-column>
        <el-table-column label="原始图像" width="150">
          <template #default="scope">
            <el-button
              v-if="scope.row['原始图像']"
              type="primary"
              size="small"
              @click="showImageDialog(scope.row['原始图像'], '原始图像')"
            >
              查看原图
            </el-button>
            <span v-else>无图片</span>
          </template>
        </el-table-column>
        <el-table-column label="标注图像" width="150">
          <template #default="scope">
            <el-button
              v-if="scope.row['检测结果图']"
              type="success"
              size="small"
              @click="showImageDialog(scope.row['检测结果图'], '标注图像')"
            >
              查看标注
            </el-button>
            <span v-else>无图片</span>
          </template>
        </el-table-column>
        <el-table-column label="检测数量" width="100">
          <template #default="scope">
            <el-tag type="primary">{{ scope.row["目标数量"] || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="检测详情" min-width="200">
          <template #default="scope">
            <div v-if="scope.row['检测详情']">
              <el-tag
                v-for="(result, index) in parseDetectionResults(
                  scope.row['检测详情']
                )"
                :key="index"
                type="success"
                size="small"
                style="margin-right: 5px; margin-bottom: 2px"
              >
                {{ result.label }}: {{ result.confidence }}%
              </el-tag>
            </div>
            <span v-else>无检测结果</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="c_time"
          label="检测时间"
          width="180"
        ></el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button
              type="danger"
              size="small"
              @click="deleteAIDetectionRecord(scope.row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 行为数据分页组件 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="behaviorCurrentPage"
          :page-size="behaviorPageSize"
          :total="behaviorTotal"
          layout="total, prev, pager, next"
          @current-change="handleBehaviorPageChange"
        ></el-pagination>
      </div>

      <!-- 用户行为数据图 -->
      <!--      <time-series-chart :data="behaviorData" :header="behaviorHeader" :units="behaviorUnits" v-if="false"/>-->
    </el-card>

    <!-- 图片查看对话框 -->
    <el-dialog
      v-model="imageDialogVisible"
      :title="imageDialogTitle"
      width="60%"
      center
    >
      <div style="text-align: center">
        <el-image
          :src="currentImageUrl"
          fit="contain"
          style="max-width: 100%; max-height: 500px"
          :preview-src-list="[currentImageUrl]"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import TimeSeriesChart from "@/components/TimeSeriesChart.vue";
import useUserStore from "@/stores"; // 引入仓库
import axios from "axios";
import { ElMessage, ElMessageBox } from "element-plus";
import { inject, onMounted, ref } from "vue";

const $baseUrl = inject("$baseUrl");

// 获取userStore仓库
const $store = useUserStore();

// WebSocket连接
// let ws: WebSocket | null = null;

let data = ref([]);
let header = ref([]);
let units = ref([]);
let behaviorData = ref([]);
let behaviorHeader = ref([]);
let behaviorUnits = ref([]);
const startTime = ref(null);
const endTime = ref(null);
const behaviorStartTime = ref(null);
const behaviorEndTime = ref(null);
// 添加传感器选择变量
// const selectedSensorType = ref("")

// 场景ID相关
const selectedSceneId = ref("");
const sceneIds = ref([]);

// 分页相关状态
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(5);

// 设备选择
let selectedDevice = ref("");
let devices = ref([]);

// 默认时间
const defaultStartTime = new Date(2000, 1, 1, 0, 0, 0);
const defaultEndTime = new Date(2000, 2, 1, 23, 59, 59);

// 用户行为数据分页状态
const behaviorTotal = ref(0);
const behaviorCurrentPage = ref(1);
const behaviorPageSize = ref(5);

// 图片对话框相关状态
const imageDialogVisible = ref(false);
const imageDialogTitle = ref("");
const currentImageUrl = ref("");

// 初始化WebSocket连接
// const initWebSocket = () => {
//   try {
//     ws = new WebSocket('ws://localhost:8080');

//     ws.onopen = () => {
//       console.log('WebSocket连接已建立')
//     };

//     ws.onmessage = (event) => {
//       try {
//         const message = JSON.parse(event.data);
//         console.log('收到消息:', message);

//         if (message.type === 'sensorDataUpdate') {
//           // 传感器数据更新
//           console.log('传感器数据更新')
//           fetchData();
//         } else if (message.type === 'behaviorDataUpdate') {
//           // 用户行为数据更新
//           console.log('用户行为数据更新')
//           fetchBehaviorData();
//         }
//       } catch (error) {
//         console.error('处理WebSocket消息失败:', error);
//       }
//     };

//     ws.onclose = () => {
//       console.log('WebSocket连接已关闭')
//     };

//     ws.onerror = (error) => {
//       console.error('WebSocket错误:', error);
//     };
//   } catch (error) {
//     console.error('初始化WebSocket失败:', error);
//   }
// }

const fetchData = async () => {
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
    };
    if (startTime.value) {
      params.startTime = startTime.value;
    }
    if (endTime.value) {
      params.endTime = endTime.value;
    }
    if (selectedDevice.value) {
      params.deviceId = selectedDevice.value;
    }
    // if (selectedSensorType.value) {
    //   params.sensorType = selectedSensorType.value
    // }
    const response = await axios.get($baseUrl + "/api/data2", {
      params,
    });
    data.value = response.data.data;
    header.value = response.data.header;
    units.value = response.data.units;
    total.value = response.data.total || data.value.length;
  } catch (error) {
    ElMessage.error("获取数据失败");
    console.error("获取数据失败:", error);
  }
};

const fetchBehaviorData = async () => {
  try {
    const params = {
      page: behaviorCurrentPage.value,
      pageSize: behaviorPageSize.value,
    };
    if (behaviorStartTime.value) {
      params.startTime = behaviorStartTime.value;
    }
    if (behaviorEndTime.value) {
      params.endTime = behaviorEndTime.value;
    }
    if (selectedSceneId.value) {
      params.sceneId = selectedSceneId.value;
    }
    const response = await axios.get($baseUrl + "/api/behaviorData", {
      params,
    });
    behaviorData.value = response.data.data;
    behaviorHeader.value = response.data.header;
    behaviorUnits.value = response.data.units;
    behaviorTotal.value = response.data.total;
  } catch (error) {
    ElMessage.error("获取用户行为数据失败");
    console.error("获取用户行为数据失败：", error);
  }
};

// 获取场景ID列表
const fetchSceneIds = async () => {
  try {
    const response = await axios.get($baseUrl + "/api/sceneIds");
    sceneIds.value = response.data.data;
    devices.value = response.data.data;
  } catch (error) {
    ElMessage.error("获取场景ID列表失败");
    console.error("获取场景ID列表失败:", error);
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchData();
};

const behaviorHandleSearch = () => {
  behaviorCurrentPage.value = 1;
  fetchBehaviorData();
};

// 场景ID变化处理
const handleSceneIdChange = () => {
  behaviorCurrentPage.value = 1;
  fetchBehaviorData();
};

// 场景ID变化处理
const handleDeviceChange = () => {
  currentPage.value = 1;
  fetchData();
};

// 处理页码变化
const handleCurrentChange = (current) => {
  currentPage.value = current;
  fetchData();
};

// 用户行为数据分页变化处理
const handleBehaviorPageChange = (current) => {
  behaviorCurrentPage.value = current;
  fetchBehaviorData();
};

// 解析AI检测结果
const parseDetectionResults = (resultsStr) => {
  try {
    if (!resultsStr) return [];
    const results = JSON.parse(resultsStr);
    return Array.isArray(results) ? results : [];
  } catch (error) {
    console.error("解析检测结果失败:", error);
    return [];
  }
};

// 显示图片对话框
const showImageDialog = (imagePath, title) => {
  currentImageUrl.value = `/${imagePath}`;
  imageDialogTitle.value = title;
  imageDialogVisible.value = true;
};

// 删除AI检测记录
const deleteAIDetectionRecord = async (id) => {
  try {
    await ElMessageBox.confirm(
      "确定要删除这条AI检测记录吗？删除后将无法恢复。",
      "确认删除",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    const response = await axios.delete($baseUrl + `/api/behaviorData/${id}`);

    if (response.data.success) {
      ElMessage.success("删除成功");
      // 重新获取数据
      fetchBehaviorData();
    } else {
      ElMessage.error("删除失败");
    }
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("删除失败: " + error.message);
      console.error("删除AI检测记录失败:", error);
    }
  }
};

onMounted(() => {
  // 初始化WebSocket连接
  // initWebSocket();

  fetchData();
  fetchBehaviorData();
  fetchSceneIds();
});

// onUnmounted(() => {
//   if (ws) {
//     ws.close();
//     ws = null;
//   }
// })
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
      gap: 10px;
      align-items: center;
    }
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>