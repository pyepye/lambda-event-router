<template>
  <!-- Folder node -->
  <div v-if="node.type === 'folder'">
    <button class="tree-row tree-folder" :style="indent" @click="$emit('toggle', node.path)">
      <svg class="tree-icon" width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M1.5 2.5h4l1.5 1.5h6.5v9h-12z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
      <span class="tree-name">{{ node.name }}</span>
      <span class="tree-chevron" :class="{ expanded: !isCollapsed }">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>
    <div v-show="!isCollapsed">
      <TreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :selected-path="selectedPath"
        :collapsed="collapsed"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>

  <!-- File node -->
  <button
    v-else
    class="tree-row tree-file"
    :class="{ selected: node.path === selectedPath }"
    :style="indent"
    @click="$emit('select', node.file)"
  >
    <span class="tree-file-badge" :data-lang="ext">{{ badgeLabel }}</span>
    <span class="tree-name">{{ node.name }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, required: true },
  selectedPath: { type: String, required: true },
  collapsed: { type: Set, required: true },
})

defineEmits(['select', 'toggle'])

const isCollapsed = computed(() => props.collapsed.has(props.node.path))

const indent = computed(() => ({
  paddingLeft: `${12 + props.depth * 16}px`,
}))

const ext = computed(() => {
  const dot = props.node.name.lastIndexOf('.')
  return dot === -1 ? '' : props.node.name.slice(dot + 1).toUpperCase()
})

const badgeLabels = { JSON: '{}', HTML: '<>' }

const badgeLabel = computed(() => badgeLabels[ext.value] || ext.value)
</script>

<style>
.cfv .tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
  text-align: left;
  line-height: 1.5;
  transition: background-color 0.15s;
  border-radius: 6px;
  margin: 1px 6px;
  width: calc(100% - 12px);
}

.cfv .tree-row:hover {
  background: color-mix(in srgb, var(--vp-c-default-soft) 50%, transparent);
}

.cfv .tree-file.selected {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.cfv .tree-file.selected:hover {
  background: var(--vp-c-default-soft);
}

.cfv .tree-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-left: auto;
  transition: transform 0.15s ease;
  transform: rotate(-90deg);
  color: var(--vp-c-text-3);
}

.cfv .tree-chevron.expanded {
  transform: rotate(0deg);
}

.cfv .tree-icon {
  flex-shrink: 0;
  color: var(--vp-c-text-3);
}

.cfv .tree-folder .tree-name {
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.cfv .tree-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfv .tree-file-badge {
  display: inline-block;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  flex-shrink: 0;
}

.cfv .tree-file-badge {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-text);
}
</style>
