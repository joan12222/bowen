import sys
import pytesseract
from pdf2image import convert_from_path
from pathlib import Path

# Windows 需要指定 Tesseract 路径
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# 使用用户目录的 tessdata（含中文包）
import os
os.environ["TESSDATA_PREFIX"] = r'C:\Users\joan\tessdata'

POPPLER_PATH = r'C:\Users\joan\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin'

def ocr_pdf(pdf_path: str, poppler_path: str = None):
    print(f"转换 PDF 为图片: {pdf_path}")
    kwargs = {"dpi": 300, "poppler_path": poppler_path or POPPLER_PATH}

    images = convert_from_path(pdf_path, **kwargs)
    print(f"共 {len(images)} 页")

    results = []
    for i, image in enumerate(images):
        print(f"OCR 第 {i+1}/{len(images)} 页...")
        # chi_sim = 简体中文，chi_tra = 繁体中文
        text = pytesseract.image_to_string(image, lang="chi_sim+eng")
        results.append(text)

    full_text = "\n".join(results)

    # 输出到文件
    out_path = Path(pdf_path).with_suffix(".txt")
    out_path.write_text(full_text, encoding="utf-8")
    print(f"\n识别结果已保存到: {out_path}")
    print("\n--- 前 500 字预览 ---")
    print(full_text[:500])

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python ocr_pdf_test.py <pdf路径> [poppler_bin路径]")
        sys.exit(1)
    poppler = sys.argv[2] if len(sys.argv) > 2 else None
    ocr_pdf(sys.argv[1], poppler)
