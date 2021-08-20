import { writable } from "svelte/store";

export const stores = [];

const createStore = (key, fallback) => {
  const storedValue = localStorage.getItem(key);
  let initialValue = storedValue;

  if (storedValue === null || storedValue === undefined) {
    initialValue = fallback;
  }

  if (storedValue === "true" || storedValue === "false") {
    initialValue = storedValue === "true";
  }

  const value = writable(initialValue);

  value.subscribe((val) => {
    if (typeof val === "object") {
      val = JSON.stringify(val);
    }

    localStorage.setItem(key, val);
  });

  stores.push({
    value,
    key,
  });

  return value;
};

export const getStore = (key) => {
  const value = stores.find((store) => store.key === key).value;

  return value;
};

export default createStore;
