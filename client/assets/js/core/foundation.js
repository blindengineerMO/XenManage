/**
 * XenMange client — Vue / Vue Router globals.
 *
 * Concatenated first in scripts/build-client.js. Not an ES module: Vue and
 * VueRouter are loaded as vendor UMD scripts before this bundle.
 *
 * Purpose: pull the Vue 3 and Vue Router APIs the rest of the SPA uses into
 * the shared script scope (`createApp`, `reactive`, `createRouter`, …).
 * Consumers: every later concatenated file (store, views, components, app.js).
 * Gotchas: if a Vue API is missing here, later files will throw ReferenceError.
 * Do not `import 'vue'` — there is no bundler graph for app code.
 */
const { createApp, reactive, computed, ref, onMounted, onBeforeUnmount } = Vue;
const { createRouter, createWebHistory, useRouter, useRoute } = VueRouter;
