<script setup lang="ts">
import { computed, ref } from 'vue';
import { filterPills, type PackageEntry, packages } from '../data/packages';

const searchQuery = ref<string>('');
const selectedServices = ref<Set<string>>(new Set());

const filteredPackages = computed<PackageEntry[]>(function filterPackages() {
  const query = searchQuery.value.trim().toLowerCase();
  const activeSlugs = selectedServices.value;
  const results: PackageEntry[] = [];
  for (const entry of packages) {
    if (activeSlugs.size > 0 && !entry.services.some((service) => activeSlugs.has(service))) {
      continue;
    }
    if (query.length > 0) {
      const servicesText = entry.services.join(' ');
      const searchText = `${entry.name} ${servicesText} ${entry.package} ${entry.details}`.toLowerCase();
      if (!searchText.includes(query)) {
        continue;
      }
    }
    results.push(entry);
  }
  return results;
});

function isServiceActive(service: string): boolean {
  return selectedServices.value.has(service);
}

function toggleService(service: string): void {
  const next = new Set(selectedServices.value);
  if (next.has(service)) {
    next.delete(service);
  } else {
    next.add(service);
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
          v-for="option in filterPills"
          :key="option.service"
          type="button"
          class="packages-filter-pill"
          :class="{ 'is-active': isServiceActive(option.service) }"
          :aria-pressed="isServiceActive(option.service)"
          @click="toggleService(option.service)"
        >
          <img
            :src="iconUrl(option.service)"
            :alt="''"
            class="packages-filter-icon"
            aria-hidden="true"
          />
          <span>{{ option.name }}</span>
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
          <img v-for="icon in entry.icons" :key="icon" :src="iconUrl(icon)" :alt="icon" />
        </div>
        <h3 class="packages-card-title">{{ entry.name }}</h3>
        <p class="packages-card-package">{{ entry.package }}</p>
        <p class="packages-card-service">{{ entry.details }}</p>
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
