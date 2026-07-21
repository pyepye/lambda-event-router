import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import CodeFileViewer from './components/CodeFileViewer/CodeFileViewer.vue';
import ExamplesList from './components/ExamplesList.vue';
import PackagesGrid from './components/PackagesGrid.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PackagesGrid', PackagesGrid);
    app.component('CodeFileViewer', CodeFileViewer);
    app.component('ExamplesList', ExamplesList);
  },
} satisfies Theme;
