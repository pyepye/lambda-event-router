<script setup lang="ts">
import { computed, ref } from 'vue';
import { type ExampleEntry, exampleLink, fullExamples, serviceExamples } from '../data/examples';

const props = withDefaults(defineProps<{ group?: 'service' | 'full' }>(), { group: 'service' });

const entries = computed<ExampleEntry[]>(() =>
  props.group === 'full' ? fullExamples : serviceExamples,
);

const query = ref<string>('');

const filtered = computed<ExampleEntry[]>(function filterExamples() {
  const search = query.value.trim().toLowerCase();
  if (search.length === 0) {
    return entries.value;
  }
  return entries.value.filter((entry) => {
    const text = `${entry.name} ${entry.summary} ${entry.routers.join(' ')} ${entry.path}`;
    return text.toLowerCase().includes(search);
  });
});
</script>

<template>
  <section class="sx">
    <label v-if="entries.length > 4" class="sx-filter">
      <span class="sx-filter-label">Filter examples</span>
      <input
        v-model="query"
        type="search"
        placeholder="Filter by service or router..."
        aria-label="Filter examples"
      />
    </label>

    <div class="sx-list">
      <a
        v-for="entry in filtered"
        :key="entry.path"
        class="sx-link"
        :href="exampleLink(entry)"
        target="_blank"
        rel="noreferrer"
      >
        <span class="sx-icons">
          <img
            v-for="icon in entry.icons"
            :key="icon"
            :src="`/aws-icons/${icon}.svg`"
            alt=""
            aria-hidden="true"
          />
        </span>
        <span class="sx-body">
          <span class="sx-title">{{ entry.name }}</span>
          <span class="sx-summary">{{ entry.summary }}</span>
        </span>
        <span class="sx-routers">
          <code v-for="router in entry.routers" :key="router">{{ router }}</code>
        </span>
      </a>
    </div>

    <p v-if="filtered.length === 0" class="sx-empty">No examples match that filter.</p>
  </section>
</template>

<style scoped>
.sx {
  margin-top: 24px;
}

.sx-filter {
  display: block;
  width: 100%;
}

.sx-filter-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sx-filter input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  transition:
    border-color 0.25s,
    background-color 0.25s;
}

.sx-filter input::placeholder {
  color: var(--vp-c-text-3);
}

.sx-filter input:hover {
  border-color: var(--vp-c-brand-2);
}

.sx-filter input:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg);
}

.sx-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.sx-link {
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 11px 16px 13px;
  width: 100%;
  text-decoration: none;
  transition: border-color 0.25s;
}

.sx-link:hover {
  border-color: var(--vp-c-brand-1);
}

.sx-icons {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.sx-icons img {
  width: 28px;
  height: 28px;
}

.sx-body {
  display: block;
  flex: 1;
  min-width: 0;
}

.sx-title {
  display: block;
  line-height: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.sx-summary {
  display: block;
  line-height: 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.sx-routers {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 45%;
}

.sx-routers code {
  font-size: 11px;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  color: var(--vp-c-text-2);
  background-color: var(--vp-c-default-soft);
}

.sx-empty {
  color: var(--vp-c-text-2);
}

@media (max-width: 640px) {
  .sx-routers {
    display: none;
  }
}
</style>
