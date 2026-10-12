async function run() {
  const customEndpoint = "ttps://integrate.api.nvidia.com";

  let base = customEndpoint.trim();
  if (base.startsWith('ttp://')) base = 'http://' + base.substring(6);
  if (base.startsWith('ttps://')) base = 'https://' + base.substring(7);
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = 'https://' + base;
  }

  console.log("Base:", base);

}

run();
