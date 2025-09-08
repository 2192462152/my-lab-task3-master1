<template>
  <div class="power-comparison-chart-container">
    <!-- 功率曲线对比图 -->
    <div class="chart-section">
      <div ref="powerChartRef" class="power-chart" v-loading="loading"></div>
      <div v-if="!powerData || Object.keys(powerData).length === 0" class="no-data">
        <el-empty description="暂无功率数据" :image-size="150"></el-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  powerData: {
    type: Object,
    default: () => ({})
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const powerChartRef = ref(null)
let powerChart = null

// 初始化功率图表
const initPowerChart = () => {
  if (!powerChartRef.value) return
  
  if (powerChart) {
    powerChart.dispose()
  }
  powerChart = echarts.init(powerChartRef.value)
  
  // 监听窗口大小变化
  const handleResize = () => {
    if (powerChart) {
      powerChart.resize()
    }
  }
  
  window.addEventListener('resize', handleResize)
  
  // 在组件卸载时移除监听器
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })
}

// 更新功率图表
const updatePowerChart = () => {
  if (!powerChart || !props.powerData || Object.keys(props.powerData).length === 0) return

  // 准备图表数据 - 使用 '01', '02', '03'
  const fridgeIds = ['01', '02', '03']
  const colors = ['#409EFF', '#67C23A', '#E6A23C']
  
  // 获取所有时间点（取最长的时间序列）
  let allTimes = []
  fridgeIds.forEach(fridgeId => {
    if (props.powerData[fridgeId] && props.powerData[fridgeId].length > 0) {
      const times = props.powerData[fridgeId].map(item => item.c_time)
      if (times.length > allTimes.length) {
        allTimes = times
      }
    }
  })

  // 准备系列数据
  const series = fridgeIds.map((fridgeId, index) => {
    const data = props.powerData[fridgeId] || []
    const powers = data.map(item => item.power)
    
    return {
      name: `${fridgeId}号冰箱`,
      type: 'line',
      data: powers,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2
      },
      itemStyle: {
        color: colors[index]
      }
    }
  })

  const option = {
    title: {
      text: '三个冰箱功率对比曲线',
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: function(params) {
        let result = `${params[0].axisValue}<br/>`
        params.forEach(param => {
          result += `${param.seriesName}: ${param.value} W<br/>`
        })
        return result
      }
    },
    legend: {
      data: fridgeIds.map(id => `${id}号冰箱`),
      top: 30
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
      data: allTimes,
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
    series: series
  }

  powerChart.setOption(option)
}

// 监听powerData变化
watch(() => props.powerData, () => {
  nextTick(() => {
    updatePowerChart()
  })
}, { deep: true })

onMounted(() => {
  initPowerChart()
  if (props.powerData && Object.keys(props.powerData).length > 0) {
    nextTick(() => {
      updatePowerChart()
    })
  }
})

onUnmounted(() => {
  if (powerChart) {
    powerChart.dispose()
  }
})
</script>

<style lang="scss" scoped>
.power-comparison-chart-container {
  width: 100%;
  
  .chart-section {
    .power-chart {
      width: 100%;
      height: 400px;
    }

    .no-data {
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
