<template>
  <div class="container">
    <el-card>
      <div class="header">
        <h1>冰箱导航</h1>
        <el-button type="primary" @click="showDialog">
          <el-icon :size="15" style="margin-right: 5px">
            <Plus />
          </el-icon>
          添加冰箱
        </el-button>
      </div>

      <!-- 机房卡片网络布局 -->
      <div class="room-grid">
        <el-card
          v-for="room in rooms"
          :key="room.id"
          class="room-card"
          :body-style="{ padding: '0px' }"
          shadow="hover"
          @click="goToRoomDetail(room)"
        >
          <div class="room-image">
            <el-icon :size="60" color="#409EFF">
              <OfficeBuilding />
            </el-icon>
          </div>
          <div class="room-info">
            <h3>{{ room.device_name }}</h3>
            <p class="room-number">编号: {{ room.number }}</p>
            <p class="room-status">
              <el-tag :type="getRoomStatusType(room)" size="small">
                {{ getRoomStatusText(room) }}
              </el-tag>
            </p>
            <p class="room-desc">{{ room.remarks || "暂无描述" }}</p>
            <div class="room-actions">
              <el-button
                type="primary"
                size="small"
                @click.stop="editRoom(room)"
              >
                编辑
              </el-button>
              <el-button
                type="info"
                size="small"
                @click.stop="goToRoomDetail(room)"
              >
                详情
              </el-button>
              <el-popconfirm
                title="确定要删除这个冰箱吗？"
                @confirm="deleteRoom(room.id)"
                @click.stop
              >
                <template #reference>
                  <el-button type="danger" size="small" @click.stop>
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </el-card>
      </div>

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

    <!-- 功率对比图卡片 -->
    <el-card class="power-comparison-card" style="margin: 20px 0">
      <template #header>
        <div class="card-header">
          <span>冰箱功率对比分析</span>
          <el-button
            type="primary"
            size="small"
            @click="refreshPowerData"
            :loading="powerLoading"
          >
            <el-icon><Refresh /></el-icon>
            刷新数据
          </el-button>
        </div>
      </template>

      <!-- 统计信息展示 -->
      <div class="statistics-section">
        <div class="stats-row">
          <div
            class="stat-item"
            v-for="fridgeId in ['01', '02', '03']"
            :key="fridgeId"
          >
            <h4>{{ fridgeId }}号冰箱</h4>
            <div class="stat-details">
              <div class="stat-detail">
                <span class="label">最高功率:</span>
                <span class="value max"
                  >{{ statistics[fridgeId]?.maxPower || 0 }} W</span
                >
              </div>
              <div class="stat-detail">
                <span class="label">最低功率:</span>
                <span class="value min"
                  >{{ statistics[fridgeId]?.minPower || 0 }} W</span
                >
              </div>
              <div class="stat-detail">
                <span class="label">平均功率:</span>
                <span class="value avg"
                  >{{ statistics[fridgeId]?.avgPower || 0 }} W</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- 平均功率对比 -->
        <div
          class="electricity-section"
          v-if="lowestAvgPowerFridge || highestAvgPowerFridge"
        >
          <h4>平均功率对比</h4>
          <div class="electricity-row">
            <div class="electricity-item lowest" v-if="lowestAvgPowerFridge">
              <el-icon><TrendCharts /></el-icon>
              <div class="electricity-content">
                <span
                  >平均功率最低: {{ lowestAvgPowerFridge.fridgeId }}号冰箱 ({{
                    lowestAvgPowerFridge.avgPower
                  }}
                  W)</span
                >
              </div>
            </div>
            <div class="electricity-item highest" v-if="highestAvgPowerFridge">
              <el-icon><TrendCharts /></el-icon>
              <div class="electricity-content">
                <span
                  >平均功率最高: {{ highestAvgPowerFridge.fridgeId }}号冰箱 ({{
                    highestAvgPowerFridge.avgPower
                  }}
                  W)</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 使用新的功率对比图表组件 -->
      <PowerComparisonChart :powerData="powerData" :loading="powerLoading" />
    </el-card>

    <!-- 添加/编辑设备对话框 -->
    <el-dialog
      :title="isEditing ? '编辑冰箱' : '添加冰箱'"
      v-model="dialogVisible"
      width="30%"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="冰箱名称">
          <el-input v-model="form.device_name" placeholder="请输入冰箱名称" />
        </el-form-item>
        <el-form-item label="冰箱编号">
          <el-input v-model="form.number" placeholder="请输入冰箱编号" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.remarks"
            type="textarea"
            placeholder="请输入冰箱描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import PowerComparisonChart from "@/components/PowerComparisonChart.vue";
import { Plus, Refresh, TrendCharts } from "@element-plus/icons-vue";
import axios from "axios";
import { ElMessage } from "element-plus";
import { inject, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";

const $baseUrl = inject("$baseUrl");

const $router = useRouter();

// 响应式状态
const rooms = ref([]);
const total = ref(0); // 总数据条数
const currentPage = ref(1); // 当前页码
const pageSize = ref(9); // 默认最大条数
const form = reactive({
  device_name: "",
  number: "",
  remarks: "",
});
const isEditing = ref(false);
const editingId = ref(null);
const dialogVisible = ref(false);

// 功率对比相关状态
const powerData = ref({});
const statistics = ref({});
const powerLoading = ref(false);
let ws = null;

// 平均功率最低和最高的冰箱
const lowestAvgPowerFridge = ref(null);
const highestAvgPowerFridge = ref(null);

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

        // 可以移除 electricityUpdate 相关的处理，因为不再需要实时耗电量数据
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

// 获取功率对比数据
const fetchPowerData = async () => {
  powerLoading.value = true;
  try {
    const response = await axios.get($baseUrl + "/power-comparison", {
      params: {
        limit: 1000, // 获取最近1000条数据
      },
    });

    if (response.data) {
      powerData.value = response.data.data;
      statistics.value = response.data.statistics;
      lowestAvgPowerFridge.value = response.data.lowestAvgPowerFridge;
      highestAvgPowerFridge.value = response.data.highestAvgPowerFridge;
    }
  } catch (error) {
    console.error("获取功率对比数据失败:", error);
    ElMessage.error("获取功率对比数据失败");
  } finally {
    powerLoading.value = false;
  }
};

// 刷新功率数据
const refreshPowerData = () => {
  fetchPowerData();
};

// 获取机房状态类型
const getRoomStatusType = (room) => {
  // 这里可以根据实际业务逻辑判断机房状态
  return "success"; // 暂时都显示为正常状态
};

// 获取机房状态文本
const getRoomStatusText = (room) => {
  return "运行正常";
};

// 跳转到机房详情页面
const goToRoomDetail = (room) => {
  $router.push({
    name: "RoomDetail",
    params: { roomId: room.number },
  });
};

// 显示对话框
const showDialog = () => {
  isEditing.value = false;
  resetForm();
  dialogVisible.value = true;
};

// 获取设备列表
const fetchRooms = async () => {
  try {
    const response = await axios.get($baseUrl + "/devices", {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
      },
    });
    rooms.value = response.data.data;
    total.value = response.data.total;
  } catch (error) {
    ElMessage.error("获取设备列表失败");
    console.error("获取设备失败:", error);
  }
};

// 处理页码的变化
const handleCurrentChange = (current) => {
  currentPage.value = current;
  fetchRooms();
};

// 提交表单
const submitForm = async () => {
  try {
    if (isEditing.value) {
      await axios.put($baseUrl + `/devices/${editingId.value}`, form);
      ElMessage.success("更新成功");
    } else {
      await axios.post($baseUrl + "/devices", form);
      ElMessage.success("添加成功");
    }
    dialogVisible.value = false;
    resetForm();
    await fetchRooms();
  } catch (error) {
    ElMessage.error(isEditing.value ? "更新失败" : "添加失败");
    console.error("提交表单失败:", error);
  }
};

// 删除设备
const deleteRoom = async (id) => {
  try {
    await axios.delete($baseUrl + `/devices/${id}`);
    ElMessage.success("删除成功");
    await fetchRooms();
  } catch (error) {
    ElMessage.error("删除失败");
    console.error("删除冰箱失败:", error);
  }
};

// 编辑设备
const editRoom = (room) => {
  form.device_name = room.device_name;
  form.number = room.number;
  form.remarks = room.remarks;
  editingId.value = room.id;
  isEditing.value = true;
  dialogVisible.value = true;
};

// 重置表单
const resetForm = () => {
  form.device_name = "";
  form.number = "";
  form.remarks = "";
  isEditing.value = false;
  editingId.value = null;
};

// 组件挂载时获取数据
onMounted(() => {
  fetchRooms();
  initWebSocket();
  fetchPowerData();
});

// 组件卸载时清理资源
onUnmounted(() => {
  if (ws) {
    ws.close();
  }
});
</script>

<style lang="scss" scoped>
.container {
  width: 1200px;
  margin: 20px auto;
  padding: 0 20px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .room-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
  }

  .room-card {
    cursor: pointer;
    transition: transform 0.2s ease;
    border-radius: 8px;
    overflow: hidden;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .room-image {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .room-info {
      padding: 16px;

      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }

      .room-number {
        margin: 4px 0;
        color: #909399;
        font-size: 14px;
      }

      .room-status {
        margin: 8px 0;
      }

      .room-desc {
        margin: 8px 0 16px 0;
        color: #606266;
        font-size: 14px;
        line-height: 1.4;
        min-height: 40px;
      }

      .room-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    }
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: center;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .power-comparison-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
      font-weight: bold;
    }

    .statistics-section {
      margin-bottom: 20px;

      .stats-row {
        display: flex;
        justify-content: space-around;
        margin-bottom: 20px;

        .stat-item {
          flex: 1;
          text-align: center;
          padding: 0 10px;

          h4 {
            margin: 0 0 10px 0;
            color: #303133;
            font-size: 16px;
          }

          .stat-details {
            .stat-detail {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              padding: 0 10px;

              .label {
                color: #909399;
                font-size: 14px;
              }

              .value {
                font-weight: bold;
                font-size: 14px;

                &.max {
                  color: #f56c6c;
                }

                &.min {
                  color: #67c23a;
                }

                &.avg {
                  color: #409eff;
                }
              }
            }
          }
        }
      }

      .electricity-section {
        border-top: 1px solid #ebeef5;
        padding-top: 15px;

        h4 {
          margin: 0 0 10px 0;
          color: #303133;
          text-align: center;
        }

        .electricity-row {
          display: flex;
          justify-content: space-around;

          .electricity-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;

            .electricity-content {
              display: flex;
              flex-direction: column;
              gap: 4px;

              .avg-power-info {
                font-size: 12px;
                opacity: 0.8;
                font-weight: normal;
              }
            }

            &.lowest {
              background-color: #f0f9ff;
              color: #67c23a;
            }

            &.highest {
              background-color: #fef0f0;
              color: #f56c6c;
            }
          }
        }
      }
    }
  }
}
</style>