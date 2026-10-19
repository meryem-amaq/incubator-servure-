from PIL import Image

img = Image.open('frontend/public/logo-ctpes.png').convert('RGBA')
w, h = img.size

out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
for x in range(w):
    for y in range(h):
        r, g, b, a = img.getpixel((x, y))
        if a == 0:
            out.putpixel((x, y), (0, 0, 0, 0))
        elif x < 815:
            # All text before x=815 becomes crisp white
            out.putpixel((x, y), (255, 255, 255, a))
        else:
            # Orange circular seal
            out.putpixel((x, y), (r, g, b, a))

out.save('frontend/public/logo-ctpes-dark.png')
print("Successfully generated logo-ctpes-dark.png with boundary x < 815")
