<script>
  export let placeholder;
</script>

<input {placeholder} type="text" on:change />

<style>
  input {
    background: transparent;
    border: none;
    padding: 0.2rem 1rem;
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 0;
  }
</style>
