<template>
  <div class="chart-container">
    <div class="chart-header">
      <el-select v-model="chartType" placeholder="请选择图表类型" @change="updateChart">
        <el-option label="柱状图" value="bar" />
        <el-option label="曲线图" value="line" />
      </el-select>
    </div>
    <div ref="chartRef" class="chart" :style="{ display: data && data.length > 0 ? 'block' : 'none' }"></div>
    <div v-if="!data || data.length === 0" class="no-data">
      <el-empty description="暂无数据" :image-size="200"></el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
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
const chartType = ref('line')
let chart = null

// 初始化图表
const initChart = () => {
  // 只有在chartRef元素存在，且数据不为空时初始化图表
  if (!chartRef.value || !props.data || props.data.length === 0) return
  
  if (chart) {
    chart.dispose()
  }
  chart = echarts.init(chartRef.value)
}

// 更新图表
const updateChart = () => {
  // 检查数据是否存在
  if (!props.data || props.data.length === 0) {
    // 如果chart已存在但数据为空，清空图表
    if (chart) {
      chart.dispose()
      chart = null
    }
    return
  }
  
  // 确保chart已初始化
  if (!chart && chartRef.value) {
    initChart()
  }
  
  // 如果初始化失败，直接返回
  if (!chart) return

  // 获取时间数据（倒序排列以保持与表格一致）
  const times = props.data.map(item => item.c_time).reverse()

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        let result = params[0].axisValue + '<br/>'
        params.forEach(param => {
          const unit = props.units[props.header.indexOf(param.seriesName)] || ''
          result += `${param.seriesName}: ${param.value}${unit}<br/>`
        })
        return result
      }
    },
    legend: {
      data: props.header
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: function(value) {
          return value
        }
      }
    },
    series: props.header.map((item, index) => ({
      name: item,
      type: chartType.value,
      smooth:true,
      data: props.data.map(d => d[item]).reverse(),
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
    (newData) => {
      if (newData && newData.length > 0) {
        // 确保DOM已经渲染
        nextTick(() => {
          if (!chart) {
            initChart()
          }
          updateChart()
        })
      }
    },
    { deep: true, immediate: true }
)

// 监听图表类型变化
watch(chartType, () => {
  updateChart()
})

onMounted(() => {
  // 如果数据已经存在，初始化并更新图表
  nextTick(() => {
    if (props.data && props.data.length > 0) {
      initChart()
      updateChart()
    }
  })

  // 添加窗口大小变化的监听
  const handleResize = () => {
    if (chart) {
      chart.resize()
    }
  }
  
  window.addEventListener('resize', handleResize)
  
  onUnmounted(() => {
    if (chart) {
      chart.dispose()
      chart = null
    }
    window.removeEventListener('resize', handleResize)
  })
})
</script>

<style scoped>
.chart-container {
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  min-height: 400px;
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

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
  background-color: #f9f9f9;
  border-radius: 4px;
}
</style>