export interface EnvVariant { name: string; value: string; }
export interface UILayout { isListOpen: boolean; listLayout: 'sidebar' | 'bottom'; splitMode: 'vertical' | 'horizontal'; }
export interface Environment { id: string; name: string; }
export interface GlobalVariableValue { id: string; name: string; value: string; }
export interface GlobalVariable {
  id: string;
  environmentId: string; // Changed from project!
  name: string;
  values: GlobalVariableValue[];
  activeIndex: number;
}
