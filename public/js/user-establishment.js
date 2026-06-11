const STORAGE_KEY = 'webradio-podium-user-establishment';

export function getUserEstablishment() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.key) return null;
    return {
      key: parsed.key,
      label: parsed.label || parsed.key,
      savedAt: parsed.savedAt || null,
    };
  } catch {
    return null;
  }
}

export function setUserEstablishment(key, label) {
  const data = {
    key,
    label: label || key,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function clearUserEstablishment() {
  localStorage.removeItem(STORAGE_KEY);
}
