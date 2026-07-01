

async function check() {
  try {
    const res = await fetch('https://relayfactory.vercel.app');
    const text = await res.text();
    console.log('HTTP Status:', res.status);
    console.log('HTML snippet:', text.substring(0, 800));
    console.log('Includes Build v1.0.4:', text.includes('Build v1.0.4'));
    console.log('Includes Sign in to Factory:', text.includes('Sign in to Factory'));
  } catch (err) {
    console.error(err);
  }
}
check();
