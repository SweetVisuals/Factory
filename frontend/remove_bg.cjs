const Jimp = require('jimp');

async function removeBackground(imgPath) {
  try {
    const image = await Jimp.read(imgPath);
    const targetColor = image.getPixelColor(0, 0); // Get top-left pixel color
    const { r: tr, g: tg, b: tb } = Jimp.intToRGBA(targetColor);

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // If the pixel color is close to the background color, make it transparent
      if (Math.abs(r - tr) < 20 && Math.abs(g - tg) < 20 && Math.abs(b - tb) < 20) {
        this.bitmap.data[idx + 3] = 0; // Alpha channel
      }
    });

    await image.writeAsync(imgPath);
    console.log('Processed', imgPath);
  } catch(e) {
    console.error('Error processing', imgPath, e);
  }
}

async function main() {
  await removeBackground('c:/Users/Shadow/Desktop/Openclaw Factory/frontend/public/pixel_boss_sprite_1778458433322.png');
  await removeBackground('c:/Users/Shadow/Desktop/Openclaw Factory/frontend/public/pixel_worker_sprite_1778458446099.png');
}

main();
