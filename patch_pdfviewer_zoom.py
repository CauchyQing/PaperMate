import re

with open('src/renderer/components/PDFViewer/PDFViewer.tsx', 'r') as f:
    content = f.read()

# 1. Replace visualScale with renderScale
content = content.replace('const [visualScale, setVisualScale] = useState<number>(1);', 'const [renderScale, setRenderScale] = useState<number>(1.2);')

# 2. Update renderScaleRef
content = re.sub(
    r'const scaleRef = useRef\(scale\);\n  const workspacePathRef = useRef\(workspacePath\);',
    'const scaleRef = useRef(scale);\n  const renderScaleRef = useRef(renderScale);\n  const workspacePathRef = useRef(workspacePath);',
    content
)
content = re.sub(
    r'useEffect\(\(\) => \{ scaleRef\.current = scale; \}, \[scale\]\);',
    'useEffect(() => { scaleRef.current = scale; }, [scale]);\n  useEffect(() => { renderScaleRef.current = renderScale; }, [renderScale]);',
    content
)

# 3. Update getPageHeight to use renderScaleRef
content = re.sub(
    r'return size \? size\.height \* scaleRef\.current : FALLBACK_PAGE_HEIGHT \* scaleRef\.current;',
    'return size ? size.height * renderScaleRef.current : FALLBACK_PAGE_HEIGHT * renderScaleRef.current;',
    content
)

# 4. Update totalHeight dependency
content = re.sub(
    r'  \}, \[numPages, scale, pageSizesVersion\]\);',
    '  }, [numPages, renderScale, pageSizesVersion]);',
    content
)

# 5. Rewrite handleWheel logic
wheel_logic_old = r'  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> \| null>\(null\);\n\n  // Trackpad pinch-to-zoom and Cmd\+Scroll zoom\n  useEffect\(\(\) => \{.*?  \}, \[\]\);'
wheel_logic_new = """  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trackpad pinch-to-zoom and Cmd+Scroll zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // In Chromium, Mac trackpad pinch-to-zoom sets e.ctrlKey to true.
      // e.deltaY is negative when pinching out (zoom in), positive when pinching in (zoom out).
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        // Calculate a zoom factor based on deltaY.
        const zoomFactor = Math.exp(e.deltaY * -0.01);
        
        setScale((prev) => {
          const next = prev * zoomFactor;
          return Math.min(Math.max(next, 0.5), 3.0);
        });

        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        
        zoomTimeoutRef.current = setTimeout(() => {
          setScale((currentScale) => {
            setRenderScale(currentScale);
            return currentScale;
          });
        }, 200); // Debounce re-render
      }
    };

    // Use passive: false to allow e.preventDefault()
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      container.removeEventListener('wheel', handleWheel, { capture: true } as any);
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    };
  }, []);"""
content = re.sub(wheel_logic_old, wheel_logic_new, content, flags=re.DOTALL)

# 6. Update Document container transform and scale
doc_container_old = r'<div\n              className="py-8 flex flex-col items-center origin-top transition-transform"\n              style=\{\{\n                minHeight: totalHeight,\n                transform: `scale\(\$\{visualScale\}\)`,\n                transitionDuration: visualScale === 1 \? \'0s\' : \'0\.1s\',\n              \}\}\n            >'

doc_container_new = """<div
              className="py-8 flex flex-col items-center origin-top"
              style={{
                minHeight: totalHeight,
                transform: `scale(${scale / renderScale})`,
                transition: scale === renderScale ? 'none' : 'transform 0.05s ease-out',
              }}
            >"""
content = content.replace(doc_container_old, doc_container_new)

# 7. Update PDFPageItem scale prop
page_item_old = r'<PDFPageItem\n                    key={`page-\$\{pageNum\}`}\n                    pageNum=\{pageNum\}\n                    scale=\{scale\}'
page_item_new = """<PDFPageItem
                    key={`page-${pageNum}`}
                    pageNum={pageNum}
                    scale={renderScale}"""
content = content.replace(page_item_old, page_item_new)

# 8. Update zoomIn/zoomOut to also update renderScale
content = re.sub(
    r'  const zoomIn = useCallback\(\(\) => \{\n    setScale\(\(prev\) => Math\.min\(prev \+ 0\.2, 3\)\);\n  \}, \[\]\);\n\n  const zoomOut = useCallback\(\(\) => \{\n    setScale\(\(prev\) => Math\.max\(prev - 0\.2, 0\.5\)\);\n  \}, \[\]\);',
    '''  const zoomIn = useCallback(() => {
    setScale((prev) => {
      const next = Math.min(prev + 0.2, 3);
      setRenderScale(next);
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(prev - 0.2, 0.5);
      setRenderScale(next);
      return next;
    });
  }, []);''',
    content
)

with open('src/renderer/components/PDFViewer/PDFViewer.tsx', 'w') as f:
    f.write(content)
