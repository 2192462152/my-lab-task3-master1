import {defineStore} from "pinia";

const useUserStore = defineStore('userStore', {
    state: () => {
        return {
            isOne: true,
            defaultDeviceId: '001',
        }
    },
    actions: {

    },
    getters: {}
})

export default useUserStore;

