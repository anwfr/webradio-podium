import { VOTES_END_AT } from './constants.js';

const TICK_MS = 1000;
let intervalId = null;

function pad(n) {
  return String(n).padStart(2, '0');
}

function computeRemaining(endMs) {
  const diff = Math.max(0, endMs - Date.now());
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { diff, days, hours, minutes, seconds };
}

function updateCountdownEl(el, endMs) {
  const { diff, days, hours, minutes, seconds } = computeRemaining(endMs);

  if (diff <= 0) {
    el.hidden = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    return;
  }

  el.hidden = false;
  el.classList.toggle('vote-countdown--urgent', diff < 24 * 60 * 60 * 1000);
  el.classList.toggle('vote-countdown--critical', diff < 60 * 60 * 1000);

  const setUnit = (unit, value) => {
    const valueEl = el.querySelector(`[data-countdown="${unit}"]`);
    if (valueEl) valueEl.textContent = unit === 'days' ? String(value) : pad(value);
  };

  setUnit('days', days);
  setUnit('hours', hours);
  setUnit('minutes', minutes);
  setUnit('seconds', seconds);

  const daysUnit = el.querySelector('[data-countdown-unit="days"]');
  if (daysUnit) daysUnit.hidden = days === 0;
}

export function initVoteCountdown(containerId = 'vote-countdown') {
  const el = document.getElementById(containerId);
  if (!el) return;

  const endMs = Date.parse(VOTES_END_AT);
  if (!Number.isFinite(endMs) || endMs <= Date.now()) {
    el.hidden = true;
    return;
  }

  if (intervalId) clearInterval(intervalId);

  const tick = () => updateCountdownEl(el, endMs);
  tick();
  intervalId = setInterval(tick, TICK_MS);
}
