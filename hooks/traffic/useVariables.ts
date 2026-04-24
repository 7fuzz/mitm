import { useState } from 'react';
import { GlobalVariable } from './types';

export function useVariables() {
  const [variables, setVariables] = useState<GlobalVariable[]>([]);
  const [activeProject, setActiveProject] = useState('Default');

  const addVariable = (v: GlobalVariable) => {
    setVariables(prev => [...prev, v]);
    fetch('/api/variables', { method: 'POST', body: JSON.stringify(v) }).catch(console.error);
  };

  const updateVariable = (id: string, updates: Partial<GlobalVariable>) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    fetch(`/api/variables/${id}`, { method: 'PUT', body: JSON.stringify(updates) }).catch(console.error);
  };

  const deleteVariable = (id: string) => {
    setVariables(prev => prev.filter(v => v.id !== id));
    fetch(`/api/variables/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const updateActiveProject = (projectName: string, isNew = false) => {
    setActiveProject(projectName);
    fetch('/api/environments', {
      method: 'POST',
      body: JSON.stringify({ activeProject: projectName, newEnvironment: isNew ? projectName : undefined })
    }).catch(console.error);
  };

  const renameProject = (oldName: string, newName: string) => {
    if (oldName === 'Default' || !newName.trim()) return;
    setVariables(prev => prev.map(v => v.project === oldName ? { ...v, project: newName } : v));
    if (activeProject === oldName) setActiveProject(newName);
    fetch(`/api/environments/${encodeURIComponent(oldName)}`, { method: 'PUT', body: JSON.stringify({ newName }) }).catch(console.error);
  };

  const deleteProject = (name: string) => {
    if (name === 'Default') return;
    setVariables(prev => prev.filter(v => v.project !== name));
    if (activeProject === name) setActiveProject('Default');
    fetch(`/api/environments/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(console.error);
  };

  const updateVariablesState = (newVars: GlobalVariable[], newActiveProj?: string) => {
    const targetProject = newActiveProj || activeProject;
    setVariables(newVars);
    if (newActiveProj) setActiveProject(newActiveProj);
    const envs = Array.from(new Set(newVars.map(v => v.project)));
    if (!envs.includes(targetProject)) envs.push(targetProject);
    fetch('/api/variables', { method: 'POST', body: JSON.stringify({ activeProject: targetProject, environments: envs, variables: newVars }) });
  };

  return {
    variables, setVariables: updateVariablesState,
    activeProject, setActiveProject,
    addVariable, updateVariable, deleteVariable,
    updateActiveProject, renameProject, deleteProject
  };
}
