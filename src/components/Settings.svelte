<script>
  import IoIosSettings from "svelte-icons/io/IoIosSettings.svelte";
  import IoIosClose from "svelte-icons/io/IoIosClose.svelte";
  import Switch from "./Switch.svelte";
  import Input from "./Input.svelte";
  import { getStore } from "../store";
  let open;

  const time = getStore("time");
  const settings = getStore("settings");

  const parsedSettings = JSON.parse($settings);

  const handleButtonClick = () => {
    open = true;
  };

  const handleCloseClick = () => {
    open = false;
  };

  const handleSwitch =
    (key) =>
    ({ detail: { checked } }) => {
      settings.update((old) => {
        const parsed = JSON.parse(old);

        parsed[key] = checked;

        return JSON.stringify(parsed);
      });
    };

  const handleInput =
    (key, validation) =>
    ({ target: { value } }) => {
      if (!validation(value)) return;

      time.set(value);
    };
</script>

<div class="settings">
  <div class="settings__button" on:click={handleButtonClick}>
    <IoIosSettings />
  </div>

  {#if open}
    <div class="settings__panel">
      <div class="settings__header">
        <p class="settings__header--title">Settings</p>
        <div class="settings__header--close" on:click={handleCloseClick}>
          <IoIosClose />
        </div>
      </div>
      <div class="settngs__content">
        <div class="settings__item">
          <p class="settings__item--label">Time (minutes)</p>
          <Input
            placeholder={$time}
            on:change={handleInput("time", (value) => !isNaN(value))}
          />
        </div>

        <div class="settings__item">
          <p class="settings__item--label">Alarm sound</p>
          <Switch
            checkedValue={parsedSettings["alarm"]}
            on:switch={handleSwitch("alarm")}
          />
        </div>

        <div class="settings__item">
          <p class="settings__item--label">Notification</p>
          <Switch
            checkedValue={parsedSettings["notification"]}
            on:switch={handleSwitch("notification")}
          />
        </div>
      </div>
    </div>

    <div class="settings_overlay" />
  {/if}
</div>

<style>
  .settings {
    position: relative;
    z-index: 10;
  }

  .settings__button {
    width: 2rem;
    height: 2rem;
    color: white;
    cursor: pointer;
  }

  .settings__panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-height: 20rem;
    min-width: 30rem;
    background-color: var(--bg-background-darker);
    color: white;
    z-index: 99;
    border-radius: 1rem;
    padding: 1rem 2rem;
  }

  .settings_overlay {
    background-color: rgba(0, 0, 0, 0.7);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .settings__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .settings__header--title {
    color: var(--primary);
    font-weight: bold;
  }

  .settings__header--close {
    width: 2rem;
    height: 2rem;
    cursor: pointer;
  }

  .settings__item {
    display: flex;
    align-items: center;
    margin: 1rem auto;
  }

  .settings__item--label {
    margin: 0;
    margin-right: 0.5rem;
  }
</style>
