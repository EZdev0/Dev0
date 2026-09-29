async function run() {
    let customEndpoint = 'https://integrate.api.nvidia.com';
    let url = customEndpoint.replace(/\/v1\/chat\/completions$/, '').replace(/\/$/, '') + '/v1/models';
    console.log(url);
}
run();
