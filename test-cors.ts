async function run() {
  const customEndpoint = "ttps://integrate.api.nvidia.com";

  let base = customEndpoint.trim();
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = 'https://' + base;
  }

  const url = base.replace(/\/v1\/chat\/completions$/, '').replace(/\/$/, '') + '/v1/models';
  console.log("URL:", url);

}

run();
