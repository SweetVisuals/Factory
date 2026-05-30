async function test() {
  console.log("Fetching openrouter.ai...");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions");
    console.log("OpenRouter status:", res.status);
  } catch (e) {
    console.error("OpenRouter failed:", e);
  }
}
test();
