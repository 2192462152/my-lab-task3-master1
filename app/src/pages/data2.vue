<template>
	<view class="data-container">
		<!-- 设备选择器 -->
		<view class="device-selector">
			<view class="selector-label">选择场景：</view>
			<picker 
				mode="selector"
				:range="deviceList" 
				:value="currentIndex"
				range-key="device_name"
				@change="onDeviceChange"
				class="device-picker"
			>
				<view class="picker-value">
					<text>{{ currentIndex === -1 ? '请选择场景' : deviceList[currentIndex]?.device_name }}</text>
					<text class="picker-arrow">▼</text>
				</view>
			</picker>
		</view>

		<!-- 时间选择器 -->
		<view class="time-selector">
			<view class="time-item">
				<text class="time-label">开始时间：</text>
				<view class="datetime-picker">
					<picker mode="date" :value="startDate" @change="onStartDateChange" class="picker-item">
						<view class="picker-value">
							<text>{{ startDate || '选择日期' }}</text>
							<text class="picker-arrow">▼</text>
						</view>
					</picker>
					<picker mode="time" :value="startTime" @change="onStartTimeChange" class="picker-item">
						<view class="picker-value">
							<text>{{ startTime || '选择时间' }}</text>
							<text class="picker-arrow">▼</text>
						</view>
					</picker>
				</view>
			</view>
			<view class="time-item">
				<text class="time-label">结束时间：</text>
				<view class="datetime-picker">
					<picker mode="date" :value="endDate" @change="onEndDateChange" class="picker-item">
						<view class="picker-value">
							<text>{{ endDate || '选择日期' }}</text>
							<text class="picker-arrow">▼</text>
						</view>
					</picker>
					<picker mode="time" :value="endTime" @change="onEndTimeChange" class="picker-item">
						<view class="picker-value">
							<text>{{ endTime || '选择时间' }}</text>
							<text class="picker-arrow">▼</text>
						</view>
					</picker>
				</view>
			</view>
			<view class="button-container">
				<button class="clear-btn" @click="clearTimeSelection">清除时间</button>
				<button class="search-btn" @click="handleSearch">查询</button>
			</view>
		</view>

		<!-- 传感器图表控制区域 -->
		<view class="chart-control">
			<view class="chart-type-selector">
				<text class="label">图表类型：</text>
				<view class="button-group">
					<button :class="['type-btn', chartType === 'line' ? 'active' : '']"
						@click="changeChartType('line')">曲线图</button>
					<button :class="['type-btn', chartType === 'column' ? 'active' : '']"
						@click="changeChartType('column')">柱状图</button>
				</view>
			</view>
		</view>

		<!-- 传感器数据图表 -->
		<view class="chart-card">
			<canvas canvas-id="historyChart" id="historyChart" class="charts" @touchstart="tap"></canvas>
		</view>

		<!-- 传感器历史数据表格 -->
		<view class="data-table">
			<view class="table-header">
				<text class="title">传感器历史数据</text>
			</view>
			<scroll-view scroll-y class="table-content">
				<view v-for="(item, index) in sensorData" :key="index" class="table-row">
					<view class="row-header">
						<text class="device-id">场景ID: {{ item.d_no }}</text>
						<text class="time">{{ item.c_time }}</text>
					</view>
					<view class="row-content">
						<view v-for="(header, hIndex) in sensorHeaders" :key="hIndex" class="data-row">
							<text class="label">{{ header }}({{ sensorUnits[hIndex] }}):</text>
							<text class="value">{{ item[header] }}</text>
						</view>
					</view>
				</view>
			</scroll-view>
			
			<!-- 分页控制 -->
			<view class="pagination">
				<button :disabled="currentPage <= 1" @click="prevPage" class="page-btn">上一页</button>
				<text class="page-info">第 {{ currentPage }} 页，共 {{ Math.ceil(total / pageSize) }} 页</text>
				<button :disabled="currentPage >= Math.ceil(total / pageSize)" @click="nextPage" class="page-btn">下一页</button>
			</view>
		</view>

		<!-- AI检测结果 -->
		<view class="ai-section">
			<view class="section-header">
				<text class="title">AI检测结果</text>
			</view>
			
			<!-- AI检测场景选择 -->
			<view class="device-selector">
				<view class="selector-label">选择机房：</view>
				<picker 
					mode="selector"
					:range="sceneList" 
					:value="sceneIndex"
					range-key="device_name"
					@change="onSceneChange"
					class="device-picker"
				>
					<view class="picker-value">
						<text>{{ sceneIndex === -1 ? '请选择机房' : sceneList[sceneIndex]?.device_name }}</text>
						<text class="picker-arrow">▼</text>
					</view>
				</picker>
			</view>

			<!-- AI检测时间选择器 -->
			<view class="time-selector">
				<view class="time-item">
					<text class="time-label">开始时间：</text>
					<view class="datetime-picker">
						<picker mode="date" :value="aiStartDate" @change="onAiStartDateChange" class="picker-item">
							<view class="picker-value">
								<text>{{ aiStartDate || '选择日期' }}</text>
								<text class="picker-arrow">▼</text>
							</view>
						</picker>
						<picker mode="time" :value="aiStartTime" @change="onAiStartTimeChange" class="picker-item">
							<view class="picker-value">
								<text>{{ aiStartTime || '选择时间' }}</text>
								<text class="picker-arrow">▼</text>
							</view>
						</picker>
					</view>
				</view>
				<view class="time-item">
					<text class="time-label">结束时间：</text>
					<view class="datetime-picker">
						<picker mode="date" :value="aiEndDate" @change="onAiEndDateChange" class="picker-item">
							<view class="picker-value">
								<text>{{ aiEndDate || '选择日期' }}</text>
								<text class="picker-arrow">▼</text>
							</view>
						</picker>
						<picker mode="time" :value="aiEndTime" @change="onAiEndTimeChange" class="picker-item">
							<view class="picker-value">
								<text>{{ aiEndTime || '选择时间' }}</text>
								<text class="picker-arrow">▼</text>
							</view>
						</picker>
					</view>
				</view>
				<view class="button-container">
					<button class="clear-btn" @click="clearAiTimeSelection">清除时间</button>
					<button class="search-btn" @click="handleAiSearch">查询</button>
				</view>
			</view>

			<!-- AI检测结果列表 -->
			<scroll-view scroll-y class="ai-results">
				<view v-for="(item, index) in aiData" :key="index" class="ai-item">
					<view class="item-header">
						<text class="room-id">机房编号: {{ item.d_no }}</text>
						<text class="detection-time">{{ item.c_time }}</text>
					</view>
					<view class="item-content">
						<view class="images-row">
							<view class="image-item">
								<text class="image-label">原始图像</text>
								<image v-if="item['原始图像']" :src="`${config.API_BASE_URL}/${item['原始图像']}`" 
									   class="detection-image" mode="aspectFit" @click="previewImage(item['原始图像'])"/>
								<text v-else class="no-image">无图片</text>
							</view>
							<view class="image-item">
								<text class="image-label">标注图像</text>
								<image v-if="item['检测结果图']" :src="`${config.API_BASE_URL}/${item['检测结果图']}`" 
									   class="detection-image" mode="aspectFit" @click="previewImage(item['检测结果图'])"/>
								<text v-else class="no-image">无图片</text>
							</view>
						</view>
						<view class="detection-info">
							<view class="info-row">
								<text class="label">检测数量:</text>
								<text class="count">{{ item['目标数量'] || 0 }}</text>
							</view>
							<view class="info-row" v-if="item['检测详情']">
								<text class="label">检测详情:</text>
								<view class="detection-details">
									<view v-for="(result, rIndex) in parseDetectionResults(item['检测详情'])" :key="rIndex" class="detail-tag">
										{{ result.label }}: {{ result.confidence }}%
									</view>
								</view>
							</view>
						</view>
					</view>
				</view>
			</scroll-view>

			<!-- AI检测分页控制 -->
			<view class="pagination">
				<button :disabled="aiCurrentPage <= 1" @click="prevAiPage" class="page-btn">上一页</button>
				<text class="page-info">第 {{ aiCurrentPage }} 页，共 {{ Math.ceil(aiTotal / aiPageSize) }} 页</text>
				<button :disabled="aiCurrentPage >= Math.ceil(aiTotal / aiPageSize)" @click="nextAiPage" class="page-btn">下一页</button>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, onMounted } from 'vue';
	import uCharts from '/uni_modules/qiun-data-charts/js_sdk/u-charts/u-charts.js';
	import config from '@/utils/config.js'

	let chart = null;
	const chartType = ref('line');

	// 传感器数据相关
	const sensorData = ref([]);
	const sensorHeaders = ref([]);
	const sensorUnits = ref([]);
	const currentPage = ref(1);
	const pageSize = ref(5);
	const total = ref(0);

	// 设备选择相关
	const deviceList = ref([]);
	const currentIndex = ref(-1);
	const selectedDeviceId = ref(null);

	// 时间选择相关
	const startDate = ref('');
	const startTime = ref('');
	const endDate = ref('');
	const endTime = ref('');

	// AI检测相关
	const aiData = ref([]);
	const aiCurrentPage = ref(1);
	const aiPageSize = ref(5);
	const aiTotal = ref(0);
	const sceneList = ref([]);
	const sceneIndex = ref(-1);
	const selectedSceneId = ref(null);

	// AI检测时间选择
	const aiStartDate = ref('');
	const aiStartTime = ref('');
	const aiEndDate = ref('');
	const aiEndTime = ref('');

	// 图表点击事件
	const tap = (e) => {
		chart.touchLegend(e);
		chart.showToolTip(e);
	};

	// 初始化图表
	const initChart = (categories, series) => {
		chart = new uCharts({
			type: chartType.value,
			context: uni.createCanvasContext('historyChart'),
			width: uni.upx2px(700),
			height: 300,
			categories,
			series,
			animation: true,
			background: '#FFFFFF',
			padding: [15, 15, 0, 15],
			legend: {
				show: true,
				position: 'top',
				float: 'center',
			},
			xAxis: {
				disableGrid: true,
				scrollShow: true,
				itemCount: 5,
				rotateLabel: true,
			},
			yAxis: {
				gridType: 'dash',
				splitNumber: 5,
				min: 0,
				max: 200,
				calibration: true,
			},
			extra: {
				line: {
					type: 'curve',
					width: 2,
				},
				column: {
					width: 20,
					activeBgColor: '#000000',
					activeBgOpacity: 0.1
				}
			}
		});
	};

	// 获取设备列表
	const fetchDeviceList = async () => {
		try {
			const result = await uni.request({
				url: config.API_BASE_URL + '/api/sceneIds',
				method: 'GET'
			});

			if (result.statusCode === 200 && result.data.data) {
				deviceList.value = result.data.data;
				sceneList.value = result.data.data;
			}
		} catch (error) {
			console.error('获取设备列表失败:', error);
		}
	};

	// 设备选择改变事件
	const onDeviceChange = (e) => {
		currentIndex.value = Number(e.detail.value);
		const selectedDevice = deviceList.value[currentIndex.value];
		if (selectedDevice) {
			selectedDeviceId.value = selectedDevice.number;
			currentPage.value = 1;
			fetchSensorData();
		}
	};

	// 场景选择改变事件
	const onSceneChange = (e) => {
		sceneIndex.value = Number(e.detail.value);
		const selectedScene = sceneList.value[sceneIndex.value];
		if (selectedScene) {
			selectedSceneId.value = selectedScene.number;
			aiCurrentPage.value = 1;
			fetchAiData();
		}
	};

	// 时间选择相关方法
	const onStartDateChange = (e) => {
		startDate.value = e.detail.value;
	};

	const onStartTimeChange = (e) => {
		startTime.value = e.detail.value;
	};

	const onEndDateChange = (e) => {
		endDate.value = e.detail.value;
	};

	const onEndTimeChange = (e) => {
		endTime.value = e.detail.value;
	};

	// AI检测时间选择相关方法
	const onAiStartDateChange = (e) => {
		aiStartDate.value = e.detail.value;
	};

	const onAiStartTimeChange = (e) => {
		aiStartTime.value = e.detail.value;
	};

	const onAiEndDateChange = (e) => {
		aiEndDate.value = e.detail.value;
	};

	const onAiEndTimeChange = (e) => {
		aiEndTime.value = e.detail.value;
	};

	// 清除时间选择
	const clearTimeSelection = () => {
		startDate.value = '';
		startTime.value = '';
		endDate.value = '';
		endTime.value = '';
	};

	const clearAiTimeSelection = () => {
		aiStartDate.value = '';
		aiStartTime.value = '';
		aiEndDate.value = '';
		aiEndTime.value = '';
	};

	// 获取传感器数据
	const fetchSensorData = async () => {
		try {
			const params = {
				page: currentPage.value,
				pageSize: pageSize.value
			};
			
			if (startDate.value && startTime.value) {
				params.startTime = `${startDate.value} ${startTime.value}:00`;
			}
			if (endDate.value && endTime.value) {
				params.endTime = `${endDate.value} ${endTime.value}:00`;
			}
			if (selectedDeviceId.value) {
				params.deviceId = selectedDeviceId.value;
			}

			const result = await uni.request({
				url: config.API_BASE_URL + '/api/data2',
				method: 'GET',
				data: params
			});

			if (result.statusCode === 200) {
				const { data, header, units, total: totalCount } = result.data;
				sensorData.value = data;
				sensorHeaders.value = header;
				sensorUnits.value = units;
				total.value = totalCount || data.length;
				
				// 更新图表
				updateChart(data);
			}
		} catch (error) {
			console.error('获取传感器数据失败:', error);
		}
	};

	// 获取AI检测数据
	const fetchAiData = async () => {
		try {
			const params = {
				page: aiCurrentPage.value,
				pageSize: aiPageSize.value
			};
			
			if (aiStartDate.value && aiStartTime.value) {
				params.startTime = `${aiStartDate.value} ${aiStartTime.value}:00`;
			}
			if (aiEndDate.value && aiEndTime.value) {
				params.endTime = `${aiEndDate.value} ${aiEndTime.value}:00`;
			}
			if (selectedSceneId.value) {
				params.sceneId = selectedSceneId.value;
			}

			const result = await uni.request({
				url: config.API_BASE_URL + '/api/behaviorData',
				method: 'GET',
				data: params
			});

			if (result.statusCode === 200) {
				const { data, total: totalCount } = result.data;
				aiData.value = data;
				aiTotal.value = totalCount;
			}
		} catch (error) {
			console.error('获取AI检测数据失败:', error);
		}
	};

	// 更新图表
	const updateChart = (data) => {
		if (!data || data.length === 0) return;
		
		const sortedData = [...data].reverse();
		const categories = sortedData.map(item => item.c_time);
		const series = sensorHeaders.value.map((header, index) => ({
			name: header,
			data: sortedData.map(item => item[header]),
			color: ['#1890FF', '#91CB74', '#FAC858', '#EE6666'][index % 4]
		}));

		initChart(categories, series);
	};

	// 切换图表类型
	const changeChartType = (type) => {
		chartType.value = type;
		updateChart(sensorData.value);
	};

	// 搜索处理
	const handleSearch = () => {
		currentPage.value = 1;
		fetchSensorData();
	};

	const handleAiSearch = () => {
		aiCurrentPage.value = 1;
		fetchAiData();
	};

	// 分页处理
	const prevPage = () => {
		if (currentPage.value > 1) {
			currentPage.value--;
			fetchSensorData();
		}
	};

	const nextPage = () => {
		if (currentPage.value < Math.ceil(total.value / pageSize.value)) {
			currentPage.value++;
			fetchSensorData();
		}
	};

	const prevAiPage = () => {
		if (aiCurrentPage.value > 1) {
			aiCurrentPage.value--;
			fetchAiData();
		}
	};

	const nextAiPage = () => {
		if (aiCurrentPage.value < Math.ceil(aiTotal.value / aiPageSize.value)) {
			aiCurrentPage.value++;
			fetchAiData();
		}
	};

	// 预览图片
	const previewImage = (imagePath) => {
		uni.previewImage({
			urls: [`${config.API_BASE_URL}/${imagePath}`]
		});
	};

	// 解析AI检测结果
	const parseDetectionResults = (resultsStr) => {
		try {
			if (!resultsStr) return [];
			const results = JSON.parse(resultsStr);
			return Array.isArray(results) ? results : [];
		} catch (error) {
			console.error('解析检测结果失败:', error);
			return [];
		}
	};

	onMounted(() => {
		fetchDeviceList();
		fetchSensorData();
		fetchAiData();
	});
</script>

<style lang="scss">
	.data-container {
		padding: 20rpx;
		background: #f5f6fa;
		min-height: 100vh;

		/* 设备选择器样式 */
		.device-selector {
			background: #fff;
			border-radius: 16rpx;
			padding: 20rpx;
			margin-bottom: 20rpx;
			display: flex;
			align-items: center;
			box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

			.selector-label {
				font-size: 28rpx;
				color: #666;
				margin-right: 20rpx;
				white-space: nowrap;
			}

			.device-picker {
				flex: 1;

				.picker-value {
					font-size: 28rpx;
					color: #333;
					padding: 15rpx 20rpx;
					background: #f5f6fa;
					border-radius: 8rpx;
					display: flex;
					justify-content: space-between;
					align-items: center;

					.picker-arrow {
						color: #999;
					}
				}
			}
		}

		/* 时间选择器样式 */
		.time-selector {
			background: #fff;
			border-radius: 16rpx;
			padding: 20rpx;
			margin-bottom: 20rpx;
			box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

			.time-item {
				margin-bottom: 20rpx;

				.time-label {
					font-size: 28rpx;
					color: #666;
					margin-bottom: 10rpx;
					display: block;
				}

				.datetime-picker {
					display: flex;
					gap: 10rpx;

					.picker-item {
						flex: 1;

						.picker-value {
							font-size: 28rpx;
							color: #333;
							padding: 15rpx 20rpx;
							background: #f5f6fa;
							border-radius: 8rpx;
							display: flex;
							justify-content: space-between;
							align-items: center;

							.picker-arrow {
								color: #999;
							}
						}
					}
				}
			}

			.button-container {
				display: flex;
				gap: 20rpx;
				justify-content: flex-end;

				.clear-btn, .search-btn {
					padding: 15rpx 30rpx;
					border-radius: 8rpx;
					font-size: 28rpx;
				}

				.clear-btn {
					background: #f5f6fa;
					color: #666;
				}

				.search-btn {
					background: #007AFF;
					color: #fff;
				}
			}
		}

		/* 图表控制样式 */
		.chart-control {
			background: #fff;
			border-radius: 16rpx;
			padding: 20rpx;
			margin-bottom: 20rpx;

			.chart-type-selector {
				display: flex;
				align-items: center;

				.label {
					font-size: 28rpx;
					color: #666;
					margin-right: 20rpx;
				}

				.button-group {
					display: flex;
					gap: 20rpx;

					.type-btn {
						padding: 10rpx 30rpx;
						font-size: 28rpx;
						border-radius: 30rpx;
						background: #f5f6fa;
						color: #666;

						&.active {
							background: #007AFF;
							color: #fff;
						}
					}
				}
			}
		}

		/* 图表卡片样式 */
		.chart-card {
			background: #fff;
			border-radius: 16rpx;
			padding: 20rpx;
			margin-bottom: 20rpx;
			box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

			.charts {
				width: 100%;
				height: 300px;
			}
		}

		/* 数据表格样式 */
		.data-table {
			background: #fff;
			border-radius: 16rpx;
			padding: 20rpx;
			margin-bottom: 20rpx;
			box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

			.table-header {
				margin-bottom: 20rpx;
				padding-bottom: 15rpx;
				border-bottom: 1px solid #eee;

				.title {
					font-size: 32rpx;
					color: #333;
					font-weight: bold;
				}
			}

			.table-content {
				max-height: 600rpx;
			}

			.table-row {
				margin-bottom: 20rpx;
				padding: 15rpx;
				background: #f8f9fa;
				border-radius: 12rpx;

				.row-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 15rpx;
					padding-bottom: 10rpx;
					border-bottom: 1px solid #eee;

					.device-id {
						font-size: 28rpx;
						color: #333;
						font-weight: bold;
					}

					.time {
						font-size: 26rpx;
						color: #999;
					}
				}

				.row-content {
					display: grid;
					grid-template-columns: repeat(2, 1fr);
					gap: 15rpx;

					.data-row {
						display: flex;
						align-items: center;

						.label {
							font-size: 26rpx;
							color: #666;
							margin-right: 10rpx;
						}

						.value {
							font-size: 28rpx;
							color: #333;
							font-weight: 500;
						}
					}
				}
			}
		}

		/* AI检测部分样式 */
		.ai-section {
			background: #fff;
			border-radius: 16rpx;
			padding: 20rpx;
			margin-bottom: 20rpx;
			box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

			.section-header {
				margin-bottom: 20rpx;
				padding-bottom: 15rpx;
				border-bottom: 1px solid #eee;

				.title {
					font-size: 32rpx;
					color: #333;
					font-weight: bold;
				}
			}

			.ai-results {
				max-height: 800rpx;
			}

			.ai-item {
				margin-bottom: 20rpx;
				padding: 15rpx;
				background: #f8f9fa;
				border-radius: 12rpx;

				.item-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 15rpx;
					padding-bottom: 10rpx;
					border-bottom: 1px solid #eee;

					.room-id {
						font-size: 28rpx;
						color: #333;
						font-weight: bold;
					}

					.detection-time {
						font-size: 26rpx;
						color: #999;
					}
				}

				.item-content {
					.images-row {
						display: flex;
						gap: 20rpx;
						margin-bottom: 15rpx;

						.image-item {
							flex: 1;
							text-align: center;

							.image-label {
								font-size: 26rpx;
								color: #666;
								margin-bottom: 10rpx;
								display: block;
							}

							.detection-image {
								width: 100%;
								height: 120rpx;
								border-radius: 8rpx;
								background: #f0f0f0;
							}

							.no-image {
								font-size: 24rpx;
								color: #999;
								padding: 30rpx 0;
								background: #f0f0f0;
								border-radius: 8rpx;
								display: block;
							}
						}
					}

					.detection-info {
						.info-row {
							display: flex;
							align-items: flex-start;
							margin-bottom: 10rpx;

							.label {
								font-size: 26rpx;
								color: #666;
								margin-right: 10rpx;
								white-space: nowrap;
							}

							.count {
								font-size: 28rpx;
								color: #007AFF;
								font-weight: bold;
							}

							.detection-details {
								flex: 1;
								display: flex;
								flex-wrap: wrap;
								gap: 8rpx;

								.detail-tag {
									font-size: 24rpx;
									color: #52c41a;
									background: #f6ffed;
									padding: 4rpx 8rpx;
									border-radius: 4rpx;
								}
							}
						}
					}
				}
			}
		}

		/* 分页样式 */
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