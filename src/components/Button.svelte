<script>
  export let primary = false;
  export let secondary = false;
  export let text;
</script>

<button
  on:click
  class="button"
  class:button--primary={primary}
  class:button--secondary={secondary}
>
  {text}
</button>

<style>
  .button {
    padding: 0.5rem 2rem;
    cursor: pointer;
    color: white;
    background: none;
    border-width: 2px;
    border-style: solid;
    outline: 0;
    background-color: transparent;
    text-align: center;
    border-radius: 0.12em;
  }

  .button:hover {
    --bg-opacity: 0.8;
  }

  .button--primary {
    --bg-opacity: 1;
    border-color: rgba(28, 163, 236, var(--bg-opacity));
  }

  .button--primary:hover {
    --bg-opacity: 1;
    background-color: rgba(28, 163, 236, var(--bg-opacity));
  }

  .button--secondary {
    --bg-opacity: 1;
    border-color: rgba(255, 0, 0, var(--bg-opacity));
  }

  .button--secondary:hover {
    --bg-opacity: 1;
    background-color: rgba(255, 0, 0, var(--bg-opacity));
  }
</style>
