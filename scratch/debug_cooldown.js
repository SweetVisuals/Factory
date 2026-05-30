const { fetchAIChatCompletion } = require('../backend/ai-client');
require('dotenv').config();

// We will inspect the Map using a backdoor since it's not exported.
// But we can patch keyCooldowns if we want, or just test.
// Wait! Let's modify ai-client.js to export keyCooldowns, or we can just print in the file.
// Actually, let's write a simple script that logs what is going on.
