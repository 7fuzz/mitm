"use client";

import React, { useState, useEffect, useMemo } from "react";

// --- Deep Search Recursion ---
const deepSearch = (obj: any, term: string): boolean => {
  if (!term) return false;
  if (obj === null || typeof obj !== 'object') {
    return String(obj).toLowerCase().includes(term);
  }
  if (Array.isArray(obj)) {
    return obj.some(item => deepSearch(item, term));
  }
  return Object.entries(obj).some(([k, v]) =>
    k.toLowerCase().includes(term) || deepSearch(v, term)
  );
};

// --- Text Highlighter ---
const HighlightText = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const parts = text.toString().split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-amber-500/50 text-white rounded-sm px-[1px]">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
};

export default function JsonViewer({
  label, value, isLast = true, expandSignal, collapseSignal, path,
  searchTerm = "", filterMode = false, forceShow = false
}: any) {
  const [expanded, setExpanded] = useState(true);
  const [showAllArray, setShowAllArray] = useState(false);

  const termLower = searchTerm.toLowerCase();
  const labelMatches = label ? label.toLowerCase().includes(termLower) : false;
  const shouldForceShow = forceShow || labelMatches; // If parent matched, show all children!

  const containsMatch = useMemo(() => {
    if (!searchTerm) return false;
    return typeof value === 'object' && value !== null && deepSearch(value, termLower);
  }, [value, searchTerm, termLower]);

  useEffect(() => { if (expandSignal > 0) setExpanded(true); }, [expandSignal]);
  useEffect(() => { if (collapseSignal > 0) setExpanded(false); }, [collapseSignal]);

  // Force expand if searching
  useEffect(() => { if (searchTerm && containsMatch) setExpanded(true); }, [searchTerm, containsMatch]);

  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;

  // --- Primitive Leaf Nodes ---
  if (value === null || typeof value !== "object") {
    let valueColor = "text-zinc-300";
    let formattedValue = String(value);
    const isString = typeof value === "string";

    if (isString) valueColor = "text-emerald-400";
    else if (typeof value === "number") valueColor = "text-amber-400";
    else if (typeof value === "boolean") valueColor = "text-purple-400";
    else if (value === null) { valueColor = "text-rose-400"; formattedValue = "null"; }

    const valueMatches = formattedValue.toLowerCase().includes(termLower);

    // FILTER LOGIC: Destroy node if filtering and nothing matches
    if (filterMode && searchTerm && !shouldForceShow && !valueMatches && !labelMatches) {
      return null;
    }

    return (
      <div className="font-mono text-[13px] leading-relaxed flex" data-path={path} data-state="primitive">
        <div className="w-5 shrink-0" />
        <div className="flex-1 min-w-0 break-all">
          {label && (
            <span className="text-sky-400 mr-1 whitespace-nowrap">
              "<HighlightText text={label} query={searchTerm} />":
            </span>
          )}
          <span className={valueColor}>
            {isString && '"'}
            <HighlightText text={formattedValue} query={searchTerm} />
            {isString && '"'}
          </span>
          {!isLast && <span className="text-zinc-500">,</span>}
        </div>
      </div>
    );
  }

  // --- Object / Array Parent Nodes ---
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const items = isArray ? value : Object.entries(value);

  // Pre-filter the items before rendering so we know exactly who is left
  const processedItems = useMemo(() => {
    if (!filterMode || !searchTerm || shouldForceShow) return items;

    return items.filter((item: any) => {
      if (isArray) {
        if (item === null || typeof item !== 'object') return String(item).toLowerCase().includes(termLower);
        return deepSearch(item, termLower);
      } else {
        const [k, v] = item;
        if (k.toLowerCase().includes(termLower)) return true;
        if (v === null || typeof v !== 'object') return String(v).toLowerCase().includes(termLower);
        return deepSearch(v, termLower);
      }
    });
  }, [items, searchTerm, filterMode, isArray, termLower, shouldForceShow]);

  // FILTER LOGIC: Destroy object if filtering and it has no matching children
  if (filterMode && searchTerm && !shouldForceShow && processedItems.length === 0) {
    return null;
  }

  const isEmpty = processedItems.length === 0;
  const isLongArray = isArray && processedItems.length > 1;

  // When searching, auto-expand large arrays
  const effectiveShowAll = showAllArray || !!searchTerm;
  const visibleItems = isLongArray && !effectiveShowAll ? processedItems.slice(0, 1) : processedItems;
  const nodeState = isEmpty ? "expanded" : !expanded ? "collapsed" : isLongArray && !effectiveShowAll ? "truncated" : "expanded";

  return (
    <div className="font-mono text-[13px] leading-relaxed" data-path={path} data-state={nodeState}>
      <div className="flex items-start group">
        <button onClick={() => setExpanded(!expanded)} className="w-5 shrink-0 flex justify-center items-center cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors mt-[2px]" disabled={isEmpty}>
          {!isEmpty && (expanded ? "▼" : "▶")}
        </button>
        <div className="flex-1 min-w-0 flex items-center flex-wrap">
          {label && (
            <span className="text-sky-400 mr-1 whitespace-nowrap">
              "<HighlightText text={label} query={searchTerm} />":
            </span>
          )}
          <span className="text-zinc-400">{openBracket}</span>
          {isEmpty && <span className="text-zinc-400">{closeBracket}{!isLast ? "," : ""}</span>}
          {!expanded && !isEmpty && (
            <>
              <span className="cursor-pointer text-zinc-500 hover:text-zinc-300 mx-2 bg-zinc-800 px-1 rounded text-[10px]" onClick={() => setExpanded(true)}>...</span>
              <span className="text-zinc-400">{closeBracket}{!isLast ? "," : ""}</span>
              {isArray && <span className="text-zinc-500 ml-2 text-[11px]">({processedItems.length} items)</span>}
              {isObject && <span className="text-zinc-500 ml-2 text-[11px]">({processedItems.length} keys)</span>}
            </>
          )}
        </div>
      </div>

      {expanded && !isEmpty && (
        <div className="ml-[9px] pl-[14px] border-l border-zinc-700 hover:border-zinc-500 transition-colors">
          {isArray
            ? visibleItems.map((item: any, index: number) => (
              <JsonViewer key={index} value={item} isLast={index === visibleItems.length - 1} expandSignal={expandSignal} collapseSignal={collapseSignal} path={`${path}-${index}`} searchTerm={searchTerm} filterMode={filterMode} forceShow={shouldForceShow} />
            ))
            : visibleItems.map(([key, val]: any, index: number) => (
              <JsonViewer key={key} label={key} value={val} isLast={index === visibleItems.length - 1} expandSignal={expandSignal} collapseSignal={collapseSignal} path={`${path}-${encodeURIComponent(key)}`} searchTerm={searchTerm} filterMode={filterMode} forceShow={shouldForceShow} />
            ))}

          {isLongArray && !effectiveShowAll && (
            <div className="text-zinc-500 hover:text-sky-400 text-xs py-1 cursor-pointer select-none pl-2 flex items-center gap-1" onClick={() => setShowAllArray(true)}>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded">+{processedItems.length - 1} more items</span>
            </div>
          )}
        </div>
      )}
      {expanded && !isEmpty && <div className="ml-5 text-zinc-400">{closeBracket}{!isLast ? "," : ""}</div>}
    </div>
  );
}
