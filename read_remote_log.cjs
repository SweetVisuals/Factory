const { execSync } = require('child_process');
try {
  console.log(execSync('ssh -o BatchMode=yes root@5.75.252.100 "tail -n 50 /root/Factory/companies/Relay/scraper_endpoint.log"').toString());
} catch (e) {
  console.log(e.stdout ? e.stdout.toString() : e.message);
}
