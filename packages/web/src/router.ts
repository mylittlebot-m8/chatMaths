import { createRouter, createWebHistory } from 'vue-router'
import Error from './pages/error.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('#/layout/sidebar-layout.vue'),
      children: [
        { path: '', component: () => import('#/pages/home.vue') },
        { path: 'chat', component: () => import('#/pages/chat/index.vue') },
        { path: 'chat/:id', component: () => import('#/pages/chat/index.vue') },
        {
          path: 'settings',
          component: () => import('#/pages/settings/index.vue'),
        },
        // 404
        {
          path: ':pathMatch(.*)',
          component: Error,
          props: {
            type: '404',
          },
        },
        // error
        {
          name: 'error',
          path: 'error/:type/:message?',
          component: Error,
          props: true,
        },
      ],
    },
  ],
})

export default router