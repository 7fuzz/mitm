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
  HEADER_VALUE_REPLACEMENTS: {},
  HEADER_HOST_REPLACEMENTS: {},
  BODY_KEY_REPLACEMENTS: {},
  URL_PARAM_REPLACEMENTS: {}
};

// URL replacements - prefix matching domains with environment variable
export let URL_REPLACEMENTS: Record<string, string> = {};

// Header key replacements - maps old header values to variable placeholders
export let HEADER_VALUE_REPLACEMENTS: Record<string, string> = {};

// Header host replacements - maps host header to use environment variable
export let HEADER_HOST_REPLACEMENTS: Record<string, string> = {};

// Body key replacements - replaces specific keys with variable placeholders
export let BODY_KEY_REPLACEMENTS: Record<string, string> = {};

// URL query parameter replacements - replaces param values with variable placeholders
export let URL_PARAM_REPLACEMENTS: Record<string, string> = {};

// Fetch replacements from the database API
export async function fetchReplacements(): Promise<typeof DEFAULT_REPLACEMENTS> {
  try {
    const res = await fetch('/api/replacements');
    const data = await res.json();
    
    // API returns { grouped: {...}, ordered: [...] }
    const grouped = data.grouped || {};
    
    URL_REPLACEMENTS = grouped.URL_REPLACEMENTS || {};
    HEADER_VALUE_REPLACEMENTS = grouped.HEADER_VALUE_REPLACEMENTS || {};
    HEADER_HOST_REPLACEMENTS = grouped.HEADER_HOST_REPLACEMENTS || {};
    BODY_KEY_REPLACEMENTS = grouped.BODY_KEY_REPLACEMENTS || {};
    URL_PARAM_REPLACEMENTS = grouped.URL_PARAM_REPLACEMENTS || {};
    
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
  HEADER_VALUE_REPLACEMENTS = DEFAULT_REPLACEMENTS.HEADER_VALUE_REPLACEMENTS;
  HEADER_HOST_REPLACEMENTS = DEFAULT_REPLACEMENTS.HEADER_HOST_REPLACEMENTS;
  BODY_KEY_REPLACEMENTS = DEFAULT_REPLACEMENTS.BODY_KEY_REPLACEMENTS;
  URL_PARAM_REPLACEMENTS = DEFAULT_REPLACEMENTS.URL_PARAM_REPLACEMENTS;
}

// Helper function to apply URL replacements (domain + query params)
export function applyUrlReplacements(url: string): string {
  try {
    const parsed = new URL(url);

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
    let newKey = key;

    // Check for Bearer token replacement - replace entire token after "Bearer "
    if (newValue.startsWith('Bearer ')) {
      newValue = 'Bearer {{token}}';
    }

    // Check for host header replacements (case-insensitive)
    if (key.toLowerCase() === 'host') {
      for (const [pattern, replacement] of Object.entries(HEADER_HOST_REPLACEMENTS)) {
        if (newValue.includes(pattern)) {
          newValue = newValue.replace(pattern, replacement);
        }
      }
    }

    result[newKey] = newValue;
  }

  return result;
}

// Helper function to apply body replacements (handles nested JSON)
export function applyBodyReplacements(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const transformed = transformObject(parsed);
    return JSON.stringify(transformed, null, 2);
  } catch {
    // Not valid JSON, return as-is
    return body;
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
