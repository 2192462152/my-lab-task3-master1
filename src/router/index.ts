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
            path: '/realTime',
            name: 'RealTime',
            component: () => import('@/views/RealTime.vue'),
        },
        {
            path: '/history',
            name: 'History',
            component: () => import('@/views/History.vue'),
        },
        {
            path: '/direct',
            name: 'Direct',
            component: () => import('@/views/Direct.vue'),
        }
    ],
})

export default router
