<template>
  <div class="cfv" :id="id || undefined">
    <!-- LEFT SIDEBAR: file tree -->
    <div v-show="sidebarOpen" class="cfv-sidebar" :class="{ 'cfv-sidebar-fixed': collapseToggle }">
      <div class="cfv-sidebar-header">
        <span class="cfv-sidebar-title">File viewer</span>
        <div class="cfv-sidebar-actions">
        <button v-if="collapseToggle" class="cfv-sidebar-toggle" :aria-label="allFoldersCollapsed ? 'Expand all folders' : 'Collapse all folders'" @click="toggleAllFolders">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="3.5" y="3.5" width="11.5" height="11.5" rx="2" stroke="currentColor" stroke-width="1.2" />
            <rect x="1" y="1" width="11.5" height="11.5" rx="2" stroke="currentColor" stroke-width="1.2" fill="var(--vp-code-block-bg)" />
            <path d="M4 6.5h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            <path v-if="allFoldersCollapsed" d="M6.5 4v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </button>
        <button class="cfv-sidebar-toggle" aria-label="Collapse sidebar" @click="sidebarOpen = false">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3L3 8L8 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M13 3L8 8L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        </div>
      </div>
      <template v-for="node in tree" :key="node.name">
        <TreeNode
          :node="node"
          :depth="0"
          :selected-path="activeFile.path"
          :collapsed="collapsed"
          @select="selectFile"
          @toggle="toggleFolder"
        />
      </template>
    </div>

    <!-- RIGHT PANEL: code viewer -->
    <div class="cfv-code">
      <div class="cfv-code-header">
        <button v-show="!sidebarOpen" class="cfv-sidebar-toggle" aria-label="Expand sidebar" @click="sidebarOpen = true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3L8 8L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 3L13 8L8 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span class="cfv-badge" :data-lang="activeExt">{{ badgeLabel(activeExt) }}</span>
        <span class="cfv-code-path">{{ activeFile.path }}</span>
        <button
          title="Copy Code"
          class="cfv-copy"
          :class="{ copied }"
          @click="copyCode"
        />
      </div>
      <div class="cfv-code-body" :class="{ 'line-numbers': lineNumbers }" :style="lineNumberStyle" v-html="html" />
    </div>
  </div>
</template>

<script setup>
import { codeToHtml } from 'shiki';
import { computed, onMounted, onUnmounted, reactive, ref, watchEffect } from 'vue';
import TreeNode from './TreeNode.vue';

const props = defineProps({
  files: { type: Array, required: true },
  rootLabel: { type: String, default: '' },
  defaultFile: { type: String, default: '' },
  sidebarCollapsed: { type: Boolean, default: false },
  id: { type: String, default: '' },
  lineNumbers: { type: Boolean, default: false },
  collapseToggle: { type: Boolean, default: false },
});

const langMap = { ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', json: 'json', html: 'html' };

function getExt(path) {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
}

function inferLang(file) {
  if (file.lang) return file.lang;
  return langMap[getExt(file.path)] || 'text';
}

// Build tree from flat file list
function buildTree(files, rootLabel) {
  const root = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let folder = current.find((n) => n.name === folderName && n.type === 'folder');
      if (!folder) {
        folder = { name: folderName, type: 'folder', path: parts.slice(0, i + 1).join('/'), children: [] };
        current.push(folder);
      }
      current = folder.children;
    }

    current.push({ name: parts[parts.length - 1], type: 'file', path: file.path, file });
  }

  // Sort: folders first, then files, alphabetical within each group
  function sortNodes(nodes) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  }
  sortNodes(root);

  if (rootLabel) {
    return [{ name: rootLabel, type: 'folder', path: rootLabel, children: root }];
  }
  return root;
}

const tree = computed(() => buildTree(props.files, props.rootLabel));

const initialFile = props.defaultFile
  ? props.files.find((f) => f.path === props.defaultFile) || props.files[0]
  : props.files[0];

const activeFile = ref(initialFile);
const html = ref('');
const collapsed = reactive(new Set());
const sidebarOpen = ref(!props.sidebarCollapsed);
const copied = ref(false);

const lineNumberStyle = computed(() => {
  if (!props.lineNumbers) return {};
  const lineCount = activeFile.value.code.split('\n').length;
  const digits = String(lineCount).length;
  return { '--cfv-ln-width': `${digits}ch` };
});

let copyTimeout;
function copyCode() {
  navigator.clipboard.writeText(activeFile.value.code);
  copied.value = true;
  clearTimeout(copyTimeout);
  copyTimeout = setTimeout(() => {
    copied.value = false;
  }, 2000);
}

const activeExt = computed(() => getExt(activeFile.value.path).toUpperCase());

const badgeLabels = { JSON: '{}', HTML: '<>' };

function badgeLabel(ext) {
  return badgeLabels[ext] || ext;
}

function getFileFromHash() {
  if (!props.id) return null;
  const hash = window.location.hash.slice(1);
  const prefix = `${props.id}:`;
  if (!hash.startsWith(prefix)) return null;
  const filePath = hash.slice(prefix.length);
  return props.files.find((f) => f.path === filePath) || null;
}

function expandParentFolders(filePath) {
  const parts = filePath.split('/');
  for (let i = 1; i < parts.length; i++) {
    const folderPath = parts.slice(0, i).join('/');
    collapsed.delete(folderPath);
  }
}

function selectFile(file) {
  activeFile.value = file;
  if (props.id) {
    history.replaceState(null, '', `#${props.id}:${file.path}`);
  }
}

function onHashChange() {
  const file = getFileFromHash();
  if (file) {
    expandParentFolders(file.path);
    activeFile.value = file;
  }
}

function toggleFolder(path) {
  if (collapsed.has(path)) {
    collapsed.delete(path);
  } else {
    collapsed.add(path);
  }
}

function collectFolderPaths(nodes) {
  const paths = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path);
      if (node.children) {
        paths.push(...collectFolderPaths(node.children));
      }
    }
  }
  return paths;
}

const allFolderPaths = computed(() => collectFolderPaths(tree.value));
const allFoldersCollapsed = computed(
  () => allFolderPaths.value.length > 0 && allFolderPaths.value.every((p) => collapsed.has(p)),
);

function toggleAllFolders() {
  if (allFoldersCollapsed.value) {
    collapsed.clear();
  } else {
    for (const path of allFolderPaths.value) {
      collapsed.add(path);
    }
  }
}

onMounted(() => {
  const file = getFileFromHash();
  if (file) {
    expandParentFolders(file.path);
    activeFile.value = file;
  }
  window.addEventListener('hashchange', onHashChange);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange);
});

watchEffect(async () => {
  const file = activeFile.value;
  html.value = await codeToHtml(file.code, {
    lang: inferLang(file),
    themes: { light: 'github-light', dark: 'github-dark' },
  });
});
</script>

<style scoped>
.cfv {
  display: flex;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  font-size: 14px;
}

/* Sidebar */
.cfv-sidebar {
  max-width: 200px;
  width: fit-content;
  background: var(--vp-code-block-bg);
  border-right: 1px solid var(--vp-c-divider);
  padding: 0 0 12px;
  overflow-y: auto;
  flex-shrink: 0;
}

.cfv-sidebar-fixed {
  width: 200px;
}

.cfv-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 8px;
  min-height: 52px;
  box-sizing: border-box;
}

.cfv-sidebar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.cfv-sidebar-title {
  font-size: 13px;
  font-weight: 500;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
}

.cfv-sidebar-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--vp-c-text-3);
  transition: color 0.15s, background-color 0.15s;
}

.cfv-sidebar-toggle:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

/* Code panel */
.cfv-code {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--vp-code-block-bg);
}

.cfv-code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  background: var(--vp-code-block-bg);
}

.cfv-code-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfv-code-body {
  flex: 1;
  overflow: auto;
}

/* Copy button — matches VitePress code block copy */
.cfv-copy {
  margin-left: auto;
  border: 1px solid var(--vp-code-copy-code-border-color);
  border-radius: 4px;
  width: 32px;
  height: 32px;
  background-color: var(--vp-code-copy-code-bg);
  background-image: var(--vp-icon-copy);
  background-position: 50%;
  background-size: 18px;
  background-repeat: no-repeat;
  cursor: pointer;
  opacity: 0.7;
  flex-shrink: 0;
  transition:
    border-color 0.25s,
    background-color 0.25s,
    opacity 0.25s;
}

.cfv-copy:hover {
  opacity: 1;
  border-color: var(--vp-code-copy-code-hover-border-color);
  background-color: var(--vp-code-copy-code-hover-bg);
}

.cfv-copy.copied {
  opacity: 1;
  border-color: var(--vp-code-copy-code-hover-border-color);
  background-color: var(--vp-code-copy-code-hover-bg);
  background-image: var(--vp-icon-copied);
}

/* File type badge */
.cfv-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  line-height: 1.4;
  white-space: nowrap;
}

.cfv-badge {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-text);
}

/* Shiki dual-theme overrides */
:deep(.shiki) {
  background-color: transparent !important;
}

:deep(pre) {
  margin: 0;
  padding: 16px;
  background: transparent !important;
}

:deep(code) {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

:deep(.shiki span) {
  color: var(--shiki-light);
}

/* Line numbers */
.line-numbers :deep(code) {
  counter-reset: line;
}

.line-numbers :deep(code .line)::before {
  counter-increment: line;
  content: counter(line);
  display: inline-block;
  width: var(--cfv-ln-width, 2ch);
  margin-right: 1em;
  text-align: right;
  color: var(--vp-c-text-3);
  user-select: none;
}

/* Responsive */
@media (max-width: 640px) {
  .cfv-sidebar {
    width: 160px;
    min-width: 120px;
  }
}
</style>

<style>
/* Dark mode Shiki theme switching — must be unscoped to target html.dark */
html.dark .cfv .shiki span {
  color: var(--shiki-dark) !important;
}
</style>
