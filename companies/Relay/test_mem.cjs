const { City } = require('country-state-city');

console.log('Memory before:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
const cities = City.getCitiesOfCountry('GB');
console.log(`Loaded ${cities.length} cities.`);
console.log('Memory after:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
