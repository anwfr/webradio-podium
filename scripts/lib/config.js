import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

dotenv.config({ path: path.join(rootDir, '.env') });

const repository = process.env.GITHUB_REPOSITORY || '';
const [repoOwner, repoName] = repository.includes('/')
  ? repository.split('/')
  : [null, null];

export const config = {
  rootDir,
  dataDir: path.join(rootDir, 'data'),
  publicDataDir: path.join(rootDir, 'public/data'),
  publicJsDir: path.join(rootDir, 'public/js'),
  githubOwner:
    process.env.GITHUB_OWNER || repoOwner || 'YOUR_GITHUB_USER',
  githubRepo:
    process.env.GITHUB_REPO || repoName || 'webradio-podium',
  siteBaseUrl:
    process.env.SITE_BASE_URL ||
    `https://${process.env.GITHUB_OWNER || repoOwner || 'YOUR_GITHUB_USER'}.github.io/${process.env.GITHUB_REPO || repoName || 'webradio-podium'}`,
  httpTimeoutMs: Number(process.env.HTTP_TIMEOUT_MS || 15000),
  afdBaseUrl: 'https://offre-pedagogique.afd.fr',
  /** Podcast + programme pédagogique « Edition 2026 » (thematic 389). */
  listUrl:
    'https://offre-pedagogique.afd.fr/fr/publications/liste?words=&type%5B6%5D=6&thematic%5B389%5D=389&location=',
  userAgents: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/131.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Edge/131.0.0.0',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  ],
};

export function repoUrl() {
  return `https://github.com/${config.githubOwner}/${config.githubRepo}`;
}
