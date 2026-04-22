"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

// --- Helper: XML Formatter ---
const formatXml = (xml: string) => {
  let formatted = '';
  let pad = 0;
  const cleanXml = xml.replace(/\r|\n/g, '').replace(/>\s+</g, ">\n<");
  cleanXml.split('\n').forEach(line => {
    let indent = 0;
    if (line.match(/.+<\/\w[^>]*>$/)) indent = 0;
    else if (line.match(/^<\/\w/)) { if (pad !== 0) pad -= 1; }
    else if (line.match(/^<\w[^>]*[^\/]>.*$/)) indent = 1;
    formatted += '  '.repeat(pad) + line + '\n';
    pad += indent;
  });
  return formatted;
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

  // Fallback if no headers detected
  if (splitIndex === -1) {
    try {
      return { headersStr: "", headerList: [], contentType: "", json: JSON.parse(text), rawBody: text };
    } catch {
      return { headersStr: "", headerList: [], contentType: "", json: null, rawBody: text };
    }
  }

  const headersStr = text.substring(0, splitIndex);
  const rawBody = text.substring(splitIndex + gap);

  // Parse Headers into structured Key/Value pairs
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
  const isMediaOrFile = isImage || isVideo || isAudio || (parsed.contentType.includes('application/') && !parsed.json && !isXml);

  const [viewMode, setViewMode] = useState<"pretty" | "raw">(isMediaOrFile ? "pretty" : "pretty");
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedVisible, setCopiedVisible] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  // Generate Media Blob URL securely without memory leaks
  useEffect(() => {
    if (!parsed.rawBody || !isMediaOrFile) {
      setMediaUrl(null);
      return;
    }

    let objectUrl: string | null = null;

    try {
      // 1. Check if the python bridge sent it as a base64 string
      // Base64 strings from our Python bridge won't have spaces or newlines
      const isBase64 = !parsed.rawBody.includes(' ') && parsed.rawBody.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(parsed.rawBody.substring(0, 100));

      if (isBase64) {
        // Create an Object URL directly from the base64 string using the Fetch API (safest/fastest way in browsers)
        fetch(`data:${parsed.contentType};base64,${parsed.rawBody}`)
          .then(res => res.blob())
          .then(blob => {
            objectUrl = URL.createObjectURL(blob);
            setMediaUrl(objectUrl);
          });
      } else {
        // Fallback for older non-base64 records
        const blob = new Blob([parsed.rawBody], { type: parsed.contentType });
        objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
      }
    } catch (e) {
      console.error("Failed to parse media blob", e);
    }

    // Clean up
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [parsed.rawBody, parsed.contentType, isMediaOrFile]);
  // Clean up Blob on unmount
  useEffect(() => {
    return () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); };
  }, [mediaUrl]);

  // ... [Keep your existing buildVisibleData, handleCopyFull, handleCopyAll, handleCopyVisible functions exactly as they are] ...
  const buildVisibleData = (data: any, currentPath: string): any => {
    if (!containerRef.current) return data;
    const node = containerRef.current.querySelector(`[data-path="${currentPath}"]`);
    if (!node) return data;
    const state = node.getAttribute("data-state");

    if (state === "collapsed") {
      if (Array.isArray(data)) return [`... ${data.length} items hidden`];
      return { "...": `${Object.keys(data).length} keys hidden` };
    }

    if (Array.isArray(data)) {
      if (state === "truncated") {
        const visibleChild = buildVisibleData(data[0], `${currentPath}-0`);
        return data.length > 0 ? [visibleChild, `... ${data.length - 1} more items hidden`] : [];
      }
      return data.map((item, idx) => buildVisibleData(item, `${currentPath}-${idx}`));
    }

    if (data !== null && typeof data === "object") {
      const result: Record<string, any> = {};
      Object.entries(data).forEach(([key, val]) => {
        result[key] = buildVisibleData(val, `${currentPath}-${encodeURIComponent(key)}`);
      });
      return result;
    }
    return data;
  };

  const handleCopyFull = () => {
    let contentToCopy = text;
    if (parsed.headersStr) {
      contentToCopy = `${parsed.headersStr}\n\n`;
      if (parsed.json && viewMode === "pretty") contentToCopy += JSON.stringify(parsed.json, null, 2);
      else contentToCopy += parsed.rawBody;
    } else if (parsed.json && viewMode === "pretty") contentToCopy = JSON.stringify(parsed.json, null, 2);
    else contentToCopy = parsed.rawBody || text;

    navigator.clipboard.writeText(contentToCopy);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const handleCopyAll = () => {
    if (parsed.json && viewMode === "pretty") navigator.clipboard.writeText(JSON.stringify(parsed.json, null, 2));
    else navigator.clipboard.writeText(parsed.rawBody || text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyVisible = () => {
    if (parsed.json && viewMode === "pretty") {
      const prunedData = buildVisibleData(parsed.json, "root");
      navigator.clipboard.writeText(JSON.stringify(prunedData, null, 2));
    } else if (containerRef.current) navigator.clipboard.writeText(containerRef.current.innerText);
    setCopiedVisible(true);
    setTimeout(() => setCopiedVisible(false), 2000);
  };


  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden h-full flex flex-col relative">

      {/* UPGRADED: Resizable Headers Section */}
      {parsed.headerList.length > 0 && (
        <div className="border-b border-zinc-800 bg-zinc-950 resize-y overflow-auto min-h-[100px] max-h-[80%] z-10" style={{ height: '200px' }}>
          <div className="p-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-[11px] font-mono">
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
          <button onClick={() => setViewMode("pretty")} className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === "pretty" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            {isMediaOrFile ? "Preview" : "Pretty"}
          </button>
          <button onClick={() => setViewMode("raw")} className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${viewMode === "raw" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            Raw
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <button onClick={handleCopyFull} className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white tracking-widest transition-colors">
            {copiedFull ? "✓ Copied Full!" : "Copy Full"}
          </button>
          <button onClick={handleCopyAll} className="text-[10px] uppercase font-bold text-emerald-500 hover:text-emerald-400 tracking-widest transition-colors">
            {copiedAll ? "✓ Copied Body!" : "Copy Body"}
          </button>

          {parsed.json && viewMode === "pretty" && (
            <>
              <button onClick={handleCopyVisible} className="text-[10px] uppercase font-bold text-sky-500 hover:text-sky-400 tracking-widest transition-colors">
                {copiedVisible ? "✓ Copied Visible!" : "Copy Visible"}
              </button>
              <div className="w-[1px] h-4 bg-zinc-700 mx-1"></div>
              <button onClick={() => setExpandSignal((s) => s + 1)} className="text-[10px] uppercase font-bold text-zinc-500 hover:text-sky-400 tracking-widest transition-colors">Expand All</button>
              <button onClick={() => setCollapseSignal((s) => s + 1)} className="text-[10px] uppercase font-bold text-zinc-500 hover:text-sky-400 tracking-widest transition-colors">Collapse All</button>
            </>
          )}
        </div>
      </div>

      {/* Body Section */}
      <div className="p-4 overflow-auto flex-1 bg-zinc-950/50" ref={containerRef}>
        {viewMode === "raw" ? (
          <pre className="text-[12px] font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap break-words">
            {parsed.rawBody || "No Response Body"}
          </pre>
        ) : isImage && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-6 h-full">
            <img src={mediaUrl} alt="Response Preview" className="max-w-full max-h-[400px] rounded border border-zinc-800 shadow-xl" />
            <a href={mediaUrl} download={`download.${parsed.contentType.split('/')[1] || 'png'}`} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-xs tracking-widest rounded transition-colors">Download Image</a>
          </div>
        ) : isVideo && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-6 h-full">
            <video controls src={mediaUrl} className="max-w-full max-h-[400px] rounded border border-zinc-800 shadow-xl" />
            <a href={mediaUrl} download="video.mp4" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-xs tracking-widest rounded transition-colors">Download Video</a>
          </div>
        ) : isAudio && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-6 h-full">
            <audio controls src={mediaUrl} className="w-full max-w-md" />
            <a href={mediaUrl} download="audio.mp3" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-xs tracking-widest rounded transition-colors">Download Audio</a>
          </div>
        ) : isMediaOrFile && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-6 h-full">
            <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            </div>
            <div className="text-center">
              <div className="text-zinc-300 font-bold mb-1">Binary File Detected</div>
              <div className="text-zinc-500 font-mono text-[10px]">{parsed.contentType}</div>
            </div>
            <a href={mediaUrl} download="file.download" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-xs tracking-widest rounded transition-colors">Download File</a>
          </div>
        ) : parsed.json ? (
          <JsonNode value={parsed.json} expandSignal={expandSignal} collapseSignal={collapseSignal} path="root" />
        ) : isXml || isHtml ? (
          <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-words">
            {formatXml(parsed.rawBody)}
          </pre>
        ) : (
          <pre className="text-[12px] font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap break-words">
            {parsed.rawBody || "No Response Body"}
          </pre>
        )}
      </div>
    </div>
  );
}
