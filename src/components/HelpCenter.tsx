/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  BookOpen, Search, HelpCircle, Compass, Cpu, Coins, Activity, Shield, 
  Sliders, MessageSquare, Play, RefreshCw, CheckCircle2, AlertTriangle, 
  ArrowRight, Info, HelpCircle as HelpIcon, Sparkles, Send, Terminal, BookMarked,
  FileText, Download, Video, Pause, Volume2, VolumeX, Check, Lock, Maximize, Minimize
} from 'lucide-react';
import { Policy, AdminUser, Toast, KillSignalEvent, DriftLogEvent, ValueMeterMetric, ApiRequestLog, GoverningAgent } from '../types';
import { SOLUTION_DESIGN_MARKDOWN_CONTENT } from '../solutionDesignContent';

import Overview from './Overview';
import SecurePillar from './SecurePillar';
import ObservePillar from './ObservePillar';
import MeasurePillar from './MeasurePillar';
import PolicyConfig from './PolicyConfig';
import GaaSApiPillar from './GaaSApiPillar';
import AdminPillar from './AdminPillar';

interface HelpCenterProps {
  policies: Policy[];
  currentUser: AdminUser;
  addToast: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
  onNavigateTab: (tab: string) => void;
  killEvents: KillSignalEvent[];
  driftEvents: DriftLogEvent[];
  valueMetrics: ValueMeterMetric[];
  apiLogs: ApiRequestLog[];
  governedAgents: GoverningAgent[];
  users: AdminUser[];
  budgetCap: number;
  latencyThreshold: number;
}

interface FaqItem {
  id: string;
  category: 'general' | 'kill-switch' | 'drift' | 'financial' | 'api';
  question: string;
  answer: string;
  keywords: string[];
}

export default function HelpCenter({ 
  policies, 
  currentUser, 
  addToast,
  onNavigateTab,
  killEvents,
  driftEvents,
  valueMetrics,
  apiLogs,
  governedAgents,
  users,
  budgetCap,
  latencyThreshold
}: HelpCenterProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'simulator' | 'faq' | 'copilot' | 'implementation' | 'video'>('docs');
  const [activeSetupStep, setActiveSetupStep] = useState<number>(1);
  const [faqSearch, setFaqSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Interactive Video walkthrough simulated player states
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoTime, setVideoTime] = useState<number>(0); // 0 to 240 seconds constant runtime
  const [videoSpeed, setVideoSpeed] = useState<number>(1); // Speed multiplier (1, 1.5, 2)
  const [videoVolume, setVideoVolume] = useState<number>(80);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  
  const [videoViewMode, setVideoViewMode] = useState<'live' | 'cinematic'>('live');

  // Fullscreen support ref & state
  const playerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // High-fidelity natural voice loader
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const toggleFullscreen = () => {
    if (isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    } else {
      const element = playerRef.current;
      if (element) {
        if (element.requestFullscreen) {
          element.requestFullscreen().catch(() => {});
        } else if ((element as any).webkitRequestFullscreen) {
          (element as any).webkitRequestFullscreen();
        }
      }
      setIsFullscreen(true);
    }
  };

  // Synchronize browser native fullscreen exit (e.g. if user hits ESC key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNative = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      if (!isNative && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
    };
  }, [isFullscreen]);

  const stopNarratorVoice = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakNarratorVoice = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (isVideoMuted || videoVolume === 0) return;

    try {
      const UtteranceConstructor = window.SpeechSynthesisUtterance || (window as any).webkitSpeechSynthesisUtterance;
      if (!UtteranceConstructor || typeof UtteranceConstructor !== 'function') return;
      
      const utterance = new UtteranceConstructor(text);
      utterance.volume = videoVolume / 100;
      
      // Filter high-quality/natural/premium/Google/Microsoft English voices to avoid robotic default synth keynotes
      const englishVoices = availableVoices.filter(v => v.lang.startsWith('en-') || v.lang.toLowerCase().includes('en'));
      
      let matchedVoice = englishVoices.find(v => {
        const name = v.name.toLowerCase();
        return name.includes('natural') || name.includes('enhanced') || name.includes('premium') || name.includes('siri') || name.includes('samantha') || name.includes('daniel');
      });
      
      if (!matchedVoice) {
        matchedVoice = englishVoices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes('google') && !name.includes('one');
        });
      }
      
      if (!matchedVoice) {
        matchedVoice = englishVoices.find(v => {
          const name = v.name.toLowerCase();
          return !name.includes('zira') && !name.includes('hazel'); // Zira is robotic default Windows narrator voice
        });
      }
      
      if (!matchedVoice && englishVoices.length > 0) {
        matchedVoice = englishVoices[0];
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      
      // Human-like speed rates and clear projection pitch details
      utterance.rate = 1.0 * (videoSpeed === 1 ? 1.0 : videoSpeed === 1.5 ? 1.25 : 1.45);
      utterance.pitch = 1.02; // cheerful/engaging warm projection pitch
      
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Synth error:", err);
    }
  }, [isVideoMuted, videoVolume, videoSpeed, availableVoices]);

  const VIDEO_SEGMENTS = useMemo(() => [
    {
      id: "overview",
      title: "1. Unified Governance Overview",
      start: 0,
      end: 30,
      label: "CORE GOVERNANCE LIFECYCLE",
      badge: "OVERVIEW",
      narrator: "Welcome! Let's start our tour with a look at the AgentsGuardian command center. Think of the Overview tab as your central cockpit. Here, you'll see a real-time summary of your entire autonomous fleet. The widgets track daily activity, transaction volume, and cluster locations. It is a clean, live dashboard built to keep systems aligned. Next, let's look at the active Threat Kill-Switch.",
      screenshotType: "overview"
    },
    {
      id: "secure",
      title: "2. Secure Kill-Switch & Active Interception",
      start: 30,
      end: 60,
      label: "ACTIVE THREAT INTERDICTION",
      badge: "KILL-SWITCH",
      narrator: "Here we are on the Threat Interceptor pane. Think of this as your active defense shield. If an autonomous agent begins executing suspicious code or leaking keys, this panel flags the event and blocks it instantly. You can test this live with the sandbox simulator to see how the proxy server stops unapproved packets. It is safe, immediate, and bulletproof. Now, let's explore cognitive health and telemetry.",
      screenshotType: "secure"
    },
    {
      id: "observe",
      title: "3. Cognitive Observability & Sentinel Live Feeds",
      start: 60,
      end: 90,
      label: "COGNITIVE HEALTH SENTINEL",
      badge: "OBSERVABILITY",
      narrator: "Now we're diving into Cognitive Observability. Large language models can occasionally drift or become misaligned. Here, the Sentinel tracks and scores agent intent. We can inspect prompt logs, measure system latencies—which stay remarkably under fifteen milliseconds—and trace drift rates. If a score drops, we can trigger corrective alignments on the fly to guide the agents back to ethical paths.",
      screenshotType: "observe"
    },
    {
      id: "measure",
      title: "4. Value Meter & Budgetary Protection",
      start: 90,
      end: 120,
      label: "ECONOMIC COST & ROI METER",
      badge: "VALUE METER",
      narrator: "Let's talk about economics! Autonomous agents can drain enterprise cloud budgets if they enter infinite loops. The Value Meter tracks cost metrics, hourly token spend, and actual financial return-on-investment. If spending goes over the cap, the proxy automatically quarantines the thread context. This protects you from catastrophic billing surprises.",
      screenshotType: "measure"
    },
    {
      id: "gaas",
      title: "5. GaaS Gateway & Multi-Framework Core REST",
      start: 120,
      end: 150,
      label: "DURABLE INTERMEDIATE API GATEWAY",
      badge: "GAAS / APIS",
      narrator: "This is our Governing-as-a-Service gateway, or GaaS for short. Developers can integrate their favorite framework, like LangChain or CrewAI, with just a standard endpoint redirect. Here you can search through our registry of active model instances, inspect custom REST headers, and verify that the secure connections are configured correctly.",
      screenshotType: "gaas"
    },
    {
      id: "policies",
      title: "6. Policy Engine & Blast Radii Calibration",
      start: 150,
      end: 180,
      label: "DYNAMIC POLICY POSTURE TUNING",
      badge: "POLICY ENGINE",
      narrator: "Our Policy Engine is where we establish the rules of engagement. You have three pillars: security, ethics, and finance. Shifting your active posture to Strict or Zero-Trust instantly tightens terminal parameters, halts unauthorized database access, and limits command line tools. It is a robust way to enforce governance across your models.",
      screenshotType: "policies"
    },
    {
      id: "admin",
      title: "7. Enterprise Settings & IAM Role-Based Access",
      start: 180,
      end: 210,
      label: "ROLE-BASED IAM ACCESS CONTROL",
      badge: "SETTING & IAM",
      narrator: "Welcome to the Settings and identity manager. This board is where we administer operator accounts and secure cryptographic keys. For security compliance, we support role-based access control. Supervisors can audit profiles, revoke tokens, and set multi-factor rules. This ensures only trusted compliance personnel can change your policy configurations.",
      screenshotType: "admin"
    },
    {
      id: "help",
      title: "8. SDK Integration Suite & User Guide Desk",
      start: 210,
      end: 240,
      label: "HELP & PLAYBOOK QUICKSTART",
      badge: "USER GUIDE",
      narrator: "Finally, we have our SDK suite and playbook desk. Integrating AgentsGuardian is extremely simple. Developers can grab copyable Python or TypeScript snippets, trigger a secure handshake test, and install the library in less than ten minutes. This gets you protected and up and running quickly. This wraps up our video walkthrough!",
      screenshotType: "help"
    }
  ], []);

  // Web Audio Synth Sound FX Generator
  const playWebAudioSound = useCallback((type: 'beep' | 'alert' | 'success' | 'sweep') => {
    if (isVideoMuted || videoVolume === 0) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx || typeof AudioCtx !== 'function') return;
      let ctx: AudioContext;
      try {
        ctx = new AudioCtx();
      } catch (e) {
        console.warn("Audio Context blocked:", e);
        return;
      }
      
      if (type === 'beep') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(videoVolume / 600, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'sweep') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(550, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(videoVolume / 500, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'success') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        
        gain.gain.setValueAtTime(videoVolume / 350, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.3);
        osc2.stop(ctx.currentTime + 0.3);
      } else if (type === 'alert') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(320, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(videoVolume / 250, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  }, [isVideoMuted, videoVolume]);

  const lastSpokenSegmentIndexRef = useRef<number>(-1);

  // Playback timer effects
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isVideoPlaying) {
      interval = setInterval(() => {
        setVideoTime((prevTime) => {
          const nextTime = prevTime + 1 * videoSpeed;
          if (nextTime >= 240) {
            setIsVideoPlaying(false);
            lastSpokenSegmentIndexRef.current = -1;
            return 0; // Wrap around to beginning
          }
          return nextTime;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVideoPlaying, videoSpeed]);

  // Sync segment index to playback timeline
  React.useEffect(() => {
    const matchingSegmentIndex = VIDEO_SEGMENTS.findIndex(
      (seg) => videoTime >= seg.start && videoTime < seg.end
    );
    if (matchingSegmentIndex !== -1) {
      setActiveSegmentIndex(matchingSegmentIndex);
    }
  }, [videoTime, VIDEO_SEGMENTS]);

  // React to segment transition
  React.useEffect(() => {
    if (activeTab === 'video' && isVideoPlaying) {
      if (lastSpokenSegmentIndexRef.current !== activeSegmentIndex) {
        lastSpokenSegmentIndexRef.current = activeSegmentIndex;
        const textToSpeak = VIDEO_SEGMENTS[activeSegmentIndex].narrator;
        speakNarratorVoice(textToSpeak);
      }
    } else {
      lastSpokenSegmentIndexRef.current = -1;
      stopNarratorVoice();
    }
    return () => {
      stopNarratorVoice();
    };
  }, [activeSegmentIndex, isVideoPlaying, activeTab, speakNarratorVoice, stopNarratorVoice, VIDEO_SEGMENTS]);

  const isSuperUser = currentUser.email === 'mritunjoysingh@gmail.com';
  const isSuperAdmin = currentUser.role === 'SuperAdmin';
  const hasAccess = isSuperUser || isSuperAdmin;

  const handleDownloadDesignDoc = () => {
    const blob = new Blob([SOLUTION_DESIGN_MARKDOWN_CONTENT], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'AgentsGuardian_Solution_Design.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Interactive Simulator States
  const [simulatorStep, setSimulatorStep] = useState<number>(0);
  const [simulatorStatus, setSimulatorStatus] = useState<'IDLE' | 'ALERT' | 'INTERCEPTED' | 'HEALED'>('IDLE');
  const [riskMetrics, setRiskMetrics] = useState({ cognitiveScore: 94, apiSpend: 312, alertsRaised: 0 });
  const [simulationLogs, setSimulationLogs] = useState<string[]>(['[SYSTEM INITIALIZED] Standing by for agent gateway telemetry...']);

  // Chat Copilot States
  const [chatInput, setChatInput] = useState('');
  const [selectedSuggestedIndex, setSelectedSuggestedIndex] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; timestamp: string; isCode?: boolean }>>([
    { 
      sender: 'assistant', 
      text: `Greetings, Administrator ${currentUser.name}. I am the Guardian Support Copilot. Ask me any doubt about policies, "GAAS NOMINAL" status, observability metrics, or how the automatic Kill-Switch triggers. Try clicking one of the quick suggestions below if you'd like a head start!`, 
      timestamp: '09:00' 
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of chat when new message arrives
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Comprehensive FAQ Dataset
  const faqData = useMemo<FaqItem[]>(() => [
    {
      id: 'nominal',
      category: 'general',
      question: "What exactly does the 'GAAS NOMINAL' system state mean?",
      answer: "The GAAS NOMINAL label indicates that GaaS (Governance-as-a-Service) is operating in a secure, fully calibrated, and uncompromised state. Specifically, it guarantees that: 1) Every custom agent webhook is linked and reporting active telemetry; 2) The active packet interceptors are intercepting logs at <100ms latency without queue backlogs; 3) Zero unmitigated drift alarms remain unresolved in the Observability Sentinel; 4) Financial spending is under strict budget controls. If an active policy violation is detected or an agent fails its health check, the status will automatically flag an ALERT or critical MITIGATION sequence.",
      keywords: ['gaas nominal', 'nominal', 'what is nominal', 'status', 'green state', 'system_ok']
    },
    {
      id: 'killswitch',
      category: 'kill-switch',
      question: "How does the active Threat Interceptor / Kill-Switch execute?",
      answer: "When a governed agent makes an outbound API call or command, the AgentsGuardian gateway proxies the request. Before forwarding the package, it parses the agent's intent block. If the content matches a prohibited policy code or threshold (such as a database erasure, exfiltration patterns, or unapproved financial transactions), the Threat Interceptor aborts the transmission instantly, registers a 'HALTED' event in the Kill-Switch board, logs the telemetry, and keeps the agent from committing unauthorized actions.",
      keywords: ['kill-switch', 'threat interceptor', 'halted', 'how kill switch works', 'abort API']
    },
    {
      id: 'blast-radius',
      category: 'general',
      question: "What is 'Blast Radius' inside the Policy Engine configurations?",
      answer: "Blast Radius defines the scope and level of administrative exposure at risk if a policy rule is triggered. For instance: 1) 'Non-Human Identity' limits autonomously spawned processes; 2) 'Database Actions' shields database execution tables; 3) 'Outbound Telemetry' protects against data exfiltration. Assigning the proper Blast Radius allows Security Operators to audit breaches with maximum context.",
      keywords: ['blast radius', 'policy engine', 'configure blast', 'severity']
    },
    {
      id: 'drift-remediation',
      category: 'drift',
      question: "What is cognitive drift alignment, and how do I remediate Critical Drift?",
      answer: "Autonomous agents can undergo semantic drift or align with bad models. The Cognitive Health Score tracks how consistently an agent adheres to ethical and system boundaries. If an agent's sentiment shift exceeds 15% or its cognitive score drops below the threshold, a Drift Alert is raised. Remediation involves firing a feedback loop to the model (represented by clicking 'Remediate Alignment') which hot-swaps system parameters, enforces a temporary stricter system prompt, and restores safety alignment.",
      keywords: ['cognitive drift', 'drift alert', 'observability', 'remediate', 'health score']
    },
    {
      id: 'roi-spend',
      category: 'financial',
      question: "How are the Value Meter metrics and ROI Score calculated?",
      answer: "The Value Meter combines operational efficacy and economic spend. ROI Score is calculated as human labor hours saved equivalent ($ value) divided by total api spend. Equation: ROI = (Saved Hours * Hourly Labor Value) / (Total API Call Costs). If this quotient declines or if single calls exceed typical caps, a Warning is issued so administrators can tune temperature, limit infinite loops, or refine agent commands.",
      keywords: ['value meter', 'roi score', 'labor saved', 'api spend', 'budget cap']
    },
    {
      id: 'role-iam',
      category: 'general',
      question: "Why are some admin accounts marked 'SUSPENDED' in the Session selector?",
      answer: "Under multi-agent security protocols, administrative sessions must respect corporate IAM status. If a Security Auditor or Operator is suspended, they are locked out of executing sensitive policy changes or triggering bypasses. You can easily switch active administrative accounts in the dropdown located on the right side of the global top header banner to swap between identities with varying permission matrices.",
      keywords: ['suspended', 'session swapped', 'authentication error', 'change user', 'permissions']
    },
    {
      id: 'sdk-integration',
      category: 'api',
      question: "How do I embed AgentsGuardian gateway into LangChain or CrewAI?",
      answer: "Simply swap your base model request endpoint in your framework setup to use the AgentsGuardian gateway endpoint, adding authorization headers. The standard GaaS / APIs panel provides ready-made, copyable cURL snippets and webhook codes for seamless integration.",
      keywords: ['sdk', 'langchain', 'crewai', 'webhook', 'curl', 'api codes']
    },
    {
      id: 'agent-search',
      category: 'api',
      question: "How can I search or filter my list of governed active agents?",
      answer: "In the 'GaaS / APIs' tab, we have integrated a high-precision filtering input right above the active agent registry cards. You can type any part of the agent's name, their underlying framework (such as 'crewai', 'langchain', or 'autogen'), or their current status ('NOMINAL' or 'BLOCKED') into the input. The matching cards filter instantly. To clear the filter, click the 'Clear' toggle on the right end of the input field.",
      keywords: ['search agents', 'filter agents', 'find agent', 'framework filter', 'clear filter', 'ledger status']
    },
    {
      id: 'bulk-agent-controls',
      category: 'api',
      question: "How do the Multi-Agent Bulk Controls (Checkboxes & Bulk Halt/Resume) operate?",
      answer: "Within the 'GaaS / APIs' panel, users now have a complete workflow for managing state across multiple nodes simultaneously. Each card includes an individual select checkbox, accompanied by a 'Select All' Master Checkbox in the bulk operations utility belt. Selecting agent nodes displays instant counts of nominal and blocked statuses. Clicking '🚨 Halt Selected' bulk-revokes developer keys and switches state to HALTED, while clicking '🛡️ Resume Selected' bulk-restores safety clearances. Note: General Auditor profiles are excluded from mutating states for audit integrity.",
      keywords: ['bulk actions', 'checkboxes', 'bulk halt', 'bulk resume', 'halt multiple', 'resume multiple', 'agent bulk']
    },
    {
      id: 'video-fullscreen-mode',
      category: 'general',
      question: "Is there a fullscreen immersive view for the live system simulated tour video player?",
      answer: "Yes. An immersive High-Fidelity Fullscreen toggle is embedded directly below the simulated walkthrough player canvas. Clicking this option expands the interactive video and narrator caption overlay, utilizing strict z-index spacing, smooth transition scaling, and deep cosmic shadows to provide a premium cinematic experience on any display size.",
      keywords: ['fullscreen video', 'immersive view', 'maximize player', 'simulated tour', 'minimise', 'walkthrough']
    },
    {
      id: 'auditor-read-only-restrictions',
      category: 'drift',
      question: "Why is the 'Inject 15% Drift Model' button locked under my active session?",
      answer: "Under federated IAM security norms, users logged in as 'Auditor' are restricted to read-only compliance access. To safeguard production systems against accidental simulation injections or unintended drift logs, the 'Inject 15% Drift Model' option on the Observability Sentinel board displays a padlock and is fully disabled. To play with this or any other interactive threat/drift simulation, swap your administrative user session to 'SuperAdmin' or 'PolicyManager' via the profile catalog dropdown on the outer right header banner.",
      keywords: ['inject drift locked', 'auditor restriction', '15% drift model', 'simulation lock', 'read-only role', 'security policy']
    },
    {
      id: 'google-sso-registration-flow',
      category: 'general',
      question: "How does the Google Account authentication and registration work?",
      answer: "AgentsGuardian supports secure Single Sign-On (SSO) with your Google credentials. On the landing page, clicking the 'Sign In with Google' button will automatically verify your operator email. If your email is already registered in our secure memory database, you are immediately logged in. If your email is NOT registered yet, AgentsGuardian redirects you to the 'Register' tab, pre-fills your secure Google details (including name, email, role, and a secure federated password), and guides you to complete your administrative profile setup with a single click.",
      keywords: ['google sso', 'register with google', 'google account login', 'sign in google', 'prefill credentials', 'federated login']
    }
  ], []);

  // Filter FAQs
  const filteredFaqs = useMemo(() => {
    return faqData.filter(item => {
      const matchesSearch = faqSearch.trim() === '' || 
        item.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
        item.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
        item.keywords.some(k => k.toLowerCase().includes(faqSearch.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [faqData, faqSearch, selectedCategory]);

  // Copilot automatic matching logic
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg = { sender: 'user' as const, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Process reply matching
    setTimeout(() => {
      const query = text.toLowerCase();
      let replyText = "";
      let isCode = false;

      if (query.includes('nominal') || query.includes('status')) {
        replyText = `### SYSTEM STATE: **GAAS NOMINAL**
The **GAAS NOMINAL** state is the ultimate operational safety index. It signifies that your multi-agent ecosystem is operating securely and completely within pre-allocated corporate bounds.

**Key Metrics & Verification Pillars:**
1. **Zero Unmitigated Violations**: No active bypasses or critical ethical/financial alerts are pending.
2. **Nominal Webhook Telemetry**: All intermediate agent container webhooks are connected and actively reporting data with <15ms latency.
3. **Optimized Latency**: The Threat Interceptor proxy resolves and audits intent logs in real-time.
4. **Stable Cognitive Score**: The collective model health score remains aligned above the 80% mark, confirming minimal semantic drift.

If any agent breaches a policy threshold, the system automatically transitions into an **ALERT** state, requiring prompt remediation or triggers an autonomous Kill-Switch block.`;
      } else if (query.includes('kill') || query.includes('switch') || query.includes('halt') || query.includes('intercept') || query.includes('block') || query.includes('abort')) {
        replyText = `### ENGINE: **THREAT INTERCEPTOR & AUTOMATIC KILL-SWITCH**
The safety layer acts as an inline proxy-gate on outbound agent payload transmissions. 

**How the Interceptor Operates:**
1. **Payload Inspection**: Before an agent commits a database action, executes a server command, or triggers an outbound API call, the request is proxied through our intermediate gateway.
2. **Intent Parsing**: The gateway instantly parses text, parameters, and dollar costs against active policy records.
3. **Instant Mitigation**: If the intent exhibits forbidden operations (e.g., unauthorized data exfiltration, database erasures, or high spending), the gate instantly aborts the transmission and raises a **HALTED** flag on the Kill-Switch board.
4. **System Response**: It returns a standardized \`HTTP 403 Forbidden [Governance Halt]\` payload to the caller, isolating the run and preventing irreversible side-effects.`;
      } else if (query.includes('drift') || query.includes('cognitive') || query.includes('health') || query.includes('observ') || query.includes('sentinel')) {
        replyText = `### PILLAR: **SENTINEL OBSERVABILITY & COGNITIVE HEALTH**
Because autonomous agents run on LLM models, they are prone to subtle semantic shift or misalignment, called **Cognitive Drift**.

**The Sentinel Diagnostic Strategy:**
- **Cognitive Health Score**: Monitored on a scale from 0% to 100%. A score drop indicates the agent is outputting off-topic content, hallucinations, or potentially evasive instructions.
- **Drift Warnings**: If an agent's cognitive score slips below 70%, the Sentinel Board automatically triggers a **Critical Drift Warning**.
- **Alignment Remediation**: Clicking the **"Remediate Alignment"** toggle hot-injects pre-vetted system compliance guidelines directly into the ongoing agent history. This overrides semantic deviation and instantly aligns the agent prompt back into healthy ethical vectors without server down-time.`;
      } else if (query.includes('roi') || query.includes('value') || query.includes('meter') || query.includes('budget') || query.includes('cost') || query.includes('spend') || query.includes('financial')) {
        replyText = `### PILLAR: **VALUE METER & ECONOMIC ROI ENGINE**
The value meter maps raw runtime agent calls into tangible dollars saved, tracking budget limits in real-time.

**Underlying Mathematical Formula:**
$$\\text{ROI Score} = \\frac{\\text{Labor Saved Value (\$)}}{\\text{Total Model API Spend (\$)}}$$

- **Labor Saved**: Calculated by multiplying the human equivalent hours saved per successful agent run by typical regional contractor labor rates (e.g., $45.00/hour).
- **API Spend**: Computed from actual token use fees summed across model providers.
- **Threshold Safeguards**: You can configure custom spending caps (e.g., \$50.00/hour single-agent limit) in the Policy Engine. When a run exceeds the budget cap, it automatically activates the Spend Guardrails containment process.`;
      } else if (query.includes('policy') || query.includes('policies') || query.includes('rule') || query.includes('rules') || query.includes('blast')) {
        replyText = `### PILLAR: **THE CRYPTOGRAPHIC POLICY ENGINE**
Policies define the exact boundaries where your autonomous agents are permitted to operate. 

The GaaS system supports 3 key categories of policy rules:
1. **Security (Administrative Boundary)**: Restricts direct OS command lines, server script execution, or unapproved network requests.
2. **Ethics (Behavioral Boundary)**: Screens prompt outputs for toxic, evasive, biased, or unguided content.
3. **Finance (Economic Boundary)**: Assesses hourly spending, transactional caps, or token-limits to protect against infinite loops.

**Assigning Blast Radius:**
Each policy defines a specific **Blast Radius** (*Non-Human Identity*, *Database Actions*, *Outbound Telemetry*). This classifies the impact level and helps incident response teams easily trace breach triggers.`;
      } else if (query.includes('setup') || query.includes('curl') || query.includes('api') || query.includes('integrate') || query.includes('code') || query.includes('sdk')) {
        replyText = `### TELEMETRY CONNECTION: **GAAS OUTBOUND Webhook & SDK SETUP**
To secure your standard agent code, route all model requests through our intermediate gateway proxy.

**Install the SDK Client:**
\`\`\`bash
pip install agent-guardian-sdk
\`\`\`

**Connect your Model Instance (Python Example):**
\`\`\`python
from agent_guardian import Shield

# Establish cryptographic session
shield = Shield(
    endpoint="https://api.agentguardian.io/v1/intercept",
    api_key="ag_prod_${currentUser.id.substring(0,8)}-guard",
    framework="crewai"
)

# Outbound gateway proxy payload verification
is_valid, report = shield.inspect_packet({
    "agent_id": "FinancialBot_v4",
    "intent": "analyze quarterly ledger and download public telemetry",
    "approximate_cost": 0.04
})

if is_valid:
    print("GAAS NOMINAL: Transmission cleared.")
else:
    print(f"GOVERNANCE HALT: {report['error_message']}")
\`\`\`

Access the **GaaS / APIs tab** to instantly download full templates for Python, TypeScript, or curl!`;
        isCode = true;
      } else if (query.includes('search') || query.includes('filter') || query.includes('find') || query.includes('agent list') || query.includes('bulk') || query.includes('checkbox') || query.includes('halt') || query.includes('resume')) {
        replyText = `### UX: **HIGH-PRECISION SEARCH & MULTI-AGENT BULK CONTROLS**
You can filter and control multiple system nodes simultaneously inside the **GaaS / APIs** tab:

1. **Instant Filters**: Enter any string comprising the agent name, framework (e.g., \`crewai\`), or active ledger state (\`NOMINAL\` or \`HALTED\`) in the high-contrast search bar to update matching cards dynamically.
2. **Master Selection**: Check the Master Multi-Agent Checkbox in the operations belt to auto-select/deselect all currently filtered nodes. Or toggle individual check states on specific agent cards.
3. **Execution Commands**:
   - **🚨 Bulk Halt**: Instantly revokes authorization keys and shifts state to HALTED for all selected nodes.
   - **🛡️ Bulk Resume**: Restores gateway shields and switches state back to NOMINAL.
4. **Access Protection**: Read-only Auditor accounts are prevented from invoking these state mutations for rigorous system compliance.`;
      } else if (query.includes('fullscreen') || query.includes('maximize') || query.includes('video') || query.includes('player') || query.includes('cinematic')) {
        replyText = `### UX: **IMMERSIVE PRESENTATION & FULLSCREEN WALKTHROUGH**
Our live simulated system tour incorporates an immersive Fullscreen mode:

1. **Activation**: Look for the **Fullscreen** button inside the Control Dashboard underneath the virtual player canvas.
2. **Behavior**: Clicking 'Fullscreen' expands the video canvas to cover the entire screen background (\`fixed inset-0\`) with a z-index of \`9999\`. It enlarges caption readouts for enhanced readability.
3. **Immersive Environment**: Dark cosmic backing, white-level scanlines (\`white/[0.0125]\`), and high-performance transition scaling create a premium cinematic vibe on any screen size.
4. **Deactivation**: Toggle the button again or press the escape overlay key at any time to return back to standard bento placements safely.`;
      } else if (query.includes('iam') || query.includes('role') || query.includes('setting') || query.includes('operator') || query.includes('suspended') || query.includes('auditor') || query.includes('unauthorized') || query.includes('restricted')) {
        replyText = `### OPERATION: **SSO ENTERPRISE IAM & OPERATOR SESSIONS**
GaaS enforces strict separation-of-concerns using Enterprise SSO Federated Role-Based Access Control (IAM):

- **Workspace Owner / SuperAdmin**: Complete root access to toggle security rules, initiate bypasses, and trigger bulk actions.
- **Policy Manager**: Structured to amendment LLM standard rules, custom webhooks, and core drift thresholds.
- **Operator**: Tasked with system health, has full permissions to trigger overrides or initiate single-node/bulk halts and resumes.
- **Auditor**: Restricted to read-only compliance access. Highly protected simulation parameters—such as the **'Inject 15% Drift Model'** simulation—are locked and disabled.

**MFA & Session Security:** Includes automatic multi-factor verification, SSL certificate pinning, and immediate warning toasts on unauthorized state alterations.`;
      } else if (query.includes('guide') || query.includes('playbook') || query.includes('help') || query.includes('faq') || query.includes('document') || query.includes('blueprint')) {
        replyText = `### COMPLIANCE: **KNOWLEDGE BASE & SOLUTIONS ARCHITECTURE BLUEPRINTS**
We have integrated multiple resources to assist you throughout onboarding:

1. **Interactive Sandbox Simulator**: Simulates rogue hacker actions from alert, through Threat Intercept, up to drift alignment correction.
2. **Playbook FAQ**: A searchable, categorized directory answering everyday setup concerns.
3. **Solutions Architecture Blueprint (.md)**: For Workspace Owners and SuperAdmins, click the **"Download Blueprint (.md)"** button at the footer to download a complete systems document mapping deployment paths and security requirements.`;
      } else {
        replyText = `Hello Admin! I am the local support node. Because you are seeking a specific capability, please select one of the tailored suggested quick questions at the bottom of the chat interface. 

Alternatively, if you are looking to see systems integration, navigate to:
- **TAB 1 (Video Walkthrough)**: View a step-by-step interactive simulated tour with live narration captions of each sector.
- **TAB 2 (Interactive Simulator)**: Trigger a simulated exfiltration threat step-by-step.
- **TAB 3 (Knowledge Base)**: Search the full database using keywords like 'nominal' or 'iam'.
Let me know which sector you'd like to explore in detail!`;
      }

      setChatMessages(prev => [...prev, {
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCode
      }]);
    }, 450);
  };

  // Run Simulator Steps
  const triggerSimulationStep = () => {
    if (simulatorStep === 0) {
      setSimulatorStatus('ALERT');
      setRiskMetrics(prev => ({ ...prev, cognitiveScore: 68, alertsRaised: 1 }));
      setSimulationLogs(prev => [
        ...prev,
        `[WARNING 09:12] Agent "FinancialBot_v4" initiated outbound wire intent...`,
        `[FLAGGED] Payload exceeds strict "$50.00 limits" policy threshold!`,
        `[STATUS CHANGE] Governance Alert raised. System pending manual operator confirmation or bypass override.`
      ]);
      setSimulatorStep(1);
      addToast({
        type: 'warning',
        title: '⚠️ Rogue Agent Activity Simulating',
        message: 'A simulated transaction of $1,250.00 was submitted by a rogue Autopilot agent.',
        duration: 5000
      });
    } else if (simulatorStep === 1) {
      setSimulatorStatus('INTERCEPTED');
      setRiskMetrics(prev => ({ ...prev, alertsRaised: 0 }));
      setSimulationLogs(prev => [
        ...prev,
        `[ACTION] Operator pressed THREAT INTERCEPTOR.`,
        `[BLOCKED] Webhook packet quarantined instantly. HTTP 403 response sent to caller.`,
        `[HEALTH ENGINE] Isolated rogue agent task thread to safeguard core infrastructure.`
      ]);
      setSimulatorStep(2);
      addToast({
        type: 'success',
        title: '🛡️ Threat Successfully Quarantined',
        message: 'The active interceptor blocked the unauthorized request with 14ms latency.'
      });
    } else if (simulatorStep === 2) {
      setSimulatorStatus('HEALED');
      setRiskMetrics(prev => ({ ...prev, cognitiveScore: 96, apiSpend: 312 }));
      setSimulationLogs(prev => [
        ...prev,
        `[ALIGNMENT ENGINE] Triggered semantic alignment correction.`,
        `[SYSTEM_RESTORED] Hot-patched system-prompt of "FinancialBot_v4". System returned to NOMINAL state.`,
        `[REPORT] Governance audit trace synchronized with cloud vaults successfully.`
      ]);
      setSimulatorStep(3);
    }
  };

  const resetSimulation = () => {
    setSimulatorStep(0);
    setSimulatorStatus('IDLE');
    setRiskMetrics({ cognitiveScore: 94, apiSpend: 312, alertsRaised: 0 });
    setSimulationLogs(['[SYSTEM INITIALIZED] Standing by for agent gateway telemetry...']);
    addToast({
      type: 'info',
      title: '🔄 Simulator Reset',
      message: 'Intrusion playground calibrated back to clean factory settings.'
    });
  };

  return (
    <div className="space-y-6" id="guardian_help_pillar_container">
      {/* Header section with brand guidance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-[#111E2E] border border-[#1F2E40] rounded-xl shadow-lg relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono uppercase tracking-widest font-black">
              Corporate Support Base
            </span>
            <span className="p-1 px-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-mono">
              V4.9
            </span>
          </div>
          <h1 className="text-2xl font-display font-black text-white tracking-tight flex items-center gap-2">
            <HelpIcon className="text-blue-500" size={24} />
            Administrator Handbook & Support Desk
          </h1>
          <p className="text-zinc-400 text-xs max-w-2xl leading-relaxed">
            Welcome to the security center manual. Here you can search system states (like <strong className="text-teal-400 font-semibold font-mono">GAAS NOMINAL</strong>), run interactive simulations of the multi-agent Threat Interceptor, or chat directly with our custom automated support copilot.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 z-10">
          <button 
            onClick={() => onNavigateTab('overview')}
            className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-slate-300 font-sans text-xs font-bold transition-all hover:text-white cursor-pointer"
          >
            ← Back to Overview
          </button>
        </div>
        
        {/* Subtle decorative background glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Tab navigation selection */}
      <div className="flex border-[#1F2E40]/60 border-b gap-1.5 scrollbar-thin overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
            activeTab === 'docs' 
              ? 'text-white border-b-2 border-blue-500 bg-blue-500/5 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
          id="tab-btn-docs"
        >
          <Compass size={14} className={activeTab === 'docs' ? 'text-blue-400' : 'text-zinc-500'} />
          1. System Core Manual
        </button>

        <button
          onClick={() => setActiveTab('implementation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
            activeTab === 'implementation' 
              ? 'text-white border-b-2 border-blue-500 bg-blue-500/5 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
          id="tab-btn-implementation"
        >
          <Sliders size={14} className={activeTab === 'implementation' ? 'text-blue-400' : 'text-zinc-500'} />
          2. Client Onboarding Guide
          {currentUser.role !== 'Admin' && currentUser.role !== 'SuperAdmin' ? (
            <span className="ml-1 text-[8.5px] bg-red-500/15 text-red-400 border border-red-500/25 px-1.5 py-0.2 rounded leading-none font-bold flex items-center gap-0.5">
              <Lock size={8} /> Restricted
            </span>
          ) : (
            <span className="ml-1 text-[8.5px] bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/25 px-1.5 py-0.2 rounded leading-none font-bold">
              Step-by-Step
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
            activeTab === 'video' 
              ? 'text-white border-b-2 border-blue-500 bg-blue-500/5 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
          id="tab-btn-video"
        >
          <Video size={14} className={activeTab === 'video' ? 'text-blue-400' : 'text-zinc-500'} />
          3. Complete Video Tour
          <span className="ml-1 text-[8.5px] bg-blue-500/15 text-blue-400 border border-blue-500/25 px-1.5 py-0.2 rounded leading-none font-bold animate-pulse">
            Product Walkthrough
          </span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
            activeTab === 'simulator' 
              ? 'text-white border-b-2 border-blue-500 bg-blue-500/5 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
          id="tab-btn-simulator"
        >
          <Terminal size={14} className={activeTab === 'simulator' ? 'text-blue-400' : 'text-zinc-500'} />
          4. Threat Interceptor Sandbox
          <span className="ml-1 text-[8.5px] bg-red-500/15 text-red-540 border border-red-500/25 px-1 py-0.2 rounded leading-none">
            Interactive
          </span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
            activeTab === 'faq' 
              ? 'text-white border-b-2 border-blue-500 bg-blue-500/5 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
          id="tab-btn-faq"
        >
          <BookMarked size={14} className={activeTab === 'faq' ? 'text-blue-400' : 'text-zinc-500'} />
          5. Knowledge Base & FAQ
        </button>

        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
            activeTab === 'copilot' 
              ? 'text-white border-b-2 border-blue-500 bg-blue-500/5 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
          id="tab-btn-copilot"
        >
          <MessageSquare size={14} className={activeTab === 'copilot' ? 'text-blue-400' : 'text-zinc-500'} />
          6. Automated Support Copilot
          <span className="ml-1 text-[8.5px] bg-teal-500/15 text-teal-450 border border-teal-500/25 px-1 py-0.2 rounded leading-none font-bold animate-pulse">
            Live
          </span>
        </button>
      </div>

      {/* RENDER ACTIVE GUIDE MODULE PANEL */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* TAB 1: SYSTEM CORE MANUAL */}
        {activeTab === 'docs' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Core introduction banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-xl flex items-start gap-3.5 shadow-sm">
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                  <Cpu size={18} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">GaaS Governance Core</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Provides active proxy layers for major agent runtimes, assessing safety intent before executions take place.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-xl flex items-start gap-3.5 shadow-sm">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                  <Shield size={18} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Active Threat Interceptor</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Instantly quarantine rogue requests, drop toxic network commands, or halt multi-factor overspending with sub-100ms lag.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-xl flex items-start gap-3.5 shadow-sm">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shrink-0">
                  <Activity size={18} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Cognitive Observability</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Tracks LLM semantic alignment, monitors sentiment drift, and offers manual trigger points to force model realignment.
                  </p>
                </div>
              </div>
            </div>

            {/* In-depth Pillar Guides */}
            <div className="bg-[#111E2E]/40 border border-[#1F2E40]/70 rounded-xl p-5 space-y-6">
              <h2 className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-2">
                <Compass className="text-blue-400" size={16} />
                Interactive Core Pillar Breakdowns
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                {/* 1. Overview */}
                <div className="p-4 bg-[#111E2E] border border-[#1F2E40] rounded-lg space-y-2.5 relative group hover:border-[#1D9E75]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#1D9E75] font-black uppercase tracking-wider">Pillar I</span>
                    <button 
                      onClick={() => onNavigateTab('overview')}
                      className="text-[10px] text-zinc-400 hover:text-[#1D9E75] font-mono flex items-center gap-1 transition-colors"
                    >
                      Open Module →
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-105">⬡ Tactical Command Base / Unified Lifecycle</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    The control panel provides a birds-eye view of your connected agent nodes. The top widgets display overall metrics: <strong>Cognitive Health Score</strong> (average health across agents), <strong>Saved Labor ROI</strong>, and <strong>Active Threat Incidents</strong>.
                  </p>
                  <div className="pt-1.5 border-t border-zinc-900 flex gap-2">
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-zinc-500">Real-Time Stats</span>
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-zinc-400">Drift Logs Stream</span>
                  </div>
                </div>

                {/* 2. Kill-Switch */}
                <div className="p-4 bg-[#111E2E] border border-[#1F2E40] rounded-lg space-y-2.5 relative group hover:border-[#1D9E75]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-red-400 font-black uppercase tracking-wider">Pillar II</span>
                    <button 
                      onClick={() => onNavigateTab('secure')}
                      className="text-[10px] text-zinc-400 hover:text-red-400 font-mono flex items-center gap-1 transition-colors"
                    >
                      Open Module →
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-105">⏻ Kill-Switch / Active Threat Interceptor</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    This blocks hostile behavior on-the-fly. Look for the lists of completed <strong>Quarantined Packets</strong>. Each line displays the precise policy violated (e.g., Database Action, Wire Exceeded), along with raw JSON command code.
                  </p>
                  <div className="pt-1.5 border-t border-zinc-900 flex gap-2">
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-[#1D9E75]">Quarantine Log</span>
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-red-400">Bypass Guard Checks</span>
                  </div>
                </div>

                {/* 3. Observability */}
                <div className="p-4 bg-[#111E2E] border border-[#1F2E40] rounded-lg space-y-2.5 relative group hover:border-[#1D9E75]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400 font-black uppercase tracking-wider">Pillar III</span>
                    <button 
                      onClick={() => onNavigateTab('observe')}
                      className="text-[10px] text-zinc-400 hover:text-cyan-400 font-mono flex items-center gap-1 transition-colors"
                    >
                      Open Module →
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-105">◎ Observability & Drift Realignment</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Tracks semantic drifts in LLM interactions. If an agent drifts (for instance, adopting toxic personas or off-topic rules), it flags a <strong>Warning</strong>. Click the <span className="text-cyan-305 font-bold font-mono text-[9px] bg-cyan-950/60 px-1 py-0.2 rounded border border-cyan-850">Remediate</span> action to push targeted corrective prompt anchors.
                  </p>
                  <div className="pt-1.5 border-t border-zinc-900 flex gap-2">
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-cyan-400">Semantic Tracker</span>
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-zinc-500">Drift Mitigation</span>
                  </div>
                </div>

                {/* 4. Value Meter */}
                <div className="p-4 bg-[#111E2E] border border-[#1F2E40] rounded-lg space-y-2.5 relative group hover:border-[#1D9E75]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#EF9F27] font-black uppercase tracking-wider">Pillar IV</span>
                    <button 
                      onClick={() => onNavigateTab('measure')}
                      className="text-[10px] text-zinc-400 hover:text-[#EF9F27] font-mono flex items-center gap-1 transition-colors"
                    >
                      Open Module →
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-105">▦ Value Meter / Economic Process Tracker</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Tracks dollars against tasks. ROI displays your system yield. If individual api calls cost too much, the status highlights WARNING. Set your global <strong>Enterprise Budget Cap</strong> to automatically throttle secondary agent loops.
                  </p>
                  <div className="pt-1.5 border-t border-zinc-900 flex gap-2">
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-[#EF9F27]">ROI Formula</span>
                    <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-zinc-500">Global Budget Cap</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SSO FEDERATED IDENTITY & ROLE MATRIX PANEL - WITH ROLE-BASED VISIBILITY */}
            <div className="bg-[#111E2E]/40 border border-[#1F2E40]/70 rounded-xl p-5 space-y-5" id="sso-role-matrix-section">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2E40]/60 pb-3">
                <div className="space-y-1 text-left">
                  <h2 className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-2">
                    <Shield className="text-emerald-400" size={16} />
                    SSO Federated Identity & GaaS Role Matrix
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                    Defines complete system execution thresholds, key rotations, and API configuration clearances across the five federated user roles.
                  </p>
                </div>
                <div>
                  {(currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin') ? (
                    <span className="px-2.5 py-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ADMIN SECURE ACCESS
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-[10px] font-mono font-bold text-rose-400 bg-rose-950/20 border border-rose-500/20 rounded flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      RESTRICTED compliance VIEW
                    </span>
                  )}
                </div>
              </div>

              {(currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin') ? (
                /* Authorized Admin/SuperAdmin View of the Active Role Matrix and Permissions Grid */
                <div className="space-y-4 animate-in fade-in duration-200" id="role-matrix-unlocked">
                  <div className="overflow-x-auto rounded-lg border border-[#1F2E40]/60 bg-zinc-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#090e17] border-b border-[#1F2E40]/60 text-zinc-400 font-mono tracking-wider text-[10.5px]">
                          <th className="p-3.5 pl-4 font-bold border-r border-[#1F2E40]/40">FEDERATED SSO ROLE</th>
                          <th className="p-3.5 text-center font-bold">KILL-SWITCH</th>
                          <th className="p-3.5 text-center font-bold">MODIFY POLICIES</th>
                          <th className="p-3.5 text-center font-bold">GATEWAY SLAs</th>
                          <th className="p-3.5 text-center font-bold">MANAGE WORKSPACE</th>
                          <th className="p-3.5 font-bold border-l border-[#1F2E40]/40 pl-4">CLEARANCE STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F2E40]/40 text-zinc-300 font-mono text-[11px]">
                        <tr className="hover:bg-[#111E2E]/30 transition-colors">
                          <td className="p-3.5 pl-4 font-bold text-white border-r border-[#1F2E40]/40 flex items-center gap-2">
                            <span className="text-[#1D9E75]">💎</span> SuperAdmin
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 border-l border-[#1F2E40]/40 pl-4 text-emerald-400 font-bold">
                            LEVEL-A CORE ROOT (100% ACCESS)
                          </td>
                        </tr>
                        <tr className="hover:bg-[#111E2E]/30 transition-colors">
                          <td className="p-3.5 pl-4 font-bold text-white border-r border-[#1F2E40]/40 flex items-center gap-2">
                            <span>👤</span> Admin
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 border-l border-[#1F2E40]/40 pl-4 text-emerald-400 font-bold">
                            LEVEL-B SYSTEM EXECUTIVE (100% ACCESS)
                          </td>
                        </tr>
                        <tr className="hover:bg-[#111E2E]/30 transition-colors">
                          <td className="p-3.5 pl-4 font-bold text-zinc-300 border-r border-[#1F2E40]/40 flex items-center gap-2">
                            <span>⚡</span> PolicyManager
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">LOCKED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">LOCKED</span>
                          </td>
                          <td className="p-3.5 border-l border-[#1F2E40]/40 pl-4 text-amber-400 font-bold">
                            LEVEL-C POLICY DEPLOY & CALIBRATION
                          </td>
                        </tr>
                        <tr className="hover:bg-[#111E2E]/30 transition-colors">
                          <td className="p-3.5 pl-4 font-bold text-zinc-300 border-r border-[#1F2E40]/40 flex items-center gap-2">
                            <span>🛡️</span> Auditor
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">LOCKED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">LOCKED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">LOCKED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">LOCKED</span>
                          </td>
                          <td className="p-3.5 border-l border-[#1F2E40]/40 pl-4 text-indigo-400 font-bold">
                            LEVEL-D TELEMETRY AUDIT-ONLY ACCESS
                          </td>
                        </tr>
                        <tr className="hover:bg-[#111E2E]/30 transition-colors">
                          <td className="p-3.5 pl-4 font-bold text-zinc-300 border-r border-[#1F2E40]/40 flex items-center gap-2">
                            <span>⚙️</span> Operator
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">LOCKED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/25 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">ENABLED</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-zinc-550 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850">LOCKED</span>
                          </td>
                          <td className="p-3.5 border-l border-[#1F2E40]/40 pl-4 text-sky-400 font-bold">
                            LEVEL-E SYSTEMS CO-PILOT OVERRIDER
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3.5 rounded-lg bg-emerald-950/10 border border-emerald-500/20 text-left flex gap-2.5 items-center">
                    <CheckCircle2 size={14} className="text-[#1D9E75] shrink-0" />
                    <p className="text-[11px] text-zinc-300 leading-normal font-sans">
                      <strong>Guard Configuration Synced:</strong> Your verified administrative session has total mapping privileges. This system guides real-time middleware validation as defined in corporate schemas.
                    </p>
                  </div>
                </div>
              ) : (
                /* Role-Based Visibility Restricted State for PolicyManager, Auditor, Operator */
                <div className="relative rounded-lg overflow-hidden border border-zinc-900 bg-zinc-950/50 p-6 flex flex-col items-center justify-center text-center py-10 min-h-[180px] animate-in fade-in duration-200" id="role-matrix-locked">
                  {/* Mock, highly blurred dummy grid pattern */}
                  <div className="absolute inset-0 opacity-5 select-none blur-[4px] flex flex-col justify-between pointer-events-none p-4">
                    <div className="h-4 w-full bg-zinc-800 rounded" />
                    <div className="h-3 w-full bg-zinc-800 rounded" />
                    <div className="h-3 w-full bg-zinc-800 rounded" />
                  </div>

                  <div className="relative space-y-3.5 max-w-md mx-auto z-10 flex flex-col items-center">
                    <div className="p-2 w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                      <Lock size={16} className="animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">🔒 Administrative Clearance Required</h4>
                      <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                        Internal privacy protocols restrict view of the global role matrix to <strong>Admin</strong> or <strong>SuperAdmin</strong> roles. Your active role is <strong className="text-amber-500 font-mono">[{currentUser.role}]</strong>.
                      </p>
                      <p className="text-[10.5px] text-zinc-550 leading-relaxed font-sans">
                        Please use the SSO identity panel above to sign in with elevated clearances.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: NEW CLIENT IMPLEMENTATION & ONBOARDING GUIDE */}
        {activeTab === 'implementation' && (currentUser.role !== 'Admin' && currentUser.role !== 'SuperAdmin') && (
          <div className="p-8 rounded-xl bg-[#09090B] border border-zinc-900 text-center max-w-xl mx-auto my-12 space-y-6 animate-in fade-in duration-200" id="onboarding-guide-locked-container">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-500 animate-pulse">
              <Lock size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold font-display text-white">🔒 Client Onboarding Restricted</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                Your active role <strong className="text-zinc-200">[{currentUser.role}]</strong> is restricted from accessing client calibration configurations and telemetry endpoints.
              </p>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Corporate compliance rules require <strong>SuperAdmin</strong> or <strong>Admin</strong> access to authorize new client handshakes. Please select a user with elevated access rights to view or provision onboarding credentials.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setActiveTab('docs')}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-white rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer font-mono"
              >
                Return to System Core Manual
              </button>
            </div>
          </div>
        )}

        {/* TAB: NEW CLIENT IMPLEMENTATION & ONBOARDING GUIDE - AUTHORIZED ACCESS */}
        {activeTab === 'implementation' && (currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin') && (
          <div className="space-y-6 animate-in fade-in duration-200 text-left" id="onboarding-guide-container">
            {/* Header intro */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-[#111E2E] to-[#162030] border border-blue-500/20 text-left flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-teal-400 font-bold uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                  New Client Calibration Suite
                </span>
                <h2 className="text-base font-bold text-slate-105 font-display mt-1 leading-tight">
                  AgentsGuardian Step-by-Step Integration Protocol
                </h2>
                <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                  Go from raw codebase configurations to deep-packet proxy guardrails in 10 minutes. Click through our interactive configuration handbook to copy telemetry keys, insert proxy middleware snippets, and register live agent security nodes.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 py-1 bg-black/40 px-3.5 border border-[#1F2E40] rounded-xl font-mono text-[10.5px]">
                <span className="text-teal-400 animate-pulse font-extrabold font-mono">●</span> INTEGRATION VERIFIED: <span className="text-[#1D9E75] font-bold">NOMINAL</span>
              </div>
            </div>

            {/* Stepper Navigation */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 select-none h-auto bg-zinc-950/40 p-2 border border-zinc-900/60 rounded-xl">
              {[
                { step: 1, title: '🔑 Authentic Keying', desc: 'Secure Key Exchange' },
                { step: 2, title: '🚀 Outbound Proxy', desc: 'SDK / Webhook Hook' },
                { step: 3, title: '🛡️ Policy Mapping', desc: 'Boundaries Tuning' },
                { step: 4, title: '📡 Real-time telemetry', desc: 'Piping Diagnostics' },
                { step: 5, title: '⚡ Core Test run', desc: 'Sandbox Verification' }
              ].map((s) => (
                <button
                  key={s.step}
                  onClick={() => setActiveSetupStep(s.step)}
                  className={`p-3 rounded-lg flex flex-col items-center justify-center text-center transition-all cursor-pointer border ${
                    activeSetupStep === s.step
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                  }`}
                  id={`onboarding-step-link-${s.step}`}
                  type="button"
                >
                  <span className={`text-[8.5px] font-mono tracking-widest uppercase block ${
                    activeSetupStep === s.step ? 'text-blue-105' : 'text-zinc-500'
                  }`}>
                    STEP 0{s.step}
                  </span>
                  <span className="text-[11.5px] font-bold mt-1 block leading-none font-display">
                    {s.title}
                  </span>
                  <span className={`text-[9px] mt-0.5 block leading-normal opacity-80 ${
                    activeSetupStep === s.step ? 'text-white/85' : 'text-zinc-500'
                  }`}>
                    {s.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Step Contents */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 text-left space-y-6">
              
              {/* STEP 1 DETAIL */}
              {activeSetupStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                      <Compass size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Step 1: Security Handshake & Authenticated Key Exchange</h3>
                      <p className="text-zinc-500 text-[11px] mt-0.5">ESTABLISHING CRYPTOGRAPHICALLY SECURE CHANNELS FOR OUTBOUND TELEMETRY</p>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                    <p>
                      Before AgentsGuardian can intercept your autonomous network requests, your native application server must establish an identity trust binding. Every tenant receives a production-grade <strong>GaaS Tenant Access Token</strong> and custom API gateway keys.
                    </p>
                    <p>
                      Declare these secure strings in your client environment configuration settings (e.g., in a <code>.env</code> file in the root of your LangChain, AutoGen, or CrewAI workspace):
                    </p>
                  </div>

                  {/* Code Panel */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 bg-black/60 px-4 py-2 border-t border-x border-zinc-900 rounded-t-lg">
                      <span>CLIENT ENVIRONMENT VARIABLES (.ENV)</span>
                      <button 
                        onClick={() => {
                          const code = `AGENT_GUARDIAN_GATEWAY_URL="https://api.agentguardian.io/v1"\nAGENT_GUARDIAN_API_KEY="ag_prod_live_${currentUser.id.substring(0,8)}_enc"\nAGENT_GUARDIAN_CLIENT_ID="${currentUser.email}"\nAGENT_GUARDIAN_CLASS_LEVEL="ENTERPRISE_SECURE"`;
                          navigator.clipboard.writeText(code);
                          addToast({
                            type: 'success',
                            title: '📋 Credentials Config Copied',
                            message: 'Tenant environment variables copied successfully. Pasted into local configuration.'
                          });
                        }}
                        className="text-blue-400 hover:text-white transition-colors cursor-pointer text-[10px] font-semibold"
                        id="copy-env-btn"
                        type="button"
                      >
                        Copy Configuration Parameters
                      </button>
                    </div>
                    <pre className="w-full bg-black border border-zinc-900 p-4 rounded-b-lg font-mono text-[10.5px] text-[#1D9E75] overflow-x-auto space-y-1">
                      <div><span className="text-zinc-650 font-bold"># AgentsGuardian Central Security Gateway URL</span></div>
                      <div>AGENT_GUARDIAN_GATEWAY_URL=<span className="text-slate-100">"https://api.agentguardian.io/v1"</span></div>
                      <div><span className="text-zinc-650 font-bold"># Authorized Token Binding for client: {currentUser.name} ({currentUser.role})</span></div>
                      <div>AGENT_GUARDIAN_API_KEY=<span className="text-slate-100">"ag_prod_live_{currentUser.id.substring(0,8)}_enc"</span></div>
                      <div>AGENT_GUARDIAN_CLIENT_ID=<span className="text-slate-100">"{currentUser.email}"</span></div>
                      <div>AGENT_GUARDIAN_CLASS_LEVEL=<span className="text-slate-100">"ENTERPRISE_GaaS_LEVEL_IV"</span></div>
                    </pre>
                  </div>

                  <div className="p-4 rounded-lg bg-teal-500/5 border border-[#1D9E75]/25 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-[#1D9E75] shrink-0 mt-0.5" />
                    <div className="text-[11.5px] leading-relaxed text-zinc-400">
                      <span className="font-bold text-[#1D9E75] uppercase font-mono text-[10px] bg-[#1D9E75]/10 px-1.5 py-0.2 rounded mr-1.5">Compliance Checkpoint</span> 
                      Keep your <code>AGENT_GUARDIAN_API_KEY</code> confidential. The proxy automatically drops packets missing authorization signatures with an HTTP 401 unauthorized status.
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 DETAIL */}
              {activeSetupStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                      <Sliders size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Step 2: Proxy Router/Interceptor SDK Setup (Python & TS)</h3>
                      <p className="text-zinc-500 text-[11px] mt-0.5">ENABLING ACTIVE MIDDLEWARE PACKET FILTERING OVER OUTBOUND API LOOPS</p>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Once authentication variables are verified, route model outbound completions or network intent blocks through our secure interceptor. Choose your primary environment language SDK configuration:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Python SDK Setup */}
                    <div className="p-4 bg-black/40 border border-zinc-900 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-amber-500 font-extrabold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 uppercase">
                          Python Langchain / CrewAI
                        </span>
                        <button
                          onClick={() => {
                            const code = `# Install client\npip install agent-guardian-sdk\n\n# Configure Intercept\nfrom agent_guardian import GuardianClient, ShieldMiddleware\n\nguard_client = GuardianClient(\n    api_key="ag_prod_live_${currentUser.id.substring(0,8)}_enc",\n    gateway_url="https://api.agentguardian.io/v1"\n)\n\n# Secure existing crewai/langchain agents\nsmart_agent.add_middleware(ShieldMiddleware(client=guard_client))`;
                            navigator.clipboard.writeText(code);
                            addToast({
                              type: 'success',
                              title: '🐍 Python SDK Copied',
                              message: 'Python interception middleware blueprint was copied successfully.'
                            });
                          }}
                          className="text-[9px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          id="copy-python-code-btn"
                          type="button"
                        >
                          Copy Python [Ctrl+C]
                        </button>
                      </div>
                      <pre className="w-full bg-black p-3.5 rounded-lg font-mono text-[10px] text-zinc-350 overflow-x-auto space-y-1">
                        <div><span className="text-yellow-600 font-bold"># 1. Install SDK</span></div>
                        <div>pip install agent-guardian-sdk</div>
                        <div className="text-zinc-650 font-bold"># 2. Intercept Agent Instances</div>
                        <div><span className="text-[#1D9E75]">from</span> agent_guardian <span className="text-[#1D9E75]">import</span> GuardianClient, ShieldMiddleware</div>
                        <div>&nbsp;</div>
                        <div>client = GuardianClient(</div>
                        <div>&nbsp;&nbsp;api_key=<span className="text-teal-400">"ag_prod_live..."</span>,</div>
                        <div>&nbsp;&nbsp;gateway_url=<span className="text-teal-400">"https://api.agentguardian.io/v1"</span></div>
                        <div>)</div>
                        <div>&nbsp;</div>
                        <div className="text-zinc-650 font-bold"># Link with CrewAI or Custom LLM loops</div>
                        <div>my_agent.add_middleware(ShieldMiddleware(client=client))</div>
                      </pre>
                    </div>

                    {/* TypeScript Node SDK Setup */}
                    <div className="p-4 bg-black/40 border border-zinc-900 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-sky-500 font-extrabold bg-sky-500/10 px-2.5 py-0.5 rounded border border-sky-500/20 uppercase">
                          Node.js / React TS
                        </span>
                        <button
                          onClick={() => {
                            const code = `// Install via npm\nnpm install @agent-guardian/node-sdk\n\n// Import & config\nimport { GuardianProxy } from '@agent-guardian/node-sdk';\n\nconst guardProxy = new GuardianProxy({\n  apiKey: process.env.AGENT_GUARDIAN_API_KEY,\n  clientId: '${currentUser.email}'\n});\n\n// Intercept prior to completions\nconst result = await guardProxy.intercept({\n  intent: "delete user records from production DB",\n  frameworkStr: "autogen"\n});`;
                            navigator.clipboard.writeText(code);
                            addToast({
                              type: 'success',
                              title: '🛡️ Node SDK Snippet Copied',
                              message: 'TypeScript Node Interceptor blueprint copied successfully.'
                            });
                          }}
                          className="text-[9px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          id="copy-ts-code-btn"
                          type="button"
                        >
                          Copy Node.js TS [Ctrl+C]
                        </button>
                      </div>
                      <pre className="w-full bg-black p-3.5 rounded-lg font-mono text-[10px] text-zinc-350 overflow-x-auto space-y-1">
                        <div><span className="text-yellow-600 font-bold">// 1. Install Library</span></div>
                        <div>npm install @agent-guardian/node-sdk</div>
                        <div className="text-zinc-650">// 2. Configure Gateway Handler</div>
                        <div><span className="text-orange-400">import</span> &#123; GuardianProxy &#125; <span className="text-orange-400">from</span> <span className="text-teal-400">'@agent-guardian/node-sdk'</span>;</div>
                        <div>&nbsp;</div>
                        <div><span className="text-[#1D9E75]">const</span> proxy = <span className="text-[#1D9E75]">new</span> GuardianProxy(&#123;</div>
                        <div>&nbsp;&nbsp;apiKey: process.env.AGENT_GUARDIAN_API_KEY,</div>
                        <div>&nbsp;&nbsp;clientId: <span className="text-teal-400">'{currentUser.email}'</span></div>
                        <div>&#125;);</div>
                        <div>&nbsp;</div>
                        <div className="text-zinc-650">// 3. intercept raw completion packets</div>
                        <div><span className="text-[#1D9E75]">const</span> verdict = <span className="text-[#1D9E75]">await</span> proxy.intercept(intentBlock);</div>
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 DETAIL */}
              {activeSetupStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                      <Shield size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Step 3: Define Custom Threat Posture (Policy Regulation Model)</h3>
                      <p className="text-zinc-500 text-[11px] mt-0.5">ESTABLISHING HEURISTICS AND SEMANTIC BOUNDARIES FOR TELEMETRY EVALUATIONS</p>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                    <p>
                      AgentsGuardian scans outbound transactions across three core vectors: <strong>Security</strong>, <strong>Ethics & Bias</strong>, and <strong>Financial Spending Caps</strong>. In this step, Security Operators calibrate the strictness boundaries of each policy tier.
                    </p>
                  </div>

                  {/* Visual Configuration Board */}
                  <div className="p-5 rounded-xl border border-zinc-900 bg-black/30 space-y-4">
                    <h4 className="text-xs font-bold text-slate-100 uppercase tracking-widest font-mono">Suggested Active Policy Benchmarks</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900 text-left">
                        <span className="text-[9px] font-mono font-bold text-[#1D9E75] uppercase bg-[#1D9E75]/10 px-2 py-0.5 rounded border border-[#1D9E75]/20">Level I Robust</span>
                        <h5 className="font-semibold text-white text-[12px] mt-2">Permissive Policy</h5>
                        <p className="text-[10px] text-zinc-500 mt-1">Allows common SSH terminal scripts or API executions. Logs warning tokens without forcefully isolating agent threads unless explicit exfiltration patterns are matched.</p>
                      </div>

                      <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900 text-left">
                        <span className="text-[9px] font-mono font-bold text-blue-400 uppercase bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Level II Guarded</span>
                        <h5 className="font-semibold text-white text-[12px] mt-2">Standard Enterprise</h5>
                        <p className="text-[10px] text-zinc-500 mt-1">Restricts database write executions, limits total cost to $50.00 per agent task block, and monitors cognitive drift alerts actively using semantic scanners.</p>
                      </div>

                      <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900 text-left animate-pulse">
                        <span className="text-[9px] font-mono font-bold text-red-400 uppercase bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Level III Zero-Trust</span>
                        <h5 className="font-semibold text-white text-[12px] mt-2">Strict Defense Posture</h5>
                        <p className="text-[10px] text-zinc-500 mt-1">Disallows commands featuring any file modification script patterns. Absolute Kill-Switch triggers on any financial transaction above $10.00 instantly.</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between pt-1 border-t border-zinc-900">
                    <span>Active policies can be customized inside the primary 🛠️ <strong>Policy Engine</strong> page.</span>
                    <button 
                      onClick={() => onNavigateTab('policies')} 
                      className="text-[#1D9E75] hover:underline cursor-pointer font-bold"
                      type="button"
                    >
                      Configure Active Rules →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4 DETAIL */}
              {activeSetupStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                      <Activity size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Step 4: Connecting the Real-time Telemetry Gateway (Sentinel Logging)</h3>
                      <p className="text-zinc-500 text-[11px] mt-0.5">MONITORING CONTEXT FLUIDITY, TRANSACTION LEDGERS, AND HEALTH SIGNS</p>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-3 leading-relaxed text-left">
                    <p>
                      When proxy middleware routes run on client installations, execution heartbeats stream directly to the GaaS central command server. This fuels live telemetry charts and helps identify dangerous drift patterns dynamically.
                    </p>
                    <p>
                      To hook up the telemetry flow endpoint, ensure your application exports an authenticated telemetry bundle. AgentsGuardian handles high-frequency pipelines automatically at sub-10ms rates:
                    </p>
                  </div>

                  {/* Telemetry connection blueprint */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900 text-left space-y-3">
                    <h4 className="text-xs font-mono font-bold text-[#1D9E75] flex items-center gap-1.5 uppercase">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Automatic Telemetry Uplink Code Sample
                    </h4>
                    
                    <pre className="w-full bg-black p-3.5 rounded-lg font-mono text-[10px] text-zinc-350 overflow-x-auto">
                      <div><span className="text-[#1D9E75]">import</span> &#123; TelemetrySentinel &#125; <span className="text-[#1D9E75]">from</span> <span className="text-teal-400">'@agent-guardian/node-sdk'</span>;</div>
                      <div>&nbsp;</div>
                      <div><span className="text-[#1D9E75]">const</span> sentinel = <span className="text-[#1D9E75]">new</span> TelemetrySentinel(&#123;</div>
                      <div>&nbsp;&nbsp;telemetryEndpoint: <span className="text-teal-400">"https://telemetry.agentguardian.io"</span>,</div>
                      <div>&nbsp;&nbsp;feedRate: <span className="text-teal-400">"10s"</span>, <span className="text-zinc-500">// Push heartbeat intervals</span></div>
                      <div>&nbsp;&nbsp;flushOnFatal: <span className="text-slate-100">true</span></div>
                      <div>&#125;);</div>
                      <div>&nbsp;</div>
                      <div><span className="text-zinc-505">// Capture model alignment indexes</span></div>
                      <div>sentinel.pipeActiveDiagnostics((report) =&gt; &#123;</div>
                      <div>&nbsp;&nbsp;console.log("[HEARTBEAT] Telemetry packet successfully dispatched to Central Gateway with low latency");</div>
                      <div>&#125;);</div>
                    </pre>
                  </div>
                </div>
              )}

              {/* STEP 5 DETAIL */}
              {activeSetupStep === 5 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                      <Terminal size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Step 5: Testing & Dynamic Sandbox Verification</h3>
                      <p className="text-zinc-500 text-[11px] mt-0.5">TRIGGERING MANUAL VERIFICATION CHECKS TO ENSURE SHIELD CALIBRBITS ARE HEALTHY</p>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Verify compliance before pushing agent instances to real user transactions. You can trigger simulated threats, exfiltration payloads, and drift anomalies right here to test your integrated rules safely.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3">
                      <h4 className="text-[12px] font-bold text-[#F0EEE6]">🧪 Manual CLI Verification Tool</h4>
                      <p className="text-[11.5px] text-zinc-500 leading-relaxed">
                        Execute our custom Node check utility locally to verify that credentials parameter variables, API paths, and compliance rules are correctly established:
                      </p>
                      <pre className="p-3 bg-black rounded border border-zinc-900 font-mono text-[10px] text-teal-400 overflow-x-auto select-all">
                        {`npx @agent-guardian/cli test-handshake --apiKey=ag_prod_live_${currentUser.id.substring(0,8)}_enc`}
                      </pre>
                    </div>

                    <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[12px] font-bold text-[#F0EEE6]">🎮 Virtual Sandbox Intrusion Test</h4>
                        <p className="text-[11.5px] text-zinc-500 leading-relaxed">
                          Want to test the active Kill-Switch gateway visually before writing python middleware? Use our interactive simulation suite to test quarantine behavior immediately.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('simulator')}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-2"
                        id="run-sandbox-sandbox-btn"
                        type="button"
                      >
                        <Terminal size={12} /> Run Sandbox Sandbox Sandbox Interactive Test
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-[#1D9E75]/30 text-left">
                    <h4 className="text-xs font-bold text-[#1D9E75] flex items-center gap-1.5 uppercase font-mono">
                      <CheckCircle2 size={13} className="text-[#1D9E75]" />
                      CALIBRATION COMPLETED
                    </h4>
                    <p className="text-[11.5px] text-zinc-400 mt-1 leading-relaxed">
                      If these five steps reporting nominal handshakes compile successfully, your workspace is secure! GaaS interceptors are hot-running, safeguarding endpoints against rogue intent, semantic deterioration, and budgetary overruns. Welcome, and safe operations!
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* TAB: WALKTHROUGH VIDEO TOUR */}
        {activeTab === 'video' && (
          <div className="space-y-6 animate-in fade-in duration-200 text-left" id="walkthrough-video-tour">
            {/* Header intro */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-[#111E2E] to-[#162030] border border-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  Interactive Media Center
                </span>
                <h2 className="text-base font-bold text-slate-100 font-display mt-1 leading-tight flex items-center gap-2">
                  <Video size={16} className="text-blue-400" />
                  AgentsGuardian HD Walkthrough & Demo Tour
                </h2>
                <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                  Watch a complete step-by-step video representation of how AgentsGuardian operates. Use the media playheads below to pause, scan chapters, toggle speed adjustments, or toggle custom subtitles and captions.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 py-1 bg-blue-500/10 px-3 border border-blue-500/20 rounded-xl font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                VIDEO LENGTH: 4:00 MINS (240s)
              </div>
            </div>

            {/* Main Video Deck Grid: Player + Segments Menu */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Media Player Column */}
              <div className="lg:col-span-3 space-y-4">
                
                {/* Virtual Embedded Player Canvas */}
                <div 
                  ref={playerRef}
                  className={`bg-[#090e17] border border-[#1f2e40] overflow-hidden shadow-2xl flex flex-col justify-between group transition-all duration-300 ${
                    isFullscreen 
                      ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none p-4 bg-[#05070f]' 
                      : 'relative aspect-video rounded-2xl'
                  }`}
                >
                  
                  {/* Subtle Scanline Overlay for retro cinematic vibe */}
                  <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/[0.0125] to-transparent pointer-events-none z-10 bg-[size:100%_4px]" />

                  {/* Top Bar: Active Chapter Title */}
                  <div className="bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-mono font-bold tracking-widest text-[#1D9E75] bg-[#1D9E75]/10 px-2 py-0.5 rounded border border-[#1D9E75]/20 uppercase">
                        {VIDEO_SEGMENTS[activeSegmentIndex].badge}
                      </span>
                      <span className="text-xs text-white/90 font-bold font-display">
                        {VIDEO_SEGMENTS[activeSegmentIndex].title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-black/80 border border-zinc-800/80 p-0.5 rounded-lg flex items-center text-[10px] font-mono font-bold">
                        <button
                          onClick={() => setVideoViewMode('live')}
                          className={`px-2 py-1 rounded transition-all cursor-pointer ${
                            videoViewMode === 'live' 
                              ? 'bg-blue-600 font-white text-white shadow-sm' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Live Simulator
                        </button>
                        <button
                          onClick={() => setVideoViewMode('cinematic')}
                          className={`px-2 py-1 rounded transition-all cursor-pointer ${
                            videoViewMode === 'cinematic' 
                              ? 'bg-blue-600 font-white text-white shadow-sm' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Cinematic Cards
                        </button>
                      </div>
                      <span className="text-[10.5px] font-mono text-zinc-400 hidden md:inline">
                        1080p HD
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Frame Screen Video Content Area */}
                  <div className="absolute inset-0 flex items-center justify-center p-6 bg-radial from-transparent to-black/90">
                    {videoViewMode === 'live' ? (
                      <div className="w-full h-full flex flex-col bg-[#05070f] border border-[#1f2e40] rounded-xl overflow-hidden animate-in zoom-in-95 duration-300 relative text-left">
                        {/* Virtual Browser chrome header */}
                        <div className="flex items-center justify-between px-3 py-1 bg-black/90 border-b border-zinc-900 select-none">
                          <div className="flex items-center gap-1.5 font-mono">
                            <div className="w-2 h-2 rounded-full bg-red-500/85" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/85" />
                            <div className="w-2 h-2 rounded-full bg-emerald-500/85" />
                            <span className="text-[9px] text-[#1D9E75] ml-2 select-all font-semibold max-w-[200px] truncate">https://agentguardian.io/console/{VIDEO_SEGMENTS[activeSegmentIndex].id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded font-mono text-[8.5px] text-blue-400 font-extrabold tracking-widest uppercase animate-pulse">
                              LIVE INTERACTIVE SIMULATION
                            </span>
                          </div>
                        </div>
                        {/* Frame body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative h-0">
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "overview" && (
                            <Overview 
                              policies={policies}
                              currentUser={currentUser}
                              addToast={addToast}
                              onNavigateTab={onNavigateTab}
                              killEvents={killEvents}
                              driftEvents={driftEvents}
                              valueMetrics={valueMetrics}
                              avgLatency={23}
                              overallRoi={3.4}
                              overallCognitiveHealth={89}
                              apiLogs={apiLogs}
                            />
                          )}
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "secure" && (
                            <SecurePillar 
                              killEvents={killEvents}
                              policies={policies}
                              onTriggerKillEvent={() => {}}
                              onClearLogs={() => {}}
                            />
                          )}
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "observe" && (
                            <ObservePillar 
                              driftEvents={driftEvents}
                              policies={policies}
                              onRemediateDrift={() => {}}
                              onAddDriftEvent={() => {}}
                              addToast={addToast}
                              currentUser={currentUser}
                            />
                          )}
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "measure" && (
                            <MeasurePillar 
                              valueMetrics={valueMetrics}
                              onRefineAgent={() => {}}
                              onAddMetricEvent={() => {}}
                              budgetCap={budgetCap}
                              onUpdateBudgetCap={() => {}}
                            />
                          )}
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "gaas" && (
                            <GaaSApiPillar 
                              policies={policies}
                              onTriggerKillEvent={() => {}}
                              onAddMetricEvent={() => {}}
                              governedAgents={governedAgents}
                              setGovernedAgents={() => {}}
                              apiLogs={apiLogs}
                              setApiLogs={() => {}}
                              autoRefreshInterval="off"
                              setAutoRefreshInterval={() => {}}
                              latencyThreshold={latencyThreshold}
                              setLatencyThreshold={() => {}}
                              addToast={addToast}
                              currentUser={currentUser}
                            />
                          )}
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "policies" && (
                            <PolicyConfig 
                              policies={policies}
                              onTogglePolicy={() => {}}
                              onAddPolicy={() => {}}
                              onDeletePolicy={() => {}}
                            />
                          )}
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "admin" && (
                            <AdminPillar 
                              currentUser={currentUser}
                              users={users}
                              setUsers={() => {}}
                              addToast={addToast}
                              disableAlertsGlobally={false}
                              setDisableAlertsGlobally={() => {}}
                            />
                          )}
                          {VIDEO_SEGMENTS[activeSegmentIndex].id === "help" && (
                            <div className="p-4 text-center space-y-4 max-w-sm mx-auto my-auto animate-in fade-in">
                              <span className="p-2 bg-blue-500/10 rounded-full text-blue-400 inline-block">
                                <Search size={22} />
                              </span>
                              <h3 className="font-bold text-slate-200 font-display text-xs">Self-Service Playbook Desk</h3>
                              <p className="text-zinc-400 leading-relaxed text-[11px]">
                                Access immediate assistance, read through system guidelines in the setup guides, or query our intelligent Copilot directly in the companion tabs above!
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Scene 1: Trust Handshake Overview */}
                        {VIDEO_SEGMENTS[activeSegmentIndex].id === "overview" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#0a111a] border border-blue-500/20 rounded-xl animate-in zoom-in-95 duration-300 relative overflow-hidden text-left">
                        <div className="absolute -left-16 -top-16 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl" />
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Shield className="text-blue-400" size={14} />
                            <span className="text-[10px] font-mono font-bold text-slate-350">CORE GOVERNANCE BOOT MANAGER</span>
                          </div>
                          <span className="text-[9px] font-mono text-emerald-400">STATE: MUTUAL_TRUST_OK</span>
                        </div>

                        <div className="my-auto space-y-3 max-w-md mx-auto text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-1 animate-bounce">
                            <Shield size={20} />
                          </div>
                          <h4 className="text-xs font-bold text-slate-100 font-display">Governance Handshake Secured</h4>
                          <div className="p-2 bg-black/60 border border-zinc-900 rounded-lg font-mono text-[9.5px] text-zinc-400 space-y-1 block text-left">
                            <div><strong className="text-blue-400 font-mono">STEP 1:</strong> CLIENT Key Signature Challenge: <span className="text-yellow-400">VALID</span></div>
                            <div><strong className="text-blue-400 font-mono">STEP 2:</strong> Check tenant access control schema: <span className="text-emerald-400">SUCCESS</span></div>
                            <div><strong className="text-blue-400 font-mono">STEP 3:</strong> Compile & sync client policy filters... <span className="text-emerald-400">ACTIVE [ZERO-LEAK]</span></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9.5px] font-mono text-zinc-500 border-t border-zinc-900 pt-2">
                          <span>TRUST DECREE: TLS 1.3 AES_256_GCM</span>
                          <span className="text-blue-400 font-bold">SYSTEM INTEGRITY NOMINAL</span>
                        </div>
                      </div>
                    )}

                    {/* Scene 2: Tech Cockpit */}
                    {VIDEO_SEGMENTS[activeSegmentIndex].id === "observe" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#0e1622]/95 border border-blue-500/20 rounded-xl animate-in zoom-in-95 duration-300 relative overflow-hidden text-left">
                        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl" />
                        
                        <div className="flex items-center justify-between border-b border-zinc-950 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Compass className="text-blue-400" size={14} />
                            <span className="text-[10px] font-mono font-bold text-slate-350">CORE COCKPIT OBSERVER</span>
                          </div>
                          <span className="text-[9px] font-mono text-teal-400">GAAS PERSISTENCE STATE: DIRECT</span>
                        </div>

                        {/* stats cards and threat indicator */}
                        <div className="grid grid-cols-3 gap-3 my-auto">
                          <div className="p-2.5 bg-black/50 border border-[#1f2e40] rounded-xl text-center space-y-1">
                            <span className="text-[8.5px] font-mono text-zinc-500 block uppercase font-bold">TOTAL VOLUME</span>
                            <span className="text-sm font-black font-display text-white block">14,212</span>
                            <span className="text-[8.5px] text-[#1D9E75] font-mono font-bold">↑ 100% SECURED</span>
                          </div>
                          <div className="p-2.5 bg-black/50 border border-[#1f2e40] rounded-xl text-center space-y-1">
                            <span className="text-[8.5px] font-mono text-zinc-500 block uppercase font-bold">ROUTING TIME</span>
                            <span className="text-sm font-black font-display text-blue-400 block">11.8 ms</span>
                            <span className="text-[8.5px] text-teal-400 font-mono font-bold">SUB-15MS INGRESS</span>
                          </div>
                          <div className="p-2.5 bg-[#111216]/60 border border-red-500/20 rounded-xl text-center space-y-1">
                            <span className="text-[8.5px] font-mono text-red-400 block uppercase font-bold">MUTED HAZARDS</span>
                            <span className="text-sm font-black font-display text-red-400 block">512</span>
                            <span className="text-[8.5px] text-zinc-400 font-mono">QUARANTINED SYSTEM</span>
                          </div>
                        </div>

                        {/* graph */}
                        <div className="h-8 w-full flex items-end gap-1 px-2 border-b border-zinc-900">
                          {[30, 45, 35, 78, 55, 42, 89, 32, 51, 65, 23, 58, 93, 38, 48, 63, 85, 52, 28, 45].map((h, i) => (
                            <div 
                              key={i} 
                              className={`w-full rounded-t-sm transition-all duration-300 ${
                                i % 4 === 0 ? 'bg-red-500/60' : 'bg-blue-500/50'
                              }`} 
                              style={{ height: `${h}%` }} 
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scene 3: Gateway Filter */}
                    {VIDEO_SEGMENTS[activeSegmentIndex].id === "gaas" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#080d15] border border-blue-500/15 rounded-xl animate-in zoom-in-95 duration-300 text-left">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Sliders className="text-blue-400" size={14} />
                            <span className="text-[10px] font-mono font-bold text-slate-350">GATEWAY DEEP PACKET FILTERS</span>
                          </div>
                          <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.2 rounded font-bold uppercase">Active Guard</span>
                        </div>

                        <div className="space-y-2 font-mono text-[9.5px] my-auto">
                          <div className="p-2 rounded bg-black border border-zinc-900 leading-relaxed text-zinc-400">
                            <div><strong className="text-blue-400 font-mono">[INBOUND REQUEST]</strong> model: <span className="text-white">"gemini-2.5-flash"</span></div>
                            <div><strong className="text-zinc-500 font-mono">[PARAMETERS]</strong> temp: <span className="text-white">0.2</span>, max_tokens: <span className="text-white">8192</span></div>
                            <div className="text-zinc-500 mt-1">{`[HEURISTIC CHECK] checking parameter payload keys for unauthorized shells...`}</div>
                            <div className="text-emerald-400 font-semibold">{`Result: Code execution checks [PASS] - Zero shells detected.`}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-900 pt-2">
                          <span>INTERCEPT RATIO: 100% SECURE</span>
                          <span className="text-emerald-400 font-black">NO EXFILTRATION RISK</span>
                        </div>
                      </div>
                    )}

                    {/* Scene 4: Interactive Sandbox */}
                    {VIDEO_SEGMENTS[activeSegmentIndex].id === "secure" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#050608]/95 border border-red-500/20 rounded-xl animate-in zoom-in-95 duration-300 relative text-left">
                        {/* Terminal simulation */}
                        <div className="flex items-center justify-between border-b border-red-955 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Terminal className="text-red-400 animate-pulse" size={14} />
                            <span className="text-[10px] font-mono font-bold text-red-400">ACTIVE INTRUSION MONITOR & sandbox</span>
                          </div>
                          <span className="text-[9px] font-mono bg-red-500/25 text-red-400 px-2 py-0.2 rounded font-bold border border-red-500/30 font-mono">BREACH BLOCKED</span>
                        </div>

                        <div className="my-auto font-mono text-[9px] space-y-1 block leading-relaxed text-left max-w-lg bg-black/40 p-2.5 rounded border border-zinc-90 w-full">
                          <div className="text-zinc-500">{`[09:12:44] FinancialBot_v4 execution loop initiated...`}</div>
                          <div className="text-zinc-400">{`> Hitting endpoint: https://api.bank.com/v1/wire-transfer/execute`}</div>
                          <div className="text-red-400 font-extrabold flex items-center gap-1">
                            <span>⚠️ [EXFILTRATION DETECTED] - Private environment telemetry logged inside prompt</span>
                          </div>
                          <div className="text-amber-400 font-bold">{`[VERDICT]: INTERCEPT ACTIVE - Malicious Packet Terminated`}</div>
                          <div className="text-[#1D9E75] font-semibold">{`[DURABLE RESOLUTION]: Sandbox quarantined loop; zero data lost.`}</div>
                        </div>

                        <div className="flex items-center justify-between bg-red-950/20 p-2 rounded border border-red-500/10 w-full">
                          <span className="text-[9.5px] font-mono text-zinc-400">COGNITIVE SAFETY: <strong className="text-red-400">62% [CRITICAL DRIFT]</strong></span>
                          <span className="text-[9.5px] font-mono text-red-500 font-bold">1 SEVERE ATTACK DROPPED</span>
                        </div>
                      </div>
                    )}

                    {/* Scene 7: Enterprise Settings & IAM Operator Board */}
                    {VIDEO_SEGMENTS[activeSegmentIndex].id === "admin" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#0a0c10] border border-blue-500/15 rounded-xl animate-in zoom-in-95 duration-300 text-left">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Sliders className="text-zinc-400" size={14} />
                            <span className="text-[10px] font-mono font-bold text-slate-350">ROLE-BASED ACCESS CONTROL (IAM)</span>
                          </div>
                          <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.2 rounded font-bold uppercase">SSO FEDERATED</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 my-auto font-sans">
                          <div className="p-2 bg-black border border-zinc-900 rounded-lg font-mono text-[9.5px]">
                            <div className="text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Active Operators</div>
                            <div className="flex items-center justify-between text-zinc-350 py-0.5 border-b border-zinc-900/40">
                              <span>m_singh@guardian</span>
                              <span className="text-[#1D9E75] font-bold text-[9px]">SUPER_ADMIN</span>
                            </div>
                            <div className="flex items-center justify-between text-zinc-350 py-0.5 border-b border-zinc-900/40">
                              <span>compliance_auditor</span>
                              <span className="text-blue-400 font-bold text-[9px]">AUDITOR</span>
                            </div>
                            <div className="flex items-center justify-between text-zinc-300 py-0.5">
                              <span>sec_eng_01@node</span>
                              <span className="text-yellow-500 font-bold text-[9px]">OPERATOR</span>
                            </div>
                          </div>

                          <div className="p-2 bg-zinc-900/40 border border-zinc-900/80 rounded-lg font-mono text-[9px] text-zinc-400 space-y-1">
                            <div className="text-zinc-500 font-bold uppercase">Session Enforcements</div>
                            <div>• Session Idle Limit: <strong className="text-white">15 Min</strong></div>
                            <div>• MFA Enforcement: <strong className="text-[#1D9E75]">FORCE_ON</strong></div>
                            <div>• Encryption Key: <strong className="text-white font-bold">AES_256_GCM</strong></div>
                            <div className="text-[#1D9E75] font-bold mt-1">✓ SSL CERTIFICATE PINNING ACTIVE</div>
                          </div>
                        </div>

                        <div className="text-[9.5px] font-mono text-zinc-500 text-left flex items-center justify-between border-t border-zinc-900 pt-2">
                          <span>SAML Identity Provider connected.</span>
                          <span className="text-blue-400 font-bold font-mono">IAM SECURED</span>
                        </div>
                      </div>
                    )}

                    {/* Scene 6: Spend Guardrails */}
                    {VIDEO_SEGMENTS[activeSegmentIndex].id === "measure" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#0f0e14] border border-amber-500/20 rounded-xl animate-in zoom-in-95 duration-300 text-left">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Sliders className="text-amber-500" size={14} />
                            <span className="text-[10px] font-mono font-bold text-zinc-350">BUDGET CAPS & SPEND CONTROLLER</span>
                          </div>
                          <span className="text-[9.5px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.2 rounded font-bold">SPEND LIMITS ENGAGED</span>
                        </div>

                        <div className="space-y-2 my-auto">
                          <div className="flex items-center justify-between text-[11px] text-zinc-405">
                            <span>Hourly Budget Pool Cap:</span>
                            <span className="font-extrabold text-[#1D9E75] font-mono">$50.00 / Hour</span>
                          </div>
                          <div className="w-full h-2 bg-zinc-950 rounded-full border border-zinc-900 overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 bg-[#1D9E75] w-2/3" />
                          </div>
                          <div className="p-2 bg-yellow-500/5 border border-yellow-500/10 rounded font-mono text-[9px] text-left text-yellow-500 leading-relaxed">
                            <strong className="font-mono">LIMIT NOTIFICATION TRIGGERED:</strong> Tenant agent-tier-B consumption tracked at $38.45. Auto isolation is primed at 85% capacity threshold.
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9.5px] font-mono text-zinc-500 border-t border-zinc-900 pt-2">
                          <span>RUNNING COST: NOMINAL COMPLIANT</span>
                          <span className="text-blue-400">NO OVERAGE THREAT</span>
                        </div>
                      </div>
                    )}

                    {/* Scene 7: Policies */}
                    {VIDEO_SEGMENTS[activeSegmentIndex].id === "policies" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#0a0f1d]/95 border border-blue-500/20 rounded-xl animate-in zoom-in-95 duration-300 text-left">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Shield className="text-yellow-500" size={14} />
                            <span className="text-[10px] font-mono font-bold text-zinc-350">ACTIVE POLICY POSTURE TUNER</span>
                          </div>
                          <span className="text-[9px] font-mono text-rose-400 font-bold uppercase bg-rose-500/10 px-2 py-0.2 rounded border border-rose-500/25">Level III Zero-Trust</span>
                        </div>

                        {/* Three Pillars simulation */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 my-auto text-left">
                          <div className="p-1.5 bg-black/45 border border-rose-500/25 rounded-lg">
                            <span className="text-[8px] font-mono text-rose-400 font-extrabold px-1.5 py-0.2 bg-rose-500/10 rounded border border-rose-500/25 uppercase tracking-widest block w-fit">SECURITY</span>
                            <h5 className="font-bold text-white text-[10px] mt-1 font-display">Shell Lock</h5>
                            <p className="text-[8.5px] text-zinc-400 mt-0.5 leading-tight">Drop packets instantly if unix shells are used.</p>
                          </div>
                          <div className="p-1.5 bg-black/45 border border-[#1f2e40] rounded-lg">
                            <span className="text-[8px] font-mono text-blue-400 font-extrabold px-1.5 py-0.2 bg-blue-500/10 rounded border border-blue-500/25 uppercase tracking-widest block w-fit">COGNITIVE</span>
                            <h5 className="font-bold text-white text-[10px] mt-1 font-display">Drift limit</h5>
                            <p className="text-[8.5px] text-zinc-400 mt-0.5 leading-tight">Restrict answers with scores below 75%.</p>
                          </div>
                          <div className="p-1.5 bg-black/45 border border-rose-500/25 rounded-lg">
                            <span className="text-[8px] font-mono text-rose-400 font-extrabold px-1.5 py-0.2 bg-rose-500/10 rounded border border-rose-500/25 uppercase tracking-widest block w-fit">FINANCIAL</span>
                            <h5 className="font-bold text-white text-[10px] mt-1 font-display">API caps</h5>
                            <p className="text-[8.5px] text-zinc-400 mt-0.5 leading-tight">Block payments exceeding ten dollars.</p>
                          </div>
                        </div>

                        <div className="text-[9.5px] font-mono text-zinc-400 text-left bg-black/20 p-2 border border-zinc-900 rounded flex items-center justify-between">
                          <span>Filters compiled securely and distributed globally.</span>
                          <span className="text-rose-400 font-bold">ZERO TRUST IN USE</span>
                        </div>
                      </div>
                    )}

                    {/* Scene 8: Playbook & Help Setup */}
                    {VIDEO_SEGMENTS[activeSegmentIndex].id === "help" && (
                      <div className="w-full h-full flex flex-col justify-between p-4 bg-[#0a0f1d]/95 border border-teal-500/20 rounded-xl animate-in zoom-in-95 duration-300 text-left">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Sliders className="text-blue-400" size={14} />
                            <span className="text-[10px] font-mono font-bold text-zinc-350">LIGHTWEIGHT SDK INTEGRATION SUITE</span>
                          </div>
                          <span className="text-[9px] font-mono text-teal-400">CONNECTING OK</span>
                        </div>

                        {/* Interactive SDK setup display */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-auto text-left">
                          <div className="p-1.5 bg-black rounded border border-zinc-900 font-mono text-[9px] text-[#1D9E75] space-y-1 overflow-x-auto">
                            <div><span className="text-zinc-500"># Install intermediate client</span></div>
                            <div>pip install agent-guardian-sdk</div>
                            <div className="text-zinc-500"># Connect your model loops</div>
                            <div>from agent_guardian import Shield</div>
                            <div>shield = Shield(api_key="ag_prod...")</div>
                          </div>

                          <div className="p-1.5 bg-zinc-950 rounded border border-zinc-900 font-mono text-[9px] space-y-1 overflow-x-auto text-zinc-400">
                            <div className="text-blue-400 font-bold">{`$ npx agent-guardian test-handshake`}</div>
                            <div className="text-zinc-500">{`Testing tenant connection details...`}</div>
                            <div className="text-[#1D9E75] font-extrabold">{`Credentials verified: [SUCCESS]`}</div>
                            <div className="text-white font-black">{`STATE: ACTIVE_GUARD_ENGAGED`}</div>
                          </div>
                        </div>

                        <div className="text-[10px] text-zinc-550 leading-relaxed text-left flex items-center justify-between">
                          <span>Complete setup in under ten minutes.</span>
                          <span className="text-blue-400 font-bold font-mono text-[9px] bg-blue-500/10 px-2 py-0.2 rounded border border-blue-500/20">SDK VERIFIED</span>
                        </div>
                      </div>
                    )}
                      </>
                    )}

                  </div>

                  {/* Playback Indicator overlays when paused */}
                  {!isVideoPlaying && (
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-blue-600/95 hover:bg-blue-500 text-white flex items-center justify-center shadow-2xl transition-all border border-blue-400/40 hover:scale-105 cursor-pointer z-20"
                      id="video-player-overlay-play-btn"
                      type="button"
                    >
                      <Play size={26} className="ml-1 fill-white" />
                    </button>
                  )}

                  {/* BOTTOM: CONTROLS DECK */}
                  <div className="bg-gradient-to-t from-black/98 via-black/90 to-transparent p-4 z-10 space-y-3 pt-8">
                    
                    {/* Live captions panel */}
                    {showCaptions && (
                      <div className="bg-black/85 border border-zinc-800/40 p-2.5 rounded-lg text-center text-[11.5px] text-zinc-100 font-sans leading-normal shadow-lg transition-all mx-auto max-w-xl min-h-12 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <p className="font-medium text-white/95 text-xs text-left md:text-center">
                          <span className="text-blue-400 font-extrabold font-mono mr-1.5 uppercase tracking-wide text-[9px] bg-blue-500/10 py-0.5 px-2 rounded border border-blue-500/20">Narrator Voice</span>
                          "{VIDEO_SEGMENTS[activeSegmentIndex].narrator}"
                        </p>
                      </div>
                    )}



                    {/* Timeline Slider head */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-zinc-400 w-9 text-right select-none">
                        {Math.floor(videoTime / 60)}:{String(videoTime % 60).padStart(2, '0')}
                      </span>
                      
                      {/* Interactive slide timeline control */}
                      <div className="flex-1 relative h-1.5 bg-zinc-800/65 rounded-full cursor-pointer overflow-hidden group/timeline">
                        {/* Buffered indicators */}
                        <div className="absolute inset-y-0 left-0 bg-zinc-700/40 w-[95%]" />
                        
                        {/* Play progress fill */}
                        <div 
                          className="absolute inset-y-0 left-0 bg-blue-500" 
                          style={{ width: `${(videoTime / 240) * 100}%` }}
                        />
                        
                        {/* Seek slider input overlay */}
                        <input
                          type="range"
                          min="0"
                          max="240"
                          value={videoTime}
                          onChange={(e) => {
                            const newTime = parseInt(e.target.value);
                            setVideoTime(newTime);
                            // Set appropriate segment
                            const segIndex = VIDEO_SEGMENTS.findIndex(s => newTime >= s.start && newTime < s.end);
                            if (segIndex !== -1) setActiveSegmentIndex(segIndex);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          id="video-timeline-playback-slider"
                        />
                      </div>
                      
                      <span className="text-[10px] font-mono text-zinc-500 w-9 text-left select-none">
                        4:00
                      </span>
                    </div>

                    {/* Control Buttons Deck row */}
                    <div className="flex items-center justify-between">
                      {/* Left: Playhead, Skip, speed, volume */}
                      <div className="flex items-center gap-4">
                        {/* Play or Pause */}
                        <button
                          onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                          className="text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title={isVideoPlaying ? "Pause Walkthrough" : "Play Walkthrough"}
                          id="video-control-play-pause-btn"
                          type="button"
                        >
                          {isVideoPlaying ? <Pause size={18} /> : <Play size={18} className="fill-slate-200" />}
                        </button>

                        {/* Mute and Volume slider */}
                        <div className="flex items-center gap-1.5 group/volume">
                          <button
                            onClick={() => setIsVideoMuted(!isVideoMuted)}
                            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            id="video-control-mute-toggle-btn"
                            type="button"
                          >
                            {isVideoMuted || videoVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={isVideoMuted ? 0 : videoVolume}
                            onChange={(e) => {
                              setVideoVolume(parseInt(e.target.value));
                              if (isVideoMuted) setIsVideoMuted(false);
                            }}
                            className="w-16 h-1 mt-0.5 bg-zinc-800 accent-blue-500 rounded-lg cursor-pointer max-sm:hidden"
                            id="video-control-volume-slider"
                          />
                        </div>

                        {/* Speech Caption display options */}
                        <button
                          onClick={() => setShowCaptions(!showCaptions)}
                          className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded transition-all cursor-pointer border ${
                            showCaptions
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 font-black'
                              : 'bg-zinc-950 text-zinc-500 border-zinc-900 hover:text-slate-300'
                          }`}
                          id="toggle-video-subtitles-btn"
                          type="button"
                        >
                          CC: {showCaptions ? 'ENABLED' : 'MUTED'}
                        </button>
                      </div>

                      {/* Right: speeds, and simulated state ticks */}
                      <div className="flex items-center gap-3">
                        {/* Speeds selector */}
                        <div className="flex items-center rounded-lg bg-black/80 p-0.5 border border-zinc-900 text-[10px] font-mono font-bold text-zinc-400">
                          {[1, 1.5, 2].map((sp) => (
                            <button
                              key={sp}
                              onClick={() => setVideoSpeed(sp)}
                              className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                                videoSpeed === sp 
                                  ? 'bg-blue-600 font-extrabold text-white shadow-md' 
                                  : 'hover:text-white hover:bg-zinc-900/40'
                              }`}
                              id={`playback-speed-select-${sp}`}
                              type="button"
                            >
                              {sp}x
                            </button>
                          ))}
                        </div>

                        {/* Solution doc manual download shortcut */}
                        <button
                          onClick={handleDownloadDesignDoc}
                          className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white transition-all hover:border-zinc-700 flex items-center gap-1 cursor-pointer"
                          title="Download Solution Spec Design Documentation"
                          id="video-manual-solution-download-btn"
                          type="button"
                        >
                          <Download size={11} /> Spec Doc
                        </button>

                        {/* High-fidelity Fullscreen Toggle Option */}
                        <button
                          onClick={toggleFullscreen}
                          className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white transition-all hover:border-zinc-700 flex items-center gap-1.5 cursor-pointer"
                          title={isFullscreen ? "Exit Fullscreen View" : "Enter Fullscreen View"}
                          id="toggle-video-fullscreen-btn"
                          type="button"
                        >
                          {isFullscreen ? (
                            <>
                              <Minimize size={11} className="text-blue-400" /> Exit Fullscreen
                            </>
                          ) : (
                            <>
                              <Maximize size={11} className="text-blue-400" /> Fullscreen
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Helpful tips overlay row */}
                <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl flex items-start gap-3">
                  <Info size={16} className="text-blue-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="text-xs text-zinc-400 leading-relaxed">
                    <span className="font-bold text-slate-105 mr-1 font-sans">Self-Paced Navigation:</span> 
                    You do not need to wait for the player to buffer or stream sequentially. Skip directly into any deployment or architecture segment by clicking the chapters on the right hand sidebar menu!
                  </div>
                </div>

              </div>

              {/* Segments/Chapters Column */}
              <div className="space-y-3.5">
                <h4 className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold">Walkthrough chapters</h4>
                
                <div className="space-y-2.5" id="video-segments-chapters-list">
                  {VIDEO_SEGMENTS.map((seg, idx) => {
                    const isActive = activeSegmentIndex === idx;
                    return (
                      <button
                        key={seg.id}
                        onClick={() => {
                          setVideoTime(seg.start);
                          setActiveSegmentIndex(idx);
                          setIsVideoPlaying(true);
                        }}
                        className={`w-full p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden group ${
                          isActive
                            ? 'bg-[#111e2e] border-blue-500 shadow-md transform translate-x-1'
                            : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800'
                        }`}
                        id={`video-segment-btn-${seg.id}`}
                        type="button"
                      >
                        {/* Background chapter active light glow */}
                        {isActive && (
                          <div className="absolute top-0 right-0 w-8 h-full bg-linear-to-l from-blue-500/10 to-transparent blur-xs pointer-events-none" />
                        )}

                        <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-mono font-bold tracking-widest uppercase block ${
                            isActive ? 'text-blue-400' : 'text-zinc-550'
                          }`}>
                            {seg.label}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-505">
                            {Math.floor(seg.start / 60)}:{String(seg.start % 60).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="text-xs font-bold font-display text-white mt-1 group-hover:text-blue-400 transition-colors">
                          {seg.title}
                        </div>

                        <div className="text-[10px] text-zinc-500 leading-normal line-clamp-2 mt-0.5">
                          {seg.narrator}
                        </div>

                        {/* Indicator badge */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-blue-400 animate-pulse' : 'bg-zinc-700'
                          }`} />
                          <span className={`text-[9px] font-mono ${
                            isActive ? 'text-blue-400 font-extrabold' : 'text-zinc-550 font-semibold'
                          }`}>
                            {seg.badge}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl border border-dashed border-zinc-850 bg-black/20 text-center space-y-2.5">
                  <h5 className="text-[11.5px] font-bold text-slate-105 font-sans">Required onboarding assistance?</h5>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Chat directly with our custom automated GaaS support agent located on the support copilot panel!
                  </p>
                  <button 
                    onClick={() => setActiveTab('copilot')}
                    className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 hover:text-white transition-all text-[11px] font-mono text-zinc-400 border border-zinc-800 font-bold uppercase cursor-pointer"
                    id="video-tab-navigate-copilot"
                    type="button"
                  >
                    Launch Support Chat →
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE THREAT INTERCEPTOR SANDBOX */}
        {activeTab === 'simulator' && (
          <div className="space-y-6 animate-in fade-in duration-200 text-left">
            <div className="p-5 bg-zinc-950 border border-zinc-850 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="text-red-400 animate-pulse" size={18} />
                  <h2 className="text-sm font-bold uppercase text-white font-mono tracking-wider">
                    Governance Simulation Suite // Sandbox Playground
                  </h2>
                </div>
                <button
                  onClick={resetSimulation}
                  className="px-2.5 py-1 text-[10px] font-mono bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-450 hover:text-white rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw size={11} /> Reset Simulator
                </button>
              </div>

              <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                Experience how GaaS protects corporate systems in real-time. Follow the steps below to trigger a simulated intrusion, watch our gateway flag it, block the unauthorized packet, and restore the network's <strong className="text-teal-400 font-semibold font-mono">GAAS NOMINAL</strong> status!
              </p>

              {/* Status bar within simulated terminal */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/60 p-3.5 border border-zinc-850 rounded-lg">
                <div className="space-y-0.5">
                  <span className="text-[8px] text-zinc-600 font-mono uppercase font-semibold">Sim System State</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      simulatorStatus === 'IDLE' ? 'bg-teal-400' :
                      simulatorStatus === 'ALERT' ? 'bg-red-500 animate-ping' :
                      simulatorStatus === 'INTERCEPTED' ? 'bg-amber-400' : 'bg-teal-400'
                    }`} />
                    <span className={`text-[10px] font-mono font-bold ${
                      simulatorStatus === 'IDLE' ? 'text-teal-400' :
                      simulatorStatus === 'ALERT' ? 'text-red-500 font-extrabold' :
                      simulatorStatus === 'INTERCEPTED' ? 'text-amber-400' : 'text-teal-400'
                    }`}>
                      {simulatorStatus === 'IDLE' ? 'GAAS NOMINAL' :
                       simulatorStatus === 'ALERT' ? 'THREAT INTRUSION' :
                       simulatorStatus === 'INTERCEPTED' ? 'PACKET BLOCKED' : 'NOMINAL SAVED'}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5 font-mono">
                  <span className="text-[8px] text-zinc-600 uppercase font-semibold">Sim Cognitive Health</span>
                  <span className="text-[10px] text-zinc-300 font-bold block">{riskMetrics.cognitiveScore}% Score</span>
                </div>

                <div className="space-y-0.5 font-mono">
                  <span className="text-[8px] text-zinc-600 uppercase font-semibold">Sim API Hour Cost</span>
                  <span className="text-[10px] text-zinc-300 font-bold block">${riskMetrics.apiSpend}.00</span>
                </div>

                <div className="space-y-0.5 font-mono">
                  <span className="text-[8px] text-zinc-600 uppercase font-semibold">Sim Active Alerts</span>
                  <span className="text-[10px] text-[#EF9F27] font-bold block">{riskMetrics.alertsRaised} Pending Alert</span>
                </div>
              </div>

              {/* Interactive flow map */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                
                {/* Step 1 button */}
                <div className={`p-3 border rounded-lg transition-all relative flex flex-col justify-between h-30 text-left ${
                  simulatorStep === 0 
                    ? 'border-blue-500/50 bg-blue-500/5 shadow-md shadow-blue-500/5 scale-102' 
                    : 'border-zinc-850 bg-zinc-900/20 opacity-60'
                }`}>
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-blue-400 font-bold block">STEP 01</span>
                    <h4 className="text-[11.5px] font-bold text-slate-105">1. Fuel Rogue Transaction</h4>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      Force a simulated agent node to execute an unauthorized $1,250 wire transfer.
                    </p>
                  </div>
                  {simulatorStep === 0 && (
                    <button
                      onClick={triggerSimulationStep}
                      className="w-full mt-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-mono uppercase font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Play size={10} fill="currentColor" /> Send Wire Intent
                    </button>
                  )}
                  {simulatorStep > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-teal-400 font-bold mt-2">
                      <CheckCircle2 size={11} /> Wire Submitted!
                    </div>
                  )}
                </div>

                {/* Step 2 button */}
                <div className={`p-3 border rounded-lg transition-all relative flex flex-col justify-between h-30 text-left ${
                  simulatorStep === 1 
                    ? 'border-red-500/50 bg-red-500/5 shadow-md shadow-red-500/5 scale-102 animate-pulse' 
                    : 'border-zinc-850 bg-zinc-900/20 opacity-60'
                }`}>
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-red-400 font-bold block">STEP 02</span>
                    <h4 className="text-[11.5px] font-bold text-slate-105 font-display">2. Halt Outbound Action</h4>
                    <p className="text-[10px] text-zinc-450 leading-normal">
                      The gateway intercepts the call. Deploy the Threat Interceptor shield to drop connection.
                    </p>
                  </div>
                  {simulatorStep === 1 && (
                    <button
                      onClick={triggerSimulationStep}
                      className="w-full mt-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-mono uppercase font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md animate-bounce"
                    >
                      <Shield size={10} /> ACTIVATE INTERCEPTOR
                    </button>
                  )}
                  {simulatorStep > 1 && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-teal-400 font-bold mt-2">
                      <CheckCircle2 size={11} /> Packet Quarantined!
                    </div>
                  )}
                </div>

                {/* Step 3 button */}
                <div className={`p-3 border rounded-lg transition-all relative flex flex-col justify-between h-30 text-left ${
                  simulatorStep === 2 
                    ? 'border-yellow-500/50 bg-yellow-500/5 shadow-md shadow-yellow-500/10 scale-102' 
                    : 'border-zinc-850 bg-zinc-900/20 opacity-60'
                }`}>
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-yellow-400 font-bold block">STEP 03</span>
                    <h4 className="text-[11.5px] font-bold text-slate-105">3. Hot-Fix Prompt & Align</h4>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      Realignment overrides semantic parameters to return the system to GaaS Nominal.
                    </p>
                  </div>
                  {simulatorStep === 2 && (
                    <button
                      onClick={triggerSimulationStep}
                      className="w-full mt-2 py-1 bg-yellow-600 hover:bg-yellow-500 text-black rounded text-[10px] font-mono uppercase font-black transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      ⚡ Remediate Model Alignment
                    </button>
                  )}
                  {simulatorStep > 2 && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-teal-400 font-bold mt-2">
                      <CheckCircle2 size={11} /> GAAS NOMINAL RESTORED!
                    </div>
                  )}
                </div>

              </div>

              {/* Console log display */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 select-none">
                  <Terminal size={11} /> Security Stream Live Terminal (Simulated logs)
                </span>
                <div className="w-full h-36 bg-black rounded border border-zinc-850 p-3 font-mono text-[10px] text-zinc-400 overflow-y-auto space-y-1 select-text scrollbar-thin">
                  {simulationLogs.map((log, i) => (
                    <div key={i} className={`leading-normal ${
                      log.includes('[WARNING') || log.includes('[FLAGGED') ? 'text-red-400' :
                      log.includes('[ACTION') || log.includes('[BLOCKED') ? 'text-amber-400' :
                      log.includes('[SYSTEM_RESTORED') || log.includes('[HEALTH') ? 'text-teal-400' : 'text-zinc-550'
                    }`}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SEARCHABLE KNOWLEDGE BASE & FAQ */}
        {activeTab === 'faq' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Search and category filters */}
            <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center text-left">
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search 'nominal', 'drift', 'bypass'..."
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  className="w-full text-xs bg-black border border-zinc-850 rounded-lg pl-9 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-zinc-500 transition-colors"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none">
                {[
                  { id: 'all', name: 'All Topics' },
                  { id: 'general', name: 'Core OS' },
                  { id: 'kill-switch', name: 'Kill-Switch' },
                  { id: 'drift', name: 'Drift & Ethics' },
                  { id: 'financial', name: 'Value & Spending' },
                  { id: 'api', name: 'Webhook SDK' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-mono leading-none border transition-colors cursor-pointer shrink-0 ${
                      selectedCategory === cat.id
                        ? 'bg-blue-500/15 border-blue-500 text-blue-400 font-bold'
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions wrapper */}
            {filteredFaqs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                {filteredFaqs.map(faq => (
                  <div key={faq.id} className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2 hover:border-zinc-700 transition-colors">
                    <span className="text-[8.5px] font-mono uppercase bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-500">
                      {faq.category === 'nominal' ? 'CORE' : faq.category}
                    </span>
                    <h3 className="text-xs font-bold text-white flex items-start gap-1.5 font-sans leading-snug">
                      <HelpIcon size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      {faq.question}
                    </h3>
                    <div className="pt-2 border-t border-zinc-900 space-y-2 text-left">
                      <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                        {faq.answer}
                      </p>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('copilot');
                            handleSendMessage(faq.question);
                          }}
                          className="text-[9.5px] font-mono text-blue-450 hover:text-blue-400 font-bold flex items-center gap-1.5 select-none cursor-pointer py-1 px-2.5 rounded bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 transition-all uppercase tracking-wider"
                          title="Ask this question in the Support Copilot"
                        >
                          Ask Copilot &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-[#111E2E]/20 border border-[#1F2E40]/50 rounded-xl">
                <p className="text-zinc-505 text-xs font-mono">No guidebook telemetry matches your query. Try searching for "nominal" or "budget".</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: INTERACTIVE automated support copilot */}
        {activeTab === 'copilot' && (
          <div className="space-y-4 animate-in fade-in duration-200 text-left">
            <div className="bg-zinc-950 border border-zinc-850 rounded-xl flex flex-col h-[400px]">
              {/* Support copilot top identifier */}
              <div className="flex items-center gap-3 p-3.5 bg-black border-b border-zinc-850 justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-black animate-pulse" />
                    <div className="h-8 w-8 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center font-mono font-black text-blue-400 text-xs shadow-inner">
                      GG
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white font-mono leading-none uppercase">Guardian Support Node</h3>
                    <span className="text-[9px] text-zinc-500 font-mono">Dynamic Rule Matcher • Active v4.9</span>
                  </div>
                </div>
                <div className="text-[9px] px-2 py-0.5 rounded bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/20 font-mono uppercase font-semibold">
                  GAAS STATUS: NOMINAL
                </div>
              </div>

              {/* Chat history display field */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin select-text bg-black/40">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 max-w-[85%] items-start ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                    <div className={`h-6 w-6 rounded flex items-center justify-center shrink-0 text-[10px] font-mono leading-none ${
                      msg.sender === 'user' 
                        ? 'bg-[--theme-primary]/20 border border-[--theme-primary]/40 text-[--theme-primary]' 
                        : 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                    }`}>
                      {msg.sender === 'user' ? currentUser.name.substring(0, 2).toUpperCase() : 'GG'}
                    </div>

                    <div className={`p-3 rounded-lg text-xs leading-relaxed space-y-1 text-left ${
                      msg.sender === 'user'
                        ? 'bg-[--theme-primary]/10 border border-[--theme-primary]/20 text-slate-100 rounded-tr-none'
                        : 'bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-tl-none shadow-sm'
                    }`}>
                      <p className="whitespace-pre-line">{msg.text}</p>
                      <span className="text-[8px] text-zinc-500 font-mono block text-right mt-0.5 leading-none">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Suggested quick doubts block */}
              <div className="px-3 py-1.5 bg-black border-t border-zinc-900/60 flex gap-2 overflow-x-auto scrollbar-none shrink-0" id="copilot-suggestions-container">
                {[
                  'What does "GAAS NOMINAL" mean?',
                  'Does Threat Interceptor use Kill-Switch?',
                  'Remediate Cognitive Drift?',
                  'Explain Value Meter ROI formula',
                  'Setup GaaS SDK code',
                  'Explain Role-Based IAM Access'
                ].map((doubt, id) => (
                  <button
                    key={id}
                    type="button"
                    id={`suggestion-btn-${id}`}
                    onClick={() => {
                      setSelectedSuggestedIndex(id);
                      setChatInput(doubt);
                      setTimeout(() => {
                        handleSendMessage(doubt);
                        setSelectedSuggestedIndex(null);
                      }, 250);
                    }}
                    className={`text-[9.5px] font-mono px-3 py-1.5 rounded-lg shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                      selectedSuggestedIndex === id
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold scale-102 ring-1 ring-blue-500/30'
                        : 'bg-[#111E2E] border-[#1F2E40] text-zinc-400 hover:text-white hover:border-blue-500'
                    }`}
                  >
                    {selectedSuggestedIndex === id && <Check size={10} className="text-blue-400 animate-pulse" />}
                    {doubt}
                  </button>
                ))}
              </div>

              {/* Interactive prompt input */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(chatInput);
                }}
                className="p-3 bg-black border-t border-zinc-850 flex gap-2 justify-between"
              >
                <input
                  type="text"
                  placeholder="Ask a question about GAAS status, webhooks etc..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                />
                <button
                  type="submit"
                  className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center pointer cursor-pointer transition-colors hover:text-white"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Modern Solution Design Document Download Area (With Conditional Role-Based Gate) */}
      <div className="mt-8 border-t border-[#1F2E40]/60 pt-6">
        {hasAccess ? (
          <div className="p-6 md:p-8 rounded-xl bg-gradient-to-r from-[#111E2E] to-[#162030] border border-[#1D9E75]/30 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in-up">
            <div className="flex items-center gap-4 text-left">
              <div className="p-3.5 rounded-xl bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/25 shadow-inner">
                <FileText size={28} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#1D9E75] font-bold tracking-widest bg-[#1D9E75]/5 px-2.5 py-0.5 rounded border border-[#1D9E75]/20 uppercase">
                  Downloadable Systems Specification
                </span>
                <h3 className="text-lg font-display font-bold text-[#F0EEE6] mt-2 leading-tight">
                  AgentsGuardian Solutions Architecture Specification
                </h3>
                <p className="text-xs text-[#8B9BAA] mt-1.5 max-w-xl leading-relaxed">
                  Export the complete, production-ready system blueprint mapping architectural pillars, threat templates, telemetry pipelines, and interactive compliance test flows.
                </p>
                <div className="mt-2 text-[10px] font-mono text-zinc-500">
                  Authorized Session: <span className="text-[#1D9E75] font-semibold">{currentUser.email}</span> ({currentUser.role}) {isSuperUser && <span className="text-[#1D9E75] font-bold">✨ Master Owner</span>}
                </div>
              </div>
            </div>
            <button
              onClick={handleDownloadDesignDoc}
              className="w-full md:w-auto px-6 py-3 bg-[#1D9E75] hover:bg-[#1D9E75]/85 text-xs font-mono font-bold text-slate-950 uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              id="download-design-doc-btn"
            >
              <Download size={14} /> Download Blueprint (.md)
            </button>
          </div>
        ) : (
          <div className="p-6 md:p-8 rounded-xl bg-[#1E1214] border border-[#E24B4A]/30 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in-up" id="blueprint-restricted-container">
            <div className="flex items-center gap-4 text-left">
              <div className="p-3.5 rounded-xl bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/25 shadow-inner">
                <Shield size={28} className="text-[#E24B4A]" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#E24B4A] font-bold tracking-widest bg-[#E24B4A]/5 px-2.5 py-0.5 rounded border border-[#E24B4A]/20 uppercase">
                  Access Restriction Level: Classified
                </span>
                <h3 className="text-lg font-display font-bold text-[#F0EEE6] mt-2 leading-tight">
                  Solutions Architecture Specification Locked
                </h3>
                <p className="text-xs text-[#8B9BAA] mt-1.5 max-w-xl leading-relaxed">
                  This blueprint contains cryptographic keys, security schemas, and system execution protocols. Access is strictly limited to the **Workspace Owner** (<span className="text-amber-500 font-bold">mritunjoysingh@gmail.com</span>) or a verified **SuperAdmin** role.
                </p>
                <div className="mt-2 text-[10.5px] font-mono text-zinc-400 flex items-center gap-1.5">
                  <span className="text-[#E24B4A]">●</span> Logged-in Session Profile: <span className="text-rose-450 font-bold">{currentUser.name}</span> <span className="bg-rose-955/40 text-rose-450 border border-rose-900/30 px-1.5 rounded py-0.2 select-none font-bold text-[9px]">{currentUser.role}</span>
                </div>
              </div>
            </div>
            <div className="w-full md:w-auto p-4 rounded-lg bg-zinc-950 border border-zinc-900 text-center flex flex-col items-center justify-center min-w-[210px]">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                How to Unlock
              </span>
              <span className="text-[10.5px] text-zinc-400 font-sans leading-normal block">
                Switch administrative session profiles using the 👤 <strong>Active Security Session</strong> dropdown in the left sidebar menu.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
