
  Agent(Build Storyboard v2.0 with named players, claiming, progress counter)
  ⎿  Prompt:
       Write a complete new HTML file at
       /Users/macbook/Desktop/superbox-speedrun/superbox-storyboard-system-2.0.html.

       This is a rewrite/upgrade of the existing v1.4 file. The v1.4 file is at
       /Users/macbook/Desktop/superbox-speedrun/superbox-storyboard-system-1.4.html — read it first to
       understand the base.

       Features to implement in v2.0

       1. Named Players (replaces hardcoded P1/P2)

       - Generate a UUID player ID on first visit, stored in localStorage as sb_pid
       - Setup panel asks for: name (text input), color (preset swatches + custom color picker)
       - Store playerName in sb_pname, playerColor in sb_pcolor
       - Players register themselves in synced players state: { [playerId]: { name, color, lastSeen } }
       - Heartbeat: push my player entry every 30 seconds to update lastSeen
       - "Online" = lastSeen within last 3 minutes
       - Show online players as colored avatar dots in the header (initials in colored circles)
       - Remove all references to hardcoded PLAYERS = { p1: ..., p2: ... }

       2. Task Claiming

       - Add claimed state: { [stepKey]: { id, name, color, at } } — synced with server
       - In StoryboardStrip step cards:
         - Unclaimed step: single click = claim it (shows your color border + dot in top-left)
         - Claimed by me: single click = complete it AND release claim; right-click = release claim only
       (e.preventDefault)
         - Claimed by others: show their initials in top-left corner, cursor not-allowed, clicks disabled
         - Double-click on unclaimed = claim + complete in one action
       - Claim is released automatically when step is completed
       - Show a small pulsing dot indicator for claimed steps (claimed by me = my color, others = their color
       + initials overlay)

       3. Big Progress Counter (C3 from roadmap)

       - A full-width strip AT THE VERY TOP of the page (above the main header)
       - Left: 073% — monospaced, 44px, bold, glowing, letterSpacing 3px
       - Middle: a dual-layer progress bar (global progress on top, personal progress shown as a translucent
       layer behind it)
       - Right: "ALL STEPS" label and "YOU: 041%" in player's color
       - Color shifts based on percentage:
         - 0-29%: #00FFFF (cyan)
         - 30-59%: #FFD700 (yellow)
         - 60-89%: #FF9800 (orange)
         - 90-99%: #4AC262 (green)
         - 100%: #FFFFFF (white, intense glow)
       - Progress computed from ALL steps across ALL scenarios (built-in + custom):
         - globalDone = steps where ANY player has checked[key][anyId] = true
         - personalDone = steps where checked[key][myId] = true
         - Total = sum of all scenario.steps.length
       - At 100% global: show a full-screen celebration overlay — black bg, "100%" huge white text, "PROJECT
       COMPLETE" subtitle, "DISMISS" button

       4. Clock (top-right of header)

       - Digital clock showing HH:MM:SS
       - Updates every second
       - Monospaced, subtle color (#555 normally, brighter at key times)
       - Always visible in main header area

       5. Activity Feed

       - A small strip below the tabs showing last 4 recent events
       - Events: claimed/released/completed steps
       - Format: [PlayerColor dot] PlayerName claimed LAYER step in Scenario Title — 14:23
       - Slide in from right, fade out after 10 seconds
       - Stored in React state (not persisted), max 20 items

       6. Version Snapshots (F3 from roadmap)

       - Auto-snapshot: debounced 30 seconds after any state change, keep last 10 auto-saves
       - Manual save: a "SAVE" button in header that prompts for a label
       - Version stored in localStorage as sb_versions: array of { id, label, at, auto, state }
       - state = { checked, claimed, customScenarios, customGlyphs, notes }
       - New tab "HISTORY (N)" in the tab bar showing all versions
       - History tab: list of versions with timestamp, label, type (auto/manual), and a RESTORE button
       - On restore: confirm first, then apply the snapshot and push to server

       Keep from v1.4 (unchanged or minimally modified)

       - All GLYPHS object (all 50+ glyphs)
       - All SCENARIOS array (all 17 scenarios)
       - LAYER_COLORS constant
       - PRESET_COLORS array
       - GlyphIcon component (all SVG icons)
       - AddScenarioModal component (keep as-is)
       - AddGlyphModal component (keep as-is)
       - RichTextEditor component (keep as-is)
       - Notes system (keep as-is, but now notes show player name/color instead of P1/P2)
       - SSE sync system — now syncs: checked, claimed, players, notes, customScenarios, customGlyphs
       - Export/Import state (update to include claimed and players)
       - Error boundary
       - CSS for .note-editor, .tbtn, scrollbar, etc.

       Key state changes in App

       // Player identity (not synced, local to this device)
       const [playerId] = useState(() => localStorage.getItem("sb_pid") || (() => { const id =
       `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`; localStorage.setItem("sb_pid",
        id); return id; })());
       const [playerName, setPlayerName] = useState(() => localStorage.getItem("sb_pname") || "");
       const [playerColor, setPlayerColor] = useState(() => localStorage.getItem("sb_pcolor") || "#00FFFF");

       // Synced state
       const [checked, setChecked] = useState({}); // { stepKey: { [playerId]: bool } }
       const [claimed, setClaimed] = useState({}); // { stepKey: { id, name, color, at } }
       const [players, setPlayers] = useState({}); // { [playerId]: { name, color, lastSeen } }
       const [customScenarios, setCustomScenarios] = useState([]);
       const [customGlyphs, setCustomGlyphs] = useState({});
       const [notes, setNotes] = useState([]);

       // Local state
       const [versions, setVersions] = useState(() => { try { return
       JSON.parse(localStorage.getItem("sb_versions") || "[]"); } catch { return []; } });
       const [activity, setActivity] = useState([]); // [{ msg, playerName, playerColor, at }]

       // UI state
       const [activeTab, setActiveTab] = useState("strips");
       const [showSetup, setShowSetup] = useState(!localStorage.getItem("sb_pname"));
       const [celebrationDismissed, setCelebrationDismissed] = useState(false);
       // etc.

       Important implementation details

       stepKey function: stepKey(scenarioId, i) returns s_${scenarioId}_${i}
       taskKey function: taskKey(scenarioId, i) returns t_${scenarioId}_${i}

       Progress computation (NOT using useMemo, inline like v1.4):
       const allStepsList = allScenarios.flatMap(s => s.steps.map((step, i) => ({ key: stepKey(s.id, i) })));
       const totalSteps = allStepsList.length;
       const globalDone = allStepsList.filter(({ key }) => Object.values(checked[key] ||
       {}).some(Boolean)).length;
       const personalDone = allStepsList.filter(({ key }) => !!checked[key]?.[playerId]).length;
       const globalPct = totalSteps === 0 ? 0 : (globalDone / totalSteps) * 100;
       const personalPct = totalSteps === 0 ? 0 : (personalDone / totalSteps) * 100;

       Claiming handlers in App:
       function addActivity(msg, name, color) {
         setActivity(prev => [...prev.slice(-19), { msg, playerName: name, playerColor: color, at: Date.now()
       }]);
       }

       function claimStep(key, scenarioTitle, stepNote) {
         setClaimed(prev => {
           if (prev[key]) return prev; // already claimed
           const newClaim = { id: playerId, name: playerName, color: playerColor, at: Date.now() };
           const updated = { ...prev, [key]: newClaim };
           claimedRef.current = updated;
           pushAll({ claimed: updated });
           return updated;
         });
         addActivity(`claimed a step`, playerName, playerColor);
       }

       function releaseStep(key) {
         setClaimed(prev => {
           if (prev[key]?.id !== playerId) return prev;
           const updated = { ...prev };
           delete updated[key];
           claimedRef.current = updated;
           pushAll({ claimed: updated });
           return updated;
         });
         addActivity(`released a claim`, playerName, playerColor);
       }

       function completeStep(key) {
         setChecked(prev => {
           const entry = prev[key] || {};
           const nowDone = !entry[playerId];
           const updated = { ...prev, [key]: { ...entry, [playerId]: nowDone } };
           checkedRef.current = updated;
           pushAll({ checked: updated });
           return updated;
         });
         // Release claim on completion
         setClaimed(prev => {
           if (prev[key]?.id !== playerId) return prev;
           const updated = { ...prev };
           delete updated[key];
           claimedRef.current = updated;
           return updated;
         });
         addActivity(`completed a step`, playerName, playerColor);
       }

       function handleStepClick(key) {
         const claim = claimedRef.current[key];
         if (claim && claim.id !== playerId) return; // locked by others
         if (!claim) {
           claimStep(key);
         } else {
           completeStep(key);
         }
       }

       function handleStepDoubleClick(key) {
         const claim = claimedRef.current[key];
         if (claim && claim.id !== playerId) return;
         if (!claim) {
           // Claim + complete in one action
           claimStep(key);
           setTimeout(() => completeStep(key), 50);
         }
       }

       function handleStepRightClick(e, key) {
         e.preventDefault();
         releaseStep(key);
       }

       Version saving:
       const autoSaveTimerRef = useRef(null);
       useEffect(() => {
         if (showSetup) return;
         if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
         autoSaveTimerRef.current = setTimeout(() => {
           const snap = { id: uid(), label: `Auto ${new Date().toLocaleString()}`, at: Date.now(), auto: true,
        state: { checked: checkedRef.current, claimed: claimedRef.current, customScenarios:
       customScenariosRef.current, customGlyphs: customGlyphsRef.current, notes: notesRef.current } };
           setVersions(prev => {
             const autos = prev.filter(v => v.auto).slice(-9);
             const manuals = prev.filter(v => !v.auto);
             const updated = [...manuals, ...autos, snap];
             localStorage.setItem("sb_versions", JSON.stringify(updated));
             return updated;
           });
         }, 30000);
         return () => clearTimeout(autoSaveTimerRef.current);
       }, [checked, claimed, customScenarios, customGlyphs, notes, showSetup]);

       function saveManualVersion(label) {
         const snap = { id: uid(), label: label || `Milestone ${new Date().toLocaleString()}`, at: Date.now(),
        auto: false, state: { checked: checkedRef.current, claimed: claimedRef.current, customScenarios:
       customScenariosRef.current, customGlyphs: customGlyphsRef.current, notes: notesRef.current } };
         setVersions(prev => {
           const updated = [...prev, snap];
           localStorage.setItem("sb_versions", JSON.stringify(updated));
           return updated;
         });
       }

       Synced state pull/push — extend to include claimed and players:
       const pullState = useCallback(async () => {
         const data = await fetch(`${syncUrl}/state`).then(r => r.json());
         if (data.checked) setChecked(data.checked);
         if (data.claimed) setClaimed(data.claimed);
         if (data.players) setPlayers(data.players);
         if (data.notes) setNotes(data.notes);
         if (data.customScenarios) setCustomScenarios(data.customScenarios);
         if (data.customGlyphs) setCustomGlyphs(data.customGlyphs);
         setConnStatus("ok");
       }, [syncUrl]);

       Tasks tab — update to work with named players:
       - Instead of p1done / p2done, show: my checkbox on left, and small colored circles for each OTHER
       player who checked it
       - Filter: keep the same layer filter buttons
       - Stats: show "YOU: N/total" and "OTHERS: N total completions"

       Header layout (top to bottom):
       1. BigProgressCounter (full width strip)
       2. Main header row: [SB logo] [title/version] [online player avatars] [clock] [SAVE button] [EXPORT]
       [IMPORT] [conn dot + SETUP]
       3. Tabs row: Storyboard Strips | Tasks | Glyph Legend | Notes | HISTORY

       Activity feed — render as a small horizontal strip below the tabs:
       Recent: [dot] Alex claimed step — 14:23 · [dot] Maria completed step — 14:21 · [dot] Alex released
       claim — 14:20
       Max 4 items, fade old ones, in a thin bar between tabs and content.

       Visual Design (keep v1.4 aesthetic)

       - Black background (#000000)
       - Same color palette: #00FFFF, #FF95DA, #4AC262
       - Monospace font throughout
       - Same border/card styles

       File details

       - Save as: /Users/macbook/Desktop/superbox-speedrun/superbox-storyboard-system-2.0.html
       - Use same React 18 CDN + Babel approach as v1.4
       - Version string in UI: "v2.0 · NAMED PLAYERS · CLAIMING · BIG COUNTER · CLOCK · HISTORY"
       - Keep the same error boundary and error handler at top

       Write the complete, working HTML file. Make sure all JavaScript is syntactically correct. Test mentally
        that the state flow makes sense. The file should be self-contained and work when opened in a browser.