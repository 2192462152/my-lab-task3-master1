<template>
	<view class="direct-container">
	  <!-- 指令配置列表 -->
	  <view class="config-section">
		<view class="section-header">
		  <text class="title">指令配置</text>
		</view>
		
		<scroll-view scroll-y class="config-list">
		  <view v-for="config in configs" :key="config.id" class="config-item" :class="{ disabled: !config.visible }">
			<view class="config-header">
			  <text class="config-name">{{ config.t_name }}</text>
			  <view class="config-status">
				<text :class="['status-tag', config.visible ? 'available' : 'unavailable']">
				  {{ config.visible ? '可用' : '不可用' }}
				</text>
			  </view>
			</view>
			
			<view class="config-control" v-if="config.visible">
			  <!-- 开关类型 -->
			  <view v-if="config.f_type === '1'" class="control-switch">
				<switch 
				  :checked="config.direct_value === getActiveValue(config)"
				  @change="(e) => handleSwitchChange(config, e)"
				  color="#007AFF"
				/>
			  </view>
			  
			  <!-- 输入框类型 -->
			  <view v-else-if="config.f_type === '2'" class="control-input">
				<input 
				  v-model="config.direct_value"
				  placeholder="请输入值"
				  @blur="() => handleValueChange(config, config.direct_value)"
				  class="input-field"
				/>
			  </view>
			  
			  <!-- 滑块类型 -->
			  <view v-else-if="config.f_type === '3'" class="control-slider">
				<slider 
				  :value="Number(config.direct_value) || 0"
				  :min="config.min ? Number(config.min) : 0"
				  :max="config.max ? Number(config.max) : 100"
				  @change="(e) => handleSliderChange(config, e.detail.value)"
				  activeColor="#007AFF"
				  backgroundColor="#f5f6fa"
				  block-color="#007AFF"
				  block-size="24"
				  show-value
				/>
			  </view>
			  
			  <!-- 时间选择类型 -->
			  <view v-else-if="config.f_type === '4'" class="control-time">
				<picker 
				  mode="time"
				  :value="config.direct_value"
				  @change="(e) => handleValueChange(config, e.detail.value)"
				>
				  <view class="time-picker">
					<text>{{ config.direct_value || '选择时间' }}</text>
					<text class="picker-arrow">▼</text>
				  </view>
				</picker>
			  </view>
			  
			  <!-- 单选类型 -->
			  <view v-else-if="config.f_type === '5'" class="control-radio">
				<radio-group @change="(e) => handleValueChange(config, e.detail.value)">
				  <label v-for="option in parseDeviceOptions(config.f_value)" :key="option.value" class="radio-item">
					<radio :value="option.value" :checked="config.direct_value === option.value" color="#007AFF" />
					<text class="radio-text">{{ option.label }}</text>
				  </label>
				</radio-group>
			  </view>
			</view>
			
			<view v-else class="config-value">
			  <text class="disabled-value">{{ config.direct_value || config.f_value }}</text>
			</view>
		  </view>
		</scroll-view>
	  </view>
  
	  <!-- 操作日志 -->
	  <view class="log-section">
		<view class="section-header">
		  <text class="title">操作日志</text>
		  <view class="log-controls">
			<input 
			  v-model="logFilter.targetName"
			  placeholder="搜索目标名称"
			  class="search-input"
			  @confirm="fetchOperationLogs"
			/>
			<button class="search-btn" @click="fetchOperationLogs">查询</button>
			<button class="clear-btn" @click="showClearDialog">清空</button>
		  </view>
		</view>
  
		<!-- 时间筛选 -->
		<view class="time-filter">
		  <view class="time-item">
			<text class="time-label">开始时间:</text>
			<picker mode="date" :value="logStartDate" @change="onLogStartDateChange">
			  <view class="time-picker">
				<text>{{ logStartDate || '选择日期' }}</text>
				<text class="picker-arrow">▼</text>
			  </view>
			</picker>
			<picker mode="time" :value="logStartTime" @change="onLogStartTimeChange">
			  <view class="time-picker">
				<text>{{ logStartTime || '选择时间' }}</text>
				<text class="picker-arrow">▼</text>
			  </view>
			</picker>
		  </view>
		  <view class="time-item">
			<text class="time-label">结束时间:</text>
			<picker mode="date" :value="logEndDate" @change="onLogEndDateChange">
			  <view class="time-picker">
				<text>{{ logEndDate || '选择日期' }}</text>
				<text class="picker-arrow">▼</text>
			  </view>
			</picker>
			<picker mode="time" :value="logEndTime" @change="onLogEndTimeChange">
			  <view class="time-picker">
				<text>{{ logEndTime || '选择时间' }}</text>
				<text class="picker-arrow">▼</text>
			  </view>
			</picker>
		  </view>
		</view>
		
		<scroll-view scroll-y class="log-list">
		  <view v-for="log in operationLogs" :key="log.id" class="log-item">
			<view class="log-header">
			  <text class="operation-type">{{ log.operation_type }}</text>
			  <text class="operation-time">{{ formatDateTime(log.operation_time) }}</text>
			</view>
			<view class="log-content">
			  <text class="target-name">{{ log.target_name }}</text>
			  <view class="value-change">
				<text class="old-value">{{ log.old_value || '无' }}</text>
				<text class="arrow">→</text>
				<text class="new-value">{{ log.new_value }}</text>
			  </view>
			  <view class="log-status">
				<text :class="['status-tag', log.status === 1 ? 'success' : 'failed']">
				  {{ log.status === 1 ? '成功' : '失败' }}
				</text>
			  </view>
			</view>
		  </view>
		</scroll-view>
  
		<!-- 日志分页 -->
		<view class="pagination">
		  <button :disabled="logCurrentPage <= 1" @click="prevLogPage" class="page-btn">上一页</button>
		  <text class="page-info">第 {{ logCurrentPage }} 页，共 {{ Math.ceil(logTotal / logPageSize) }} 页</text>
		  <button :disabled="logCurrentPage >= Math.ceil(logTotal / logPageSize)" @click="nextLogPage" class="page-btn">下一页</button>
		</view>
	  </view>
  
	  <!-- 清空日志确认对话框 -->
	  <uni-popup ref="clearPopup" type="dialog">
		<uni-popup-dialog 
		  title="确认清空"
		  content="确定要清空所有操作日志吗？此操作不可恢复！"
		  @confirm="confirmClearLogs"
		  @close="closeClearDialog"
		/>
	  </uni-popup>
	</view>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import config from '@/utils/config.js'
  
  // 指令配置相关
  const configs = ref([]);
  const sliderValues = ref({});
  const originalValues = ref({});
  
  // 操作日志相关
  const operationLogs = ref([]);
  const logTotal = ref(0);
  const logCurrentPage = ref(1);
  const logPageSize = ref(10);
  const logFilter = ref({
	targetName: ''
  });
  
  // 日志时间筛选
  const logStartDate = ref('');
  const logStartTime = ref('');
  const logEndDate = ref('');
  const logEndTime = ref('');
  
  // popup引用
  const clearPopup = ref(null);
  
  // 获取指令配置
  const fetchConfigs = async () => {
	try {
	  const result = await uni.request({
		url: config.API_BASE_URL + '/api/config',
		method: 'GET'
	  });
  
	  if (result.statusCode === 200) {
		const allConfigs = result.data.data;
		configs.value = allConfigs.filter(config => config.mode === '1');
		
		// 初始化滑块值和原始值
		configs.value.forEach(config => {
		  if (config.f_type === '3') {
			sliderValues.value[config.id] = Number(config.direct_value);
		  }
		  originalValues.value[config.id] = config.direct_value;
		});
	  }
	} catch (error) {
	  console.error('获取配置失败:', error);
	  uni.showToast({
		title: '获取配置失败',
		icon: 'none'
	  });
	}
  };
  
  // 获取操作日志
  const fetchOperationLogs = async () => {
	try {
	  const params = {
		page: logCurrentPage.value,
		pageSize: logPageSize.value
	  };
	  
	  if (logStartDate.value && logStartTime.value) {
		params.startTime = `${logStartDate.value} ${logStartTime.value}:00`;
	  }
	  if (logEndDate.value && logEndTime.value) {
		params.endTime = `${logEndDate.value} ${logEndTime.value}:00`;
	  }
	  if (logFilter.value.targetName) {
		params.targetName = logFilter.value.targetName;
	  }
  
	  const result = await uni.request({
		url: config.API_BASE_URL + '/api/operation-logs',
		method: 'GET',
		data: params
	  });
  
	  if (result.statusCode === 200) {
		operationLogs.value = result.data.data;
		logTotal.value = result.data.total;
	  }
	} catch (error) {
	  console.error('获取操作日志失败:', error);
	  uni.showToast({
		title: '获取操作日志失败',
		icon: 'none'
	  });
	}
  };
  
  // 解析设备选项
  const parseDeviceOptions = (fValue) => {
	if (!fValue || typeof fValue !== 'string') return [];
  
	const options = fValue.split('|').map(option => {
	  const [label, value] = option.split(':');
	  return { label, value };
	});
	return options;
  };
  
  // 获取激活值
  const getActiveValue = (row) => {
	if (row.f_value && row.f_value.includes('|')) {
	  const [, onValue] = row.f_value.split('|');
	  const value = onValue.split(':')[1];
	  return value;
	}
	return 'on';
  };
  
  // 获取非激活值
  const getInactiveValue = (row) => {
	if (row.f_value && row.f_value.includes('|')) {
	  const [offValue] = row.f_value.split('|');
	  const value = offValue.split(':')[1];
	  return value;
	}
	return 'off';
  };
  
  // 记录操作日志
  const recordOperationLog = async (operationType, targetName, oldValue, newValue, status = 1) => {
	try {
	  await uni.request({
		url: config.API_BASE_URL + '/api/operation-log',
		method: 'POST',
		data: {
		  operation_type: operationType,
		  target_name: targetName,
		  old_value: oldValue,
		  new_value: newValue,
		  status: status
		}
	  });
	} catch (error) {
	  console.error('记录操作日志失败:', error);
	}
  };
  
  // 发送灯光控制指令
  const sendLightCommand = async (sceneId, value) => {
	try {
	  await uni.request({
		url: config.API_BASE_URL + '/api/send-direct',
		method: 'POST',
		data: {
		  topic: 'send',
		  message: {
			scene: sceneId,
			device: "light",
			action: String(value)
		  }
		}
	  });
	  console.log(`机房 ${sceneId} 控制指令发送成功：${value}`);
	} catch (error) {
	  console.error(`机房 ${sceneId} 控制指令发送失败：`, error);
	  uni.showToast({
		title: '设备控制失败',
		icon: 'none'
	  });
	}
  };
  
  // 处理值变化
  const handleValueChange = async (row, newValue) => {
	const oldValue = originalValues.value[row.id] || row.direct_value;
	
	try {
	  let value = newValue;
  
	  if (row.f_type === '1' || row.f_type === '5') {
		value = String(newValue);
	  }
  
	  if (row.f_type === '3') {
		value = String(newValue);
	  }
  
	  // 更新数据库
	  const result = await uni.request({
		url: `${config.API_BASE_URL}/api/direct/${row.id}`,
		method: 'PUT',
		data: { value: value }
	  });
  
	  if (result.statusCode === 200) {
		// 发送控制指令
		if (row.t_name === '机房1灯泡开关') {
		  await sendLightCommand('01', value);
		} else if (row.t_name === '机房2灯泡开关') {
		  await sendLightCommand('02', value);
		} else if (row.t_name === '机房3灯泡开关') {
		  await sendLightCommand('03', value);
		}
  
		// 记录操作日志
		await recordOperationLog('指令操作', row.t_name, oldValue, value, 1);
  
		// 更新原始值
		originalValues.value[row.id] = value;
		row.direct_value = value;
  
		uni.showToast({
		  title: '更新成功',
		  icon: 'success'
		});
  
		fetchConfigs();
		fetchOperationLogs();
	  }
	} catch (error) {
	  // 记录失败日志
	  await recordOperationLog('指令操作', row.t_name, oldValue, newValue, 0);
	  
	  console.error('更新失败:', error);
	  uni.showToast({
		title: '更新失败',
		icon: 'none'
	  });
	}
  };
  
  // 处理开关变化
  const handleSwitchChange = async (row, e) => {
	const newValue = e.detail.value ? getActiveValue(row) : getInactiveValue(row);
	await handleValueChange(row, newValue);
  };
  
  // 处理滑块变化
  const handleSliderChange = async (row, newValue) => {
	if (!(row.id in originalValues.value)) {
	  originalValues.value[row.id] = sliderValues.value[row.id] || row.direct_value;
	}
	
	const numericValue = Number(newValue);
	sliderValues.value[row.id] = numericValue;
	await handleValueChange(row, String(numericValue));
  };
  
  // 时间选择处理
  const onLogStartDateChange = (e) => {
	logStartDate.value = e.detail.value;
  };
  
  const onLogStartTimeChange = (e) => {
	logStartTime.value = e.detail.value;
  };
  
  const onLogEndDateChange = (e) => {
	logEndDate.value = e.detail.value;
  };
  
  const onLogEndTimeChange = (e) => {
	logEndTime.value = e.detail.value;
  };
  
  // 显示清空对话框
  const showClearDialog = () => {
	clearPopup.value.open();
  };
  
  const closeClearDialog = () => {
	// 对话框关闭处理
  };
  
  // 确认清空日志
  const confirmClearLogs = async () => {
	try {
	  const result = await uni.request({
		url: config.API_BASE_URL + '/api/operation-logs',
		method: 'DELETE'
	  });
  
	  if (result.statusCode === 200) {
		uni.showToast({
		  title: '日志清空成功',
		  icon: 'success'
		});
		clearPopup.value.close();
		fetchOperationLogs();
	  }
	} catch (error) {
	  console.error('清空日志失败:', error);
	  uni.showToast({
		title: '清空日志失败',
		icon: 'none'
	  });
	}
  };
  
  // 日志分页处理
  const prevLogPage = () => {
	if (logCurrentPage.value > 1) {
	  logCurrentPage.value--;
	  fetchOperationLogs();
	}
  };
  
  const nextLogPage = () => {
	if (logCurrentPage.value < Math.ceil(logTotal.value / logPageSize.value)) {
	  logCurrentPage.value++;
	  fetchOperationLogs();
	}
  };
  
  // 格式化时间
  const formatDateTime = (dateStr) => {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	return date.toLocaleString('zh-CN');
  };
  
  onMounted(() => {
	fetchConfigs();
	fetchOperationLogs();
  });
  </script>
  
  <style lang="scss">
  .direct-container {
	padding: 20rpx;
	background: #f5f6fa;
	min-height: 100vh;
  
	.config-section, .log-section {
	  background: #fff;
	  border-radius: 16rpx;
	  padding: 20rpx;
	  margin-bottom: 20rpx;
	  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  
	  .section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20rpx;
		padding-bottom: 15rpx;
		border-bottom: 1px solid #eee;
  
		.title {
		  font-size: 32rpx;
		  color: #333;
		  font-weight: bold;
		}
  
		.log-controls {
		  display: flex;
		  gap: 10rpx;
		  align-items: center;
  
		  .search-input {
			width: 200rpx;
			padding: 8rpx 12rpx;
			border: 1px solid #ddd;
			border-radius: 6rpx;
			font-size: 26rpx;
		  }
  
		  .search-btn, .clear-btn {
			padding: 8rpx 16rpx;
			font-size: 24rpx;
			border-radius: 6rpx;
		  }
  
		  .search-btn {
			background: #007AFF;
			color: #fff;
		  }
  
		  .clear-btn {
			background: #ff4d4f;
			color: #fff;
		  }
		}
	  }
	}
  
	.config-list {
	  max-height: 600rpx;
	}
  
	.config-item {
	  margin-bottom: 20rpx;
	  padding: 20rpx;
	  background: #f8f9fa;
	  border-radius: 12rpx;
  
	  &.disabled {
		opacity: 0.6;
		background: #f5f5f5;
	  }
  
	  .config-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15rpx;
  
		.config-name {
		  font-size: 30rpx;
		  color: #333;
		  font-weight: bold;
		}
  
		.config-status {
		  .status-tag {
			font-size: 24rpx;
			padding: 4rpx 8rpx;
			border-radius: 4rpx;
  
			&.available {
			  background: #f6ffed;
			  color: #52c41a;
			}
  
			&.unavailable {
			  background: #fff2f0;
			  color: #ff4d4f;
			}
		  }
		}
	  }
  
	  .config-control {
		.control-switch {
		  display: flex;
		  justify-content: flex-start;
		}
  
		.control-input {
		  .input-field {
			width: 100%;
			padding: 15rpx;
			border: 1px solid #ddd;
			border-radius: 8rpx;
			font-size: 28rpx;
			background: #fff;
		  }
		}
  
		.control-slider {
		  padding: 10rpx 0;
		}
  
		.control-time {
		  .time-picker {
			padding: 15rpx 20rpx;
			background: #fff;
			border: 1px solid #ddd;
			border-radius: 8rpx;
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 28rpx;
  
			.picker-arrow {
			  color: #999;
			}
		  }
		}
  
		.control-radio {
		  .radio-item {
			display: flex;
			align-items: center;
			margin-bottom: 10rpx;
  
			.radio-text {
			  margin-left: 10rpx;
			  font-size: 28rpx;
			  color: #333;
			}
		  }
		}
	  }
  
	  .config-value {
		.disabled-value {
		  font-size: 28rpx;
		  color: #999;
		}
	  }
	}
  
	.time-filter {
	  margin-bottom: 20rpx;
	  padding: 15rpx;
	  background: #f8f9fa;
	  border-radius: 12rpx;
  
	  .time-item {
		display: flex;
		align-items: center;
		margin-bottom: 10rpx;
		gap: 10rpx;
  
		.time-label {
		  font-size: 26rpx;
		  color: #666;
		  white-space: nowrap;
		}
  
		.time-picker {
		  flex: 1;
		  padding: 10rpx 15rpx;
		  background: #fff;
		  border: 1px solid #ddd;
		  border-radius: 6rpx;
		  display: flex;
		  justify-content: space-between;
		  align-items: center;
		  font-size: 26rpx;
  
		  .picker-arrow {
			color: #999;
		  }
		}
	  }
	}
  
	.log-list {
	  max-height: 600rpx;
	}
  
	.log-item {
	  margin-bottom: 15rpx;
	  padding: 15rpx;
	  background: #f8f9fa;
	  border-radius: 12rpx;
  
	  .log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10rpx;
  
		.operation-type {
		  font-size: 28rpx;
		  color: #333;
		  font-weight: bold;
		}
  
		.operation-time {
		  font-size: 24rpx;
		  color: #999;
		}
	  }
  
	  .log-content {
		.target-name {
		  font-size: 26rpx;
		  color: #666;
		  margin-bottom: 8rpx;
		  display: block;
		}
  
		.value-change {
		  display: flex;
		  align-items: center;
		  gap: 10rpx;
		  margin-bottom: 8rpx;
  
		  .old-value, .new-value {
			font-size: 26rpx;
			padding: 4rpx 8rpx;
			border-radius: 4rpx;
		  }
  
		  .old-value {
			background: #f0f0f0;
			color: #666;
		  }
  
		  .new-value {
			background: #f6ffed;
			color: #52c41a;
		  }
  
		  .arrow {
			font-size: 24rpx;
			color: #999;
		  }
		}
  
		.log-status {
		  .status-tag {
			font-size: 24rpx;
			padding: 4rpx 8rpx;
			border-radius: 4rpx;
  
			&.success {
			  background: #f6ffed;
			  color: #52c41a;
			}
  
			&.failed {
			  background: #fff2f0;
			  color: #ff4d4f;
			}
		  }
		}
	  }
	}
  
	.pagination {
	  display: flex;
	  justify-content: space-between;
	  align-items: center;
	  margin-top: 20rpx;
	  padding-top: 15rpx;
	  border-top: 1px solid #eee;
  
	  .page-btn {
		padding: 10rpx 20rpx;
		font-size: 26rpx;
		border-radius: 6rpx;
		background: #f5f6fa;
		color: #666;
  
		&:disabled {
		  opacity: 0.5;
		}
	  }
  
	  .page-info {
		font-size: 26rpx;
		color: #666;
	  }
	}
  }
  </style>