import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/Home.vue') },
    { path: '/other', component: () => import('./views/Other.vue') },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
