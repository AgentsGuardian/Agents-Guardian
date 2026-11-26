/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Activity, 
  UploadCloud, 
  Play, 
  RefreshCw, 
  Layers, 
  CheckCircle, 
  CheckCircle2, 
  Lock, 
  Search, 
  Archive, 
  Trash2, 
  Filter, 
  ChevronDown, 
  AlertTriangle 
} from 'lucide-react';
import { DriftLogEvent, Policy, AdminUser } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';

interface ObservePillarProps {
  driftEvents: DriftLogEvent[];
  policies: Policy[];
  onRemediateDrift: (id: string) => void;
  onAddDriftEvent: (newEvent: DriftLogEvent) => void;
  onSetDriftEvents?: (events: DriftLogEvent[]) => void;
  addToast?: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
  currentUser?: AdminUser;
  onNavigateTab?: (tab: string) => void;
}

// Custom Tooltip for recharts with bucket time, health score, status, number of events
const MetricTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const scoreVal = typeof data.score === 'number' ? data.score : 100;
    const statusVal = scoreVal > 85 ? 'HEALTHY' : scoreVal >= 70 ? 'WARNING' : 'CRITICAL';
    const eventCount = typeof data.eventCount === 'number' ? data.eventCount : (typeof data.events === 'number' ? data.events : 1);
    
    return (
      <div className="bg-[#09090B] border border-zinc-800 p-3 rounded-lg shadow-xl font-mono text-[11px] space-y-1.5 min-w-[200px]">
        <p className="text-zinc-400 font-bold uppercase tracking-wider">{data.timestamp || data.name}</p>
        <div className="border-t border-zinc-900 pt-1.5 space-y-1">
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-500">Cognitive Health:</span>
            <span className="font-bold text-white">{scoreVal}/100</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-500">Sentiment Drift:</span>
            <span className="font-bold text-amber-400">{data.deviation || Math.max(0, 100 - scoreVal)}%</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-500">Judged Events:</span>
            <span className="font-bold text-slate-300">{eventCount}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-500">Status:</span>
            <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded ${
              statusVal === 'CRITICAL' 
                ? 'bg-rose-950/40 text-[#E24B4A]' 
                : statusVal === 'WARNING' 
                  ? 'bg-amber-950/40 text-[#EF9F27]' 
                  : 'bg-emerald-950/40 text-[#1D9E75]'
            }`}>
              {statusVal}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ObservePillar({ 
  driftEvents, 
  policies, 
  onRemediateDrift, 
  onAddDriftEvent, 
  onSetDriftEvents, 
  addToast, 
  currentUser 
}: ObservePillarProps) {
  const [selectedStandard, setSelectedStandard] = useState<string>('Ethics Guidelines v1.4 (Fairness Standard)');
  const [customPromptText, setCustomPromptText] = useState<string>('The agent must treat customer inquiries from all income tiers, postal codes, and demographic backgrounds with consistent warm, equitable, and helpful tones. Discrimination, disparate treatment, hostile, sarcastic, or condescending remarks are strictly prohibited.');
  const [customGuidelineName, setCustomGuidelineName] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [simulationRunning, setSimulationRunning] = useState<boolean>(false);

  // Guidelines library state & live agent profiles
  const [guidelinesList, setGuidelinesList] = useState<any[]>([]);
  const [activeGuideline, setActiveGuideline] = useState<any>(null);
  const [agentProfiles, setAgentProfiles] = useState<any[]>([]);
  const [trendHistory, setTrendHistory] = useState<any[]>([]);
  const [scopedDriftEvents, setScopedDriftEvents] = useState<DriftLogEvent[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestSeqRef = useRef<number>(0);
  const lastSyncedGuidelineKeyRef = useRef<string>('');

  // Auto-Refresh select interval state (default 15s)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | 'off'>(15000);

  // B1: Searchable Agent Picker State
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ALL');
  const [agentSearchTerm, setAgentSearchTerm] = useState<string>('');
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState<boolean>(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  // B3: Time Range Selector State (default 1 hour)
  const [timeRange, setTimeRange] = useState<string>('1h');

  // B4: Feed Actions State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'HEALTHY'>('ALL');
  const [feedDisplayCount, setFeedDisplayCount] = useState<number>(10);
  const [archivedEventIds, setArchivedEventIds] = useState<Set<string>>(new Set());
  const [showClearTestModal, setShowClearTestModal] = useState<boolean>(false);
  const [clearingTestEntries, setClearingTestEntries] = useState<boolean>(false);

  // Close agent dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch real telemetry and synchronise state
  const fetchRealTelemetry = async () => {
    const reqAgentId = selectedAgentId;
    const reqSeq = ++requestSeqRef.current;
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const queryParams = new URLSearchParams();
      if (reqAgentId && reqAgentId !== 'ALL') {
        queryParams.set('agent_id', reqAgentId);
      }
      if (timeRange) {
        queryParams.set('time_range', timeRange);
      }

      const res = await fetch(`/api/drift-events?${queryParams.toString()}`, { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (reqSeq !== requestSeqRef.current) return;

        if (Array.isArray(data.driftEvents)) {
          if (reqAgentId === 'ALL') {
            setScopedDriftEvents(null);
            if (onSetDriftEvents) onSetDriftEvents(data.driftEvents);
          } else {
            setScopedDriftEvents(data.driftEvents);
          }
        }
        if (Array.isArray(data.guidelines) && data.guidelines.length > 0) {
          setGuidelinesList(data.guidelines);
        }
        if (data.activeGuideline) {
          setActiveGuideline(data.activeGuideline);
          setSelectedStandard(data.activeGuideline.name);
          const syncKey = `${reqAgentId}:${data.activeGuideline.id}:${data.activeGuideline.version || ''}`;
          if (lastSyncedGuidelineKeyRef.current !== syncKey) {
            setCustomPromptText(data.activeGuideline.rawText || '');
            lastSyncedGuidelineKeyRef.current = syncKey;
          }
        }
        if (Array.isArray(data.agentProfiles)) {
          setAgentProfiles(data.agentProfiles);
        }
        if (Array.isArray(data.trendHistory)) {
          setTrendHistory(data.trendHistory);
        }
      }
    } catch (err) {
      console.warn('[ObservePillar] Real telemetry polling error:', err);
    }
  };

  useEffect(() => {
    fetchRealTelemetry();
    if (autoRefreshInterval === 'off') return;
    const intervalId = setInterval(fetchRealTelemetry, autoRefreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, selectedAgentId, timeRange, onSetDriftEvents, currentUser]);

  // Use scoped drift events when filtered by single agent so global Overview events stay intact
  const effectiveDriftEvents = useMemo(() => {
    return selectedAgentId === 'ALL' ? (driftEvents || []) : (scopedDriftEvents ?? (driftEvents || []));
  }, [selectedAgentId, driftEvents, scopedDriftEvents]);

  // B1: Fleet agents list combined with agentProfiles
  const allKnownAgents = useMemo(() => {
    const list: Array<{ id: string; name: string; score: number; status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'BASELINING' }> = [];
    const seen = new Set<string>();

    // From live agent profiles
    agentProfiles.forEach(p => {
      const idKey = String(p.agentId || '').toLowerCase();
      const nameKey = String(p.agentName || '').toLowerCase();
      if (idKey) seen.add(idKey);
      if (nameKey) seen.add(nameKey);

      const rawScore = typeof p.healthIndex === 'number'
        ? p.healthIndex
        : (typeof p.cognitiveHealthScore === 'number'
            ? p.cognitiveHealthScore
            : (typeof p.currentHealthScore === 'number' ? p.currentHealthScore : 100));
      const score = Math.round(rawScore);
      const judged = typeof p.judgedCount === 'number' ? p.judgedCount : 0;

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'BASELINING';
      if (judged === 0 && (p.status === 'NO DATA' || !p.baselineComplete)) {
        status = 'BASELINING';
      } else if (score > 85) {
        status = 'HEALTHY';
      } else if (score >= 70) {
        status = 'WARNING';
      } else {
        status = 'CRITICAL';
      }

      list.push({
        id: p.agentId,
        name: p.agentName || p.agentId,
        score,
        status
      });
    });

    // From non-test drift events if not already present (dedup by id and name)
    (driftEvents || []).forEach(e => {
      if ((e as any).isTest || (e as any).is_test || (e as any).archived) return;
      const eId = String(e.agentId || (e as any).agent_id || e.agentGroup || '').trim();
      const eName = String(e.agentGroup || eId).trim();
      if (!eId && !eName) return;
      if (seen.has(eId.toLowerCase()) || seen.has(eName.toLowerCase())) return;

      seen.add(eId.toLowerCase());
      seen.add(eName.toLowerCase());
      const score = typeof e.cognitiveHealthScore === 'number' ? Math.round(e.cognitiveHealthScore) : 100;
      const status = score > 85 ? 'HEALTHY' : score >= 70 ? 'WARNING' : 'CRITICAL';
      list.push({
        id: eId,
        name: eName,
        score,
        status
      });
    });

    return list;
  }, [agentProfiles, driftEvents]);

  // Filtered agent list for the searchable picker
  const filteredAgentsList = useMemo(() => {
    if (!agentSearchTerm.trim()) return allKnownAgents;
    const term = agentSearchTerm.toLowerCase();
    return allKnownAgents.filter(a => a.id.toLowerCase().includes(term) || a.name.toLowerCase().includes(term));
  }, [allKnownAgents, agentSearchTerm]);

  // Selected agent name display
  const selectedAgentDisplay = useMemo(() => {
    if (selectedAgentId === 'ALL') return 'All agents (fleet)';
    const found = allKnownAgents.find(a => a.id === selectedAgentId);
    return found ? `${found.name} (${found.id})` : selectedAgentId;
  }, [selectedAgentId, allKnownAgents]);

  // Selected agent profile & matching alias targets
  const selectedAgentProfile = useMemo(() => {
    if (selectedAgentId === 'ALL') return null;
    return agentProfiles.find(p => p.agentId === selectedAgentId || p.agentName === selectedAgentId) || null;
  }, [selectedAgentId, agentProfiles]);

  const selectedAgentTargets = useMemo(() => {
    const targets = new Set<string>();
    if (selectedAgentId && selectedAgentId !== 'ALL') {
      targets.add(selectedAgentId.toLowerCase());
      const matched = allKnownAgents.find(a => a.id.toLowerCase() === selectedAgentId.toLowerCase());
      if (matched?.name) targets.add(matched.name.toLowerCase());
      if (selectedAgentProfile?.agentName) targets.add(String(selectedAgentProfile.agentName).toLowerCase());
    }
    return targets;
  }, [selectedAgentId, allKnownAgents, selectedAgentProfile]);

  // Dynamic Chart Data based on trendHistory
  const chartData = useMemo(() => {
    if (trendHistory && Array.isArray(trendHistory) && trendHistory.length > 0) {
      return trendHistory;
    }
    return [];
  }, [trendHistory]);

  // B2: Guideline change handler
  const handleStandardChange = async (newStandardName: string) => {
    setSelectedStandard(newStandardName);
    const found = guidelinesList.find(g => g.name === newStandardName || g.id === newStandardName);
    if (found) {
      setCustomPromptText(found.rawText || '');
      lastSyncedGuidelineKeyRef.current = `${selectedAgentId}:${found.id}:${found.version || ''}`;
    }

    const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;
    try {
      if (selectedAgentId && selectedAgentId !== 'ALL') {
        // Assign to specific agent
        const res = await fetch('/api/drift/agents/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ agentId: selectedAgentId, guidelineId: found?.id || newStandardName })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (data.guideline) {
            setActiveGuideline(data.guideline);
            lastSyncedGuidelineKeyRef.current = `${selectedAgentId}:${data.guideline.id}:${data.guideline.version || ''}`;
          }
          if (addToast) {
            addToast({
              type: 'success',
              title: 'Guideline Assigned to Agent',
              message: `Standard "${newStandardName}" assigned specifically to ${selectedAgentId}.`
            });
          }
          fetchRealTelemetry();
        } else if (addToast) {
          addToast({
            type: 'danger',
            title: 'Assignment Failed',
            message: data.error || 'Could not assign guideline to selected agent.'
          });
        }
      } else {
        // Tenant default guideline selection
        const res = await fetch('/api/drift/guidelines', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ action: 'select', standard: newStandardName, guidelineId: found?.id })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (data.active) {
            setActiveGuideline(data.active);
            lastSyncedGuidelineKeyRef.current = `${selectedAgentId}:${data.active.id}:${data.active.version || ''}`;
          }
          if (data.guidelines) setGuidelinesList(data.guidelines);
          if (addToast) {
            addToast({
              type: 'info',
              title: 'Guideline Standard Activated',
              message: `Active compliance baseline set to "${newStandardName}".`
            });
          }
          fetchRealTelemetry();
        } else if (addToast) {
          addToast({
            type: 'danger',
            title: 'Selection Failed',
            message: data.error || 'Could not activate selected ethical guideline.'
          });
        }
      }
    } catch (e: any) {
      console.warn('[ObservePillar] Standard switch error:', e);
      if (addToast) {
        addToast({
          type: 'danger',
          title: 'Guideline Switch Error',
          message: e?.message || 'Failed to update active guideline.'
        });
      }
    }
  };

  const handleUploadGuidelines = async (textToUpload?: string, nameToUpload?: string) => {
    const text = textToUpload || customPromptText;
    const name = (nameToUpload || customGuidelineName.trim() || selectedStandard || 'Custom Ethical Standard').trim();
    if (!text || !text.trim()) {
      if (addToast) {
        addToast({
          type: 'warning',
          title: 'Guideline Specifications Required',
          message: 'Enter or upload guideline specifications before submitting.'
        });
      }
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;
    try {
      const res = await fetch('/api/drift/guidelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          standard: name, 
          name,
          specifications: text, 
          rawText: text,
          agentId: selectedAgentId !== 'ALL' ? selectedAgentId : undefined,
          applicableAgents: selectedAgentId !== 'ALL' ? [selectedAgentId] : ['*']
        })
      });

      const data = await res.json().catch(() => ({ error: `Server returned HTTP ${res.status}` }));
      setIsUploading(false);

      if (res.ok && data.success && data.active) {
        setUploadSuccess(true);
        setActiveGuideline(data.active);
        setSelectedStandard(data.active.name);
        setCustomGuidelineName('');
        setCustomPromptText(data.active.rawText || text);
        lastSyncedGuidelineKeyRef.current = `${selectedAgentId}:${data.active.id}:${data.active.version || ''}`;
        if (data.guidelines) setGuidelinesList(data.guidelines);
        if (addToast) {
          addToast({
            type: 'success',
            title: 'Guideline Rules Extracted & Activated',
            message: `Judge AI extracted ${data.active.extractedRules?.length || 0} enforceable rules for "${data.active.name}".`
          });
        }
        setTimeout(() => setUploadSuccess(false), 3000);
        fetchRealTelemetry();
      } else {
        const errorText = data.error || data.details || `Failed to complete rule extraction (HTTP ${res.status}).`;
        console.error('[ObservePillar] Guideline upload failed:', errorText);
        if (addToast) {
          addToast({
            type: 'danger',
            title: 'Upload Failed',
            message: errorText
          });
        }
      }
    } catch (e: any) {
      setIsUploading(false);
      console.warn('[ObservePillar] Guidelines upload error:', e);
      if (addToast) {
        addToast({
          type: 'danger',
          title: 'Extraction Error',
          message: e?.message || 'AI rule extraction failed.'
        });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content || content.startsWith('%PDF-') || content.includes('\u0000')) {
        if (addToast) {
          addToast({
            type: 'danger',
            title: 'Unsupported Binary File Content',
            message: 'Binary PDF/encoded files cannot be read directly in-browser. Please upload a plain-text (.txt, .md, .json) guideline or paste the extracted policy text.'
          });
        }
        return;
      }
      setCustomPromptText(content);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const docName = customGuidelineName.trim() || `${cleanName} Standard`;
      setCustomGuidelineName(docName);
      handleUploadGuidelines(content, docName);
    };
    reader.readAsText(file);
  };

  const isAuditor = currentUser?.role === 'Auditor';

  const triggerDemographicAttack = () => {
    if (isAuditor) {
      if (addToast) {
        addToast({
          type: 'danger',
          title: 'Access Prohibited',
          message: 'Read-only Auditor accounts are restricted from initiating runtime simulation mutations or injecting active logs.',
          duration: 5000
        });
      }
      return;
    }
    if (simulationRunning) return;
    setSimulationRunning(true);
    const targetAgent = selectedAgentId !== 'ALL' ? selectedAgentId : (allKnownAgents[0]?.id || 'MAIL-GOOGLE-SCRIPT');

    const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;
    fetch('/api/drift/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        agentGroup: targetAgent,
        ethicalStandard: selectedStandard,
        sampleLogs: 'Drift Simulation: Automated 15.0% shift in response sentiment toward specific low-income customer demographic tiers with aggressive tone.'
      })
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
      })
      .then(newEvent => {
        onAddDriftEvent(newEvent);
        if (selectedAgentId !== 'ALL') {
          setScopedDriftEvents(prev => prev ? [newEvent, ...prev] : [newEvent]);
        }
        setSimulationRunning(false);
        if (addToast) {
          addToast({
            type: 'warning',
            title: '⚠️ Drift Simulation Test Logged',
            message: `[TEST] Evaluated score: ${newEvent.cognitiveHealthScore}%. Tagged isTest=true (isolated from real health index).`
          });
        }
        fetchRealTelemetry();
      })
      .catch((err) => {
        setSimulationRunning(false);
        if (addToast) {
          addToast({
            type: 'danger',
            title: 'Simulation Test Failed',
            message: err?.message || 'Unable to execute drift simulation test.'
          });
        }
      });
  };

  const handleRemediateDrift = (id: string) => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;
    fetch('/api/drift/remediate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ id })
    })
      .then(async res => {
        const resData = await res.json().catch(() => ({}));
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || `HTTP ${res.status}`);
        }
        onRemediateDrift(id);
        if (selectedAgentId !== 'ALL') {
          setScopedDriftEvents(prev => prev ? prev.map(e => e.id === id ? { ...e, ...(resData.event || {}), remedatedAt: (resData.event?.remedatedAt || new Date().toISOString()) } : e) : prev);
        }
        if (addToast) {
          addToast({
            type: 'success',
            title: '🛡️ Remediation Dispatched',
            message: resData.message || `Drift event [${id}] remediation request dispatched to operations queue.`
          });
        }
        fetchRealTelemetry();
      })
      .catch(err => {
        console.warn('[ObservePillar] Remediation dispatch error:', err);
        if (addToast) {
          addToast({
            type: 'danger',
            title: 'Remediation Failed',
            message: err?.message || 'Could not dispatch remediation request.'
          });
        }
      });
  };

  // B4: Archive single feed entry
  const handleArchiveEntry = async (eventId: string) => {
    setArchivedEventIds(prev => new Set(prev).add(eventId));
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;

      const res = await fetch('/api/drift/events/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ eventId, reason: 'Archived by compliance auditor' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (addToast) {
        addToast({
          type: 'info',
          title: 'Entry Archived',
          message: `Sentinel log entry [${eventId}] hidden from UI feed while permanently preserved in Annex IV Audit Ledger.`
        });
      }
      fetchRealTelemetry();
    } catch (err: any) {
      setArchivedEventIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      console.warn('Archive entry error:', err);
      if (addToast) {
        addToast({
          type: 'danger',
          title: 'Archive Failed',
          message: err?.message || 'Unable to archive drift entry.'
        });
      }
    }
  };

  // B4: Clear all test entries with confirmation
  const handleConfirmClearTestEntries = async () => {
    setClearingTestEntries(true);
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;
      const res = await fetch('/api/drift/clear-test-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setShowClearTestModal(false);
      setClearingTestEntries(false);

      if (scopedDriftEvents) {
        setScopedDriftEvents(prev => prev ? prev.filter(e => !e.isTest && !(e as any).is_test) : prev);
      }

      if (addToast) {
        addToast({
          type: 'success',
          title: 'Test Entries Cleared',
          message: `Removed ${data.clearedCount || 0} simulation test entries. Real operational events remain intact.`
        });
      }
      fetchRealTelemetry();
    } catch (err: any) {
      setClearingTestEntries(false);
      setShowClearTestModal(false);
      console.warn('Clear test entries error:', err);
      if (addToast) {
        addToast({
          type: 'danger',
          title: 'Clear Test Entries Failed',
          message: err?.message || 'Could not clear test simulation entries.'
        });
      }
    }
  };

  // C2: Stable Feed with Repeat Merging, Filtering, Sorting and Stable Keys
  const processedFeedEvents = useMemo(() => {
    const list = (effectiveDriftEvents || []).filter(e => {
      // Filter out archived
      if ((e as any).archived || archivedEventIds.has(e.id)) return false;

      // Filter by selected agent if not ALL (match agentId, agent_id, or agentGroup/name alias)
      if (selectedAgentId !== 'ALL') {
        const candidates = [e.agentGroup, e.agentId, (e as any).agent_id, (e as any).agentName]
          .filter(Boolean)
          .map(v => String(v).toLowerCase());
        const agentMatch = candidates.some(c => selectedAgentTargets.has(c));
        if (!agentMatch) return false;
      }

      // Filter by status tab (strictly derived from score)
      const score = typeof e.cognitiveHealthScore === 'number' ? e.cognitiveHealthScore : 100;
      const derivedStatus = score > 85 ? 'HEALTHY' : score >= 70 ? 'WARNING' : 'CRITICAL';
      if (statusFilter !== 'ALL' && derivedStatus !== statusFilter) return false;

      return true;
    });

    // Sort stably by timestamp descending
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // C2: Merge repeated identical violations (same agent + rule within 30 min) preserving persisted repeatCount
    const mergedList: Array<DriftLogEvent & { repeatCount?: number; lastTimestamp?: string }> = [];
    const windowMs = 30 * 60 * 1000; // 30 minutes
    const normalizeRule = (r: any) => String(r || '').replace(/^\[+|\]+$/g, '').trim().toUpperCase();

    for (const item of list) {
      const itemTime = new Date(item.timestamp).getTime();
      const itemRule = normalizeRule((item as any).ruleViolated);
      const itemAgentKey = String(item.agentId || item.agentGroup || '').toLowerCase();
      const itemCount = typeof (item as any).repeatCount === 'number' && (item as any).repeatCount > 0 ? (item as any).repeatCount : 1;

      const existing = mergedList.find(m => {
        const mTime = new Date(m.timestamp).getTime();
        const mAgentKey = String(m.agentId || m.agentGroup || '').toLowerCase();
        const mRule = normalizeRule((m as any).ruleViolated);
        const sameAgent = mAgentKey === itemAgentKey || m.agentGroup === item.agentGroup;
        const sameRule = Boolean(mRule && itemRule && mRule === itemRule);
        const withinWindow = Math.abs(mTime - itemTime) <= windowMs;
        return sameAgent && sameRule && withinWindow;
      });

      if (existing) {
        existing.repeatCount = (existing.repeatCount || 1) + itemCount;
        if (itemTime > new Date(existing.lastTimestamp || existing.timestamp).getTime()) {
          existing.lastTimestamp = item.timestamp;
        }
      } else {
        mergedList.push({ ...item, repeatCount: itemCount, lastTimestamp: item.timestamp });
      }
    }

    return mergedList;
  }, [effectiveDriftEvents, selectedAgentId, selectedAgentTargets, statusFilter, archivedEventIds]);

  // Real timeline counts (C4)
  const timelineMetrics = useMemo(() => {
    const isSingleAgent = selectedAgentId !== 'ALL';
    const profile = isSingleAgent ? selectedAgentProfile : null;

    let judgedCount = 0;
    let isBaselining = false;
    let baselineProgress = 0;

    if (isSingleAgent) {
      judgedCount = profile?.judgedCount || 0;
      baselineProgress = Math.min(30, judgedCount);
      isBaselining = judgedCount < 30;
    } else if (agentProfiles.length > 0) {
      const activeBaselining = agentProfiles.find(p => (p.judgedCount || 0) > 0 && (p.judgedCount || 0) < 30);
      if (activeBaselining) {
        judgedCount = activeBaselining.judgedCount || 0;
        baselineProgress = Math.min(30, judgedCount);
        isBaselining = true;
      } else {
        judgedCount = agentProfiles.reduce((max, p) => Math.max(max, p.judgedCount || 0), 0);
        baselineProgress = Math.min(30, judgedCount);
        isBaselining = judgedCount < 30;
      }
    } else {
      isBaselining = true;
      baselineProgress = 0;
    }

    const unassignedRealEvents = (effectiveDriftEvents || []).filter(e => {
      if ((e as any).isTest || (e as any).is_test || (e as any).archived || archivedEventIds.has(e.id)) return false;
      if (isSingleAgent) {
        const candidates = [e.agentGroup, e.agentId, (e as any).agent_id, (e as any).agentName]
          .filter(Boolean)
          .map(v => String(v).toLowerCase());
        if (!candidates.some(c => selectedAgentTargets.has(c))) return false;
      }
      return true;
    });

    const isActionableDrift = (e: DriftLogEvent) => {
      if (e.remedatedAt) return false;
      if (typeof e.cognitiveHealthScore === 'number') {
        return e.cognitiveHealthScore <= 85;
      }
      return e.status === 'WARNING' || e.status === 'CRITICAL';
    };

    const activeDriftEvent = unassignedRealEvents.find(isActionableDrift);
    const pendingReviewCount = unassignedRealEvents.filter(isActionableDrift).length;

    return {
      isBaselining,
      baselineProgress,
      activeDriftEvent,
      pendingReviewCount,
      totalRealEvents: unassignedRealEvents.length
    };
  }, [selectedAgentId, selectedAgentProfile, selectedAgentTargets, agentProfiles, effectiveDriftEvents, archivedEventIds]);

  return (
    <div className="space-y-8 animate-fade-in text-[#F0EEE6]">
      {/* Pillar Introduction Header */}
      <div className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30 rounded-xl mt-1">
            <Activity size={26} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#1D9E75] uppercase tracking-widest bg-[#1D9E75]/10 border border-[#1D9E75]/25 px-2.2 py-0.5 rounded">
                PILLAR 2: OBSERVE
              </span>
              <span className="text-xs font-mono text-[#556070] font-bold">Google AI Studio Native Sentinel</span>
            </div>
            <h1 className="text-2xl font-display font-medium text-[#F0EEE6] mt-1.5">
              Cognitive Health & Passive Drift Auditor
            </h1>
            <p className="text-[#8B9BAA] text-sm max-w-xl mt-1">
              Continuously monitors agent reasoning logs across long-running autonomous customer bots. 
              Identifies ethical alignment drift, language bias, and neural decay compared against fairness baselines.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={triggerDemographicAttack}
            disabled={simulationRunning || isAuditor}
            className={`px-4 py-2 border font-display font-semibold text-xs rounded-lg transition shrink-0 shadow-md flex items-center gap-1.5 cursor-pointer ${
              isAuditor 
                ? 'border-zinc-800 bg-zinc-900/60 text-zinc-500 cursor-not-allowed'
                : 'border-[#1D9E75]/35 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white'
            }`}
            title={isAuditor ? "Injection locked: Auditor profile is read-only" : "Inject a mock alignment drift event"}
          >
            {simulationRunning ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Ingesting Logs...
              </>
            ) : isAuditor ? (
              <>
                <Lock size={12} className="text-zinc-500 animate-pulse" /> 15% Drift Locked
              </>
            ) : (
              <>
                <Play size={13} /> Run Drift Simulation Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* B1: Compact Searchable Agent Picker Bar */}
      <div className="p-3.5 bg-[#162030] border border-[#1F2E40] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-[#8B9BAA] font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <span className="text-[#1D9E75]">●</span> AUDIT SCOPE:
          </span>

          {/* Searchable Dropdown */}
          <div className="relative" ref={agentDropdownRef}>
            <button
              onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              className="px-3 py-1.5 bg-[#0D1B2A] border border-[#1F2E40] hover:border-[#1D9E75]/50 text-slate-200 rounded-lg flex items-center gap-2 text-xs font-mono min-w-[240px] justify-between cursor-pointer transition shadow-sm"
              id="observe-agent-picker-btn"
            >
              <div className="flex items-center gap-2 truncate">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  selectedAgentId === 'ALL'
                    ? 'bg-[#1D9E75]'
                    : allKnownAgents.find(a => a.id === selectedAgentId)?.status === 'CRITICAL'
                      ? 'bg-[#E24B4A]'
                      : allKnownAgents.find(a => a.id === selectedAgentId)?.status === 'WARNING'
                        ? 'bg-[#EF9F27]'
                        : 'bg-[#1D9E75]'
                }`} />
                <span className="truncate">{selectedAgentDisplay}</span>
              </div>
              <ChevronDown size={14} className="text-[#8B9BAA] shrink-0" />
            </button>

            {isAgentDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-80 max-h-72 bg-[#09090B] border border-zinc-800 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden">
                <div className="p-2 border-b border-zinc-900 bg-[#0D1B2A] flex items-center gap-2">
                  <Search size={14} className="text-zinc-500" />
                  <input
                    type="text"
                    value={agentSearchTerm}
                    onChange={(e) => setAgentSearchTerm(e.target.value)}
                    placeholder="Search 100+ fleet agents..."
                    className="w-full bg-transparent text-xs text-slate-200 placeholder-zinc-500 outline-none font-mono"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-56 p-1 scrollbar">
                  <button
                    onClick={() => {
                      setSelectedAgentId('ALL');
                      setIsAgentDropdownOpen(false);
                      setAgentSearchTerm('');
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs font-mono cursor-pointer transition ${
                      selectedAgentId === 'ALL' ? 'bg-[#1D9E75]/20 text-[#1D9E75]' : 'text-slate-300 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                      <span className="font-semibold">All agents (fleet)</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{allKnownAgents.length} agents</span>
                  </button>

                  <div className="border-t border-zinc-900 my-1" />

                  {filteredAgentsList.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setIsAgentDropdownOpen(false);
                        setAgentSearchTerm('');
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs font-mono cursor-pointer transition ${
                        selectedAgentId === agent.id ? 'bg-[#1D9E75]/20 text-[#1D9E75]' : 'text-slate-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          agent.status === 'CRITICAL' 
                            ? 'bg-[#E24B4A]' 
                            : agent.status === 'WARNING' 
                              ? 'bg-[#EF9F27]' 
                              : 'bg-[#1D9E75]'
                        }`} />
                        <span className="truncate">{agent.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-bold ml-2 shrink-0">{agent.score}/100</span>
                    </button>
                  ))}

                  {filteredAgentsList.length === 0 && (
                    <div className="p-3 text-center text-zinc-500 text-xs">No matching agents found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Scope Indicator */}
        <div className="flex items-center gap-3">
          <span className="text-[#8B9BAA] text-xs">
            Applies to: <span className="text-[#1D9E75] font-bold">{selectedAgentId === 'ALL' ? 'All agents' : selectedAgentId}</span>
          </span>
          {selectedAgentProfile && (() => {
            const profileScore = Math.round(
              typeof selectedAgentProfile.healthIndex === 'number'
                ? selectedAgentProfile.healthIndex
                : (typeof selectedAgentProfile.cognitiveHealthScore === 'number'
                    ? selectedAgentProfile.cognitiveHealthScore
                    : 100)
            );
            const scoreColor = profileScore > 85 ? 'text-[#1D9E75]' : profileScore >= 70 ? 'text-[#EF9F27]' : 'text-[#E24B4A]';
            return (
              <span className="px-2 py-0.5 rounded text-[10px] bg-[#0D1B2A] border border-[#1F2E40] text-slate-300">
                Judged: <strong className="text-white">{selectedAgentProfile.judgedCount || 0}</strong> | Score: <strong className={scoreColor}>{profileScore}/100</strong>
              </span>
            );
          })()}
        </div>
      </div>

      {/* Google AI Studio Observability Loop representation */}
      <CollapsibleSection
        title={
          <h2 className="text-sm font-mono font-bold text-[#8B9BAA] tracking-wider uppercase flex items-center gap-2">
            <span className="text-[#1D9E75]">●</span> GOOGLE AI STUDIO NATIVE OBSERVABILITY LOOP
          </h2>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <div className="hidden md:block absolute top-[2.2rem] left-[12%] right-[12%] h-0.5 border-t border-dashed border-[#1F2E40] z-0" />

          {/* Block 1 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-2">LOOP 01</span>
            <div className="w-10 h-10 rounded-full bg-[#162030] border border-[#1F2E40] text-[#1D9E75] flex items-center justify-center text-[10px] font-mono font-bold">
              LOGS
            </div>
            <h4 className="font-display font-semibold text-slate-200 mt-2.5 text-xs">Log Ingestion</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Google AI Studio captures reasoning logs across all bots.
            </p>
          </div>

          {/* Block 2 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-2">LOOP 02</span>
            <div className="w-10 h-10 rounded-full bg-[#162030] border border-[#1F2E40] text-[#1D9E75] flex items-center justify-center text-[10px] font-mono font-bold">
              SCORE
            </div>
            <h4 className="font-display font-semibold text-slate-200 mt-2.5 text-xs">Scoring Engine</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              AG compares outputs against fairness baselines.
            </p>
          </div>

          {/* Block 3 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-2">LOOP 03</span>
            <div className="w-10 h-10 rounded-full bg-[#162030] border border-[#1F2E40] text-[#1D9E75] flex items-center justify-center text-[10px] font-mono font-bold animate-pulse">
              DRIFT
            </div>
            <h4 className="font-display font-semibold text-slate-200 mt-2.5 text-xs">Drift Detection</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              System identifies "Cognitive Health" declines.
            </p>
          </div>

          {/* Block 4 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-2">LOOP 04</span>
            <div className="w-10 h-10 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30 flex items-center justify-center text-[10px] font-mono font-bold">
              REPORT
            </div>
            <h4 className="font-display font-semibold text-slate-200 mt-2.5 text-xs">Remediate</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Automated reports trigger weights retraining cycles.
            </p>
          </div>
        </div>

        <div className="text-right mt-4">
          <span className="text-[10px] font-mono text-[#556070]">
            *Continuous Monitoring Cycle enabled by Google AI Studio Native Integration.
          </span>
        </div>
      </CollapsibleSection>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Workbench: Baseline Guidelines Formulation */}
        <CollapsibleSection
          title="Ethical Guidelines Baseline"
          subtitle="Admin Upload: Define the 'Reasoning Standard' and Brand Neutrality benchmarks matching legal Compliance rules."
          icon={<Layers size={18} className="text-[#1D9E75]" />}
          className="lg:col-span-12 xl:col-span-5 p-6 bg-[#162030] border border-[#1F2E40] rounded-xl flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono text-[#8B9BAA] tracking-wider font-bold block">
                  Active Safety Standard Code
                </label>
                {/* B2: Small Hint Line */}
                <span className="text-[10px] font-mono text-[#1D9E75]">
                  Applies to: {selectedAgentId === 'ALL' ? 'All agents' : selectedAgentId}
                </span>
              </div>
              <select
                value={selectedStandard}
                onChange={(e) => handleStandardChange(e.target.value)}
                className="w-full text-xs font-mono bg-[#0D1B2A] border border-[#1F2E40] rounded-lg p-2.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/40"
                id="select-ethical-standard"
              >
                {guidelinesList.length > 0 ? (
                  guidelinesList.map((g) => (
                    <option key={g.id || g.name} value={g.name}>
                      {g.name} {g.version ? `(${g.version})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Ethics Guidelines v1.4 (Fairness Standard)">Ethics Guidelines v1.4 (Fairness Standard)</option>
                    <option value="Medical Triage Safe Boundaries v2">Medical Triage Safe Boundaries v2</option>
                    <option value="Neutral Outbound Marketing Tone Baseline">Neutral Outbound Marketing Tone Baseline</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#8B9BAA] tracking-wider font-bold block mb-1">
                Guideline Name
              </label>
              <input
                type="text"
                value={customGuidelineName}
                onChange={(e) => setCustomGuidelineName(e.target.value)}
                placeholder="e.g. Corporate Communication & Fairness Standard"
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/40 font-mono mb-2"
                id="guideline-name-input"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#8B9BAA] tracking-wider font-bold block mb-1">
                Compliance Guidelines Specifications
              </label>
              <textarea
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                placeholder="Paste your custom policy specifications or compliance rules here..."
                className="w-full h-36 bg-[#0D1B2A] border border-[#1F2E40] rounded-lg p-3 text-slate-350 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/40 font-mono scrollbar"
                id="ethical-prompt-textarea"
              />
            </div>

            {/* Hidden File Input for document upload */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".txt,.md,.pdf,.json" 
              className="hidden" 
            />

            {/* Upload Simulator Widget */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group border border-dashed border-[#1F2E40] hover:border-[#1D9E75]/50 bg-[#0D1B2A] rounded-lg p-5 text-center cursor-pointer transition-colors"
              id="ethical-upload-box"
            >
              <div className="flex flex-col items-center gap-1.5 text-[#8B9BAA] group-hover:text-[#1D9E75] transition-colors">
                <UploadCloud size={24} className="animate-pulse" />
                <span className="text-xs font-display font-semibold">Upload Local Guidelines Document</span>
                <span className="text-[10px] font-mono text-[#556070]">PDF, TXT or JSON format (Annex IV Standard)</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => handleUploadGuidelines()}
              disabled={isUploading || uploadSuccess}
              className={`
                w-full py-3 px-4 font-display font-medium text-xs tracking-wider uppercase rounded-lg transition shadow-md flex items-center justify-center gap-2 cursor-pointer
                ${uploadSuccess 
                  ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400'
                  : 'bg-[#1D9E75]/10 hover:bg-[#1D9E75] hover:text-[#0D1B2A] border border-[#1D9E75]/35 text-[#1D9E75]'
                }
              `}
              id="btn-upload-ethics"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Ingesting Guidelines Baseline...
                </>
              ) : uploadSuccess ? (
                <>
                  <CheckCircle2 size={14} /> Baseline Synchronized!
                </>
              ) : (
                'Upload Ethical Guidelines'
              )}
            </button>
          </div>
        </CollapsibleSection>

        {/* Right Column */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          {/* C4: Bias & Drift Compliance Timeline (Real numbers and baseline progress) */}
          <CollapsibleSection
            title="Bias & Drift Compliance Timeline"
            subtitle={`Real-time phases for ${selectedAgentId === 'ALL' ? 'Fleet' : selectedAgentId} under active standard.`}
            className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl animate-fade-in-up"
          >
            <div className="space-y-4">
              {/* Phase 1: Real Baseline Progress */}
              <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                <span className="w-5 h-5 shrink-0 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30 flex items-center justify-center font-mono text-[10px] font-bold">1</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-display font-semibold text-slate-200">Phase 1: Baseline Establishment</h4>
                    <span className="text-[10px] font-mono text-[#1D9E75] font-bold">
                      {timelineMetrics.baselineProgress}/30 events
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
                    {timelineMetrics.isBaselining
                      ? `Baseline evaluation underway for ${selectedAgentId === 'ALL' ? 'new fleet agents' : selectedAgentId}: ${timelineMetrics.baselineProgress}/30 calibration events logged under "${activeGuideline?.name || selectedStandard}".`
                      : `Active standard "${activeGuideline?.name || selectedStandard}". Baseline established (${timelineMetrics.baselineProgress}/30 calibration events completed).`}
                  </p>
                </div>
              </div>

              {/* Phase 2: Real Drift Detection State */}
              <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                <span className="w-5 h-5 shrink-0 rounded-full bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/30 flex items-center justify-center font-mono text-[10px] font-bold">2</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-display font-semibold text-slate-200">Phase 2: Drift Detection</h4>
                    <span className={`text-[10px] font-mono font-bold ${timelineMetrics.activeDriftEvent ? 'text-[#EF9F27]' : 'text-[#1D9E75]'}`}>
                      {timelineMetrics.activeDriftEvent ? 'DRIFT DETECTED' : 'ALIGNMENT OPTIMAL'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
                    {timelineMetrics.activeDriftEvent
                      ? `Active alignment drift flagged: ${timelineMetrics.activeDriftEvent.sentimentShiftPct}% shift recorded for ${timelineMetrics.activeDriftEvent.agentGroup}. Reason: ${(timelineMetrics.activeDriftEvent as any).ruleViolated || 'Behavioral divergence'}.`
                      : `Continuous passive monitoring active under "${activeGuideline?.name || selectedStandard}". No active alignment drift breaches recorded.`}
                  </p>
                </div>
              </div>

              {/* Phase 3: Real Human Review Count */}
              <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                  timelineMetrics.pendingReviewCount > 0 
                    ? 'bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/30 animate-pulse'
                    : 'bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30'
                }`}>3</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-display font-semibold text-slate-200">Phase 3: Human Review</h4>
                    <span className={`text-[10px] font-mono font-bold ${timelineMetrics.pendingReviewCount > 0 ? 'text-[#E24B4A]' : 'text-[#1D9E75]'}`}>
                      {timelineMetrics.pendingReviewCount} PENDING
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 leading-snug ${timelineMetrics.pendingReviewCount > 0 ? 'text-red-200' : 'text-[#8B9BAA]'}`}>
                    {timelineMetrics.pendingReviewCount > 0
                      ? `Compliance Auditor review pending for ${timelineMetrics.pendingReviewCount} un-remediated drift event(s). Review quotes below to trigger model retraining.`
                      : `All interactions verified compliant under "${activeGuideline?.name || selectedStandard}". Zero pending remediation tickets.`}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* B3 & C1: Cognitive Health Index Deviation Tracker with Rolling Average & Time Range */}
          <CollapsibleSection
            title="Cognitive Health Index Deviation Tracker"
            headerExtra={
              <div className="flex items-center gap-2 mr-2">
                {/* B3: Time Range Dropdown */}
                <div className="flex items-center gap-1.5 bg-[#0D1B2A] px-2 py-1 border border-[#1F2E40] rounded">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Range</span>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="bg-transparent border-none text-[10px] text-slate-200 font-mono font-bold focus:outline-none cursor-pointer outline-none"
                    id="observe-time-range-select"
                  >
                    <option value="30m" className="bg-[#0D1B2A] text-slate-200">Last 30 min</option>
                    <option value="1h" className="bg-[#0D1B2A] text-slate-200">1 hour</option>
                    <option value="24h" className="bg-[#0D1B2A] text-slate-200">24 hours</option>
                    <option value="7d" className="bg-[#0D1B2A] text-slate-200">7 days</option>
                    <option value="30d" className="bg-[#0D1B2A] text-slate-200">30 days</option>
                  </select>
                </div>

                {/* Auto-Interval Selector */}
                <div className="flex items-center gap-1.5 bg-[#0D1B2A] px-2 py-1 border border-[#1F2E40] rounded">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Poll</span>
                  <select
                    value={autoRefreshInterval}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = val === 'off' ? 'off' : Number(val);
                      setAutoRefreshInterval(parsed);
                    }}
                    className="bg-transparent border-none text-[10px] text-[#1D9E75] font-mono font-bold focus:outline-none cursor-pointer outline-none"
                    id="observe-refresh-interval-select"
                  >
                    <option value="off" className="bg-[#0D1B2A] text-zinc-400">Off</option>
                    <option value="15000" className="bg-[#0D1B2A] text-[#1D9E75]">15s</option>
                    <option value="30000" className="bg-[#0D1B2A] text-[#1D9E75]">30s</option>
                    <option value="60000" className="bg-[#0D1B2A] text-[#1D9E75]">1m</option>
                  </select>
                </div>

                <span className="text-[10px] font-mono text-[#8B9BAA] bg-[#0D1B2A] uppercase px-2 py-1 border border-[#1F2E40] rounded hidden sm:inline-block">
                  Rolling 20-Avg
                </span>
              </div>
            }
            className="p-6 bg-[#162030] rounded-xl border border-[#1F2E40] space-y-4"
          >
            <div className="w-full h-52 bg-[#0D1B2A] rounded-lg border border-[#1F2E40] p-4 flex flex-col justify-between">
              {chartData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[#8B9BAA] font-mono text-xs">
                  <Activity size={24} className="mb-2 text-[#556070]" />
                  <span>No trend history recorded for {selectedAgentDisplay} in {timeRange} window.</span>
                  <span className="text-[10px] text-zinc-600 mt-1">Telemetry will plot once judged interactions are ingested.</span>
                </div>
              ) : (
                <div className="w-full flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2E40" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#556070" 
                        fontSize={10} 
                        fontFamily="JetBrains Mono, monospace" 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        stroke="#556070" 
                        fontSize={10} 
                        fontFamily="JetBrains Mono, monospace" 
                        tickLine={false}
                        axisLine={false}
                        tickCount={6}
                      />
                      <Tooltip content={<MetricTooltip />} cursor={{ stroke: '#1F2E40', strokeWidth: 1 }} />
                      <ReferenceLine 
                        y={70} 
                        stroke="#E24B4A" 
                        strokeDasharray="4 4" 
                        strokeWidth={1}
                      />
                      <ReferenceLine 
                        y={85} 
                        stroke="#EF9F27" 
                        strokeDasharray="4 4" 
                        strokeWidth={1}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#1D9E75" 
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload, index } = props;
                          if (cx == null || cy == null || !payload) {
                            return <g key={`dot-empty-${index}`} />;
                          }
                          const isCurrent = payload.name === 'Current' || payload.isCurrent;
                          let fillVal = '#1D9E75';
                          if (payload.score < 70) fillVal = '#E24B4A';
                          else if (payload.score <= 85) fillVal = '#EF9F27';

                          return (
                            <circle 
                              key={`dot-${index}-${payload.name || payload.timestamp}`}
                              cx={cx} 
                              cy={cy} 
                              r={isCurrent ? 5 : 4} 
                              fill="#0D1B2A" 
                              stroke={fillVal} 
                              strokeWidth={isCurrent ? 3 : 2} 
                            />
                          );
                        }}
                        activeDot={{ r: 6, fill: '#1D9E75', stroke: '#ffffff', strokeWidth: 1.5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4 pt-1 text-xs font-mono justify-center">
              <span className="flex items-center gap-1.5 text-[#8B9BAA]">
                <span className="w-2.5 h-2.5 bg-[#1D9E75] rounded-sm" /> Healthy Baseline (Y &gt; 85)
              </span>
              <span className="flex items-center gap-1.5 text-[#8B9BAA]">
                <span className="w-2.5 h-2.5 bg-[#EF9F27] rounded-sm" /> Warning Deviation (70 - 85)
              </span>
              <span className="flex items-center gap-1.5 text-[#8B9BAA]">
                <span className="w-2.5 h-2.5 bg-[#E24B4A] rounded-sm" /> Critical Drift Block (Y &lt; 70)
              </span>
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* B4 & C2: Google AI Studio Reasoning Sentinels Logs Feed */}
      <CollapsibleSection
        title="Google AI Studio Reasoning Sentinels Logs Feed"
        subtitle="Captures linguistic anomalies across custom bots"
        headerExtra={
          <div className="flex flex-wrap items-center gap-2 mr-2">
            {/* Status Filter */}
            <div className="flex items-center bg-[#0D1B2A] border border-[#1F2E40] rounded p-0.5 text-[10px] font-mono">
              {(['ALL', 'CRITICAL', 'WARNING', 'HEALTHY'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition ${
                    statusFilter === tab 
                      ? 'bg-[#1D9E75] text-[#0D1B2A] font-bold' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Clear All Test Entries Button */}
            <button
              onClick={() => setShowClearTestModal(true)}
              className="px-2.5 py-1 bg-[#0D1B2A] hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-[#1F2E40] hover:border-rose-800/40 text-[10px] font-mono rounded flex items-center gap-1 cursor-pointer transition"
              title="Remove simulation test entries while preserving real events"
            >
              <Trash2 size={11} /> Clear Test Entries
            </button>
          </div>
        }
        className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl"
      >
        {processedFeedEvents.length === 0 ? (
          <div className="p-8 rounded-lg bg-[#0D1B2A] border border-dashed border-[#1F2E40] text-center space-y-3" id="observe-empty-state">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#162030] border border-[#1F2E40] flex items-center justify-center text-[#556070]">
              <Activity size={22} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-display font-semibold text-slate-300">No drift/bias events matching current scope</h4>
              <p className="text-xs font-mono text-[#8B9BAA] max-w-md mx-auto leading-relaxed">
                Cognitive health and demographic sentiment monitoring is active. Telemetry will automatically appear here once agents process live traffic or when an audit scan is triggered.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {processedFeedEvents.slice(0, feedDisplayCount).map((event) => {
              // C3: Status badges derive strictly from score
              const score = typeof event.cognitiveHealthScore === 'number' ? event.cognitiveHealthScore : 100;
              const derivedStatus = score > 85 ? 'HEALTHY' : score >= 70 ? 'WARNING' : 'CRITICAL';
              const isCritical = derivedStatus === 'CRITICAL';
              const isWarning = derivedStatus === 'WARNING';

              return (
                <div 
                  key={event.id}
                  className={`p-4 rounded-lg bg-[#0D1B2A] border transition-all ${
                    isCritical 
                      ? 'border-[#E24B4A]/50 bg-[#E24B4A]/5' 
                      : isWarning
                        ? 'border-[#EF9F27]/30 bg-[#EF9F27]/5'
                        : 'border-[#1F2E40]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-[#162030] text-[#8B9BAA] border border-[#1F2E40] font-bold rounded flex items-center gap-1.5">
                        {event.isTest && (
                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[8.5px] font-bold">
                            TEST
                          </span>
                        )}
                        {event.id}
                      </span>
                      <div>
                        <span className="font-display font-semibold text-slate-200 text-sm block">
                          {event.agentGroup}
                        </span>
                        <span className="text-[10px] text-[#556070] font-mono block">
                          Audited under: {event.ethicalStandard}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      {/* Repeat Count Badge */}
                      {(event.repeatCount && event.repeatCount > 1) && (
                        <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold">
                          {event.repeatCount}× within 30m
                        </span>
                      )}

                      <div className="text-right">
                        <span className="text-[#556070] block text-[9.5px]">
                          {(event as any).ruleViolated ? 'RULE VIOLATION' : 'DRIFT SHIFT'}
                        </span>
                        <span className={`font-bold block ${
                          isCritical ? 'text-[#E24B4A]' : isWarning ? 'text-[#EF9F27]' : 'text-[#1D9E75]'
                        }`}>
                          {(event as any).ruleViolated ? String((event as any).ruleViolated).replace(/^\[+|\]+$/g, '') : `${event.sentimentShiftPct}% Shift`}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[#556070] block text-[9.5px]">COGNITIVE HEALTH</span>
                        <span className="font-bold text-slate-200 block">
                          {event.cognitiveHealthScore}/100
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded ${
                        isCritical 
                          ? 'bg-[#E24B4A]/10 text-[#E24B4A] border-[#E24B4A]/30 animate-pulse' 
                          : isWarning 
                            ? 'bg-[#EF9F27]/10 text-[#EF9F27] border-[#EF9F27]/30' 
                            : 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30'
                      }`}>
                        {derivedStatus}
                      </span>
                    </div>
                  </div>

                  {/* Logs & Evidence Quote */}
                  <div className="p-3 bg-[#162030]/80 border border-[#1F2E40] rounded font-mono text-[11px] text-[#8B9BAA] leading-relaxed mb-3 space-y-1.5">
                    <div>{event.logsDetails}</div>
                    {(event as any).evidenceQuote && (
                      <div className="p-2 bg-[#0D1B2A] border-l-2 border-[#E24B4A] text-slate-300 text-[10.5px] italic rounded-r">
                        "{(event as any).evidenceQuote}"
                      </div>
                    )}
                  </div>

                  {/* Footer details: timestamp, judge model, actions */}
                  <div className="flex flex-wrap items-center justify-between font-mono text-[11px] gap-2">
                    <div className="flex items-center gap-3 text-[#556070]">
                      <span>
                        Logged: {new Date(event.timestamp).toLocaleDateString()} at {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      {((event as any).judge_model || (event as any).judgeModel) && (
                        <span className="px-1.5 py-0.5 rounded bg-[#162030] text-[#1D9E75] text-[9.5px]">
                          Judge: {(event as any).judge_model || (event as any).judgeModel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* B4: Archive Button */}
                      <button
                        onClick={() => handleArchiveEntry(event.id)}
                        className="px-2.5 py-1 bg-[#162030] hover:bg-zinc-800 text-zinc-400 hover:text-white border border-[#1F2E40] text-xs rounded transition flex items-center gap-1 cursor-pointer"
                        title="Archive and hide entry from feed (retains in audit ledger)"
                      >
                        <Archive size={11} /> Archive
                      </button>

                      {/* Remediation Button */}
                      {event.remedatedAt ? (
                        <span className="text-[#1D9E75] font-semibold flex items-center gap-1 text-xs">
                          <CheckCircle size={12} /> {event.remediationNotes ? event.remediationNotes : `Remediation Dispatched (${new Date(event.remedatedAt).toLocaleTimeString([], { hour12: false })})`}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRemediateDrift(event.id)}
                          className="px-3 py-1 bg-[#1D9E75]/10 hover:bg-[#1D9E75] hover:text-[#0D1B2A] text-[#1D9E75] border border-[#1D9E75]/30 text-xs rounded font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw size={12} /> Dispatch Remediation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {processedFeedEvents.length > feedDisplayCount && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setFeedDisplayCount(prev => prev + 10)}
                  className="px-4 py-1.5 bg-[#0D1B2A] hover:bg-[#162030] border border-[#1F2E40] text-slate-300 font-mono text-xs rounded-lg transition cursor-pointer"
                >
                  Load More ({processedFeedEvents.length - feedDisplayCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Confirmation Modal: Clear Test Entries */}
      {showClearTestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#162030] border border-[#1F2E40] rounded-xl max-w-md w-full p-6 shadow-2xl font-mono text-xs space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle size={24} />
              <h3 className="text-sm font-display font-bold text-white">Clear Test Simulation Entries</h3>
            </div>
            <p className="text-[#8B9BAA] leading-relaxed">
              This action will remove all simulated test entries (<span className="text-amber-300 font-bold">isTest: true</span>) from the active drift list. Real production events and the immutable Annex IV audit ledger will not be modified.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearTestModal(false)}
                disabled={clearingTestEntries}
                className="px-3 py-1.5 bg-[#0D1B2A] border border-[#1F2E40] hover:bg-zinc-800 text-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearTestEntries}
                disabled={clearingTestEntries}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded cursor-pointer flex items-center gap-1.5"
              >
                {clearingTestEntries ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
