<template>
  <div class="power-chart-container">
    <div class="chart-header">
      <h3>冰箱功率曲线</h3>
      <div class="chart-controls">
        <el-select v-model="chartType" placeholder="请选择图表类型" @change="updateChart" style="width: 120px;">
          <el-option label="曲线图" value="line" />
          <el-option label="柱状图" value="bar" />
        </el-select>
        <el-button type="primary" size="small" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>
    <div ref="chartRef" class="chart" v-loading="loading"></div>
    <div v-if="!powerData || powerData.length === 0" class="no-data">
      <el-empty description="暂无功率数据" :image-size="150"></el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

const props = defineProps({
  roomId: {
    type: String,
    required: true
  }
})

const chartRef = ref(null)
const chartType = ref('line')
const powerData = ref([])
const loading = ref(false)
let chart = null

// 获取功率数据
const fetchPowerData = async () => {
  if (!props.roomId) return
  
  loading.value = true
  try {
    const response = await axios.get('http://localhost:3000/api/power-data', {
      params: {
        deviceId: props.roomId,
        limit: 20 // 获取最近20条数据
      }
    })
    
    if (response.data && response.data.data) {
      powerData.value = response.data.data
      await nextTick()
      updateChart()
    }
  } catch (error) {
    console.error('获取功率数据失败:', error)
    ElMessage.error('获取功率数据失败')
  } finally {
    loading.value = false
  }
}

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return
  
  if (chart) {
    chart.dispose()
  }
  chart = echarts.init(chartRef.value)
  
  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    if (chart) {
      chart.resize()
    }
  })
}

// 更新图表
const updateChart = () => {
  if (!chart || !powerData.value || powerData.value.length === 0) return

  // 准备数据
  const times = powerData.value.map(item => item.c_time)
  const powers = powerData.value.map(item => item.power)

  const option = {
    title: {
      text: '功率变化趋势',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'normal'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        const param = params[0]
        return `${param.axisValue}<br/>功率: ${param.value} W`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: {
        rotate: 45,
        formatter: function(value) {
          // 只显示时间部分
          return value.split(' ')[1] || value
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '功率 (W)',
      axisLabel: {
        formatter: '{value} W'
      }
    },
    series: [{
      name: '功率',
      type: chartType.value,
      smooth: chartType.value === 'line',
      data: powers,
      itemStyle: {
        color: '#409EFF'
      },
      areaStyle: chartType.value === 'line' ? {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0, color: 'rgba(64, 158, 255, 0.3)'
          }, {
            offset: 1, color: 'rgba(64, 158, 255, 0.1)'
          }]
        }
      } : null,
      label: {
        show: false
      }
    }]
  }

  chart.setOption(option, true)
}

// 刷新数据
const refreshData = () => {
  fetchPowerData()
}

// 监听房间ID变化
watch(() => props.roomId, (newRoomId) => {
  if (newRoomId) {
    fetchPowerData()
  }
})

// 监听图表类型变化
watch(chartType, () => {
  updateChart()
})

onMounted(() => {
  initChart()
  if (props.roomId) {
    fetchPowerData()
  }
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
  }
  window.removeEventListener('resize', () => {
    if (chart) {
      chart.resize()
    }
  })
})

// 注册组件
defineOptions({
  components: {
    Refresh
  }
})
</script>

<style lang="scss" scoped>
.power-chart-container {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h3 {
    margin: 0;
    color: #303133;
    font-size: 18px;
    font-weight: 600;
  }
  
  .chart-controls {
    display: flex;
    gap: 10px;
    align-items: center;
  }
}

.chart {
  width: 100%;
  height: 400px;
  min-height: 400px;
}

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
}
</style>