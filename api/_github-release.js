const DEFAULT_RELEASE_REPO = 'koala73/worldmonitor';

function getEnv(name, fallback = '') {
  const value = process?.env?.[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function resolveReleasesUrl() {
  const explicitUrl = getEnv('DOWNLOAD_RELEASES_API_URL');
  if (explicitUrl) return explicitUrl;

  const repo = getEnv('DOWNLOAD_RELEASE_REPO', DEFAULT_RELEASE_REPO);
  return `https://api.github.com/repos/${repo}/releases/latest`;
}

export async function fetchLatestRelease(userAgent) {
  const releaseApiUrl = resolveReleasesUrl();
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': userAgent,
  };
  const githubToken = getEnv('GITHUB_TOKEN');
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const res = await fetch(releaseApiUrl, {
    headers: {
      ...headers,
    },
  });
  if (!res.ok) return null;
  return res.json();
}
