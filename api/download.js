import { fetchLatestRelease } from './_github-release.js';

// Non-sebuf: returns XML/HTML, stays as standalone Vercel function
export const config = { runtime: 'edge' };

const RELEASES_PAGE = 'https://github.com/koala73/worldmonitor/releases/latest';

const PLATFORM_PATTERNS = {
  'windows-exe': (name) => name.endsWith('_x64-setup.exe'),
  'windows-msi': (name) => name.endsWith('_x64_en-US.msi'),
  'macos-arm64': (name) => name.endsWith('_aarch64.dmg'),
  'macos-x64': (name) => name.endsWith('_x64.dmg') && !name.includes('setup'),
  'linux-appimage': (name) => name.endsWith('_amd64.AppImage'),
  'linux-appimage-arm64': (name) => name.endsWith('_aarch64.AppImage'),
};

const VARIANT_IDENTIFIERS = {
  full: ['worldmonitor'],
  world: ['worldmonitor'],
  tech: ['techmonitor'],
  finance: ['financemonitor'],
};

const PLATFORM_ENV_KEYS = {
  'windows-exe': ['DOWNLOAD_URL_WINDOWS_EXE', 'DOWNLOAD_URL_WINDOWS'],
  'windows-msi': ['DOWNLOAD_URL_WINDOWS_MSI', 'DOWNLOAD_URL_WINDOWS'],
  'macos-arm64': ['DOWNLOAD_URL_MACOS_ARM64', 'DOWNLOAD_URL_MAC_SILICON'],
  'macos-x64': ['DOWNLOAD_URL_MACOS_X64', 'DOWNLOAD_URL_MAC_INTEL'],
  'linux-appimage': ['DOWNLOAD_URL_LINUX_APPIMAGE', 'DOWNLOAD_URL_LINUX_X64', 'DOWNLOAD_URL_LINUX'],
  'linux-appimage-arm64': ['DOWNLOAD_URL_LINUX_APPIMAGE_ARM64', 'DOWNLOAD_URL_LINUX_ARM64'],
};

function getEnv(name) {
  const value = process?.env?.[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function buildVariantEnvKey(baseKey, variant) {
  if (!variant) return '';
  return `${baseKey}_${variant.toUpperCase()}`;
}

function resolveCustomDownloadUrl(platform, variant) {
  const keys = PLATFORM_ENV_KEYS[platform] ?? [];
  for (const key of keys) {
    const variantKey = buildVariantEnvKey(key, variant);
    if (variantKey) {
      const variantValue = getEnv(variantKey);
      if (variantValue) return variantValue;
    }
    const value = getEnv(key);
    if (value) return value;
  }
  return '';
}

function canonicalAssetName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findAssetForVariant(assets, variant, platformMatcher) {
  const identifiers = VARIANT_IDENTIFIERS[variant] ?? null;
  if (!identifiers) return null;

  return assets.find((asset) => {
    const assetName = String(asset?.name || '');
    const normalizedAssetName = canonicalAssetName(assetName);
    const hasVariantIdentifier = identifiers.some((identifier) =>
      normalizedAssetName.includes(identifier)
    );
    return hasVariantIdentifier && platformMatcher(assetName);
  }) ?? null;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const platform = url.searchParams.get('platform');
  const variant = (url.searchParams.get('variant') || '').toLowerCase();

  if (!platform || !PLATFORM_PATTERNS[platform]) {
    return Response.redirect(RELEASES_PAGE, 302);
  }

  try {
    const customUrl = resolveCustomDownloadUrl(platform, variant);
    if (customUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': customUrl,
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60, stale-if-error=600',
        },
      });
    }

    const release = await fetchLatestRelease('WorldMonitor-Download-Redirect');
    if (!release) {
      return Response.redirect(RELEASES_PAGE, 302);
    }
    const matcher = PLATFORM_PATTERNS[platform];
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const asset = variant
      ? findAssetForVariant(assets, variant, matcher)
      : assets.find((a) => matcher(String(a?.name || '')));

    if (!asset) {
      return Response.redirect(RELEASES_PAGE, 302);
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': asset.browser_download_url,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60, stale-if-error=600',
      },
    });
  } catch {
    return Response.redirect(RELEASES_PAGE, 302);
  }
}
