import sys

def extract_with_pymupdf(path, max_pages):
    import fitz
    doc = fitz.open(path)
    out = []
    for i in range(min(max_pages, len(doc))):
        out.append(f"--- Page {i+1} ---\n{doc[i].get_text()}")
    return "\n\n".join(out)

def extract_with_pypdf(path, max_pages):
    from pypdf import PdfReader
    reader = PdfReader(path)
    out = []
    for i in range(min(max_pages, len(reader.pages))):
        out.append(f"--- Page {i+1} ---\n{reader.pages[i].extract_text() or ''}")
    return "\n\n".join(out)

def extract_with_pdfplumber(path, max_pages):
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        out = []
        for i in range(min(max_pages, len(pdf.pages))):
            out.append(f"--- Page {i+1} ---\n{pdf.pages[i].extract_text() or ''}")
        return "\n\n".join(out)

def extract(path, max_pages):
    try:
        return extract_with_pymupdf(path, max_pages)
    except Exception:
        pass
    try:
        return extract_with_pypdf(path, max_pages)
    except Exception:
        pass
    try:
        return extract_with_pdfplumber(path, max_pages)
    except Exception:
        pass
    raise RuntimeError("No suitable PDF library found. Please install PyMuPDF (pip install pymupdf) or pypdf (pip install pypdf) or pdfplumber (pip install pdfplumber).")

if __name__ == "__main__":
    path = sys.argv[1]
    max_pages = int(sys.argv[2])
    print(extract(path, max_pages))
