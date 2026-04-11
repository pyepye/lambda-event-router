import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import PackagesGrid from './components/PackagesGrid.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PackagesGrid', PackagesGrid);
  },
} satisfies Theme;
