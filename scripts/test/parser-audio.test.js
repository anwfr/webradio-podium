import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePodcastPage, resolveAudioUrl } from '../lib/parser.js';

test('resolveAudioUrl builds absolute URL from relative path', () => {
  assert.equal(
    resolveAudioUrl('/sites/pedagogie/files/2026-05/projet-final-505.mp3'),
    'https://offre-pedagogique.afd.fr/sites/pedagogie/files/2026-05/projet-final-505.mp3'
  );
});

test('resolveAudioUrl keeps absolute URLs unchanged', () => {
  const url = 'https://example.com/audio.mp3';
  assert.equal(resolveAudioUrl(url), url);
});

test('parsePodcastPage extracts audioUrl from audio source', () => {
  const html = `
    <html><body>
      <h1>Test podcast</h1>
      <audio controls>
        <source src="/sites/pedagogie/files/2026-05/test.mp3" type="audio/mpeg" />
      </audio>
      <input data-drupal-selector="edit-likes" value="42" />
      Edition 2026
    </body></html>
  `;
  const parsed = parsePodcastPage(html, 'test-podcast');
  assert.equal(
    parsed.audioUrl,
    'https://offre-pedagogique.afd.fr/sites/pedagogie/files/2026-05/test.mp3'
  );
});

test('parsePodcastPage returns null audioUrl when no source', () => {
  const html = '<html><body><h1>Sans audio</h1></body></html>';
  const parsed = parsePodcastPage(html, 'sans-audio');
  assert.equal(parsed.audioUrl, null);
});
