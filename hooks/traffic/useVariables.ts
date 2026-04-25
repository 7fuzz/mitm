import { useState } from 'react';
import { GlobalVariable, Environment } from './types';

export function useVariables() {
  const [variables, setVariables] = useState<GlobalVariable[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([{ id: 'default-env-id', name: 'Default' }]);
  const [activeEnvId, setActiveEnvId] = useState('default-env-id');

  const loadVariables = (vars: GlobalVariable[], envs: Environment[], activeId: string) => {
    setVariables(vars);
    setEnvironments(envs);
    setActiveEnvId(activeId);
  };

  const addVariable = (v: GlobalVariable) => {
    setVariables(prev => [...prev, v]);
    fetch('/api/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }).catch(console.error);
  };

  const updateVariable = (id: string, updates: Partial<GlobalVariable>) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    fetch(`/api/variables/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }).catch(console.error);
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

  return {
    variables, environments, activeEnvId,
    loadVariables,
    addVariable, updateVariable, deleteVariable,
    setActiveEnvironment, createEnvironment, renameEnvironment, deleteEnvironment
  };
}
