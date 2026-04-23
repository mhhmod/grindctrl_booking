const LOADER_URL = 'https://cdn.grindctrl.com/widget/v1/loader.js';

export function buildCanonicalInstallSnippet(embedKey: string) {
  const key = String(embedKey || 'gc_live_xxxxx');

  return [
    '<script>',
    '  window.GrindctrlSupport = window.GrindctrlSupport || [];',
    '  window.GrindctrlSupport.push({',
    `    embedKey: '${key}',`,
    '    user: {',
    '      id: null,',
    '      email: null,',
    '      name: null',
    '    },',
    '    context: {',
    '      custom: {}',
    '    }',
    '  });',
    '</script>',
    `<script async src="${LOADER_URL}"></script>`,
  ].join('\n');
}

export function buildCspInstallSnippet(embedKey: string) {
  const key = String(embedKey || 'gc_live_xxxxx');

  return [
    '<script',
    '  async',
    `  src="${LOADER_URL}"`,
    `  data-gc-embed-key="${key}">`,
    '</script>',
  ].join('\n');
}

export function containsLegacyInstallPattern(snippet: string) {
  return [
    'window.GRINDCTRL_ID',
    'cdn.example.com/widget.js',
    'GrindctrlSupport.init',
    'https://cdn.grindctrl.com/grindctrl-support.js',
  ].some((value) => snippet.includes(value));
}

export const installContract = {
  loaderUrl: LOADER_URL,
};
