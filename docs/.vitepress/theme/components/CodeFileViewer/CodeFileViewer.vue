<template>
  <div class="cfv" :class="{ 'cfv-dragging': isDragging }" :id="id">
    <!-- LEFT SIDEBAR: file tree -->
    <div v-show="sidebarOpen" ref="sidebarRef" class="cfv-sidebar" :class="{ 'cfv-sidebar-fixed': collapseToggle }" :style="sidebarStyle">
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

    <!-- DRAG DIVIDER -->
    <div v-show="sidebarOpen" class="cfv-divider" @mousedown="onDividerMouseDown" />

    <!-- RIGHT PANEL: code viewer -->
    <div class="cfv-code">
      <div class="cfv-code-header">
        <button v-show="!sidebarOpen" class="cfv-sidebar-toggle" aria-label="Expand sidebar" @click="sidebarOpen = true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3L8 8L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 3L13 8L8 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span class="cfv-badge" :data-lang="activeExt">{{ getBadgeLabel(activeExt) }}</span>
        <span class="cfv-code-path">{{ activeFile.path }}</span>
        <button
          title="Copy Code"
          class="cfv-copy"
          :class="{ copied }"
          @click="copyCode"
        />
      </div>
      <div v-if="fixedHeight" class="cfv-code-body-stack" :class="{ 'line-numbers': lineNumbers }">
        <div
          v-for="file in files"
          :key="file.path"
          class="cfv-code-body cfv-code-body-layer"
          :class="{ 'cfv-code-body-hidden': file.path !== activeFile.path }"
          :style="lineNumberStyleFor(file)"
          v-html="allHtml.get(file.path) || ''"
        />
      </div>
      <div v-else class="cfv-code-body" :class="{ 'line-numbers': lineNumbers }" :style="lineNumberStyleFor(activeFile)" v-html="html" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { codeToHtml } from 'shiki';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { getBadgeLabel, getExt } from './fileBadge';
import TreeNode from './TreeNode.vue';
import type { CodeFile, FolderNode, TreeNode as TreeNodeType } from './types';

const props = withDefaults(
  defineProps<{
    files: CodeFile[];
    rootLabel?: string;
    defaultFile?: string;
    sidebarCollapsed?: boolean;
    id?: string;
    lineNumbers?: boolean;
    collapseToggle?: boolean;
    fixedHeight?: boolean;
  }>(),
  {
    sidebarCollapsed: false,
    lineNumbers: false,
    collapseToggle: false,
    fixedHeight: false,
  },
);

const langMap: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  json: 'json', html: 'html', css: 'css', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', sh: 'bash', bash: 'bash',
};

function inferLang(file: CodeFile): string {
  if (file.lang) return file.lang;
  return langMap[getExt(file.path)] || 'text';
}

// Build tree from flat file list
function buildTree(files: CodeFile[], rootLabel?: string): TreeNodeType[] {
  const root: TreeNodeType[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current: TreeNodeType[] = root;

    const folderParts = parts.slice(0, -1);
    for (const [depth, folderName] of folderParts.entries()) {
      let folder = current.find((n): n is FolderNode => n.name === folderName && n.type === 'folder');
      if (!folder) {
        folder = { name: folderName, type: 'folder', path: parts.slice(0, depth + 1).join('/'), children: [] };
        current.push(folder);
      }
      current = folder.children;
    }

    current.push({ name: parts[parts.length - 1], type: 'file', path: file.path, file });
  }

  // Sort: folders first, then files, alphabetical within each group
  function sortNodes(nodes: TreeNodeType[]): void {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.type === 'folder') sortNodes(node.children);
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
const collapsed = reactive(new Set<string>());
const sidebarOpen = ref(!props.sidebarCollapsed);
const copied = ref(false);
const sidebarWidth = ref<number | null>(null);
const isDragging = ref(false);

const sidebarStyle = computed(() => {
  if (sidebarWidth.value === null) return {};
  return { width: `${sidebarWidth.value}px`, maxWidth: `${sidebarWidth.value}px` };
});

const dragStartX = ref(0);
const dragStartWidth = ref(0);
const sidebarRef = ref<HTMLElement | null>(null);

function onDragMove(event: MouseEvent) {
  const delta = event.clientX - dragStartX.value;
  const minWidth = 120;
  const maxWidth = 400;
  sidebarWidth.value = Math.min(maxWidth, Math.max(minWidth, dragStartWidth.value + delta));
}

function onDragEnd() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

function onDividerMouseDown(event: MouseEvent) {
  event.preventDefault();
  if (!sidebarRef.value) return;
  isDragging.value = true;
  dragStartX.value = event.clientX;
  dragStartWidth.value = sidebarRef.value.getBoundingClientRect().width;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

const allHtml = ref(new Map<string, string>());

function lineNumberStyleFor(file: CodeFile) {
  if (!props.lineNumbers) return {};
  const lineCount = file.code.split('\n').length;
  const digits = String(lineCount).length;
  return { '--cfv-ln-width': `${digits}ch` };
}

const copyTimeout = ref<ReturnType<typeof setTimeout>>();
function copyCode() {
  navigator.clipboard.writeText(activeFile.value.code);
  copied.value = true;
  clearTimeout(copyTimeout.value);
  copyTimeout.value = setTimeout(() => {
    copied.value = false;
  }, 2000);
}

const activeExt = computed(() => getExt(activeFile.value.path).toUpperCase());

function getFileFromHash() {
  if (!props.id) return null;
  const hash = window.location.hash.slice(1);
  const prefix = `${props.id}:`;
  if (!hash.startsWith(prefix)) return null;
  const filePath = hash.slice(prefix.length);
  return props.files.find((f) => f.path === filePath) || null;
}

function expandParentFolders(filePath: string) {
  const parts = filePath.split('/');
  const parentParts = parts.slice(0, -1);
  for (const [index] of parentParts.entries()) {
    const folderPath = parts.slice(0, index + 1).join('/');
    collapsed.delete(folderPath);
  }
}

function selectFile(file: CodeFile) {
  activeFile.value = file;
  clearHash();
}

function clearHash() {
  if (getFileFromHash()) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function onHashChange() {
  const file = getFileFromHash();
  if (file) {
    expandParentFolders(file.path);
    activeFile.value = file;
  }
}

function toggleFolder(path: string) {
  if (collapsed.has(path)) {
    collapsed.delete(path);
  } else {
    collapsed.add(path);
  }
}

function collectFolderPaths(nodes: TreeNodeType[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path);
      paths.push(...collectFolderPaths(node.children));
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
  const hashFile = getFileFromHash();
  if (hashFile) {
    expandParentFolders(hashFile.path);
    activeFile.value = hashFile;
    clearHash();
  } else if (props.defaultFile) {
    expandParentFolders(activeFile.value.path);
  }
  window.addEventListener('hashchange', onHashChange);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange);
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  clearTimeout(copyTimeout.value);
});

watch(activeFile, async (file) => {
  if (props.fixedHeight && allHtml.value.size === 0) {
    const renderPromises = props.files.map(async (f) => {
      const rendered = await codeToHtml(f.code, {
        lang: inferLang(f),
        themes: { light: 'github-light', dark: 'github-dark' },
      });
      return [f.path, rendered] as const;
    });
    const entries = await Promise.all(renderPromises);
    allHtml.value = new Map(entries);
    return;
  }

  html.value = await codeToHtml(file.code, {
    lang: inferLang(file),
    themes: { light: 'github-light', dark: 'github-dark' },
  });
}, { immediate: true });
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

/* Drag divider */
.cfv-divider {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  margin-left: -1px;
}

.cfv-divider::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: var(--vp-c-divider);
  transition: background-color 0.15s, width 0.15s;
  transform: translateX(-50%);
}

.cfv-divider:hover::after,
.cfv-dragging .cfv-divider::after {
  width: 3px;
  background: var(--vp-c-divider);
}

.cfv-dragging {
  user-select: none;
  cursor: col-resize;
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

/* Fixed-height: stack all file renders in the same grid cell */
.cfv-code-body-stack {
  flex: 1;
  display: grid;
  overflow: auto;
}

.cfv-code-body-layer {
  grid-area: 1 / 1;
}

.cfv-code-body-hidden {
  visibility: hidden;
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
  opacity: 0;
  flex-shrink: 0;
  transition:
    border-color 0.25s,
    background-color 0.25s,
    opacity 0.25s;
}

.cfv-code:hover .cfv-copy {
  opacity: 0.7;
}

.cfv-code:hover .cfv-copy:hover {
  opacity: 1;
  border-color: var(--vp-code-copy-code-hover-border-color);
  background-color: var(--vp-code-copy-code-hover-bg);
}

.cfv-copy.copied,
.cfv-code:hover .cfv-copy.copied {
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
