function fixUrl(url: string) {
  let fixed = url.trim();
  // Auto-correct typo where 'https://ttps://' occurs or 'ttp://'
  if (fixed.startsWith('ttps://')) fixed = 'https://' + fixed.substring(7);
  else if (fixed.startsWith('ttp://')) fixed = 'http://' + fixed.substring(6);

  if (!fixed.startsWith('http://') && !fixed.startsWith('https://')) {
    fixed = 'https://' + fixed;
  }
  return fixed;
}
console.log(fixUrl("ttps://integrate.api.nvidia.com"));
console.log(fixUrl("http://localhost"));
console.log(fixUrl("ttp://example.com"));
console.log(fixUrl("example.com"));
