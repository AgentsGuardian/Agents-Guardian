/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Play, Terminal, RefreshCw, CheckCircle2 } from 'lucide-react';
import { KillSignalEvent, Policy } from '../types';
import { SIMULATION_TRIGGER_TEMPLATES, TaskTrigger } from '../data';
import CollapsibleSection from './CollapsibleSection';

interface SecurePillarProps {
  killEvents: KillSignalEvent[];
  policies: Policy[];
  onTriggerKillEvent: (newEvent: KillSignalEvent) => void;
  onClearLogs: () => void;
}

export default function SecurePillar({ killEvents, policies, onTriggerKillEvent, onClearLogs }: SecurePillarProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTrigger>(SIMULATION_TRIGGER_TEMPLATES[0]);
  const [customJson, setCustomJson] = useState<string>(selectedTemplate.rawJson);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [currentLatency, setCurrentLatency] = useState<number>(0);
  const [simLogResult, setSimLogResult] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Sync state if template changes
  const handleTemplateSelect = (tmpl: TaskTrigger) => {
    setSelectedTemplate(tmpl);
    setCustomJson(tmpl.rawJson);
    setSimulationStep(0);
    setSimLogResult('');
  };

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationStep(1); // AGENT ACTION
    setSimLogResult('Initializing Agent process inside sandboxed zone...');
    
    // Step-by-step execution timeline:
    // Step 1: AGENT ACTION (0-850ms)
    // Step 2: AG INTERCEPT (850-1700ms)
    // Step 3: EVALUATE (1700-2800ms)
    // Step 4: KILL SIGNAL / PROTOCOL HALT (2100ms+)

    setTimeout(() => {
      setSimulationStep(2); // AG INTERCEPT
      setSimLogResult(prev => prev + '\n[Google AI Studio Gateway] API Intercept: Intercepting Action Fabric CLI command packet...');
    }, 850);

    setTimeout(() => {
      setSimulationStep(3); // EVALUATE
      setSimLogResult(prev => prev + '\n[Policy Engine] Evaluating Policy-As-Code limits matching "Non-Human Identity" blast radius...');
    }, 1700);

    setTimeout(() => {
      setSimulationStep(4); // KILL SIGNAL
      const finalLatency = Math.floor(Math.random() * 30) + 35; // 35 - 65 ms
      setCurrentLatency(finalLatency);
      
      const newEventId = `KG-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const matchingPolicy = policies.find(p => p.category === 'security' && p.enabled) || policies[0];
      const annexIVHash = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${newEventId}-ANNEX-IV`;

      const simulatedEvent: KillSignalEvent = {
        id: newEventId,
        timestamp: new Date().toISOString(),
        agentName: selectedTemplate.agentName,
        actionCommand: selectedTemplate.name,
        interceptedPacket: selectedTemplate.actionType,
        policyViolated: `${matchingPolicy.code} (${matchingPolicy.name})`,
        latencyMs: finalLatency,
        status: 'HALTED',
        rawJsonIntent: customJson,
        timestampAnnexV: annexIVHash
      };

      onTriggerKillEvent(simulatedEvent);
      setIsSimulating(false);
      setSimulationStep(4);
      setSimLogResult(prev => prev + `\n\n🛑 [PROTOCOL HALT INITIATED] \nLatency speed: ${finalLatency}ms (SLA <100ms target passed)\nSecurity Review Required Flag dispatched to Enterprise IT Compliance Gateway.\nImmutable Annex IV Ledger entry generated: ${annexIVHash}`);
    }, 2800);
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#F0EEE6]">
      {/* Pillar Introduction Banner */}
      <div className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/30 rounded-xl mt-1 animate-pulse">
            <Shield size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#E24B4A] uppercase tracking-widest bg-[#E24B4A]/10 border border-[#E24B4A]/25 px-2.2 py-0.5 rounded">
                PILLAR 1: SECURE
              </span>
              <span className="text-xs font-mono text-[#556070] font-bold">2026 ANNEX IV</span>
            </div>
            <h1 className="text-2xl font-display font-medium text-[#F0EEE6] mt-1.5">
              The Deterministic Kill-Switch Gateway
            </h1>
            <p className="text-[#8B9BAA] text-sm max-w-xl mt-1">
              Guarantees zero-trust active threat containment. Intercepts headless requests, 
              evaluates policies-as-code, and revokes credentials in less than 100 milliseconds.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={onClearLogs}
            className="px-3.5 py-1.5 border border-[#1F2E40] text-[#8B9BAA] font-mono text-xs rounded-lg hover:bg-[#0D1B2A] hover:text-[#F0EEE6] transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} /> Clear Ledger Logs
          </button>
        </div>
      </div>

      {/* Deterministic Intercept Process View */}
      <CollapsibleSection
        title={
          <h2 className="text-xs font-mono font-bold text-[#8B9BAA] tracking-wider uppercase shrink-0 flex items-center gap-2">
            <span className="text-[#1D9E75]">●</span> INTERACTIVE INTERCEPTION PROCESS FRAMEWORK
          </h2>
        }
      >
        {/* 4 Steps Block matching Deterministic Process */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Connecting lines between nodes and steps */}
          <div className="hidden md:block absolute top-[2.2rem] left-[12%] right-[12%] h-0.5 border-t border-dashed border-[#1F2E40] z-0" />

          {/* Step 1: Agent Action */}
          <div className={`p-4 rounded-lg text-center flex flex-col items-center relative z-10 transition-all duration-300 ${simulationStep === 1 ? 'bg-[#1D9E75]/15 border border-[#1D9E75]/40 text-[#1D9E75] shadow-[0_0_15px_rgba(29,158,117,0.15)]' : 'bg-[#0D1B2A] border border-[#1F2E40]'}`}>
            <span className="text-[10px] font-mono font-bold text-[#556070] tracking-widest block mb-2">01. ACTION</span>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-colors ${simulationStep >= 1 ? 'bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/40' : 'bg-[#162030] text-[#8B9BAA] border border-[#1F2E40]'}`}>
              AGENT
            </div>
            <h4 className="font-display font-medium text-[#F0EEE6] mt-2.5 text-xs">Agent Action</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Triggers "headless" Action Fabric Command.
            </p>
          </div>

          {/* Step 2: AG Intercept */}
          <div className={`p-4 rounded-lg text-center flex flex-col items-center relative z-10 transition-all duration-300 ${simulationStep === 2 ? 'bg-[#1D9E75]/15 border border-[#1D9E75]/40 text-[#1D9E75] shadow-[0_0_15px_rgba(29,158,117,0.15)]' : 'bg-[#0D1B2A] border border-[#1F2E40]'}`}>
            <span className="text-[10px] font-mono font-bold text-[#556070] tracking-widest block mb-1">02. INTERCEPT</span>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-colors ${simulationStep >= 2 ? 'bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/40' : 'bg-[#162030] text-[#8B9BAA] border border-[#1F2E40]'}`}>
              GEMINI
            </div>
            <h4 className="font-display font-medium text-[#F0EEE6] mt-2.5 text-xs">AG Intercept</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Google AI Studio rules intercept the API request packet.
            </p>
          </div>

          {/* Step 3: Evaluate */}
          <div className={`p-4 rounded-lg text-center flex flex-col items-center relative z-10 transition-all duration-300 ${simulationStep === 3 ? 'bg-[#EF9F27]/15 border border-[#EF9F27]/40 text-[#EF9F27] shadow-[0_0_15px_rgba(239,159,39,0.15)]' : 'bg-[#0D1B2A] border border-[#1F2E40]'}`}>
            <span className="text-[10px] font-mono font-bold text-[#556070] tracking-widest block mb-1">03. EVALUATED</span>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-colors ${simulationStep >= 3 ? 'bg-[#EF9F27]/20 text-[#EF9F27] border border-[#EF9F27]/40' : 'bg-[#162030] text-[#8B9BAA] border border-[#1F2E40]'}`}>
              CODE
            </div>
            <h4 className="font-display font-medium text-[#F0EEE6] mt-2.5 text-xs">Evaluate</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Logic checks Policy-as-Code for Approval.
            </p>
          </div>

          {/* Step 4: Kill Signal */}
          <div className={`p-4 rounded-lg text-center flex flex-col items-center relative z-10 transition-all duration-300 ${simulationStep === 4 ? 'bg-[#E24B4A]/15 border border-[#E24B4A]/40 text-[#E24B4A] shadow-[0_0_15px_rgba(226,75,74,0.15)]' : 'bg-[#0D1B2A] border border-[#1F2E40]'}`}>
            <span className="text-[10px] font-mono font-bold text-[#556070] tracking-widest block mb-1">04. TIMEOUT</span>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-colors ${simulationStep >= 4 ? 'bg-[#E24B4A]/20 text-[#E24B4A] border border-[#E24B4A]/40' : 'bg-[#162030] text-[#8B9BAA] border border-[#1F2E40]'}`}>
              HALT
            </div>
            <h4 className="font-display font-medium text-[#F0EEE6] mt-2.5 text-xs">Kill Signal</h4>
            <p className="text-[11px] text-[#E24B4A] mt-1 leading-snug font-bold">
              Protocol HALT in &lt;100ms. Token revoked.
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Simulated Interaction Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Interactive panel: Simulator Control */}
        <CollapsibleSection
          title="Threat Simulator Workbench"
          subtitle="Select agent scenarios payload variables to evaluate the Real-Time Kill-Switch."
          className="lg:col-span-5 p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col justify-between"
        >
          <div>
            {/* Template Selector */}
            <div className="space-y-2 mb-5">
              <label className="text-[10px] font-mono text-[#8B9BAA] font-bold tracking-wider uppercase block">
                Scenario Templates
              </label>
              <div className="grid grid-cols-1 gap-2">
                {SIMULATION_TRIGGER_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleTemplateSelect(tmpl)}
                    className={`
                      px-3 py-2.5 rounded-lg border text-left text-xs transition-all block w-full cursor-pointer
                      ${selectedTemplate.id === tmpl.id 
                        ? 'bg-[#0D1B2A] border-[#E24B4A]/40 text-[#F0EEE6] font-semibold' 
                        : 'bg-[#0D1B2A]/40 border-[#1F2E40] text-[#8B9BAA] hover:text-[#F0EEE6] hover:bg-[#0D1B2A]/60'
                      }
                    `}
                    id={`secure-tmpl-${tmpl.id}`}
                  >
                    <div className="font-display text-sm tracking-wide flex items-center justify-between">
                      <span>{tmpl.name}</span>
                      <span className="text-[9px] font-mono uppercase font-bold text-[#E24B4A] bg-[#E24B4A]/5 border border-[#E24B4A]/20 px-1 py-0.2 rounded shrink-0">
                        {tmpl.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#556070] block mt-1 leading-snug">{tmpl.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* JSON Payload Display */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-[#8B9BAA] font-bold tracking-wider uppercase block">
                Intercepted Raw JSON Packet (Edit allowed)
              </label>
              <textarea
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                disabled={isSimulating}
                className="w-full h-44 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] p-3 text-xs text-[#1D9E75] font-mono focus:outline-none focus:ring-1 focus:ring-[#E24B4A]/30 whitespace-pre scrollbar"
                spellCheck="false"
                id="secure-payload-textarea"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className={`
                w-full py-3.5 px-4 font-display font-medium text-xs tracking-wider uppercase rounded-lg flex items-center justify-center gap-2 transition shadow-md cursor-pointer
                ${isSimulating 
                  ? 'bg-red-950/35 border border-red-500/30 text-red-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#E24B4A] to-[#E24B4A]/90 hover:from-[#E24B4A]/90 hover:to-[#E24B4A] text-white hover:shadow-[0_0_15px_rgba(226,75,74,0.30)]'
                }
              `}
              id="btn-run-threat-sim"
            >
              {isSimulating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Halt Action Under Evaluation...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Trigger Threat Payload ({selectedTemplate.name})
                </>
              )}
            </button>
          </div>
        </CollapsibleSection>

        {/* Right Telemetry Column: Terminal Console */}
        <CollapsibleSection
          title={
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-[#E24B4A]" />
              <span className="text-xs font-mono text-[#8B9BAA] font-bold tracking-wider uppercase">
                Google AI Studio Native Sentinel (2026)
              </span>
            </div>
          }
          headerExtra={
            <div className="flex items-center gap-1 mr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E24B4A] animate-pulse block" />
              <span className="text-[9px] font-mono text-[#E24B4A] font-bold tracking-wide uppercase">
                ACTIVE BLOCK ATTACHED
              </span>
            </div>
          }
          className="lg:col-span-7 flex flex-col justify-between p-6 rounded-xl bg-[#162030] border border-[#1F2E40]"
        >
          <div>
            {/* Security Journey block */}
            <div className="mb-4 bg-[#0D1B2A]/75 p-3.5 rounded border border-[#1F2E40]">
              <h4 className="text-[10px] font-mono text-[#556070] font-bold tracking-wider uppercase mb-2">
                Governance Security Journey Steps
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10.5px]">
                <div className={`p-2 rounded border ${simulationStep >= 1 ? 'border-[#1D9E75]/35 bg-[#1D9E75]/5 text-[#1D9E75]' : 'border-[#1F2E40] text-[#556070]'}`}>
                  <span className="font-mono block font-bold text-slate-300">Step 1: Policy Ingestion</span>
                  CISO defines limit standards in AgentsGuardian Dashboard.
                </div>
                <div className={`p-2 rounded border ${simulationStep >= 2 ? 'border-[#1D9E75]/35 bg-[#1D9E75]/5 text-[#1D9E75]' : 'border-[#1F2E40] text-[#556070]'}`}>
                  <span className="font-mono block font-bold text-slate-300">Step 2: Real-time Vigilance</span>
                  Agent triggers key action, system intercepts missing approval.
                </div>
                <div className={`p-2 rounded border ${simulationStep >= 4 ? 'border-[#E24B4A]/30 bg-[#E24B4A]/5 text-[#E24B4A]' : 'border-[#1F2E40] text-[#556070]'}`}>
                  <span className="font-mono block font-bold text-slate-300">Step 3: Intervention</span>
                  Kill-Switch fires. Task Suspended notification issued.
                </div>
              </div>
            </div>

            {/* Simulated Live Console logs output */}
            <div className="w-full h-80 rounded-lg bg-[#0D1B2A] font-mono text-xs text-[#1D9E75] p-4 overflow-y-auto space-y-2 whitespace-pre shadow-inner border border-[#1F2E40]">
              <span className="text-[#556070] tracking-wide block mb-1">
                -- Terminal Log Stream initialized {new Date().toLocaleDateString()} --
              </span>
              
              {simLogResult ? (
                <div className="text-slate-200 leading-relaxed font-semibold">
                  {simLogResult}
                </div>
              ) : (
                <div className="text-[#556070] italic block py-12 text-center text-xs">
                  Await threat trigger payload. Push target action to visualize real-time deterministic intercepts.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F2E40] flex flex-wrap items-center justify-between text-[11px] font-mono text-[#556070]">
            <span>ANNEX IV LEDGER STAMPING ACTIVATED</span>
            <span>SYSTEM RESTART-BLOCK DELAY: 0ms</span>
          </div>
        </CollapsibleSection>
      </div>

      {/* Pillar 1 Audit Ledger Ledger List */}
      <CollapsibleSection
        title="Immutable Audit Ledger Index (Annex IV Compliant)"
        subtitle="Strict cryptographic transaction logging of every intercepted action"
        headerExtra={
          <span className="text-xs font-mono font-bold bg-[#0D1B2A] px-3 py-1 border border-[#1F2E40] text-[#8B9BAA] rounded mr-2">
            {killEvents.length} Halts Recorded
          </span>
        }
      >

        <div className="overflow-hidden rounded-lg border border-[#1F2E40]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#8B9BAA] divide-y divide-[#1F2E40]">
              <thead className="bg-[#0D1B2A] text-[#8B9BAA] font-mono text-[10px] tracking-wider uppercase">
                <tr>
                  <th className="p-4 font-bold">EVENT / ID</th>
                  <th className="p-4 font-bold">TIMESTAMP</th>
                  <th className="p-4 font-bold">AGENT / TASK</th>
                  <th className="p-4 font-bold">VIOLATED POLICY</th>
                  <th className="p-4 font-bold">LATENCY</th>
                  <th className="p-4 font-bold">STATUS</th>
                  <th className="p-4 font-bold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E40] bg-[#0D1B2A]/10 font-mono">
                {killEvents.map((event) => (
                  <React.Fragment key={event.id}>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{event.id}</div>
                        <div className="text-[10px] text-[#556070] shrink-0 truncate max-w-[120px]" title={event.timestampAnnexV}>
                          {event.timestampAnnexV.split('-')[2]}
                        </div>
                      </td>
                      <td className="p-4 text-[#8B9BAA] text-[11px]">
                        {new Date(event.timestamp).toLocaleDateString()} {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-300">{event.agentName}</div>
                        <div className="text-[10px] text-[#556070]">{event.actionCommand}</div>
                      </td>
                      <td className="p-4">
                        <span className="text-red-400 bg-red-950/20 border border-red-500/20 px-2 py-0.5 rounded font-mono text-[10.5px]">
                          {event.policyViolated}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-[#1D9E75]">
                        {event.latencyMs}ms
                      </td>
                      <td className="p-4">
                        <span className="text-[#E24B4A] bg-[#E24B4A]/10 border border-[#E24B4A]/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          {event.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setExpandedLogId(expandedLogId === event.id ? null : event.id)}
                          className="px-2.5 py-1 rounded bg-[#0D1B2A] hover:bg-white/5 border border-[#1F2E40] text-[11px] text-[#8B9BAA] font-mono hover:text-[#1D9E75] transition cursor-pointer"
                        >
                          {expandedLogId === event.id ? 'Hide Raw JSON' : 'View Payload'}
                        </button>
                      </td>
                    </tr>
                    {expandedLogId === event.id && (
                      <tr>
                        <td colSpan={7} className="p-6 bg-[#0D1B2A] border-t border-b border-[#1F2E40]">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-[#1F2E40] pb-2">
                              <span className="text-xs font-semibold text-[#8B9BAA]">Intercepted Payload Data Details ({event.id})</span>
                              <span className="text-[10px] text-[#556070] bg-[#162030] px-2 py-0.5 rounded border border-[#1F2E40]">
                                ANNEX IV SECURE LEDGER KEY: {event.timestampAnnexV}
                              </span>
                            </div>
                            <pre className="p-4 rounded bg-[#162030] border border-[#1F2E40] text-[11px] text-[#1D9E75] font-mono overflow-x-auto">
                              {event.rawJsonIntent}
                            </pre>
                            <div className="p-3 bg-[#E24B4A]/5 rounded border border-[#E24B4A]/10 text-[11px] text-red-200">
                              <strong>Deterministic Safety Intercept Verdict:</strong> Headless identity access token has been completely revoked. The server returned HTTP 403 Forbidden with payload lock. Safe state restored in {event.latencyMs}ms.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
