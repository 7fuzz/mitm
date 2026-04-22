import { useState, useEffect } from 'react';

// --- Sub-component: Handles typing without losing focus ---
const EditableKey = ({ initialKey, onCommit }: { initialKey: string, onCommit: (oldK: string, newK: string) => void }) => {
  const [localKey, setLocalKey] = useState(initialKey);

  useEffect(() => setLocalKey(initialKey), [initialKey]);

  const handleBlur = () => {
    const trimmed = localKey.trim();
    if (trimmed !== initialKey && trimmed !== '') {
      onCommit(initialKey, trimmed);
    } else {
      setLocalKey(initialKey);
    }
  };

  return (
    <div className="w-1/3 flex items-center shrink-0 group/key">
      <span className="text-zinc-600 font-mono text-[11px] mr-1">"</span>
      <input
        value={localKey}
        onChange={(e) => setLocalKey(e.target.value)}
        onBlur={handleBlur}
        className="flex-1 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-sky-500 text-sky-400 text-[11px] font-mono outline-none min-w-0 transition-colors"
      />
      <span className="text-zinc-600 font-mono text-[11px] ml-1">":</span>
    </div>
  );
};

// --- Recursive Node Component ---
const JsonNode = ({ label, value, onChange, onDelete, onKeyChange }: any) => {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === 'object' && !isArray;

  if (isObject || isArray) {
    const keys = Object.keys(value);

    const handleChildChange = (key: string, newVal: any) => {
      const cloned = isArray ? [...value] : { ...value };
      cloned[key] = newVal;
      onChange(cloned);
    };

    const handleChildDelete = (key: string) => {
      const cloned: any = isArray ? [...value] : { ...value };
      if (isArray) cloned.splice(Number(key), 1);
      else delete cloned[key];
      onChange(cloned);
    };

    const handleChildKeyChange = (oldKey: string, newKey: string) => {
      if (oldKey === newKey || isArray) return;
      const newObj: any = {};
      for (const k in value) {
        if (k === oldKey) newObj[newKey] = value[oldKey];
        else newObj[k] = value[k];
      }
      onChange(newObj);
    };

    const handleAdd = () => {
      const cloned: any = isArray ? [...value] : { ...value };
      if (isArray) cloned.push(""); // New array items default to empty string
      else cloned[`new_key_${Date.now().toString().slice(-4)}`] = ""; // New keys default to empty string
      onChange(cloned);
    };

    return (
      <div className="ml-4 pl-3 border-l border-zinc-800/80 space-y-2 mt-2">
        <div className="flex justify-between items-center group/node">
          <div className="flex items-center flex-1">
            {label !== null && onKeyChange && (
              <EditableKey initialKey={label} onCommit={onKeyChange} />
            )}
            <span className="text-[10px] text-zinc-500 font-bold uppercase ml-2">
              {isArray ? `Array [${keys.length}]` : `Object {${keys.length}}`}
            </span>
          </div>
          {onDelete && (
            <button onClick={onDelete} className="text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 px-1.5 py-0.5 rounded opacity-0 group-hover/node:opacity-100 transition-all text-xs">
              ✕
            </button>
          )}
        </div>

        {keys.map((k) => (
          <div key={k} className="mt-1">
            <JsonNode
              label={isArray ? null : k}
              value={value[k]}
              onChange={(newVal: any) => handleChildChange(k, newVal)}
              onDelete={() => handleChildDelete(k)}
              onKeyChange={isArray ? null : handleChildKeyChange}
            />
          </div>
        ))}
        <button onClick={handleAdd} className="text-[9px] text-sky-500 hover:text-sky-400 mt-2 font-bold uppercase tracking-widest px-1 hover:bg-sky-500/10 rounded transition-colors">
          + Add {isArray ? 'Item' : 'Key'}
        </button>
      </div>
    );
  }

  // === UPGRADED: Primitive Leaf Node with Explicit Types ===
  const valueType = value === null ? 'null' : typeof value;

  const handleTypeSwitch = (newType: string) => {
    if (newType === 'string') onChange(String(value ?? ''));
    else if (newType === 'number') onChange(Number(value) || 0);
    else if (newType === 'boolean') onChange(Boolean(value));
    else if (newType === 'null') onChange(null);
  };

  return (
    <div className="flex gap-2 items-center group/leaf">
      {label !== null ? (
        <EditableKey initialKey={label} onCommit={onKeyChange} />
      ) : (
        <div className="w-4 shrink-0 text-zinc-600 text-[10px] flex justify-end pr-2">-</div>
      )}

      {/* Type Selector Dropdown */}
      <select
        value={valueType}
        onChange={(e) => handleTypeSwitch(e.target.value)}
        className="bg-zinc-900 border border-zinc-700 text-zinc-400 text-[9px] uppercase font-bold px-1 py-1.5 rounded outline-none cursor-pointer hover:border-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <option value="string">STR</option>
        <option value="number">NUM</option>
        <option value="boolean">BOOL</option>
        <option value="null">NULL</option>
      </select>

      {/* Context-Aware Input Surface */}
      {valueType === 'boolean' ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
          className="flex-1 bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 p-1.5 rounded text-fuchsia-400 outline-none focus:border-fuchsia-500 text-[11px] font-mono transition-colors"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : valueType === 'null' ? (
        <div className="flex-1 bg-zinc-950/30 border border-transparent p-1.5 rounded text-zinc-600 text-[11px] font-mono italic">
          null
        </div>
      ) : (
        <div className="flex-1 flex items-center bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 focus-within:border-sky-500 rounded transition-colors overflow-hidden">
          {valueType === 'string' && <span className="text-zinc-600 pl-2">"</span>}
          <input
            type={valueType === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => onChange(valueType === 'number' ? Number(e.target.value) : e.target.value)}
            className={`w-full bg-transparent p-1.5 outline-none text-[11px] font-mono ${valueType === 'number' ? 'text-sky-400' : 'text-emerald-400'}`}
          />
          {valueType === 'string' && <span className="text-zinc-600 pr-2">"</span>}
        </div>
      )}

      {onDelete && (
        <button onClick={onDelete} className="p-1.5 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded opacity-0 group-hover/leaf:opacity-100 transition-all">
          ✕
        </button>
      )}
    </div>
  );
};

// --- Main Wrapper ---
export function JsonEditor({ initialBody, onChange }: { initialBody: string, onChange: (v: string) => void }) {
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (!initialBody || initialBody.trim() === '') {
        setParsed({});
        setError('');
        return;
      }
      setParsed(JSON.parse(initialBody));
      setError('');
    } catch (e) {
      setError('Invalid JSON syntax. Fix it in Raw mode first.');
    }
  }, [initialBody]);

  if (error) return (
    <div className="text-rose-400 text-xs p-4 border border-rose-500/30 rounded bg-rose-500/10 font-mono m-4">
      {error}
    </div>
  );
  if (parsed === null) return null;

  return (
    <div className="p-4 bg-zinc-900/30 rounded overflow-x-auto min-h-full">
      <JsonNode
        value={parsed}
        onChange={(newObj: any) => {
          setParsed(newObj);
          onChange(JSON.stringify(newObj, null, 2));
        }}
      />
    </div>
  );
}
