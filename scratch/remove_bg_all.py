from PIL import Image
import os

def remove_background(img_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()
        
        bg_color = datas[0]
        
        newData = []
        for item in datas:
            # Check if color is close to background color
            if all(abs(item[i] - bg_color[i]) < 30 for i in range(3)):
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
                
        img.putdata(newData)
        img.save(img_path, "PNG")
        print(f"Processed {img_path}")
    except Exception as e:
        print(f"Error processing {img_path}: {e}")

files = [
    'frontend/public/scheduler_agent_idle.png',
    'frontend/public/scheduler_desk.png',
    'frontend/public/pinterest_scraper_agent.png',
    'frontend/public/account_strategist_agent.png',
    'frontend/public/scheduler_manager_agent.png',
    'frontend/public/optimizer_agent.png'
]

for f in files:
    remove_background(f)
