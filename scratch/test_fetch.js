async function test() {
  console.log("Fetching google.com...");
  try {
    const res = await fetch("https://www.google.com");
    console.log("Google status:", res.status);
  } catch (e) {
    console.error("Google failed:", e);
  }
}
test();
