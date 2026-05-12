import { useState, useRef } from 'react';
import { GlobalVariable, Environment } from './types';

export function useVariables(prefs?: { autoSave: boolean }) {
  const [variables, setVariables] = useState<GlobalVariable[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([{ id: 'default-env-id', name: 'Default' }]);
  const [activeEnvId, setActiveEnvId] = useState('default-env-id');
  const debounceTimers = useRef<Record<string, any>>({});

  const loadVariables = (vars: GlobalVariable[], envs: Environment[], activeId: string) => {
    setVariables(vars);
    setEnvironments(envs);
    setActiveEnvId(activeId);
  };

  const addVariable = (v: GlobalVariable) => {
    setVariables(prev => [...prev, v]);
    fetch('/api/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }).catch(console.error);
  };

  const saveVariable = (id: string, variable?: GlobalVariable) => {
    const v = variable || variables.find(v => v.id === id);
    if (!v) return;
    
    fetch(`/api/variables/${id}`, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(v) 
    }).catch(console.error);
  };

  const saveAllVariables = async () => {
    const envVars = variables.filter(v => v.environmentId === activeEnvId);
    await Promise.all(envVars.map(v => 
      fetch(`/api/variables/${v.id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(v) 
      }).catch(console.error)
    ));
  };

  const updateVariable = (id: string, updates: Partial<GlobalVariable>, immediate = false) => {
    setVariables(prev => {
      const next = prev.map(v => v.id === id ? { ...v, ...updates } : v);
      
      if (prefs?.autoSave || immediate) {
        if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
        
        if (immediate) {
          const updatedVar = next.find(v => v.id === id);
          if (updatedVar) saveVariable(id, updatedVar);
        } else {
          debounceTimers.current[id] = setTimeout(() => {
            const updatedVar = next.find(v => v.id === id);
            if (updatedVar) saveVariable(id, updatedVar);
            delete debounceTimers.current[id];
          }, 1000);
        }
      }
      
      return next;
    });
  };

  const deleteVariable = (id: string) => {
    setVariables(prev => prev.filter(v => v.id !== id));
    fetch(`/api/variables/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const setActiveEnvironment = async (id: string) => {
    setActiveEnvId(id);

    fetch('/api/environments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeId: id })
    }).catch(console.error);

    try {
      const res = await fetch(`/api/variables?envId=${id}`);
      const data = await res.json();
      if (data.variables) {
        setVariables(data.variables);
      }
    } catch (error) {
      console.error("Failed to lazy-load environment variables:", error);
    }
  };

  const createEnvironment = (name: string) => {
    const newId = crypto.randomUUID();
    setEnvironments(prev => [...prev, { id: newId, name }]);
    setActiveEnvId(newId);
    fetch('/api/environments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: newId, name, activeId: newId }) });
  };

  const renameEnvironment = (id: string, name: string) => {
    if (id === 'default-env-id' || !name.trim()) return;
    setEnvironments(prev => prev.map(e => e.id === id ? { ...e, name } : e));
    fetch(`/api/environments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  };

  const deleteEnvironment = (id: string) => {
    if (id === 'default-env-id') return;
    setEnvironments(prev => prev.filter(e => e.id !== id));
    setVariables(prev => prev.filter(v => v.environmentId !== id)); // Local cascade
    if (activeEnvId === id) setActiveEnvironment('default-env-id');
    fetch(`/api/environments/${id}`, { method: 'DELETE' });
  };

  const updateVariableAutoValue = (name: string, value: string) => {
    setVariables(prev => prev.map(v => {
      if (v.name === name && v.environmentId === activeEnvId) {
        const autoVal = v.values.find(val => val.name === '(auto)');
        if (autoVal) {
          const newValues = v.values.map(val => val.name === '(auto)' ? { ...val, value } : val);
          
          if (prefs?.autoSave) {
            const timerId = `auto-${v.id}`;
            if (debounceTimers.current[timerId]) clearTimeout(debounceTimers.current[timerId]);
            debounceTimers.current[timerId] = setTimeout(() => {
              fetch(`/api/variables/${v.id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ values: newValues }) 
              }).catch(console.error);
              delete debounceTimers.current[timerId];
            }, 2000);
          }
          
          return { ...v, values: newValues };
        }
      }
      return v;
    }));
  };

  return {
    variables, environments, activeEnvId,
    loadVariables,
    addVariable, updateVariable, deleteVariable, saveVariable, saveAllVariables,
    setActiveEnvironment, createEnvironment, renameEnvironment, deleteEnvironment,
    updateVariableAutoValue
  };
}

