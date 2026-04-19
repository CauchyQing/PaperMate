import re

with open('src/renderer/components/PDFViewer/PDFViewer.tsx', 'r') as f:
    content = f.read()

# Remove renderScale from state
content = re.sub(r'  const \[renderScale, setRenderScale\] = useState<number>\(1\.2\);\n', '', content)
content = re.sub(r'  const renderScaleRef = useRef\(renderScale\);\n', '', content)
content = re.sub(r'  useEffect\(\(\) => \{ renderScaleRef\.current = renderScale; \}, \[renderScale\]\);\n', '', content)

# Change getPageHeight to use scaleRef instead of renderScaleRef
content = re.sub(r'renderScaleRef\.current', 'scaleRef.current', content)

# Change totalHeight dependency
content = re.sub(r'\[numPages, renderScale, pageSizesVersion\]', '[numPages, scale, pageSizesVersion]', content)

# Remove the complex zoom state and helpers
complex_zoom_start = r'  const clampScale = useCallback\(\(nextScale: number\) => \{'
complex_zoom_end = r'  // Mouse Drag to Pan'

match_start = re.search(complex_zoom_start, content)
match_end = re.search(complex_zoom_end, content)

if match_start and match_end:
    new_wheel_logic = """  // Trackpad pinch-to-zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Mac trackpad pinch-to-zoom is represented as wheel event with ctrlKey=true
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        // e.deltaY is negative when zooming in (pinching out)
        const delta = e.deltaY * -0.01;
        
        setScale((prev) => {
          const next = prev + delta;
          return Math.min(Math.max(next, 0.5), 3.0);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

"""
    content = content[:match_start.start()] + new_wheel_logic + content[match_end.start():]

# Remove the transform style from Document div
doc_style_old = r'<div\n              className="py-8 flex flex-col items-center origin-top transition-transform"\n              style=\{\{\n                minHeight: totalHeight,\n                transform: `scale\(\$\{scale / renderScale\}\)`,\n                transitionDuration: scale === renderScale \? \'0s\' : \'0\.1s\',\n              \}\}\n            >'
doc_style_new = """<div
              className="py-8 flex flex-col items-center"
              style={{ minHeight: totalHeight }}
            >"""
content = re.sub(doc_style_old, doc_style_new, content)

# Change PDFPageItem scale back
page_item_old = r'<PDFPageItem\n                    key={`page-\$\{pageNum\}`}\n                    pageNum=\{pageNum\}\n                    scale=\{renderScale\}'
page_item_new = """<PDFPageItem
                    key={`page-${pageNum}`}
                    pageNum={pageNum}
                    scale={scale}"""
content = re.sub(page_item_old, page_item_new, content)

# Update zoomIn / zoomOut to simple logic
zoom_in_old = r'  const zoomIn = useCallback\(\(\) => \{\n    const nextScale = setImmediateScale\(scaleRef\.current \+ ZOOM_STEP\);\n    syncRenderScale\(nextScale\);\n  \}, \[setImmediateScale, syncRenderScale\]\);'
zoom_in_new = """  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  }, []);"""
content = re.sub(zoom_in_old, zoom_in_new, content)

zoom_out_old = r'  const zoomOut = useCallback\(\(\) => \{\n    const nextScale = setImmediateScale\(scaleRef\.current - ZOOM_STEP\);\n    syncRenderScale\(nextScale\);\n  \}, \[setImmediateScale, syncRenderScale\]\);'
zoom_out_new = """  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  }, []);"""
content = re.sub(zoom_out_old, zoom_out_new, content)

with open('src/renderer/components/PDFViewer/PDFViewer.tsx', 'w') as f:
    f.write(content)
