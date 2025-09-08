<template>
  <div class="chart-container">
    <div class="chart-header">
      <el-select v-model="chartType" placeholder="请选择图表类型" @change="updateChart">
        <el-option label="柱状图" value="bar" />
        <el-option label="折线图" value="line" />
      </el-select>
    </div>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  header: {
    type: Array,
    required: true
  },
  units: {
    type: Array,
    required: true
  }
})

const chartRef = ref(null)
const chartType = ref('bar')
let chart = null

// 初始化图表
const initChart = () => {
  if (chart) {
    chart.dispose()
  }
  chart = echarts.init(chartRef.value)
}

// 更新图表
const updateChart = () => {
  if (!chart || !props.data || !props.data.length) return

  const latestData = props.data[0]
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        return params.map(param => {
          const unit = props.units[props.header.indexOf(param.seriesName)] || ''
          return `${param.seriesName}: ${param.value}${unit}`
        }).join('<br/>')
      }
    },
    legend: {
      data: props.header
    },
    xAxis: {
      type: 'category',
      data: ['当前数据']
    },
    yAxis: {
      type: 'value'
    },
    series: props.header.map((item, index) => ({
      name: item,
      type: chartType.value,
      data: [latestData[item]],
      label: {
        show: true,
        formatter: function(params) {
          return params.value + props.units[index]
        }
      }
    }))
  }

  chart.setOption(option)
}

// 监听数据变化
watch(
    () => props.data,
    () => {
      updateChart()
    },
    { deep: true }
)

// 监听图表类型变化
watch(chartType, () => {
  updateChart()
})

onMounted(() => {
  initChart()
  updateChart()
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
  }
})
</script>

<style scoped>
.chart-container {
  margin-top: 20px;
}

.chart-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: flex-end;
}

.chart {
  width: 100%;
  height: 400px;
}
</style>