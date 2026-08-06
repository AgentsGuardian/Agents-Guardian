/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Activity, UploadCloud, Play, RefreshCw, Layers, CheckCircle, CheckCircle2, Lock } from 'lucide-react';
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
  addToast?: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
  currentUser?: AdminUser;
}

// Custom Tooltip for recharts
const MetricTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#09090B] border border-zinc-800 p-3 rounded-lg shadow-xl font-mono text-[11px] space-y-1.5 min-w-[180px]">
        <p className="text-zinc-400 font-bold uppercase tracking-wider">{data.name}</p>
        <div className="border-t border-zinc-900 pt-1.5 space-y-1">
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-500">Cognitive Health:</span>
            <span className="font-bold text-white">{data.score}/100</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-500">Sentiment Drift:</span>
            <span className="font-bold text-amber-400">{data.deviation}%</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-500">Status:</span>
            <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded ${
              data.score < 75 
                ? 'bg-rose-950/40 text-[#E24B4A]' 
                : data.score < 90 
                  ? 'bg-amber-950/40 text-[#EF9F27]' 
                  : 'bg-emerald-950/40 text-[#1D9E75]'
            }`}>
              {data.status}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ObservePillar({ driftEvents, policies, onRemediateDrift, onAddDriftEvent, addToast, currentUser }: ObservePillarProps) {
  const [selectedStandard, setSelectedStandard] = useState<string>('Ethics Guidelines v1.4 (Fairness Standard)');
  const [customPromptText, setCustomPromptText] = useState<string>('The agent must treat customer inquiries from all income tiers and metropolitan zones with consistent warm, passive-helpful tones, following direct brand sentiment alignment regulations.');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [simulationRunning, setSimulationRunning] = useState<boolean>(false);

  // Auto-Refresh select interval state
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | 'off'>(30000);

  // Auto-Refresh cognitive sentinel health log simulator
  useEffect(() => {
    if (autoRefreshInterval === 'off') return;

    const intervalId = setInterval(() => {
      // Pick random parameters
      const agentGroups = ['Finance-Planner-CrewAI', 'Customer-Relations-Bot', 'Llama-Support-Cluster', 'Risk-Assessor-DeepSeek'];
      const matchingStandards = [
        'Ethics Guidelines v1.4 (Fairness Standard)',
        'Brand Tone Alignment standard v3',
        'Legal Regulatory Compliance directive v4.2'
      ];
      
      const randomGroup = agentGroups[Math.floor(Math.random() * agentGroups.length)];
      const randomStandard = matchingStandards[Math.floor(Math.random() * matchingStandards.length)];
      
      // Usually healthy score (e.g. 94-99) or occasionally a tiny drift warning
      const isHealthy = Math.random() > 0.15; 
      const score = isHealthy ? Math.floor(Math.random() * 6) + 94 : Math.floor(Math.random() * 8) + 80;
      const deviation = isHealthy ? (Math.random() * 3 + 1).toFixed(1) : (Math.random() * 7 + 10).toFixed(1);
      const status = score < 85 ? 'WARNING' : 'NORMAL';

      const draftId = `DFT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const newEvent: DriftLogEvent = {
        id: draftId,
        timestamp: new Date().toISOString(),
        agentGroup: randomGroup,
        ethicalStandard: randomStandard,
        sentimentShiftPct: Number(deviation),
        cognitiveHealthScore: score,
        status: status as 'NORMAL' | 'WARNING' | 'CRITICAL',
        logsDetails: isHealthy 
          ? `Linguistic scan completes nominally. Bot reasoning remains closely aligned to ${randomStandard} with a healthy score of ${score}/100.`
          : `Mild drift detected: Sentinel discovers a minor ${deviation}% shift away from neutral, patient agent tone guidelines. Registered under ${randomStandard}.`
      };

      onAddDriftEvent(newEvent);
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, onAddDriftEvent]);

  // Generate historical chart data dynamically based on the current drift events state!
  const chartData = useMemo(() => {
    // Start with a stable baseline representation
    const baseline = [
      { name: 'Day 1', score: 98, deviation: 2, status: 'Healthy stable state' },
      { name: 'Day 15', score: 95, deviation: 4, status: 'Healthy stable state' },
      { name: 'Day 30', score: 91, deviation: 7, status: 'Healthy stable state' },
      { name: 'Day 45', score: 85, deviation: 12, status: 'Warning deviation' },
    ];

    // Analyze the drift events from props to determine Day 60 and Current status!
    const activeWarnings = driftEvents.filter(e => !e.remedatedAt && e.status === 'WARNING');
    const activeCriticals = driftEvents.filter(e => !e.remedatedAt && e.status === 'CRITICAL');
    
    // Day 60 is when the drift became critical/visible
    const day60Score = activeCriticals.length > 0 ? 68 : activeWarnings.length > 0 ? 82 : 92;
    const day60Deviation = activeCriticals.length > 0 ? 21.8 : activeWarnings.length > 0 ? 15.4 : 5.8;

    // Calculate dynamic Current score based on unremediated events
    const unremediatedEvents = driftEvents.filter(e => !e.remedatedAt);
    let currentScore = 96; // Fully remediated/healthy by default
    let currentDeviation = 2.4;

    if (unremediatedEvents.length > 0) {
      // Degraded cognitive health based on current worst status
      const minScore = Math.min(...unremediatedEvents.map(e => e.cognitiveHealthScore));
      const maxShift = Math.max(...unremediatedEvents.map(e => e.sentimentShiftPct));
      currentScore = minScore;
      currentDeviation = maxShift;
    }

    return [
      ...baseline,
      { 
        name: 'Day 60', 
        score: day60Score, 
        deviation: day60Deviation, 
        status: day60Score < 75 ? 'Critical Drift Block' : 'Warning Deviation' 
      },
      { 
        name: 'Current', 
        score: currentScore, 
        deviation: currentDeviation, 
        status: unremediatedEvents.length > 0 
          ? (currentScore < 75 ? 'Critical Drift Block' : 'Warning Deviation') 
          : 'Fully Remediated' 
      }
    ];
  }, [driftEvents]);

  const handleUploadGuidelines = () => {
    setIsUploading(true);
    setUploadSuccess(false);
    if (addToast) {
      addToast({
        type: 'info',
        title: 'Uploading Alignment Guidelines',
        message: `Injecting corporate compliance template: "${selectedStandard}" into the automated evaluator...`
      });
    }
    setTimeout(() => {
      setIsUploading(false);
      setUploadSuccess(true);
      if (addToast) {
        addToast({
          type: 'success',
          title: 'System Standards Re-Aligned',
          message: 'Lighthouse Cognitive Evaluator has synchronized with the new guidelines safely.'
        });
      }
      setTimeout(() => setUploadSuccess(false), 3000);
    }, 1500);
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
    
    fetch('/api/drift/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentGroup: 'Loan-Application-Bots',
        ethicalStandard: selectedStandard,
        sampleLogs: 'Drift Simulation: 60 days in, Google AI Studio Native Sentinel detects an automated 15.0% shift in response sentiment toward specific low-income customer demographic tiers with aggressive tone.'
      })
    })
      .then(res => res.json())
      .then(newEvent => {
        onAddDriftEvent(newEvent);
        setSimulationRunning(false);
        if (addToast) {
          addToast({
            type: 'warning',
            title: '⚠️ Cognitive Drift Detected by Backend',
            message: `Evaluated score: ${newEvent.cognitiveHealthScore}%. Sentiment shift: ${newEvent.sentimentShiftPct}%. Logged in backend DB.`
          });
        }
      })
      .catch(() => {
        setSimulationRunning(false);
      });
  };

  const handleRemediateDrift = (id: string) => {
    fetch('/api/drift/remediate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
      .then(res => res.json())
      .then(resData => {
        if (resData.success) {
          onRemediateDrift(id);
          if (addToast) {
            addToast({
              type: 'success',
              title: '🛡️ Compliance Vectors Injected',
              message: `Drift event [${id}] remediated on backend. Agent alignment restored.`
            });
          }
        }
      });
  };

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

      {/* Google AI Studio Observability Loop representation */}
      <CollapsibleSection
        title={
          <h2 className="text-sm font-mono font-bold text-[#8B9BAA] tracking-wider uppercase flex items-center gap-2">
            <span className="text-[#1D9E75]">●</span> GOOGLE AI STUDIO NATIVE OBSERVABILITY LOOP
          </h2>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Dash line connector for desktop */}
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
                <label className="text-[10px] font-mono text-[#8B9BAA] tracking-wider font-bold block mb-1">
                  Active Safety Standard Code
                </label>
                <select
                  value={selectedStandard}
                  onChange={(e) => setSelectedStandard(e.target.value)}
                  className="w-full text-xs font-mono bg-[#0D1B2A] border border-[#1F2E40] rounded-lg p-2.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/40"
                  id="select-ethical-standard"
                >
                  <option value="Ethics Guidelines v1.4 (Fairness Standard)">Ethics Guidelines v1.4 (Fairness Standard)</option>
                  <option value="Medical Triage Safe Boundaries v2">Medical Triage Safe Boundaries v2</option>
                  <option value="Neutral Outbound Marketing Tone Baseline">Neutral Outbound Marketing Tone Baseline</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#8B9BAA] tracking-wider font-bold block mb-1">
                  Compliance Guidelines Specifications
                </label>
                <textarea
                  value={customPromptText}
                  onChange={(e) => setCustomPromptText(e.target.value)}
                  className="w-full h-36 bg-[#0D1B2A] border border-[#1F2E40] rounded-lg p-3 text-slate-350 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/40 font-mono scrollbar"
                  id="ethical-prompt-textarea"
                />
              </div>

              {/* Upload Simulator Widget */}
              <div 
                onClick={handleUploadGuidelines}
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
              onClick={handleUploadGuidelines}
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
          {/* Bias & Drift Compliance Journey */}
          <CollapsibleSection
            title="Bias & Drift Compliance Timeline"
            subtitle="Historical phases of demographic drift detection and human intervention."
            className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl animate-fade-in-up"
          >
            <div className="space-y-4">
              {/* Phase 1 */}
              <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                <span className="w-5 h-5 shrink-0 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30 flex items-center justify-center font-mono text-[10px] font-bold">1</span>
                <div>
                  <h4 className="text-xs font-display font-semibold text-slate-200">Phase 1: Baseline Establishment</h4>
                  <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
                    Compliance Officer uploads ethical guidelines. AG sets the "Reasoning Standard" for all customer service bots.
                  </p>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                <span className="w-5 h-5 shrink-0 rounded-full bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/30 flex items-center justify-center font-mono text-[10px] font-bold">2</span>
                <div>
                  <h4 className="text-xs font-display font-semibold text-slate-200">Phase 2: Drift Detection</h4>
                  <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
                    60 days in: System detects a **15% shift** in agent response sentiment toward a specific customer demographic.
                  </p>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                <span className="w-5 h-5 shrink-0 rounded-full bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/30 flex items-center justify-center font-mono text-[10px] font-bold animate-pulse">3</span>
                <div>
                  <h4 className="text-xs font-display font-semibold text-slate-200">Phase 3: Human Review</h4>
                  <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug font-normal text-red-200">
                    Compliance Officer receives a "Cognitive Health Warning." Reviews logs, adjusts policy, and system validates compliance.
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Recharts Cognitive Health Chart Visual */}
          <CollapsibleSection
            title="Cognitive Health Index Deviation Tracker"
            headerExtra={
              <div className="flex items-center gap-2 mr-2">
                <div className="flex items-center gap-2 bg-[#0D1B2A] px-2 py-1 border border-[#1F2E40] rounded">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Auto-Interval</span>
                  <select
                    value={autoRefreshInterval}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = val === 'off' ? 'off' : Number(val);
                      setAutoRefreshInterval(parsed);
                      if (addToast) {
                        addToast({
                          type: parsed === 'off' ? 'warning' : 'success',
                          title: parsed === 'off' ? 'Tracking Suspended' : 'Tracking Interval Updated',
                          message: parsed === 'off'
                            ? 'Cognitive Health automatic background tracking has been turned off.'
                            : `Cognitive Health auto-evaluation cycle set to run every ${parsed / 1000} seconds.`
                        });
                      }
                    }}
                    className="bg-transparent border-none text-[10px] text-[#1D9E75] font-mono font-bold focus:outline-none cursor-pointer outline-none"
                    id="observe-refresh-interval-select"
                  >
                    <option value="off" className="bg-[#0D1B2A] text-zinc-400">Off</option>
                    <option value="30000" className="bg-[#0D1B2A] text-[#1D9E75]">30s</option>
                    <option value="60000" className="bg-[#0D1B2A] text-[#1D9E75]">1m</option>
                  </select>
                </div>

                <span className="text-[10px] font-mono text-[#8B9BAA] bg-[#0D1B2A] uppercase px-2 py-1 border border-[#1F2E40] rounded">
                  Interactive Trend
                </span>
              </div>
            }
            className="p-6 bg-[#162030] rounded-xl border border-[#1F2E40] space-y-4"
          >
            <div className="w-full h-52 bg-[#0D1B2A] rounded-lg border border-[#1F2E40] p-4 flex flex-col justify-between">
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
                      domain={[50, 100]} 
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
                        const { cx, cy, payload } = props;
                        const isCurrent = payload.name === 'Current';
                        let fillVal = '#1D9E75';
                        if (payload.score < 75) fillVal = '#E24B4A';
                        else if (payload.score < 90) fillVal = '#EF9F27';

                        return (
                          <circle 
                            key={`dot-${payload.name}`}
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

      {/* Google AI Studio Drift logs and Remediate triggers list */}
      <CollapsibleSection
        title="Google AI Studio Reasoning Sentinels Logs Feed"
        subtitle="Captures linguistic anomalies across custom bots"
        className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl"
      >

        <div className="space-y-4">
          {driftEvents.map((event) => (
            <div 
              key={event.id}
              className={`p-4 rounded-lg bg-[#0D1B2A] border transition-all ${event.status === 'CRITICAL' ? 'border-[#E24B4A]/50 bg-[#E24B4A]/5' : 'border-[#1F2E40]'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-[#162030] text-[#8B9BAA] border border-[#1F2E40] font-bold rounded">
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
                  <div className="text-right">
                    <span className="text-[#556070] block text-[9.5px]">SENTIMENT DRIFT</span>
                    <span className={`font-bold block ${event.status === 'CRITICAL' ? 'text-[#E24B4A]' : event.status === 'WARNING' ? 'text-[#EF9F27]' : 'text-[#1D9E75]'}`}>
                      {event.sentimentShiftPct}% Shift
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[#556070] block text-[9.5px]">COGNITIVE HEALTH</span>
                    <span className="font-bold text-slate-200 block">
                      {event.cognitiveHealthScore}/100
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded ${
                    event.status === 'CRITICAL' 
                      ? 'bg-[#E24B4A]/10 text-[#E24B4A] border-[#E24B4A]/30 animate-pulse' 
                      : event.status === 'WARNING' 
                        ? 'bg-[#EF9F27]/10 text-[#EF9F27] border-[#EF9F27]/30' 
                        : 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#162030]/80 border border-[#1F2E40] rounded font-mono text-[11px] text-[#8B9BAA] leading-relaxed mb-3">
                {event.logsDetails}
              </div>

              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[#556070]">
                  Logged: {new Date(event.timestamp).toLocaleDateString()} at {new Date(event.timestamp).toLocaleTimeString()}
                </span>

                {event.remedatedAt ? (
                  <span className="text-[#1D9E75] font-semibold flex items-center gap-1">
                    <CheckCircle size={12} /> Model Retrained ({new Date(event.remedatedAt).toLocaleTimeString([], { hour12: false })})
                  </span>
                ) : (
                  <button
                    onClick={() => handleRemediateDrift(event.id)}
                    className="px-3 py-1 bg-[#1D9E75]/10 hover:bg-[#1D9E75] hover:text-[#0D1B2A] text-[#1D9E75] border border-[#1D9E75]/30 text-xs rounded font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={12} /> Dispatch Remediation (Trigger Model Retraining)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
