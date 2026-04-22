"use client";

import { useState, useEffect, useRef } from "react";

// --- Helper: Parses HTTP into Headers and JSON (if applicable) ---
const parseHttpMessage = (text: string) => {
  if (!text) return { headers: "", json: null, rawBody: "" };

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
      return { headers: "", json: JSON.parse(text), rawBody: text };
    } catch {
      return { headers: "", json: null, rawBody: text };
    }
  }

  const headers = text.substring(0, splitIndex);
  const body = text.substring(splitIndex + gap);

  try {
    return { headers, json: JSON.parse(body), rawBody: body };
  } catch {
    return { headers, json: null, rawBody: body };
  }
};

// --- Custom Interactive JSON Viewer Node ---
const JsonNode = ({
  label,
  value,
  isLast = true,
  expandSignal,
  collapseSignal,
  path,
}: {
  label?: string;
  value: any;
  isLast?: boolean;
  expandSignal: number;
  collapseSignal: number;
  path: string;
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showAllArray, setShowAllArray] = useState(false);

  useEffect(() => {
    if (expandSignal > 0) setExpanded(true);
  }, [expandSignal]);

  useEffect(() => {
    if (collapseSignal > 0) setExpanded(false);
  }, [collapseSignal]);

  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;

  // Primitive Values
  if (value === null || typeof value !== "object") {
    let valueColor = "text-gray-800 dark:text-gray-200";
    let formattedValue = String(value);

    if (typeof value === "string") {
      valueColor = "text-green-600 dark:text-green-400";
      formattedValue = `"${value}"`;
    } else if (typeof value === "number") {
      valueColor = "text-orange-600 dark:text-orange-400";
    } else if (typeof value === "boolean") {
      valueColor = "text-purple-600 dark:text-purple-400";
    } else if (value === null) {
      valueColor = "text-red-600 dark:text-red-400";
      formattedValue = "null";
    }

    return (
      <div
        className="font-mono text-[13px] leading-relaxed flex"
        data-path={path}
        data-state="primitive"
      >
        <div className="w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          {label && (
            <span className="text-blue-600 dark:text-blue-400 mr-1 whitespace-nowrap">
              "{label}":
            </span>
          )}
          <span className={valueColor}>{formattedValue}</span>
          {!isLast && <span className="text-gray-500">,</span>}
        </div>
      </div>
    );
  }

  // Complex Values (Objects/Arrays)
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const items = isArray ? value : Object.entries(value);
  const isEmpty = items.length === 0;

  const isLongArray = isArray && items.length > 1;
  const visibleItems = isLongArray && !showAllArray ? items.slice(0, 1) : items;

  const nodeState = isEmpty
    ? "expanded"
    : !expanded
      ? "collapsed"
      : isLongArray && !showAllArray
        ? "truncated"
        : "expanded";

  return (
    <div
      className="font-mono text-[13px] leading-relaxed"
      data-path={path}
      data-state={nodeState}
    >
      <div className="flex items-start group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-5 shrink-0 flex justify-center items-center cursor-pointer text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mt-[2px]"
          disabled={isEmpty}
        >
          {!isEmpty && (expanded ? "▼" : "▶")}
        </button>
        <div className="flex-1 min-w-0 flex items-center flex-wrap">
          {label && (
            <span className="text-blue-600 dark:text-blue-400 mr-1 whitespace-nowrap">
              "{label}":
            </span>
          )}
          <span className="text-gray-600 dark:text-gray-400">
            {openBracket}
          </span>

          {isEmpty && (
            <span className="text-gray-600 dark:text-gray-400">
              {closeBracket}
              {!isLast ? "," : ""}
            </span>
          )}

          {!expanded && !isEmpty && (
            <>
              <span
                className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mx-2 bg-gray-200 dark:bg-zinc-800 px-1 rounded text-[10px]"
                onClick={() => setExpanded(true)}
              >
                ...
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {closeBracket}
                {!isLast ? "," : ""}
              </span>
              {isArray && (
                <span className="text-gray-400 ml-2 text-[11px]">
                  ({items.length} items)
                </span>
              )}
              {isObject && (
                <span className="text-gray-400 ml-2 text-[11px]">
                  ({Object.keys(value).length} keys)
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {expanded && !isEmpty && (
        <div className="ml-[9px] pl-[14px] border-l border-gray-300 dark:border-zinc-700 hover:border-gray-500 dark:hover:border-gray-400 transition-colors">
          {isArray
            ? visibleItems.map((item: any, index: number) => (
              <JsonNode
                key={index}
                value={item}
                isLast={index === (showAllArray ? items.length - 1 : 0)}
                expandSignal={expandSignal}
                collapseSignal={collapseSignal}
                path={`${path}-${index}`}
              />
            ))
            : items.map(([key, val], index) => (
              <JsonNode
                key={key}
                label={key}
                value={val}
                isLast={index === items.length - 1}
                expandSignal={expandSignal}
                collapseSignal={collapseSignal}
                path={`${path}-${encodeURIComponent(key)}`}
              />
            ))}

          {isLongArray && !showAllArray && (
            <div
              className="text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 text-xs py-1 cursor-pointer select-none pl-2 flex items-center gap-1"
              onClick={() => setShowAllArray(true)}
            >
              <span className="bg-gray-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                +{items.length - 1} more items
              </span>
            </div>
          )}
        </div>
      )}

      {expanded && !isEmpty && (
        <div className="ml-5 text-gray-600 dark:text-gray-400">
          {closeBracket}
          {!isLast ? "," : ""}
        </div>
      )}
    </div>
  );
};

// --- Main Exported Component ---
export default function HttpResponseViewer({ text }: { text: string }) {
  const parsed = parseHttpMessage(text);

  const [viewMode, setViewMode] = useState<"pretty" | "raw">("pretty");
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedVisible, setCopiedVisible] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const buildVisibleData = (data: any, currentPath: string): any => {
    if (!containerRef.current) return data;

    const node = containerRef.current.querySelector(
      `[data-path="${currentPath}"]`,
    );
    if (!node) return data;

    const state = node.getAttribute("data-state");

    if (state === "collapsed") {
      if (Array.isArray(data)) {
        return [`... ${data.length} items hidden`];
      } else {
        return { "...": `${Object.keys(data).length} keys hidden` };
      }
    }

    if (Array.isArray(data)) {
      if (state === "truncated") {
        const visibleChild = buildVisibleData(data[0], `${currentPath}-0`);
        return data.length > 0
          ? [visibleChild, `... ${data.length - 1} more items hidden`]
          : [];
      }
      return data.map((item, idx) =>
        buildVisibleData(item, `${currentPath}-${idx}`),
      );
    }

    if (data !== null && typeof data === "object") {
      const result: Record<string, any> = {};
      Object.entries(data).forEach(([key, val]) => {
        const childPath = `${currentPath}-${encodeURIComponent(key)}`;
        result[key] = buildVisibleData(val, childPath);
      });
      return result;
    }

    return data;
  };

  const handleCopyFull = () => {
    let contentToCopy = text;

    if (parsed.headers) {
      contentToCopy = `${parsed.headers}\n\n`;
      if (parsed.json && viewMode === "pretty") {
        contentToCopy += JSON.stringify(parsed.json, null, 2);
      } else {
        contentToCopy += parsed.rawBody;
      }
    } else if (parsed.json && viewMode === "pretty") {
      contentToCopy = JSON.stringify(parsed.json, null, 2);
    } else {
      contentToCopy = parsed.rawBody || text;
    }

    navigator.clipboard.writeText(contentToCopy);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const handleCopyAll = () => {
    if (parsed.json && viewMode === "pretty") {
      navigator.clipboard.writeText(JSON.stringify(parsed.json, null, 2));
    } else {
      navigator.clipboard.writeText(parsed.rawBody || text);
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyVisible = () => {
    if (parsed.json && viewMode === "pretty") {
      const prunedData = buildVisibleData(parsed.json, "root");
      navigator.clipboard.writeText(JSON.stringify(prunedData, null, 2));
    } else if (containerRef.current) {
      navigator.clipboard.writeText(containerRef.current.innerText);
    }
    setCopiedVisible(true);
    setTimeout(() => setCopiedVisible(false), 2000);
  };

  return (
    <div className="bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded overflow-hidden max-h-[800px] flex flex-col">
      {/* Headers Section */}
      {parsed.headers && (
        <div className="p-3 border-b border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950">
          <pre className="text-[11px] font-mono text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
            {parsed.headers}
          </pre>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-gray-200 dark:bg-zinc-800 px-3 py-2 flex justify-between items-center border-b border-gray-300 dark:border-zinc-700 flex-wrap gap-y-2">

        {/* Toggle Switch */}
        {parsed.json ? (
          <div className="flex bg-gray-300 dark:bg-zinc-950 p-0.5 rounded items-center">
            <button
              onClick={() => setViewMode("pretty")}
              className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all duration-200 ${viewMode === "pretty" ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              Pretty
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all duration-200 ${viewMode === "raw" ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              Raw
            </button>
          </div>
        ) : (
          <div className="text-[10px] uppercase font-bold text-gray-500 px-2 tracking-widest">
            Raw Payload Only
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 items-center">
          <button onClick={handleCopyFull} className="text-[10px] uppercase font-bold text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white tracking-wider transition-colors">
            {copiedFull ? "✓ Copied Full!" : "Copy Headers + Body"}
          </button>

          <button onClick={handleCopyAll} className="text-[10px] uppercase font-bold text-green-700 hover:text-green-800 dark:text-green-500 dark:hover:text-green-400 tracking-wider transition-colors">
            {copiedAll ? "✓ Copied Body!" : "Copy Body"}
          </button>

          {/* Tree-only controls hidden if not JSON or in raw mode */}
          {parsed.json && viewMode === "pretty" && (
            <>
              <button onClick={handleCopyVisible} className="text-[10px] uppercase font-bold text-blue-700 hover:text-blue-800 dark:text-blue-500 dark:hover:text-blue-400 tracking-wider transition-colors">
                {copiedVisible ? "✓ Copied Visible!" : "Copy Visible State"}
              </button>

              <div className="w-[1px] h-4 bg-gray-400 dark:bg-zinc-600 mx-1"></div>

              <button onClick={() => setExpandSignal((s) => s + 1)} className="text-[10px] uppercase font-bold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 tracking-wider transition-colors">
                Expand All
              </button>
              <button onClick={() => setCollapseSignal((s) => s + 1)} className="text-[10px] uppercase font-bold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 tracking-wider transition-colors">
                Collapse All
              </button>
            </>
          )}
        </div>
      </div>
      {/* Body Section */}
      <div className="p-4 overflow-auto flex-1 relative" ref={containerRef}>
        {viewMode === "pretty" && parsed.json ? (
          <JsonNode
            value={parsed.json}
            expandSignal={expandSignal}
            collapseSignal={collapseSignal}
            path="root"
          />
        ) : (
          <pre className="text-[12px] font-mono text-gray-800 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
            {parsed.rawBody || "No Response Body"}
          </pre>
        )}
      </div>
    </div>
  );
}
