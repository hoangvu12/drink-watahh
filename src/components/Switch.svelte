<script>
  import Switch from "svelte-switch";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
  export let checkedValue = false;

  function handleChange(e) {
    const { checked } = e.detail;
    checkedValue = checked;

    dispatch("switch", {
      checked,
    });
  }
</script>

<Switch
  on:change={handleChange}
  checked={checkedValue}
  height={20}
  width={40}
  handleDiameter={0}
/>
