<template>
  <div class="container">
    <el-card>
      <div class="header">
        <div class="title-group">
          <h1>错误消息列表</h1>
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
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <!-- 简单统计展示区域 -->
      <div class="statistics-section">
        <el-row :gutter="20" style="margin-bottom: 20px">
          <!-- 统计卡片 -->
          <el-col :span="6">
            <el-card class="statistics-card total-card">
              <div class="statistics-content">
                <div class="statistics-icon">
                  <el-icon size="24"><Document /></el-icon>
                </div>
                <div class="statistics-info">
                  <div class="statistics-number">
                    {{ statistics.total || 0 }}
                  </div>
                  <div class="statistics-label">总条数</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="statistics-card warning-card">
              <div class="statistics-content">
                <div class="statistics-icon">
                  <el-icon size="24"><Warning /></el-icon>
                </div>
                <div class="statistics-info">
                  <div class="statistics-number">
                    {{ statistics.warningCount || 0 }}
                  </div>
                  <div class="statistics-label">告警</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="statistics-card error-card">
              <div class="statistics-content">
                <div class="statistics-icon">
                  <el-icon size="24"><CircleClose /></el-icon>
                </div>
                <div class="statistics-info">
                  <div class="statistics-number">
                    {{ statistics.errorCount || 0 }}
                  </div>
                  <div class="statistics-label">错误</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="statistics-card other-card">
              <div class="statistics-content">
                <div class="statistics-icon">
                  <el-icon size="24"><InfoFilled /></el-icon>
                </div>
                <div class="statistics-info">
                  <div class="statistics-number">
                    {{ statistics.otherTypesCount || 0 }}
                  </div>
                  <div class="statistics-label">其他类型</div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 饼图展示 -->
        <el-row>
          <el-col :span="12">
            <error-pie-chart :data="statistics.pieChartData || []" />
          </el-col>
          <el-col :span="12">
            <!-- 可以放其他图表或信息 -->
            <el-card style="height: 480px">
              <div style="padding: 20px; text-align: center">
                <h3>统计详情</h3>
                <el-divider />
                <div
                  v-for="item in statistics.pieChartData"
                  :key="item.type"
                  class="detail-item"
                >
                  <span class="detail-name">{{ item.name }}：</span>
                  <span class="detail-value">{{ item.value }} 条</span>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 错误消息列表 -->
      <el-table :data="errorMessages" style="width: 100%">
        <el-table-column prop="d_no" label="场景ID" />
        <el-table-column prop="e_msg" label="错误信息" />
        <!-- <el-table-column prop="e_no" label="错误编号"/> -->
        <el-table-column prop="c_time" label="创建时间">
          <template #default="scope">
            {{ formatDateTime(scope.row.c_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型">
          <template #default="scope">
            <el-tag :type="scope.row.type === '1' ? 'warning' : 'danger'">
              {{ scope.row.type === "1" ? "告警" : "错误" }}
            </el-tag>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="data_type" label="数据类型">
          <template #default="scope">
            <el-tag :type="scope.row.data_type === '1' ? 'success' : 'info'">
              {{ scope.row.data_type === '1' ? '在线' : '离线' }}
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
    </el-card>
  </div>
</template>

<script setup>
import useUserStore from "@/stores"; // 引入仓库
import {
  CircleClose,
  Document,
  InfoFilled,
  Warning,
} from "@element-plus/icons-vue";
import axios from "axios";
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";
import ErrorPieChart from "../components/ErrorPieChart.vue";

import { inject } from "vue";

const $baseUrl = inject("$baseUrl");

// 获取userStore仓库
const $store = useUserStore();

// 响应式状态
const errorMessages = ref([]);
const startTime = ref(null);
const endTime = ref(null);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(5);

// 设备选择
let selectedDevice = ref("");
let devices = ref([]);

// 统计数据
const statistics = ref({
  total: 0,
  warningCount: 0,
  errorCount: 0,
  otherTypesCount: 0,
  pieChartData: [],
});

// 默认时间
const defaultStartTime = new Date(2000, 1, 1, 0, 0, 0);
const defaultEndTime = new Date(2000, 2, 1, 23, 59, 59);

// 格式化日期时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 获取错误统计数据
const fetchErrorStatistics = async () => {
  try {
    const response = await axios.get($baseUrl + "/error-statistics");
    if (response.data.success) {
      statistics.value = response.data.data;
    }
  } catch (error) {
    ElMessage.error("获取错误统计失败");
    console.error("获取错误统计失败:", error);
  }
};

// 获取错误消息列表
const fetchErrorMessages = async () => {
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
    const response = await axios.get($baseUrl + "/error-messages", {
      params,
    });
    total.value = response.data.total;
    errorMessages.value = response.data.data;
  } catch (error) {
    ElMessage.error("获取错误消息列表失败");
    console.error("获取错误消息失败:", error);
  }
};

const fetchDevices = async () => {
  try {
    const response = await axios.get($baseUrl + "/sceneIds");
    devices.value = response.data.data;
  } catch (error) {
    ElMessage.error("获取下拉框数据失败");
    console.error("获取下拉框数据失败:", error);
  }
};

// 处理搜索(点击搜索后默认跳转到第一页)
const handleSearch = () => {
  currentPage.value = 1;
  fetchErrorMessages();
};
// 处理页码的变化
const handleCurrentChange = (current) => {
  currentPage.value = current;
  fetchErrorMessages();
};

// 场景ID变化处理
const handleDeviceChange = () => {
  currentPage.value = 1;
  fetchErrorMessages();
};

// 初始化
onMounted(() => {
  fetchErrorMessages();
  fetchDevices();
  fetchErrorStatistics();
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

  .statistics-section {
    margin-bottom: 30px;
  }

  .statistics-card {
    height: 100px;

    &.total-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    &.warning-card {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }

    &.error-card {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: white;
    }

    &.other-card {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      color: white;
    }

    :deep(.el-card__body) {
      padding: 15px;
      height: 100%;
      background: transparent;
    }
  }

  .statistics-content {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .statistics-icon {
    margin-right: 15px;
    opacity: 0.8;
  }

  .statistics-info {
    flex: 1;
  }

  .statistics-number {
    font-size: 24px;
    font-weight: bold;
    line-height: 1;
    margin-bottom: 5px;
  }

  .statistics-label {
    font-size: 12px;
    opacity: 0.8;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #ebeef5;

    &:last-child {
      border-bottom: none;
    }
  }

  .detail-name {
    font-weight: 500;
    color: #606266;
  }

  .detail-value {
    font-weight: bold;
    color: #409eff;
  }

  .el-tag {
    width: 45px;
    text-align: center;
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>