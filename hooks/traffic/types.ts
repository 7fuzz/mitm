export interface EnvVariant { name: string; value: string; }
export interface GlobalVariableValue { id: string; name: string; value: string; }
export interface GlobalVariable { id: string; project: string; name: string; values: GlobalVariableValue[]; activeIndex: number; }
export interface UILayout { isListOpen: boolean; listLayout: 'sidebar' | 'bottom'; splitMode: 'vertical' | 'horizontal'; }
