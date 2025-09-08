import {createRouter, createWebHashHistory} from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            redirect: '/device',
        },
        {
            path: '/device',
            name: 'Device',
            component: () => import('@/views/Device.vue'),
        },
        {
            path: '/room/:roomId',
            name: 'RoomDetail',
            component: () => import('@/views/RoomDetail.vue'),
        },
        {
            path: '/error',
            name: 'Error',
            component: () => import('@/views/Error.vue'),
        },
        {
            path: '/data1',
            name: 'Data1',
            component: () => import('@/views/Data1.vue'),
        },
        {
            path: '/data2',
            name: 'Data2',
            component: () => import('@/views/Data2.vue'),
        },
        {
            path: '/direct',
            name: 'Direct',
            component: () => import('@/views/Direct.vue'),
        }
    ],
})

export default router
