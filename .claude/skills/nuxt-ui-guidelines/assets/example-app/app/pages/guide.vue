<script setup lang="ts">
import { marked } from "marked";
import source from "../../../../references/guidelines.md?raw";
import PageHeader from "../components/kit/PageHeader.vue";
// Trusted, checked-in Markdown only. Do not pass user HTML to this renderer.
const html = marked.parse(source);
useHead({ title: "Guidelines" });
</script>
<template>
  <!-- eslint-disable vue/no-v-html -- Only the trusted checked-in guidelines.md is rendered. -->
  <UDashboardPanel id="guide"
    ><template #header><PageHeader title="Guidelines" /></template
    ><template #body
      ><article class="guide mx-auto w-full" v-html="html" /></template
  ></UDashboardPanel>
</template>
