#!/usr/bin/env python3
"""Generate proper launcher icons using PIL/Pillow"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow is not installed. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw, ImageFont

import os

def create_launcher_icon(size, bg_color=(33, 150, 243), text_color=(255, 255, 255)):
    """Create a simple launcher icon with text"""
    # Create image with solid background
    img = Image.new('RGB', (size, size), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Draw a simple "T" letter for Twkan
    try:
        # Try to use a system font
        font_size = int(size * 0.6)
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()

    # Draw text centered
    text = "T"
    # Use textbbox for newer Pillow versions
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    except:
        # Fallback for older Pillow
        text_width, text_height = draw.textsize(text, font=font)

    x = (size - text_width) // 2
    y = (size - text_height) // 2

    draw.text((x, y), text, fill=text_color, font=font)

    return img

def generate_all_icons():
    """Generate launcher icons for all Android densities"""
    densities = {
        'mdpi': 48,
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192
    }

    base_path = 'app/src/main/res'

    for density, size in densities.items():
        dir_path = os.path.join(base_path, f'mipmap-{density}')
        os.makedirs(dir_path, exist_ok=True)

        # Create square icon
        icon = create_launcher_icon(size)
        icon_path = os.path.join(dir_path, 'ic_launcher.png')
        icon.save(icon_path, 'PNG')
        print(f'Created {icon_path} ({size}x{size})')

        # Create round icon (same for now)
        round_icon_path = os.path.join(dir_path, 'ic_launcher_round.png')
        icon.save(round_icon_path, 'PNG')
        print(f'Created {round_icon_path} ({size}x{size})')

if __name__ == '__main__':
    print("Generating launcher icons...")
    generate_all_icons()
    print("\nIcon generation complete!")
    print("All icons have been created successfully.")
