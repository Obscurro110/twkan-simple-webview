#!/usr/bin/env python3
import struct
import os

def create_simple_png(width, height, color_rgb):
    """Create a simple solid color PNG file"""
    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_chunk = b'IHDR' + ihdr_data
    ihdr_crc = struct.pack('>I', 0)  # Simplified, not actual CRC
    ihdr = struct.pack('>I', len(ihdr_data)) + ihdr_chunk + ihdr_crc

    # Create image data (simplified approach)
    # For a real implementation, we'd use PIL/Pillow
    # This creates a minimal valid PNG structure

    # Using zlib compression for image data
    import zlib
    scanlines = b''
    for y in range(height):
        scanline = b'\x00'  # Filter type: None
        for x in range(width):
            scanline += bytes(color_rgb)
        scanlines += scanline

    compressed = zlib.compress(scanlines, 9)
    idat_chunk = b'IDAT' + compressed
    idat_crc = struct.pack('>I', 0)
    idat = struct.pack('>I', len(compressed)) + idat_chunk + idat_crc

    # IEND chunk
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', 0)

    return png_signature + ihdr + idat + iend

def generate_launcher_icons():
    """Generate launcher icons for different densities"""
    densities = {
        'mdpi': 48,
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192
    }

    # Simple blue color for the icon
    color = (33, 150, 243)  # Material Blue

    base_path = 'app/src/main/res'

    for density, size in densities.items():
        dir_path = os.path.join(base_path, f'mipmap-{density}')
        os.makedirs(dir_path, exist_ok=True)

        icon_path = os.path.join(dir_path, 'ic_launcher.png')
        round_icon_path = os.path.join(dir_path, 'ic_launcher_round.png')

        png_data = create_simple_png(size, size, color)

        with open(icon_path, 'wb') as f:
            f.write(png_data)

        with open(round_icon_path, 'wb') as f:
            f.write(png_data)

        print(f'Created {icon_path} ({size}x{size})')

if __name__ == '__main__':
    generate_launcher_icons()
    print('Icon generation complete!')
