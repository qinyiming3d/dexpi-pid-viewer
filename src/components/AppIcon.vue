<template>
  <span
    class="app-icon"
    :style="{
      maskImage: `url(/icons/${name}.svg)`,
      WebkitMaskImage: `url(/icons/${name}.svg)`,
      width: size + 'px',
      height: size + 'px',
    }"
    aria-hidden="true"
  ></span>
</template>
<script>
export default {
  props: {
    name: { type: String, required: true },
    size: { type: Number, default: 18 },
  },
};
</script>
<style>
.app-icon {
  display: inline-block;
  flex-shrink: 0;
  background: currentColor;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  vertical-align: middle;
}
</style>
