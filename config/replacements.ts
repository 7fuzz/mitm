/**
 * Replacement Configuration for Send to Repeater
 * 
 * This file defines the replacement rules applied when sending requests to the Repeater.
 * Values are fetched from the SQLite database via the Python API.
 * 
 * For client-side usage, use the useReplacements hook from the traffic context.
 * This module provides server-side/utility functions that need direct database access.
 */

// Default fallback values (used when database is unavailable)
const DEFAULT_REPLACEMENTS = {
  URL_REPLACEMENTS: {},
  HEADER_REPLACEMENTS: {},
  BODY_KEY_REPLACEMENTS: {},
  URL_PARAM_REPLACEMENTS: {},
  TEXT_REPLACEMENTS: {}
};

// URL replacements - prefix matching domains with environment variable
export let URL_REPLACEMENTS: Record<string, string> = {};

// Unified Header replacements - maps header key to replacement value
export let HEADER_REPLACEMENTS: Record<string, string> = {};

// Body key replacements - replaces specific keys with variable placeholders
export let BODY_KEY_REPLACEMENTS: Record<string, string> = {};

// URL query parameter replacements - replaces param values with variable placeholders
export let URL_PARAM_REPLACEMENTS: Record<string, string> = {};

// Global Text replacements - replaces any occurrence in URL, Headers, or Body
export let TEXT_REPLACEMENTS: Record<string, string> = {};

// Fetch replacements from the database API
export async function fetchReplacements(): Promise<typeof DEFAULT_REPLACEMENTS> {
  try {
    const res = await fetch('/api/replacements');
    const data = await res.json();
    
    // API returns { grouped: {...}, ordered: [...] }
    const grouped = data.grouped || {};
    
    URL_REPLACEMENTS = grouped.URL_REPLACEMENTS || {};
    // Migration: Merge legacy header replacements if they exist
    HEADER_REPLACEMENTS = {
      ...(grouped.HEADER_VALUE_REPLACEMENTS || {}),
      ...(grouped.HEADER_REPLACEMENTS || {})
    };
    BODY_KEY_REPLACEMENTS = grouped.BODY_KEY_REPLACEMENTS || {};
    URL_PARAM_REPLACEMENTS = grouped.URL_PARAM_REPLACEMENTS || {};
    TEXT_REPLACEMENTS = grouped.TEXT_REPLACEMENTS || {};
    
    return data;
  } catch (e) {
    console.error('Failed to fetch replacements:', e);
    return DEFAULT_REPLACEMENTS;
  }
}

// Initialize replacements on module load
if (typeof window !== 'undefined') {
  // Client-side: fetch from API on load
  fetchReplacements().catch(console.error);
} else {
  // Server-side: just set defaults
  URL_REPLACEMENTS = DEFAULT_REPLACEMENTS.URL_REPLACEMENTS;
  HEADER_REPLACEMENTS = DEFAULT_REPLACEMENTS.HEADER_REPLACEMENTS;
  BODY_KEY_REPLACEMENTS = DEFAULT_REPLACEMENTS.BODY_KEY_REPLACEMENTS;
  URL_PARAM_REPLACEMENTS = DEFAULT_REPLACEMENTS.URL_PARAM_REPLACEMENTS;
  TEXT_REPLACEMENTS = DEFAULT_REPLACEMENTS.TEXT_REPLACEMENTS;
}

// Helper function to apply URL replacements (domain + query params)
export function applyUrlReplacements(url: string): string {
  try {
    let result = url;
    // Apply global text replacements
    for (const [pattern, replacement] of Object.entries(TEXT_REPLACEMENTS)) {
      result = result.replaceAll(pattern, replacement);
    }

    const parsed = new URL(result);

    // Apply domain replacements
    let hostname = parsed.hostname;
    for (const [pattern, replacement] of Object.entries(URL_REPLACEMENTS)) {
      if (hostname.includes(pattern)) {
        hostname = hostname.replace(pattern, replacement);
      }
    }
    parsed.hostname = hostname;

    // Apply query parameter replacements (avoid URL encoding)
    const searchParams = parsed.search;
    let newSearch = searchParams;
    for (const [key, value] of Object.entries(URL_PARAM_REPLACEMENTS)) {
      // Match key=value pattern and replace the value
      const regex = new RegExp(`([?&]${key}=)([^&]*)`, 'g');
      newSearch = newSearch.replace(regex, `$1${value}`);
    }
    parsed.search = newSearch;

    return parsed.toString();
  } catch {
    // If URL parsing fails, fall back to simple string replacement
    let result = url;
    // Apply global text replacements
    for (const [pattern, replacement] of Object.entries(TEXT_REPLACEMENTS)) {
      result = result.replaceAll(pattern, replacement);
    }
    for (const [pattern, replacement] of Object.entries(URL_REPLACEMENTS)) {
      if (result.includes(pattern)) {
        result = result.replace(pattern, replacement);
      }
    }
    return result;
  }
}

// Helper function to apply header replacements
export function applyHeaderReplacements(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    let newValue = value;
    const lowerKey = key.toLowerCase();

    // Unified header replacement based on KEY
    for (const [pattern, replacement] of Object.entries(HEADER_REPLACEMENTS)) {
      if (lowerKey === pattern.toLowerCase()) {
        newValue = replacement;
        break;
      }
    }

    // Apply global text replacements to value
    for (const [pattern, replacement] of Object.entries(TEXT_REPLACEMENTS)) {
      newValue = newValue.replaceAll(pattern, replacement);
    }

    result[key] = newValue;
  }

  return result;
}

// Helper function to apply body replacements (handles nested JSON)
export function applyBodyReplacements(body: string): string {
  try {
    let transformedBody = body;
    // Apply global text replacements
    for (const [pattern, replacement] of Object.entries(TEXT_REPLACEMENTS)) {
      transformedBody = transformedBody.replaceAll(pattern, replacement);
    }

    const parsed = JSON.parse(transformedBody);
    const transformed = transformObject(parsed);
    return JSON.stringify(transformed, null, 2);
  } catch {
    let result = body;
    // Apply global text replacements even if not valid JSON
    for (const [pattern, replacement] of Object.entries(TEXT_REPLACEMENTS)) {
      result = result.replaceAll(pattern, replacement);
    }
    return result;
  }
}

function transformObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformObject(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if this key should be replaced
    const lowerKey = key.toLowerCase();
    if (BODY_KEY_REPLACEMENTS[lowerKey]) {
      result[key] = BODY_KEY_REPLACEMENTS[lowerKey];
    } else if (typeof value === 'object') {
      result[key] = transformObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
