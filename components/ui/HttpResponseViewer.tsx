"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import JsonViewer from "./JsonViewer";

// === Isolated Search Component ===
const DebouncedSearchInput = ({ onSearch }: { onSearch: (val: string) => void }) => {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setIsTyping(true);
    const handler = setTimeout(() => {
      onSearch(input);
      setIsTyping(false);
    }, 400); // 400ms debounce
    return () => clearTimeout(handler);
  }, [input, onSearch]);

  return (
    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded px-2 focus-within:border-emerald-500 transition-colors shrink-0">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-colors ${isTyping ? 'text-amber-500 animate-pulse' : 'text-zinc-500'}`}>
        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        type="text"
        placeholder="Search..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-20 md:w-24 focus:w-32 transition-all bg-transparent outline-none text-[10px] font-mono text-zinc-300 px-2 py-1 placeholder:text-zinc-600"
      />
      {input && (
        <button onClick={() => { setInput(""); onSearch(""); }} className="text-zinc-500 hover:text-rose-400 mr-1">✕</button>
      )}
    </div>
  );
};

const formatMarkup = (val: string) => {
  let formatted = '';
  let pad = 0;
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

const parseHttpMessage = (text: string) => {
  if (!text) return { firstLine: "", headersStr: "", headerList: [], contentType: "", json: null, rawBody: "" };

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
    try { return { firstLine: "", headersStr: "", headerList: [], contentType: "", json: JSON.parse(text), rawBody: text }; }
    catch { return { firstLine: "", headersStr: "", headerList: [], contentType: "", json: null, rawBody: text }; }
  }

  const headersStr = text.substring(0, splitIndex);
  const rawBody = text.substring(splitIndex + gap);

  // === NEW: Extract First Line separately from Headers ===
  const lines = headersStr.split(/\r?\n/).filter(line => line.trim());

  // If the line has no colon, it's definitely the Request/Status line!
  const firstLine = lines.length > 0 && lines[0].indexOf(':') === -1 ? lines.shift() : "";

  const headerList = lines.map(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return { key: line, value: '' };
    return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
  });

  const ctHeader = headerList.find(h => h.key.toLowerCase() === 'content-type');
  const contentType = ctHeader ? ctHeader.value.split(';')[0].trim().toLowerCase() : '';

  try { return { firstLine, headersStr, headerList, contentType, json: JSON.parse(rawBody), rawBody }; }
  catch { return { firstLine, headersStr, headerList, contentType, json: null, rawBody }; }
};

export default function HttpResponseViewer({ text }: { text: string }) {
  const parsed = parseHttpMessage(text);

  const isImage = parsed.contentType.startsWith('image/');
  const isVideo = parsed.contentType.startsWith('video/');
  const isAudio = parsed.contentType.startsWith('audio/');
  const isXml = parsed.contentType.includes('xml');
  const isHtml = parsed.contentType.includes('html');
  const isMediaOrFile = isImage || isVideo || isAudio || (parsed.contentType.includes('application/') && !parsed.json && !isXml && !isHtml);

  const [viewMode, setViewMode] = useState<"pretty" | "raw" | "render">("pretty");
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState(false);

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const formattedBody = useMemo(() => {
    if (parsed.json) {
      try {
        return JSON.stringify(parsed.json, null, 2);
      } catch {
        return parsed.rawBody;
      }
    }
    return parsed.rawBody;
  }, [parsed.json, parsed.rawBody]);

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
    let content = parsed.headersStr ? `${parsed.headersStr}\n\n${formattedBody}` : formattedBody;
    navigator.clipboard.writeText(content);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(formattedBody);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden h-full flex flex-col relative">

      {/* === UPDATED: Render First Line & Headers === */}
      {(parsed.headerList.length > 0 || parsed.firstLine) && (
        <div className="border-b border-zinc-800 bg-zinc-950 resize-y overflow-auto min-h-20 max-h-[60%] z-10" style={{ height: '160px' }}>
          <div className="p-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-[11px] font-mono">
            {parsed.firstLine && (
              <div className="col-span-2 text-sky-400 font-black text-[12px] mb-2 pb-2 border-b border-zinc-800/50 break-all">
                {parsed.firstLine}
              </div>
            )}
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
      <div className="bg-zinc-900/80 p-2 flex flex-wrap gap-y-2 gap-x-4 justify-between items-center border-b border-zinc-800 shrink-0">

        <div className="flex bg-zinc-950 p-0.5 rounded items-center border border-zinc-800 shrink-0">
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

        {/* Right Controls Container */}
        <div className="flex flex-wrap items-center gap-3 justify-end flex-1 min-w-0">

          {parsed.json && viewMode === "pretty" && (
            <div className="flex items-center mr-auto shrink-0">
              <DebouncedSearchInput onSearch={setSearchTerm} />
              <button
                onClick={() => setFilterMode(!filterMode)}
                title={filterMode ? "Filter Active: Hiding unmatched lines" : "Highlight Active: Showing all lines"}
                className={`ml-1 p-1.5 rounded transition-colors ${filterMode ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-600 hover:text-zinc-300'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCopyFull} className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white tracking-widest transition-colors shrink-0">
              {copiedFull ? "✓ Copied!" : "Copy Full"}
            </button>
            <button onClick={handleCopyBody} className="text-[10px] uppercase font-bold text-emerald-500 hover:text-emerald-400 tracking-widest transition-colors shrink-0">
              {copiedAll ? "✓ Copied!" : "Copy Body"}
            </button>
          </div>

          {/* Expand/Collapse Icons */}
          {parsed.json && viewMode === "pretty" && (
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-px h-4 bg-zinc-700 mx-1 hidden sm:block"></div>
              <button onClick={() => setExpandSignal((s) => s + 1)} title="Expand All" className="p-1.5 rounded text-zinc-500 hover:bg-zinc-800 hover:text-sky-400 transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="7 13 12 18 17 13"></polyline>
                  <polyline points="7 6 12 11 17 6"></polyline>
                </svg>
              </button>
              <button onClick={() => setCollapseSignal((s) => s + 1)} title="Collapse All" className="p-1.5 rounded text-zinc-500 hover:bg-zinc-800 hover:text-sky-400 transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 11 12 6 7 11"></polyline>
                  <polyline points="17 18 12 13 7 18"></polyline>
                </svg>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Body Section */}
      <div className="p-4 overflow-auto flex-1 bg-zinc-950/50 relative" ref={containerRef}>
        {viewMode === "raw" ? (
          <pre className="text-[12px] font-mono text-zinc-300 whitespace-pre-wrap wrap-break-words">{formattedBody || "No Response Body"}</pre>
        ) : viewMode === "render" && isHtml ? (
          <iframe srcDoc={parsed.rawBody} className="w-full h-full bg-white rounded" title="HTML Preview" sandbox="allow-same-origin" />
        ) : isImage && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <img src={mediaUrl} alt="Preview" className="max-w-full max-h-100 rounded border border-zinc-800 shadow-xl" />
            <a href={mediaUrl} download="image.png" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest rounded">Download</a>
          </div>
        ) : isVideo && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <video controls src={mediaUrl} className="max-w-full max-h-100 rounded border border-zinc-800 shadow-xl" />
            <a href={mediaUrl} download="video.mp4" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest rounded">Download</a>
          </div>
        ) : isMediaOrFile && mediaUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <div className="text-zinc-500 mb-2 italic">Binary file ({parsed.contentType})</div>
            <a href={mediaUrl} download="file.bin" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black uppercase text-xs tracking-widest rounded">Download File</a>
          </div>
        ) : parsed.json ? (
          <JsonViewer
            value={parsed.json}
            expandSignal={expandSignal}
            collapseSignal={collapseSignal}
            path="root"
            searchTerm={searchTerm}
            filterMode={filterMode}
          />
        ) : (isXml || isHtml) && viewMode === "pretty" ? (
          <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap wrap-break-words">
            {formatMarkup(parsed.rawBody)}
          </pre>
        ) : (
          <pre className="text-[12px] font-mono text-zinc-300 whitespace-pre-wrap wrap-break-words">
            {parsed.rawBody || "No Response Body"}
          </pre>
        )}
      </div>
    </div>
  );
}
