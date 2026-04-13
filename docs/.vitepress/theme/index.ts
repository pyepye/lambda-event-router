import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import CodeFileViewer from './components/CodeFileViewer/CodeFileViewer.vue';
import PackagesGrid from './components/PackagesGrid.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PackagesGrid', PackagesGrid);
    app.component('CodeFileViewer', CodeFileViewer);
  },
} satisfies Theme;
