import sys
try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
    from PIL import Image

def remove_dark_background(img_path):
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    # Getting the color of the top-left pixel to use as the background color
    bg_color = datas[0]
    
    for item in datas:
        # Distance from background color
        if abs(item[0] - bg_color[0]) < 20 and abs(item[1] - bg_color[1]) < 20 and abs(item[2] - bg_color[2]) < 20:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(img_path, "PNG")
    print(f"Processed {img_path}")

try:
    remove_dark_background("c:/Users/Shadow/Desktop/Openclaw Factory/frontend/public/pixel_boss_sprite_1778458433322.png")
    remove_dark_background("c:/Users/Shadow/Desktop/Openclaw Factory/frontend/public/pixel_worker_sprite_1778458446099.png")
except Exception as e:
    print(f"Error: {e}")
