
async function test() {
  try {
    const res = await fetch('http://localhost:3001/');
    const text = await res.text();
    console.log('Backend response:', text);
  } catch (e) {
    console.error('Backend unreachable on 3001:', e.message);
  }

  try {
    const res = await fetch('http://localhost:5174/');
    console.log('Frontend reachable on 5174');
  } catch (e) {
    console.error('Frontend unreachable on 5174:', e.message);
  }
}

test();
