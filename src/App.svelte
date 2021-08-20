<script>
  import humanizeDuration from "humanize-duration";
  import Button from "./components/Button.svelte";

  import Settings from "./components/Settings.svelte";
  import createStore from "./store";

  const { ipcRenderer } = require("electron");

  const sendNotification = () => {
    console.log("SENDING NOTIFICATIOn");

    ipcRenderer.send("notification", {
      title: "Drink watahhhhh",
      message: "Spend few minutes to drink your watah. Stay hydrated.",
    });
  };

  const minutesToMilliseconds = (minutes) => {
    let minute = 60000;

    let milliseconds = minutes * minute;

    return milliseconds;
  };

  const timeStore = createStore("time", 30);
  const settingsStore = createStore("settings", {
    alarm: true,
    notification: true,
  });

  let settings;
  let milliseconds = minutesToMilliseconds(30);
  let remainingTime = milliseconds;

  timeStore.subscribe((value) => {
    milliseconds = minutesToMilliseconds(Number(value));
    remainingTime = milliseconds;
  });

  settingsStore.subscribe((val) => {
    settings = JSON.parse(val);
  });

  const alarm = new Audio("alarm.mp3");

  let percent = 100;

  let interval;

  let isPaused = true;
  let isEnd = false;

  const restart = () => {
    if (interval) {
      clearInterval(interval);
    }

    isEnd = false;
    isPaused = false;
    percent = 100;
    remainingTime = milliseconds;
  };

  const stop = () => {
    if (settings.notification) {
      sendNotification();
    }

    percent = 0;
    clearInterval(interval);
    isPaused = false;
    isEnd = true;

    if (settings.alarm) {
      alarm.play();
    }
  };

  const handleStartClick = () => {
    if (isEnd || !isPaused) {
      restart();
    }

    isPaused = false;

    interval = setInterval(() => {
      remainingTime -= 1000;
      percent = (remainingTime / milliseconds) * 100;

      if (remainingTime === 0) {
        stop();
      }
    }, 1000);
  };

  const handlePauseClick = () => {
    clearInterval(interval);
    isPaused = true;

    alarm.pause();
    alarm.currentTime = 0;
  };
</script>

<main style={`--timer-background-percent: ${percent}%`}>
  {#if isEnd}
    <h1 class="notify-message">Oi! It's time to drink waterrr.</h1>
  {/if}

  <div class="settings-container">
    <Settings />
  </div>

  <div class="timer">
    <div class="timer__background" />

    <div class="timer__overlay">
      <h1 class="timer__overlay--title text-lg text-gray-600">
        Stay hydrated!
      </h1>

      <p class="timer__overlay--time">
        Time left: <strong>
          {humanizeDuration(remainingTime)}
        </strong>
      </p>
    </div>
  </div>

  <div class="button-container">
    <Button
      on:click={handleStartClick}
      primary
      text={isPaused && !isEnd ? "Start" : "Restart"}
    />
    <Button on:click={handlePauseClick} secondary text="Pause" />
  </div>
</main>

<style>
  main {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--bg-background);
    flex-direction: column;
  }

  .notify-message {
    color: white;
  }

  .timer {
    width: 20rem;
    height: 20rem;
    border-color: white;
    border-width: 2px;
    border-style: solid;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    position: relative;
    z-index: 0;
  }

  .timer__background {
    width: 100%;
    height: var(--timer-background-percent);
    background-color: var(--timer-background-color);
    transition: height 300ms;
    z-index: 0;
  }

  .timer__overlay {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    color: white;
    z-index: 0;
  }

  .timer__overlay--title {
    color: white;
  }

  .button-container {
    margin-top: 2rem;
    display: flex;
    align-items: center;
  }

  .button-container > :global(*) {
    margin: 0 0.2rem;
  }

  .settings-container {
    position: absolute;
    right: 5px;
    top: 5px;
  }
</style>
