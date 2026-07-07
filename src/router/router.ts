import { createRouter, createWebHistory } from "vue-router";

import SimulatorView from "@/views/SimulatorView.vue";

const routes = [
  {
    name: "simulator",
    path: "/",
    component: SimulatorView,
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
