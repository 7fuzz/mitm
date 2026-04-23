"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

// --- Helper: HTML/XML Formatter ---
const formatMarkup = (val: string) => {
  let formatted = '';
  let pad = 0;
  // Basic cleanup and adding newlines between tags
  const clean = val.replace(/\r|\n/g, '').replace(/>\s+</g, ">\n<");
  clean.split('\n').forEach(line => {
    let indent = 0;
    if (line.match(/.+<\/\w[^>]*>$/)) indent = 0;
    else if (line.match(/^<\/\w/)) { if (pad !== 0) pad -= 1; }
    else if (line.match(/^<\w[^>]*[^\/]>.*$/)) indent = 1;
    formatted += '  '.repeat(pad) + line + '\n';
    pad += indent;
  });
  return formatted.trim();
};

// --- Helper: Parses HTTP into Headers, JSON, and Metadata ---
const parseHttpMessage = (text: string) => {
  if (!text) return { headersStr: "", headerList: [], contentType: "", json: null, rawBody: "" };

  const separatorIndex = text.indexOf("\n\n");
  const winSeparatorIndex = text.indexOf("\r\n\r\n");

  let splitIndex = -1;
  let gap = 2;

  if (separatorIndex !== -1 && winSeparatorIndex !== -1) {
    splitIndex = Math.min(separatorIndex, winSeparatorIndex);
    gap = splitIndex === winSeparatorIndex ? 4 : 2;
  } else if (separatorIndex !== -1) {
    splitIndex = separatorIndex;
  } else if (winSeparatorIndex !== -1) {
    splitIndex = winSeparatorIndex;
    gap = 4;
  }

  if (splitIndex === -1) {
    try {
      return { headersStr: "", headerList: [], contentType: "", json: JSON.parse(text), rawBody: text };
    } catch {
      return { headersStr: "", headerList: [], contentType: "", json: null, rawBody: text };
    }
  }

  const headersStr = text.substring(0, splitIndex);
  const rawBody = text.substring(splitIndex + gap);

  const headerList = headersStr.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return { key: line, value: '' };
    return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
  });

  const ctHeader = headerList.find(h => h.key.toLowerCase() === 'content-type');
  const contentType = ctHeader ? ctHeader.value.split(';')[0].trim().toLowerCase() : '';

  try {
    return { headersStr, headerList, contentType, json: JSON.parse(rawBody), rawBody };
  } catch {
    return { headersStr, headerList, contentType, json: null, rawBody };
  }
};

// --- Custom Interactive JSON Viewer Node ---
const JsonNode = ({ label, value, isLast = true, expandSignal, collapseSignal, path }: any) => {
  const [expanded, setExpanded] = useState(true);
  const [showAllArray, setShowAllArray] = useState(false);

  useEffect(() => { if (expandSignal > 0) setExpanded(true); }, [expandSignal]);
  useEffect(() => { if (collapseSignal > 0) setExpanded(false); }, [collapseSignal]);

  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;

  if (value === null || typeof value !== "object") {
    let valueColor = "text-zinc-300";
    let formattedValue = String(value);

    if (typeof value === "string") { valueColor = "text-emerald-400"; formattedValue = `"${value}"`; }
    else if (typeof value === "number") { valueColor = "text-amber-400"; }
    else if (typeof value === "boolean") { valueColor = "text-purple-400"; }
    else if (value === null) { valueColor = "text-rose-400"; formattedValue = "null"; }

    return (
      <div className="font-mono text-[13px] leading-relaxed flex" data-path={path} data-state="primitive">
        <div className="w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          {label && <span className="text-sky-400 mr-1 whitespace-nowrap">"{label}":</span>}
          <span className={valueColor}>{formattedValue}</span>
          {!isLast && <span className="text-zinc-500">,</span>}
        </div>
      </div>
    );
  }

  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const items = isArray ? value : Object.entries(value);
  const isEmpty = items.length === 0;
  const isLongArray = isArray && items.length > 1;
  const visibleItems = isLongArray && !showAllArray ? items.slice(0, 1) : items;
  const nodeState = isEmpty ? "expanded" : !expanded ? "collapsed" : isLongArray && !showAllArray ? "truncated" : "expanded";

  return (
    <div className="font-mono text-[13px] leading-relaxed" data-path={path} data-state={nodeState}>
      <div className="flex items-start group">
        <button onClick={() => setExpanded(!expanded)} className="w-5 shrink-0 flex justify-center items-center cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors mt-[2px]" disabled={isEmpty}>
          {!isEmpty && (expanded ? "▼" : "▶")}
        </button>
        <div className="flex-1 min-w-0 flex items-center flex-wrap">
          {label && <span className="text-sky-400 mr-1 whitespace-nowrap">"{label}":</span>}
          <span className="text-zinc-400">{openBracket}</span>
          {isEmpty && <span className="text-zinc-400">{closeBracket}{!isLast ? "," : ""}</span>}
          {!expanded && !isEmpty && (
            <>
              <span className="cursor-pointer text-zinc-500 hover:text-zinc-300 mx-2 bg-zinc-800 px-1 rounded text-[10px]" onClick={() => setExpanded(true)}>...</span>
              <span className="text-zinc-400">{closeBracket}{!isLast ? "," : ""}</span>
              {isArray && <span className="text-zinc-500 ml-2 text-[11px]">({items.length} items)</span>}
              {isObject && <span className="text-zinc-500 ml-2 text-[11px]">({Object.keys(value).length} keys)</span>}
            </>
          )}
        </div>
      </div>

      {expanded && !isEmpty && (
        <div className="ml-[9px] pl-[14px] border-l border-zinc-700 hover:border-zinc-500 transition-colors">
          {isArray
            ? visibleItems.map((item: any, index: number) => (
              <JsonNode key={index} value={item} isLast={index === (showAllArray ? items.length - 1 : 0)} expandSignal={expandSignal} collapseSignal={collapseSignal} path={`${path}-${index}`} />
            ))
            : items.map(([key, val], index) => (
              <JsonNode key={key} label={key} value={val} isLast={index === items.length - 1} expandSignal={expandSignal} collapseSignal={collapseSignal} path={`${path}-${encodeURIComponent(key)}`} />
            ))}

          {isLongArray && !showAllArray && (
            <div className="text-zinc-500 hover:text-sky-400 text-xs py-1 cursor-pointer select-none pl-2 flex items-center gap-1" onClick={() => setShowAllArray(true)}>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded">+{items.length - 1} more items</span>
            </div>
          )}
        </div>
      )}
      {expanded && !isEmpty && <div className="ml-5 text-zinc-400">{closeBracket}{!isLast ? "," : ""}</div>}
    </div>
  );
};

// --- Main Exported Component ---
export default function HttpResponseViewer({ text }: { text: string }) {
  const parsed = parseHttpMessage(text);

  const isImage = parsed.contentType.startsWith('image/');
  const isVideo = parsed.contentType.startsWith('video/');
  const isAudio = parsed.contentType.startsWith('audio/');
  const isXml = parsed.contentType.includes('xml');
  const isHtml = parsed.contentType.includes('html');
  const isMediaOrFile = isImage || isVideo || isAudio || (parsed.contentType.includes('application/') && !parsed.json && !isXml && !isHtml);

  // View modes: pretty (default), raw, or render (for HTML)
  const [viewMode, setViewMode] = useState<"pretty" | "raw" | "render">("pretty");
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed.rawBody || !isMediaOrFile) { setMediaUrl(null); return; }
    let objectUrl: string | null = null;
    try {
      const isBase64 = !parsed.rawBody.includes(' ') && parsed.rawBody.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(parsed.rawBody.substring(0, 100));
      if (isBase64) {
        fetch(`data:${parsed.contentType};base64,${parsed.rawBody}`).then(res => res.blob()).then(blob => {
          objectUrl = URL.createObjectURL(blob);
          setMediaUrl(objectUrl);
        });
      } else {
        const blob = new Blob([parsed.rawBody], { type: parsed.contentType });
        objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
      }
    } catch (e) { console.error("Failed to parse media blob", e); }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [parsed.rawBody, parsed.contentType, isMediaOrFile]);

  const handleCopyFull = () => {
    let content = parsed.headersStr ? `${parsed.headersStr}\n\n${parsed.rawBody}` : parsed.rawBody;
    navigator.clipboard.writeText(content);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(parsed.rawBody);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden h-full flex flex-col relative">

      {/* Resizable Headers Section */}
      {parsed.headerList.length > 0 && (
        <div className="border-b border-zinc-800 bg-zinc-950 resize-y overflow-auto min-h-[80px] max-h-[60%] z-10" style={{ height: '160px' }}>
          <div className="p-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-[11px] font-mono">
            {parsed.headerList.map((h, i) => (
              <React.Fragment key={i}>
                <div className="text-zinc-500 font-bold whitespace-nowrap">{h.key}:</div>
                <div className="text-zinc-300 break-all">{h.value}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-zinc-900/80 px-3 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
        <div className="flex bg-zinc-950 p-0.5 rounded items-center border border-zinc-800">
          <button onClick={() => setViewMode("pretty")} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === "pretty" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            {isMediaOrFile ? "Preview" : "Pretty"}
          </button>
          {isHtml && (
            <button onClick={() => setViewMode("render")} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === "render" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              Render
            </button>
          )}
          <button onClick={() => setViewMode("raw")} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === "raw" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            Raw
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <button onClick={handleCopyFull} className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white tracking-widest transition-colors">
            {copiedFull ? "✓ Copied!" : "Copy Full"}
          </button>
          <button onClick={handleCopyBody} className="text-[10px] uppercase font-bold text-emerald-500 hover:text-emerald-400 tracking-widest transition-colors">
            {copiedAll ? "✓ Copied!" : "Copy Body"}
          </button>

          {parsed.json && viewMode === "pretty" && (
            <>
              <div className="w-[1px] h-4 bg-zinc-700 mx-1"></div>
              <button onClick={() => setExpandSignal((s) => s + 1)} className="text-[10px] uppercase font-bold text-zinc-500 hover:text-sky-400 tracking-widest transition-colors">Expand</button>
              <button onClick={() => setCollapseSignal((s) => s + 1)} className="text-[10px] uppercase font-bold text-zinc-500 hover:text-sky-400 tracking-widest transition-colors">Collapse</button>
            </>
          )}
        </div>
      </div>

      {/* Body Section */}
      <div className="p-4 overflow-auto flex-1 bg-zinc-950/50 relative" ref={containerRef}>
        {viewMode === "raw" ? (
          <pre className="text-[12px] font-mono text-zinc-300 whitespace-pre-wrap break-words">{parsed.rawBody || "No Response Body"}</pre>
        ) : viewMode === "render" && isHtml ? (
          <iframe
            srcDoc={parsed.rawBody}
            className="w-full h-full bg-white rounded"
            title="HTML Preview"
            sandbox="allow-same-origin" // Minimal sandbox for security
          />
        ) : isImage && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <img src={mediaUrl} alt="Preview" className="max-w-full max-h-[400px] rounded border border-zinc-800 shadow-xl" />
            <a href={mediaUrl} download="image.png" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest rounded">Download</a>
          </div>
        ) : isVideo && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <video controls src={mediaUrl} className="max-w-full max-h-[400px] rounded border border-zinc-800 shadow-xl" />
            <a href={mediaUrl} download="video.mp4" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest rounded">Download</a>
          </div>
        ) : isMediaOrFile && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <div className="text-zinc-500 mb-2 italic">Binary file ({parsed.contentType})</div>
            <a href={mediaUrl} download="file.bin" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-xs tracking-widest rounded">Download File</a>
          </div>
        ) : parsed.json ? (
          <JsonNode value={parsed.json} expandSignal={expandSignal} collapseSignal={collapseSignal} path="root" />
        ) : (isXml || isHtml) && viewMode === "pretty" ? (
          <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-words">
            {formatMarkup(parsed.rawBody)}
          </pre>
        ) : (
          <pre className="text-[12px] font-mono text-zinc-300 whitespace-pre-wrap break-words">
            {parsed.rawBody || "No Response Body"}
          </pre>
        )}
      </div>
    </div>
  );
}
