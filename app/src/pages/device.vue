<template>
  <view class="device-container">
    <!-- 添加机房按钮 -->
    <view class="header">
      <text class="title">机房导航</text>
      <button class="add-btn" @click="showAddDialog">+ 添加机房</button>
    </view>

    <!-- 机房卡片列表 -->
    <view class="room-grid">
      <view v-for="room in rooms" :key="room.id" class="room-card" @click="goToRoomDetail(room)">
        <view class="room-image">
          <text class="room-icon">🏢</text>
        </view>
        <view class="room-info">
          <text class="room-name">{{ room.device_name }}</text>
          <text class="room-number">编号: {{ room.number }}</text>
          <view class="room-status">
            <text class="status-tag success">运行正常</text>
          </view>
          <text class="room-desc">{{ room.remarks || '暂无描述' }}</text>
          <view class="room-actions">
            <button class="action-btn edit" @click.stop="editRoom(room)">编辑</button>
            <button class="action-btn detail" @click.stop="goToRoomDetail(room)">详情</button>
            <button class="action-btn delete" @click.stop="showDeleteDialog(room)">删除</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 分页 -->
    <view class="pagination">
      <button :disabled="currentPage <= 1" @click="prevPage" class="page-btn">上一页</button>
      <text class="page-info">第 {{ currentPage }} 页，共 {{ Math.ceil(total / pageSize) }} 页</text>
      <button :disabled="currentPage >= Math.ceil(total / pageSize)" @click="nextPage" class="page-btn">下一页</button>
    </view>

    <!-- 添加/编辑机房对话框 -->
    <uni-popup ref="addPopup" type="dialog">
      <uni-popup-dialog 
        :title="isEditing ? '编辑机房' : '添加机房'"
        :value="formData"
        placeholder="请输入机房信息"
        @confirm="handleSubmit"
        @close="closeDialog"
      >
        <view class="form-content">
          <view class="form-item">
            <text class="form-label">机房名称:</text>
            <input v-model="formData.device_name" placeholder="请输入机房名称" class="form-input" />
          </view>
          <view class="form-item">
            <text class="form-label">机房编号:</text>
            <input v-model="formData.number" placeholder="请输入机房编号" class="form-input" />
          </view>
          <view class="form-item">
            <text class="form-label">描述:</text>
            <textarea v-model="formData.remarks" placeholder="请输入机房描述" class="form-textarea" />
          </view>
        </view>
      </uni-popup-dialog>
    </uni-popup>

    <!-- 删除确认对话框 -->
    <uni-popup ref="deletePopup" type="dialog">
      <uni-popup-dialog 
        title="确认删除"
        content="确定要删除这个机房吗？"
        @confirm="confirmDelete"
        @close="closeDeleteDialog"
      />
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import config from '@/utils/config.js'

// 响应式数据
const rooms = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(9);
const isEditing = ref(false);
const editingId = ref(null);
const deleteRoomId = ref(null);

// 表单数据
const formData = ref({
  device_name: '',
  number: '',
  remarks: ''
});

// popup引用
const addPopup = ref(null);
const deletePopup = ref(null);

// 获取机房列表
const fetchRooms = async () => {
  try {
    const result = await uni.request({
      url: config.API_BASE_URL + '/api/devices',
      method: 'GET',
      data: {
        page: currentPage.value,
        pageSize: pageSize.value,
      }
    });

    if (result.statusCode === 200) {
      rooms.value = result.data.data;
      total.value = result.data.total;
    }
  } catch (error) {
    console.error('获取机房列表失败:', error);
    uni.showToast({
      title: '获取机房列表失败',
      icon: 'none'
    });
  }
};

// 跳转到机房详情
const goToRoomDetail = (room) => {
  uni.navigateTo({
    url: `/pages/roomDetail?roomId=${room.number}`
  });
};

// 显示添加对话框
const showAddDialog = () => {
  isEditing.value = false;
  resetForm();
  addPopup.value.open();
};

// 编辑机房
const editRoom = (room) => {
  isEditing.value = true;
  editingId.value = room.id;
  formData.value = {
    device_name: room.device_name,
    number: room.number,
    remarks: room.remarks
  };
  addPopup.value.open();
};

// 显示删除对话框
const showDeleteDialog = (room) => {
  deleteRoomId.value = room.id;
  deletePopup.value.open();
};

// 处理表单提交
const handleSubmit = async () => {
  try {
    const url = isEditing.value 
      ? `${config.API_BASE_URL}/api/devices/${editingId.value}`
      : `${config.API_BASE_URL}/api/devices`;
    
    const method = isEditing.value ? 'PUT' : 'POST';

    const result = await uni.request({
      url,
      method,
      data: formData.value
    });

    if (result.statusCode === 200) {
      uni.showToast({
        title: isEditing.value ? '更新成功' : '添加成功',
        icon: 'success'
      });
      addPopup.value.close();
      resetForm();
      await fetchRooms();
    }
  } catch (error) {
    console.error('提交失败:', error);
    uni.showToast({
      title: isEditing.value ? '更新失败' : '添加失败',
      icon: 'none'
    });
  }
};

// 确认删除
const confirmDelete = async () => {
  try {
    const result = await uni.request({
      url: `${config.API_BASE_URL}/api/devices/${deleteRoomId.value}`,
      method: 'DELETE'
    });

    if (result.statusCode === 200) {
      uni.showToast({
        title: '删除成功',
        icon: 'success'
      });
      deletePopup.value.close();
      await fetchRooms();
    }
  } catch (error) {
    console.error('删除失败:', error);
    uni.showToast({
      title: '删除失败',
      icon: 'none'
    });
  }
};

// 关闭对话框
const closeDialog = () => {
  resetForm();
};

const closeDeleteDialog = () => {
  deleteRoomId.value = null;
};

// 重置表单
const resetForm = () => {
  formData.value = {
    device_name: '',
    number: '',
    remarks: ''
  };
  isEditing.value = false;
  editingId.value = null;
};

// 分页处理
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    fetchRooms();
  }
};

const nextPage = () => {
  if (currentPage.value < Math.ceil(total.value / pageSize.value)) {
    currentPage.value++;
    fetchRooms();
  }
};

onMounted(() => {
  fetchRooms();
});
</script>

<style lang="scss">
.device-container {
  padding: 20rpx;
  background: #f5f6fa;
  min-height: 100vh;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
    padding: 20rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

    .title {
      font-size: 36rpx;
      color: #333;
      font-weight: bold;
    }

    .add-btn {
      padding: 12rpx 24rpx;
      background: #007AFF;
      color: #fff;
      border-radius: 8rpx;
      font-size: 28rpx;
    }
  }

  .room-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20rpx;
    margin-bottom: 20rpx;
  }

  .room-card {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
    transition: transform 0.2s ease;

    &:active {
      transform: scale(0.98);
    }

    .room-image {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      height: 120rpx;
      display: flex;
      align-items: center;
      justify-content: center;

      .room-icon {
        font-size: 60rpx;
        color: white;
      }
    }

    .room-info {
      padding: 20rpx;

      .room-name {
        font-size: 32rpx;
        color: #333;
        font-weight: bold;
        margin-bottom: 8rpx;
        display: block;
      }

      .room-number {
        font-size: 26rpx;
        color: #999;
        margin-bottom: 10rpx;
        display: block;
      }

      .room-status {
        margin-bottom: 10rpx;

        .status-tag {
          font-size: 24rpx;
          padding: 4rpx 8rpx;
          border-radius: 4rpx;

          &.success {
            background: #f6ffed;
            color: #52c41a;
          }
        }
      }

      .room-desc {
        font-size: 26rpx;
        color: #666;
        margin-bottom: 15rpx;
        display: block;
        min-height: 40rpx;
        line-height: 1.4;
      }

      .room-actions {
        display: flex;
        gap: 10rpx;
        justify-content: flex-end;

        .action-btn {
          padding: 8rpx 16rpx;
          font-size: 24rpx;
          border-radius: 6rpx;

          &.edit {
            background: #007AFF;
            color: #fff;
          }

          &.detail {
            background: #f5f6fa;
            color: #666;
          }

          &.delete {
            background: #ff4d4f;
            color: #fff;
          }
        }
      }
    }
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

    .page-btn {
      padding: 12rpx 24rpx;
      font-size: 26rpx;
      border-radius: 8rpx;
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

  .form-content {
    padding: 20rpx;

    .form-item {
      margin-bottom: 20rpx;

      .form-label {
        font-size: 28rpx;
        color: #333;
        margin-bottom: 10rpx;
        display: block;
      }

      .form-input {
        width: 100%;
        padding: 15rpx;
        border: 1px solid #ddd;
        border-radius: 8rpx;
        font-size: 28rpx;
        background: #fff;
      }

      .form-textarea {
        width: 100%;
        height: 120rpx;
        padding: 15rpx;
        border: 1px solid #ddd;
        border-radius: 8rpx;
        font-size: 28rpx;
        background: #fff;
        resize: none;
      }
    }
  }
}
</style>