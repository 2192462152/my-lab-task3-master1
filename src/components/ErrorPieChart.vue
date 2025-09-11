<template>
  <div class="pie-chart-container">
    <div class="chart-header">
      <h3>错误类型统计</h3>
    </div>
    <div v-if="!data || data.length === 0" class="no-data">
      <el-empty description="暂无数据" :image-size="150"></el-empty>
    </div>
    <div v-else ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import * as echarts from "echarts";
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps({
  data: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const chartRef = ref(null);
let chart = null;

// 颜色配置
const colors = [
  "#f56c6c",
  "#e6a23c",
  "#409eff",
  "#67c23a",
  "#909399",
  "#ff7675",
  "#74b9ff",
];

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return;

  if (chart) {
    chart.dispose();
  }
  chart = echarts.init(chartRef.value);
};

// 更新图表
const updateChart = () => {
  if (!chartRef.value) {
    nextTick(() => {
      initChart();
      if (chart) updateChart();
    });
    return;
  }

  if (!chart) {
    console.log("图表实例不存在，初始化图表");
    initChart();
    if (!chart) return;
  }

  if (!props.data || props.data.length === 0) return;

  // 确保canvas存在
  if (chartRef.value.querySelector("canvas") === null) {
    chart.dispose();
    chart = null;
    initChart();
  }

  const option = {
    tooltip: {
      trigger: "item",
      formatter: function (params) {
        const total = props.data.reduce((sum, item) => sum + item.value, 0);
        const percent = ((params.value / total) * 100).toFixed(1);
        return `${params.name}<br/>数量: ${params.value}<br/>占比: ${percent}%`;
      },
    },
    legend: {
      orient: "vertical",
      left: "left",
      top: "middle",
      data: props.data.map((item) => item.name),
    },
    color: colors,
    series: [
      {
        name: "错误统计",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["60%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "outside",
          formatter: function (params) {
            return `${params.name}\n${params.value}`;
          },
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: "bold",
          },
        },
        data: props.data,
      },
    ],
  };

  chart.setOption(option, true);
};

// 监听数据变化
watch(
  () => props.data,
  (newData) => {
    if (newData && newData.length > 0) {
      nextTick(() => {
        if (!chart) {
          initChart();
        }
        updateChart();
      });
    }
  },
  { deep: true, immediate: true }
);

// 添加窗口大小变化的监听
const handleResize = () => {
  if (chart) {
    chart.resize();
  }
};

onMounted(() => {
  initChart();
  if (props.data && props.data.length > 0) {
    updateChart();
  }

  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  if (chart) {
    chart.dispose();
    chart = null;
  }
  window.removeEventListener("resize", handleResize);
});
</script>

<style lang="scss" scoped>
.pie-chart-container {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.chart-header {
  margin-bottom: 10px;

  h3 {
    margin: 0;
    color: #303133;
    font-size: 18px;
    font-weight: 600;
    text-align: center;
  }
}

.chart {
  width: 100%;
  height: 200px;
  min-height: 200px;
}

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}
</style>
