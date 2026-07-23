<script setup lang="ts">
import { withBase } from 'vitepress';
import { type FilterPill, filterPills, iconUrl } from '../data/packages';

const services: FilterPill[] = filterPills.filter(function isRealService(pill) {
  return pill.service !== 'other';
});
</script>

<template>
  <section class="home-services">
    <div class="home-services-intro">
      <h2 class="home-services-title">Supported AWS services</h2>
      <p class="home-services-text">
        There is a router for every AWS service that can trigger a Lambda directly. That is 33
        routers across 26 packages.
      </p>
      <a class="home-services-link" :href="withBase('/packages')">See all packages and routers</a>
    </div>

    <ul class="home-services-grid">
      <li v-for="service in services" :key="service.service" class="home-services-item">
        <a :href="withBase(service.link)">
          <img :src="iconUrl(service.service)" :alt="''" aria-hidden="true" />
          <span>{{ service.short }}</span>
        </a>
      </li>
    </ul>
  </section>
</template>
