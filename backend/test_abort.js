async function fetchWithTimeout(url, options, timeoutMs = 2000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function run() {
  console.log("Starting fetchWithTimeout test to httpbin.org/delay/10 (2s timeout)...");
  const start = Date.now();
  try {
    await fetchWithTimeout('https://httpbin.org/delay/10', {}, 2000);
    console.log("Success! (Should have aborted)");
  } catch (err) {
    console.log(`Aborted successfully in ${Date.now() - start}ms:`, err.message);
  }
}

run();
