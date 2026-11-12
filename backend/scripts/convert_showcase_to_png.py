import fitz
import os

pdf_files = [
    ("preview_showcase_opt1_white.pdf", "preview_showcase_opt1_white.png"),
    ("preview_showcase_opt2_amber.pdf", "preview_showcase_opt2_amber.png"),
    ("preview_showcase_opt3_navy.pdf", "preview_showcase_opt3_navy.png")
]

artifact_dir = r"C:\Users\mery\.gemini\antigravity\brain\b16fe962-8c8b-4c33-8d9a-a596c5decb74"
public_dir = r"C:\Users\mery\Desktop\IDS_platforme\frontend\public"

for pdf_name, png_name in pdf_files:
    pdf_path = os.path.join(public_dir, pdf_name)
    if os.path.exists(pdf_path):
        doc = fitz.open(pdf_path)
        page = doc[0]
        # 2x zoom for high crispness
        pix = page.get_pixmap(dpi=150)
        
        # Save to public
        pix.save(os.path.join(public_dir, png_name))
        
        # Save to artifacts
        pix.save(os.path.join(artifact_dir, png_name))
        print(f"Rendered {png_name} successfully!")

print("All rendered!")

