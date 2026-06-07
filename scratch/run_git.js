import { execSync } from 'child_process';

try {
    console.log('Running git status...');
    const out = execSync('.git-portable\\cmd\\git.exe status', { encoding: 'utf8' });
    console.log('OUTPUT:');
    console.log(out);
} catch(e) {
    console.error('ERROR:', e.message);
    if (e.stdout) console.log('STDOUT:', e.stdout);
    if (e.stderr) console.log('STDERR:', e.stderr);
}
