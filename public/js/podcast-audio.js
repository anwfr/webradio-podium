/** MP3 L'hommiculture — fallback tant que audioUrl n'est pas peuplé par le scrape. */
export const DEFAULT_PODCAST_AUDIO_URL =
  'https://offre-pedagogique.afd.fr/sites/pedagogie/files/2026-05/projet-final-505.mp3';

export function resolvePodcastAudioUrl(row) {
  if (row?.audioUrl) return row.audioUrl;
  return DEFAULT_PODCAST_AUDIO_URL;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l11.04-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z"/></svg>`;

export function podcastAudioMarkup(row) {
  const audioUrl = resolvePodcastAudioUrl(row);
  if (!audioUrl) return '';

  const ariaLabel = `Écouter le podcast ${row.title}`;
  return `
    <section class="podcast-sheet-listen" aria-label="Écouter le podcast">
      <div class="podcast-audio-player" data-podcast-audio>
        <audio preload="none" src="${escapeHtml(audioUrl)}" aria-label="${escapeHtml(ariaLabel)}"></audio>
        <button type="button" class="podcast-audio-player__trigger" data-audio-play aria-label="Écouter le podcast">
          <span class="podcast-audio-player__play" aria-hidden="true">
            <span class="podcast-audio-player__play-icon" data-audio-play-icon>${PLAY_ICON}</span>
          </span>
          <span class="podcast-audio-player__title">Écouter le podcast</span>
        </button>
        <div class="podcast-audio-player__progress">
          <input
            type="range"
            class="podcast-audio-player__seek"
            data-audio-seek
            min="0"
            max="1000"
            value="0"
            step="1"
            aria-label="Progression de l'écoute"
            aria-valuemin="0"
            aria-valuemax="1000"
            aria-valuenow="0"
          />
        </div>
        <span class="podcast-audio-player__time" aria-hidden="true">
          <span data-audio-current>0:00</span><span class="podcast-audio-player__time-sep">/</span><span data-audio-duration>--:--</span>
        </span>
      </div>
    </section>`;
}

export function initPodcastAudioPlayer(root) {
  const audio = root.querySelector('audio');
  const playBtn = root.querySelector('[data-audio-play]');
  const playIcon = root.querySelector('[data-audio-play-icon]');
  const seek = root.querySelector('[data-audio-seek]');
  const currentEl = root.querySelector('[data-audio-current]');
  const durationEl = root.querySelector('[data-audio-duration]');

  if (!audio || !playBtn || !seek) {
    return { audio: null, stop() {} };
  }

  let seeking = false;

  function setPlaying(playing) {
    root.classList.toggle('podcast-audio-player--playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Mettre en pause' : 'Écouter le podcast');
    playIcon.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
  }

  function setStarted(started) {
    root.classList.toggle('podcast-audio-player--started', started);
  }

  function updateSeekUi() {
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const ratio = audio.currentTime / duration;
    const seekValue = seeking ? Number(seek.value) : Math.round(ratio * 1000);
    if (!seeking) {
      seek.value = String(seekValue);
    }
    const pct = (seekValue / 1000) * 100;
    seek.style.setProperty('--seek-fill', `${pct}%`);
    seek.setAttribute('aria-valuenow', seek.value);
    if (currentEl) currentEl.textContent = formatAudioTime(audio.currentTime);
  }

  function onLoadedMetadata() {
    if (durationEl) {
      durationEl.textContent = formatAudioTime(audio.duration);
    }
    updateSeekUi();
  }

  function onTimeUpdate() {
    updateSeekUi();
  }

  function onPlay() {
    setStarted(true);
    setPlaying(true);
  }

  function onPause() {
    setPlaying(false);
  }

  function onEnded() {
    setPlaying(false);
    setStarted(false);
    audio.currentTime = 0;
    updateSeekUi();
  }

  function onSeekInput() {
    seeking = true;
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const nextTime = (Number(seek.value) / 1000) * duration;
    seek.style.setProperty('--seek-fill', `${(Number(seek.value) / 1000) * 100}%`);
    if (currentEl) currentEl.textContent = formatAudioTime(nextTime);
    seek.setAttribute('aria-valuenow', seek.value);
  }

  function onSeekChange() {
    const duration = audio.duration;
    if (Number.isFinite(duration) && duration > 0) {
      audio.currentTime = (Number(seek.value) / 1000) * duration;
    }
    seeking = false;
    updateSeekUi();
  }

  async function togglePlay() {
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  playBtn.addEventListener('click', togglePlay);
  seek.addEventListener('input', onSeekInput);
  seek.addEventListener('change', onSeekChange);
  audio.addEventListener('loadedmetadata', onLoadedMetadata);
  audio.addEventListener('durationchange', onLoadedMetadata);
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('play', onPlay);
  audio.addEventListener('pause', onPause);
  audio.addEventListener('ended', onEnded);

  if (audio.readyState >= 1) onLoadedMetadata();

  return {
    audio,
    stop() {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      setStarted(false);
      playBtn.removeEventListener('click', togglePlay);
      seek.removeEventListener('input', onSeekInput);
      seek.removeEventListener('change', onSeekChange);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    },
  };
}
