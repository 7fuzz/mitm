export interface EnvVariant { name: string; value: string; }
export interface UILayout { isListOpen: boolean; splitMode: 'vertical' | 'horizontal'; sidebarWidth: number; }
export interface Environment { id: string; name: string; }
export interface GlobalVariableValue { id: string; name: string; value: string; }
export interface GlobalVariable {
  id: string;
  environmentId: string; // Changed from project!
  name: string;
  values: GlobalVariableValue[];
  activeIndex: number;
}

export interface RepeaterGroup {
  id: string;
  name: string;
  orderIndex?: number;
}

export interface RepeaterRequest {
  id: string;
  name: string;
  groupId: string | null;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  extract?: Record<string, string>;
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
    time?: number;
  };
}

export type ReplacementCategory = 'URL_REPLACEMENTS' | 'HEADER_REPLACEMENTS' | 'BODY_KEY_REPLACEMENTS' | 'URL_PARAM_REPLACEMENTS' | 'TEXT_REPLACEMENTS';

export interface ReplacementEntry {
  id: string;
  pattern: string;
  replacement: string;
  is_active: boolean;
}

