<template>
  <div class="layout">
    <el-config-provider :locale="zhCn">
      <el-scrollbar class="scrollbar">
        <el-menu class="el-menu-vertical-demo" active-text-color="#ffd04b" background-color="#545c64"
                 text-color="white">
          <h1 style="font-size: 25px;color: white;font-weight: bold;text-align: center;padding: 5px">管理系统
            <!-- <el-switch v-model="value" @change="changeDevice"></el-switch> -->
          </h1>
          <el-menu-item index="1" @click="deviceList">
            <el-icon>
              <OfficeBuilding/>
            </el-icon>
            机房导航
          </el-menu-item>
          <el-menu-item index="3" @click="data1List">
            <el-icon>
              <Tickets/>
            </el-icon>
            实时数据
          </el-menu-item>
          <el-menu-item index="4" @click="data2List">
            <el-icon>
              <Tickets/>
            </el-icon>
            历史数据
          </el-menu-item>
          <el-menu-item index="2" @click="errorList">
            <el-icon>
              <Menu/>
            </el-icon>
            错误信息列表
          </el-menu-item>
          <el-menu-item index="5" @click="directList">
            <el-icon>
              <Cpu/>
            </el-icon>
            指令配置信息
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
      <el-scrollbar style="height: 100vh;width: 85%;">
        <router-view></router-view>
      </el-scrollbar>
    </el-config-provider>
  </div>
</template>

<script setup lang="ts">
import {useRouter} from "vue-router";
import zhCn from 'element-plus/dist/locale/zh-cn.mjs' // 引入中文
import useUserStore from "@/stores";
import {ref} from "vue";

const $router = useRouter()
const $store = useUserStore()
// 切换多/单设备开关的变量
const value = ref(false)

// 切换多/单设备时的函数
const changeDevice = () => {
  $store.isOne = value.value
}

const deviceList = () => {
  $router.push("/device")
}
const errorList = () => {
  $router.push("/error")
}
const data1List = () => {
  $router.push("/realTime")
}
const data2List = () => {
  $router.push("/history")
}
const directList = () => {
  $router.push("/direct")
}
</script>

<style lang="scss">
.layout {
  display: flex;

  .scrollbar {
    width: 15%;
    height: 100vh;

    .el-menu-vertical-demo {
      width: 100%;
      height: 100vh;
    }
  }
}
</style>
