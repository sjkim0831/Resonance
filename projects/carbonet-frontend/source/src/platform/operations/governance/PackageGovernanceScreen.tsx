import React, { useState, useEffect } from 'react';

// Interfaces matching the DTOs from our backend API
interface ProjectRuntimeManifest {
  metadata: {
    projectId: string;
    projectName: string;
    owner: string;
  };
  installations: {
    commonCore: string;
    stableGate: string;
    adapter: string;
    adapterContract: string;
  };
  runtime: {
    status: string;
    bootTarget: string;
    lastHealthCheck: string | null;
  };
  governance: {
    compatibilityClass: string;
    updatedAt: string;
  };
}

interface UpgradeCandidate {
  targetVersion: string;
  compatibilityClass: string;
  impact: string;
  notes: string;
  requiresAdapterUpdate: boolean;
}

export const PackageGovernanceScreen: React.FC = () => {
  const [projects, setProjects] = useState<Record<string, ProjectRuntimeManifest>>({});
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [upgradeCandidates, setUpgradeCandidates] = useState<UpgradeCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      // Use the registry endpoint that includes live status
      const response = await fetch('/api/operations/governance/runtime/projects/registry');
      if (response.ok) {
        const data = await response.json();
        // Convert array to record for backward compatibility with the existing state structure
        const projectRecord: Record<string, ProjectRuntimeManifest> = {};
        if (data.items) {
          data.items.forEach((item: any) => {
            projectRecord[item.projectId] = {
              metadata: { projectId: item.projectId, projectName: item.projectName, owner: item.owner },
              installations: { commonCore: item.compatibilityClass || 'Unknown', stableGate: 'v1', adapter: 'Unknown', adapterContract: 'v1' }, // Fallbacks for registry view
              runtime: { status: item.status, bootTarget: item.bootTarget, lastHealthCheck: null },
              governance: { compatibilityClass: item.compatibilityClass, updatedAt: '' }
            };
          });
        }
        
        // Also fetch detailed manifest for full data
        const manifestResponse = await fetch('/api/operations/governance/runtime/projects');
        if (manifestResponse.ok) {
           const manifestData = await manifestResponse.json();
           Object.keys(manifestData).forEach(key => {
              if (projectRecord[key]) {
                  projectRecord[key].installations = manifestData[key].installations;
                  projectRecord[key].runtime.bootTarget = manifestData[key].runtime?.bootTarget || projectRecord[key].runtime.bootTarget;
              } else {
                  projectRecord[key] = manifestData[key];
              }
           });
        }
        setProjects(projectRecord);
      }
    } catch (error) {
      console.error('Failed to fetch project manifest', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRuntimeAction = async (projectId: string, action: 'start' | 'stop' | 'restart') => {
    if (!window.confirm(`Are you sure you want to ${action} project ${projectId}?`)) return;
    
    setActionLoading(projectId);
    try {
      const response = await fetch(`/api/operations/governance/runtime/projects/${projectId}/${action}`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success || response.ok) {
        alert(`Project ${projectId} ${action} successful.`);
        await fetchProjects(); // Refresh status
      } else {
        alert(`Failed to ${action} project: ${result.output || result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Action ${action} failed`, error);
      alert(`Action ${action} failed. See console.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    setSelectedProject(projectId);
    setUpgradeCandidates([]);
    
    try {
      const response = await fetch(`/api/operations/governance/runtime/projects/${projectId}/upgrades`);
      if (response.ok) {
        const candidates = await response.json();
        setUpgradeCandidates(candidates);
      }
    } catch (error) {
      console.error('Failed to fetch upgrade candidates', error);
    }
  };

  if (loading) return <div>Loading Platform Fleet Status...</div>;

  return (
    <div className="p-6 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Package & Runtime Governance</h1>
      
      {/* Fleet Overview Table */}
      <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">Fleet Overview</h2>
        <table className="w-full text-left bg-white border border-gray-300 rounded overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border-b border-gray-300 text-sm font-medium text-gray-600">Project</th>
              <th className="p-3 border-b border-gray-300 text-sm font-medium text-gray-600">Core Ver.</th>
              <th className="p-3 border-b border-gray-300 text-sm font-medium text-gray-600">Gate Ver.</th>
              <th className="p-3 border-b border-gray-300 text-sm font-medium text-gray-600">Status</th>
              <th className="p-3 border-b border-gray-300 text-sm font-medium text-gray-600">Health</th>
              <th className="p-3 border-b border-gray-300 text-sm font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(projects).map((proj) => (
              <tr key={proj.metadata.projectId} className="hover:bg-blue-50 transition-colors">
                <td className="p-3 border-b border-gray-200">
                  <div className="font-semibold text-gray-800">{proj.metadata.projectId}</div>
                  <div className="text-xs text-gray-500">{proj.metadata.projectName}</div>
                </td>
                <td className="p-3 border-b border-gray-200 text-gray-700">{proj.installations.commonCore}</td>
                <td className="p-3 border-b border-gray-200 text-gray-700">{proj.installations.stableGate}</td>
                <td className="p-3 border-b border-gray-200">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    proj.runtime.status === 'RUNNING' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {proj.runtime.status}
                  </span>
                </td>
                <td className="p-3 border-b border-gray-200 text-gray-600">
                  {proj.runtime.lastHealthCheck ? 'OK' : 'Unknown'}
                </td>
                <td className="p-3 border-b border-gray-200">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleSelectProject(proj.metadata.projectId)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Manage
                    </button>
                    {proj.runtime.status === 'RUNNING' ? (
                       <button onClick={() => handleRuntimeAction(proj.metadata.projectId, 'stop')} disabled={actionLoading === proj.metadata.projectId} className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50">Stop</button>
                    ) : (
                       <button onClick={() => handleRuntimeAction(proj.metadata.projectId, 'start')} disabled={actionLoading === proj.metadata.projectId} className="text-green-600 hover:text-green-800 font-medium text-sm disabled:opacity-50">Start</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upgrade Center (Visible when a project is selected) */}
      {selectedProject && projects[selectedProject] && (
        <div className="bg-blue-50 p-6 rounded-lg shadow-sm border border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-blue-900">
              Upgrade Center: {selectedProject}
            </h2>
            <button onClick={() => setSelectedProject(null)} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">Current Installation</h3>
              <p className="text-sm text-gray-600 mb-1"><span className="font-medium text-gray-800">Version:</span> {projects[selectedProject].installations.commonCore} ({projects[selectedProject].governance.compatibilityClass})</p>
              <p className="text-sm text-gray-600 mb-1"><span className="font-medium text-gray-800">Adapter:</span> {projects[selectedProject].installations.adapter} (Contract: {projects[selectedProject].installations.adapterContract})</p>
              <p className="text-sm text-gray-600 truncate" title={projects[selectedProject].runtime.bootTarget}>
                <span className="font-medium text-gray-800">Boot Path:</span> {projects[selectedProject].runtime.bootTarget}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">Available Upgrades</h3>
              {upgradeCandidates.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No newer versions available or registry is unreachable.</p>
              ) : (
                <ul className="space-y-3">
                  {upgradeCandidates.map(candidate => (
                    <li key={candidate.targetVersion} className="p-3 border rounded border-gray-200 hover:border-blue-400 transition-colors">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800">v{candidate.targetVersion}</span>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          candidate.compatibilityClass === 'IMPLEMENTATION_SAFE' ? 'bg-green-100 text-green-700' :
                          candidate.compatibilityClass === 'CONTRACT_AWARE' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {candidate.compatibilityClass}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{candidate.notes}</p>
                      {candidate.requiresAdapterUpdate && (
                        <p className="text-xs text-red-600 font-medium mb-2">⚠️ Requires project adapter update to matching contract version.</p>
                      )}
                      <button 
                        className={`text-xs font-bold px-3 py-1.5 rounded w-full ${
                          candidate.compatibilityClass === 'IMPLEMENTATION_SAFE' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {candidate.compatibilityClass === 'IMPLEMENTATION_SAFE' ? 'UPGRADE NOW' : 'PREPARE UPGRADE'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
