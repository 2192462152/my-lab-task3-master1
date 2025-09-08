<template>
  <div class="container">
    <el-card>
      <div class="header">
        <h1>指令配置</h1>
      </div>

      <!-- 全局指令配置 -->
      <el-table
        :data="configs"
        style="width: 100%; margin-bottom: 20px"
        :row-class-name="getRowClassName"
      >
        <el-table-column prop="t_name" label="指令名称" />
        <el-table-column label="指令值" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.visible">
              <el-switch
                v-if="scope.row.f_type === '1'"
                v-model="scope.row.direct_value"
                :active-value="getActiveValue(scope.row)"
                :inactive-value="getInactiveValue(scope.row)"
                @change="(val) => handleValueChange(scope.row, val)"
              />

              <el-input
                v-if="scope.row.f_type === '2'"
                v-model="scope.row.direct_value"
                placeholder="请输入值"
                @blur="
                  () => handleValueChange(scope.row, scope.row.direct_value)
                "
              />

              <el-slider
                v-if="scope.row.f_type === '3'"
                v-model="sliderValues[scope.row.id]"
                :min="scope.row.min ? Number(scope.row.min) : 0"
                :max="scope.row.max ? Number(scope.row.max) : 100"
                :step="1"
                @change="(val) => handleSliderChange(scope.row, val)"
              />

              <el-time-picker
                v-if="scope.row.f_type === '4'"
                v-model="scope.row.direct_value"
                format="HH:mm:ss"
                value-format="HH:mm:ss"
                placeholder="选择时间"
                @change="(val) => handleValueChange(scope.row, val)"
              />

              <el-radio-group
                v-if="scope.row.f_type === '5'"
                v-model="scope.row.direct_value"
                @change="(val) => handleValueChange(scope.row, val)"
              >
                <el-radio
                  v-for="option in parseDeviceOptions(scope.row.f_value)"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </el-radio>
              </el-radio-group>
            </div>
            <span v-else>{{
              scope.row.direct_value || scope.row.f_value
            }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.visible ? 'success' : 'danger'">
              {{ scope.row.visible ? "可用" : "不可用" }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <!-- 设备选择 -->
      <!-- <div class="device-select" v-if="!isAuto"> -->
      <!-- <h2>设备选择</h2>
      <el-select
          v-model="selectedDevice"
          placeholder="请选择设备"
          @change="handleDeviceChange"
          style="width: 200px;"
      >
        <el-option
            v-for="device in devices"
            :key="device.id"
            :label="device.device_name"
            :value="device.id"
        />
      </el-select> -->
      <!-- </div> -->

      <!-- 选择设备的指令 -->
      <!-- 
      <el-table
          :data="localConfigs"
          style="width:100%;margin-top:20px;"
          v-if="!$store.isOne"
          :row-class-name="getRowClassName"
      >
        <el-table-column prop="t_name" label="指令名称"/>
        <el-table-column label="指令值" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.visible">
              <el-switch
                  v-if="scope.row.f_type === '1'"
                  v-model="scope.row.direct_value"
                  :active-value="getActiveValue(scope.row)"
                  :inactive-value="getInactiveValue(scope.row)"
                  @change="(val) => handleLocalValueChange(scope.row, val)"
              />

              <el-input
                  v-if="scope.row.f_type === '2'"
                  v-model="scope.row.f_value"
                  placeholder="请输入值"
                  @change="(val) => handleLocalValueChange(scope.row, val)"
              />

              <el-slider
                  v-if="scope.row.f_type === '3'"
                  v-model="scope.row.f_value"
                  :min="scope.row.min ? Number(scope.row.min) : 0"
                  :max="scope.row.max ? Number(scope.row.max) : 100"
                  :step="1"
                  show-input
                  @change="(val) => handleLocalValueChange(scope.row, val)"
              />

              <el-time-picker
                  v-if="scope.row.f_type === '4'"
                  v-model="scope.row.f_value"
                  format="HH:mm:ss"
                  value-format="HH:mm:ss"
                  placeholder="选择时间"
                  @change="(val) => handleLocalValueChange(scope.row, val)"
              />

              <el-radio-group
                  v-if="scope.row.f_type === '5'"
                  v-model="scope.row.f_value"
                  @change="(val) => handleLocalValueChange(scope.row, val)"
              >
                <el-radio :value="getActiveValue(scope.row)">开启</el-radio>
                <el-radio :value="getInactiveValue(scope.row)">关闭</el-radio>
              </el-radio-group>
            </div>
            <span v-else>{{ scope.row.direct_value || scope.row.f_value }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.visible ? 'success' : 'danger'">
              {{ scope.row.visible ? '可用' : '不可用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      -->
    </el-card>

    <!-- 操作日志 -->
    <el-card>
      <template #header>
        <div class="log-header">
          <span>操作日志</span>
          <div class="log-controls">
            <el-input
              v-model="logFilter.targetName"
              placeholder="搜索目标名称"
              style="width: 150px; margin-right: 10px"
              @keyup.enter="fetchOperationLogs"
              clearable
              size="small"
            />
            <el-date-picker
              v-model="logDateRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              @change="fetchOperationLogs"
              style="margin-right: 10px"
              size="small"
            />
            <el-button type="primary" @click="fetchOperationLogs" size="small">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
            <el-button type="danger" @click="clearLogs" size="small">
              <el-icon><Delete /></el-icon>
              清空
            </el-button>
          </div>
        </div>
      </template>

      <!-- 操作日志表格 -->
      <el-table :data="operationLogs" style="width: 100%">
        <el-table-column prop="operation_type" label="操作类型" width="100" />
        <el-table-column prop="target_name" label="操作目标" width="200" />
        <el-table-column label="操作详情" min-width="250">
          <template #default="scope">
            <div class="operation-detail">
              <span class="change-info">
                <el-tag size="small" type="info">{{
                  scope.row.old_value || "无"
                }}</el-tag>
                <el-icon style="margin: 0 8px"><Right /></el-icon>
                <el-tag size="small" type="success">{{
                  scope.row.new_value
                }}</el-tag>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="operation_time" label="操作时间" width="180">
          <template #default="scope">
            {{ formatDateTime(scope.row.operation_time) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="scope">
            <el-tag
              :type="scope.row.status === 1 ? 'success' : 'danger'"
              size="small"
            >
              {{ scope.row.status === 1 ? "成功" : "失败" }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页组件 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="logCurrentPage"
          :page-size="logPageSize"
          :total="logTotal"
          layout="total, prev, pager, next"
          @current-change="handleLogPageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import useUserStore from "@/stores"; // 引入仓库
import axios from "axios";
import { ElMessage, ElMessageBox } from "element-plus";
import { inject, onMounted, ref } from "vue";

const $baseUrl = inject("$baseUrl");

// 获取userStore仓库
const $store = useUserStore();
const configs = ref([]); // 全局指令
const localConfigs = ref([]); // 局部指令
const devices = ref([]);
const isAuto = ref(false); // 自动模式标志
const sliderValues = ref({});

// 操作日志相关
const operationLogs = ref([]);
const logTotal = ref(0);
const logCurrentPage = ref(1);
const logPageSize = ref(10);
const logDateRange = ref([]);
const logFilter = ref({
  targetName: "",
});

// 存储原始值的映射，用于记录操作前的值
const originalValues = ref({});

// 处理滑块值变化
const handleSliderChange = async (row, newValue) => {
  // 在操作前保存原始值
  if (!(row.id in originalValues.value)) {
    originalValues.value[row.id] =
      sliderValues.value[row.id] || row.direct_value;
  }

  const numericValue = Number(newValue);

  sliderValues.value[row.id] = numericValue;

  await handleValueChange(row, String(numericValue));
};

// 解析f_value
const parseDeviceOptions = (fValue) => {
  if (!fValue || typeof fValue !== "string") return [];

  // 分割选项，例如 "档位1:AF1|档位2:AF2|档位3:AF3|关闭:DF1"
  const options = fValue.split("|").map((option) => {
    const [label, value] = option.split(":");
    return { label, value };
  });
  return options;
};

// 记录操作日志（简化版）
const recordOperationLog = async (
  operationType,
  targetName,
  oldValue,
  newValue,
  status = 1
) => {
  try {
    await axios.post($baseUrl + "/api/operation-log", {
      operation_type: operationType,
      target_name: targetName,
      old_value: oldValue,
      new_value: newValue,
      status: status,
    });
  } catch (error) {
    console.error("记录操作日志失败:", error);
  }
};

// 发送可调灯指令
const sendLightCommand = async (sceneId, value) => {
  try {
    await axios.post($baseUrl + "/api/send-direct", {
      topic: "send",
      message: {
        scene: sceneId,
        device: "light",
        action: String(value),
      },
    });
    console.log(`机房 ${sceneId} 控制指令发送成功：${value}`);
  } catch (error) {
    console.error(`机房 ${sceneId} 控制指令发送失败：`, error);
    ElMessage.error("设备控制失败");
  }
};

const getInactiveValue = (row) => {
  if (row.f_value && row.f_value.includes("|")) {
    const [offValue] = row.f_value.split("|");
    const value = offValue.split(":")[1];
    return value;
  }
  return "off";
};

const getActiveValue = (row) => {
  if (row.f_value && row.f_value.includes("|")) {
    const [, onValue] = row.f_value.split("|");
    const value = onValue.split(":")[1];
    return value;
  }
  return "on";
};

const fetchConfigs = async () => {
  try {
    const response = await axios.get($baseUrl + "/api/config");

    // 区分全局指令和局部指令
    const allConfigs = response.data.data;

    // 全局指令（mode='1'）
    configs.value = allConfigs.filter((config) => config.mode === "1");

    // 初始化滑块值和原始值
    configs.value.forEach((config) => {
      if (config.f_type === "3") {
        sliderValues.value[config.id] = Number(config.direct_value);
      }
      // 初始化原始值映射
      originalValues.value[config.id] = config.direct_value;
    });

    // 局部指令（mode='0'）
    localConfigs.value = allConfigs.filter((config) => config.mode === "0");
  } catch (error) {
    ElMessage.error("获取配置列表失败");
    console.error("获取配置失败:", error);
  }
};

// 处理全局指令值变化
const handleValueChange = async (row, newValue) => {
  // 获取操作前的原始值
  const oldValue = originalValues.value[row.id] || row.direct_value;

  try {
    let value = newValue;

    if (row.f_type === "1" || row.f_type === "5") {
      value = String(newValue);
    }

    if (row.f_type === "3") {
      value = String(newValue);
    }

    // 更新数据库
    await axios.put($baseUrl + `/api/direct/${row.id}`, {
      value: value,
    });

    // 发送控制指令
    if (row.t_name === "机房1灯泡开关") {
      await sendLightCommand("01", value);
    } else if (row.t_name === "机房2灯泡开关") {
      await sendLightCommand("02", value);
    } else if (row.t_name === "机房3灯泡开关") {
      await sendLightCommand("03", value);
    }

    // 记录操作日志
    await recordOperationLog("指令操作", row.t_name, oldValue, value, 1);

    // 更新原始值为新值，为下次操作做准备
    originalValues.value[row.id] = value;
    // 更新行数据
    row.direct_value = value;

    ElMessage.success("更新成功");
    fetchConfigs();
    fetchOperationLogs(); // 刷新操作日志
  } catch (error) {
    // 记录失败日志
    await recordOperationLog("指令操作", row.t_name, oldValue, newValue, 0);

    ElMessage.error("更新失败");
    console.error("更新失败:", error);
  }
};

// 获取操作日志
const fetchOperationLogs = async () => {
  try {
    const params = {
      page: logCurrentPage.value,
      pageSize: logPageSize.value,
    };

    if (logDateRange.value && logDateRange.value.length === 2) {
      params.startTime = logDateRange.value[0];
      params.endTime = logDateRange.value[1];
    }

    if (logFilter.value.targetName) {
      params.targetName = logFilter.value.targetName;
    }

    const response = await axios.get($baseUrl + "/api/operation-logs", {
      params,
    });
    operationLogs.value = response.data.data;
    logTotal.value = response.data.total;
  } catch (error) {
    ElMessage.error("获取操作日志失败");
    console.error("获取操作日志失败:", error);
  }
};

// 处理日志分页变化
const handleLogPageChange = (current) => {
  logCurrentPage.value = current;
  fetchOperationLogs();
};

// 清空日志
const clearLogs = async () => {
  try {
    await ElMessageBox.confirm(
      "确定要清空所有操作日志吗？此操作不可恢复！",
      "警告",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    await axios.delete($baseUrl + "/api/operation-logs");
    ElMessage.success("日志清空成功");
    fetchOperationLogs();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("清空日志失败");
      console.error("清空日志失败:", error);
    }
  }
};

// 格式化时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN");
};

// 根据行的可见性返回行的类名
const getRowClassName = (row) => {
  return row.row.visible ? "" : "hidden-row";
};

onMounted(() => {
  fetchConfigs();
  fetchOperationLogs();
});
</script>

<style scoped lang="scss">
.container {
  width: 1200px;
  margin: 20px auto;
  padding: 0 20px;

  .header {
    margin-bottom: 20px;
    display: flex;
    gap: 10px;
    justify-content: left;
    align-items: center;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .log-controls {
      display: flex;
      align-items: center;
    }
  }

  .operation-detail {
    .change-info {
      display: flex;
      align-items: center;
    }
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .device-select {
    margin: 20px 0;
    display: flex;
    align-items: center;
    gap: 20px;

    h2 {
      margin: 0;
      font-size: 18px;
    }
  }

  .el-slider {
    width: 200px;
  }

  .el-time-picker {
    width: 200px;
  }

  .el-input {
    width: 200px;
  }

  .el-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  // 添加隐藏行的样式
  :deep(.hidden-row) {
    background-color: #f5f7fa !important;
    color: #909399 !important;
    cursor: not-allowed;

    // 确保在hover状态下仍然保持灰色背景
    &:hover > td {
      background-color: #f0f2f5 !important;
    }

    // 防止文本选择
    td {
      user-select: none;
    }

    // 可选：添加轻微的不透明度效果
    opacity: 0.8;
  }
}
</style>