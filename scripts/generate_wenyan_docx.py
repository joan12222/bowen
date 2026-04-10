"""
generate_wenyan_docx.py

将结构化 JSON 内容生成文言文原文注释 Word 文档。
使用 齐桓晋文之事.docx 作为模板（保留样式），替换 word/document.xml。

用法：
  python scripts/generate_wenyan_docx.py input.json output.docx
  cat input.json | python scripts/generate_wenyan_docx.py - output.docx

JSON 格式：
{
  "title": "篇名①",
  "author": "作者",
  "sections": [
    {
      "contentLines": ["原文段落1", "原文段落2"],
      "annotations": [
        { "num": "①", "word": "词语（拼音）", "note": "释义" }
      ],
      "sectionLabel": ""        // 可选，留空为第一节，"（续）"/"（续一）"等为后续节
    }
  ]
}
"""

import sys
import json
import zipfile
import os
import shutil
import tempfile

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "齐桓晋文之事.docx")


def xml_esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def h1(text: str) -> str:
    e = xml_esc(text)
    return f"""    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/>
        <w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
        <w:t xml:space="preserve">{e}</w:t>
      </w:r>
    </w:p>"""


def h2(text: str) -> str:
    e = xml_esc(text)
    return f"""    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/>
        <w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t xml:space="preserve">{e}</w:t>
      </w:r>
    </w:p>"""


def center(text: str) -> str:
    e = xml_esc(text)
    return f"""    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="SimSun" w:cs="SimSun" w:eastAsia="SimSun" w:hAnsi="SimSun"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t xml:space="preserve">{e}</w:t>
      </w:r>
    </w:p>"""


def yw(text: str) -> str:
    e = xml_esc(text)
    return f"""    <w:p>
      <w:pPr><w:ind w:firstLine="480"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="SimSun" w:cs="SimSun" w:eastAsia="SimSun" w:hAnsi="SimSun"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t xml:space="preserve">{e}</w:t>
      </w:r>
    </w:p>"""


def zs(num: str, word: str, note: str) -> str:
    en = xml_esc(note)
    bold = f"{num}\u3000\u3010{word}\u3011" if word else f"{num}\u3000"
    eb = xml_esc(bold)
    return f"""    <w:p>
      <w:r>
        <w:rPr><w:rFonts w:ascii="SimSun" w:cs="SimSun" w:eastAsia="SimSun" w:hAnsi="SimSun"/>
        <w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t xml:space="preserve">{eb}</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="SimSun" w:cs="SimSun" w:eastAsia="SimSun" w:hAnsi="SimSun"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t xml:space="preserve">{en}</w:t>
      </w:r>
    </w:p>"""


def blank() -> str:
    return "    <w:p><w:r><w:t xml:space=\"preserve\"/></w:r></w:p>"


def build_document_xml(template_xml: str, data: dict) -> str:
    paras = []

    title = data.get("title", "")
    author = data.get("author", "")
    sections = data.get("sections", [])

    if title:
        paras.append(h1(title))
    if author:
        paras.append(center(author))
    paras.append(blank())

    for i, section in enumerate(sections):
        label = section.get("sectionLabel", "")
        content_lines = section.get("contentLines", [])
        annotations = section.get("annotations", [])

        # 原文标题
        yw_heading = "原文" + label
        paras.append(h2(yw_heading))
        for line in content_lines:
            if line.strip():
                paras.append(yw(line))
        paras.append(blank())

        # 注释标题
        zs_heading = "注释" + label
        paras.append(h2(zs_heading))
        for ann in annotations:
            num = ann.get("num", "")
            word = ann.get("word", "")
            note = ann.get("note", "")
            paras.append(zs(num, word, note))
        paras.append(blank())

    body_content = "\n".join(paras)
    body_start = template_xml.index("<w:body>") + len("<w:body>")
    body_end = template_xml.index("</w:body>")
    sect_start = template_xml.rfind("<w:sectPr", 0, body_end)
    sect_content = template_xml[sect_start:body_end]

    new_xml = (
        template_xml[:body_start]
        + "\n"
        + body_content
        + "\n    "
        + sect_content
        + "\n  </w:body>\n</w:document>"
    )
    return new_xml


def generate_docx(data: dict, output_path: str):
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"模板文件不存在：{TEMPLATE_PATH}")

    # 读取模板 XML
    with zipfile.ZipFile(TEMPLATE_PATH, "r") as z:
        template_xml = z.read("word/document.xml").decode("utf-8")
        all_names = z.namelist()

    # 生成新的 document.xml
    new_xml = build_document_xml(template_xml, data)

    # 打包新 docx（复制模板，替换 document.xml）
    tmp_fd, tmp = tempfile.mkstemp(suffix=".docx")
    os.close(tmp_fd)
    with zipfile.ZipFile(TEMPLATE_PATH, "r") as src, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as dst:
        for name in all_names:
            if name == "word/document.xml":
                dst.writestr(name, new_xml.encode("utf-8"))
            else:
                dst.writestr(name, src.read(name))

    os.replace(tmp, output_path)
    print(f"生成成功：{output_path}")


def main():
    if len(sys.argv) < 3:
        print("用法: python generate_wenyan_docx.py <input.json|-> <output.docx>")
        sys.exit(1)

    input_arg = sys.argv[1]
    output_path = sys.argv[2]

    if input_arg == "-":
        data = json.load(sys.stdin)
    else:
        with open(input_arg, "r", encoding="utf-8") as f:
            data = json.load(f)

    generate_docx(data, output_path)


if __name__ == "__main__":
    main()
