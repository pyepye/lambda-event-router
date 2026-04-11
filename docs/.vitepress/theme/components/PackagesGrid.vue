<script setup lang="ts">
import { computed, ref } from 'vue';
import { type PackageEntry, packages } from '../data/packages';

type ServiceOption = {
  slug: string;
  label: string;
};

const searchQuery = ref('');
const selectedServices = ref<Set<string>>(new Set());

const serviceOptions = computed<ServiceOption[]>(function buildServiceOptions() {
  const seen = new Map<string, string>();
  for (const entry of packages) {
    if (!seen.has(entry.serviceSlug)) {
      seen.set(entry.serviceSlug, entry.service);
    }
  }
  const options: ServiceOption[] = [];
  for (const [slug, label] of seen) {
    options.push({ slug, label });
  }
  return options;
});

const filteredPackages = computed<PackageEntry[]>(function filterPackages() {
  const query = searchQuery.value.trim().toLowerCase();
  const activeSlugs = selectedServices.value;
  const results: PackageEntry[] = [];
  for (const entry of packages) {
    if (activeSlugs.size > 0 && !activeSlugs.has(entry.serviceSlug)) {
      continue;
    }
    if (query.length > 0) {
      const haystack = `${entry.name} ${entry.service} ${entry.package} ${entry.details}`.toLowerCase();
      if (!haystack.includes(query)) {
        continue;
      }
    }
    results.push(entry);
  }
  return results;
});

function isServiceActive(slug: string): boolean {
  return selectedServices.value.has(slug);
}

function toggleService(slug: string): void {
  const next = new Set(selectedServices.value);
  if (next.has(slug)) {
    next.delete(slug);
  } else {
    next.add(slug);
  }
  selectedServices.value = next;
}

function clearFilters(): void {
  searchQuery.value = '';
  selectedServices.value = new Set();
}

function iconUrl(slug: string): string {
  return `/aws-icons/${slug}.svg`;
}
</script>

<template>
  <section class="packages-grid">
    <div class="packages-controls">
      <label class="packages-search">
        <span class="packages-search-label">Search packages</span>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search by router name or AWS service..."
          aria-label="Search packages"
        />
      </label>

      <div class="packages-filters" role="group" aria-label="Filter by AWS service">
        <button
          v-for="option in serviceOptions"
          :key="option.slug"
          type="button"
          class="packages-filter-pill"
          :class="{ 'is-active': isServiceActive(option.slug) }"
          :aria-pressed="isServiceActive(option.slug)"
          @click="toggleService(option.slug)"
        >
          <img
            :src="iconUrl(option.slug)"
            :alt="''"
            class="packages-filter-icon"
            aria-hidden="true"
          />
          <span>{{ option.label }}</span>
        </button>
      </div>
    </div>

    <div v-if="filteredPackages.length > 0" class="packages-card-grid">
      <a
        v-for="entry in filteredPackages"
        :key="entry.name"
        :href="entry.link"
        class="packages-card"
      >
        <div class="packages-card-icon">
          <img :src="iconUrl(entry.serviceSlug)" :alt="entry.service" />
        </div>
        <h3 class="packages-card-title">{{ entry.name }}</h3>
        <p class="packages-card-package">{{ entry.package }}</p>
        <p class="packages-card-service">
          {{ entry.service }}<template v-if="entry.details"> · {{ entry.details }}</template>
        </p>
      </a>
    </div>
    <div v-else class="packages-empty">
      <p>No packages match your search.</p>
      <button type="button" class="packages-empty-reset" @click="clearFilters">
        Clear filters
      </button>
    </div>
  </section>
</template>
