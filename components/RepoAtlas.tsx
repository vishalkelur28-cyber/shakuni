"use client";

import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import {
  LAYERS, LAYER, LINK_TYPES, LINK_TYPE, LEARN, SEED_REPOS, SEED_LINKS, MAX_REPOS,
  type LayerId, type LinkTypeId,
} from "../lib/blockchain/repo-atlas-data";

interface Repo { id: string; name: string; url: string; lang: string; layer: LayerId; simple: string; tech: string; }
interface Link { id: string; from: string; to: string; type: LinkTypeId; }

const STORE_KEY = "shakuni-atlas-v1";
const MODE_KEY = "shakuni-atlas-mode";

let _c = 0;
function uid() { return `n${Date.now().toString(36)}${(_c++).toString(36)}`; }

function seed(): { repos: Repo[]; links: Link[] } {
  const repos: Repo[] = SEED_REPOS.map((r) => ({ id: uid(), ...r }));
  const byName = new Map(repos.map((r) => [r.name, r.id] as const));
  const links: Link[] = SEED_LINKS
    .filter((l) => byName.has(l.from) && byName.has(l.to))
    .map((l) => ({ id: uid(), from: byName.get(l.from)!, to: byName.get(l.to)!, type: l.type }));
  return { repos, links };
}

type View = "learn" | "repos" | "map";
type Mode = "simple" | "tech";

export default function RepoAtlas() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("learn");
  const [mode, setMode] = useState<Mode>("simple");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [active, setActive] = useState<string | null>(null);

  // Load once on the client. Seeding uses uid() (Date-based) so it must not run during SSR.
  useEffect(() => {
    let loaded: { repos: Repo[]; links: Link[] } | null = null;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.repos) && d.repos.length) loaded = { repos: d.repos, links: Array.isArray(d.links) ? d.links : [] };
      }
      const m = localStorage.getItem(MODE_KEY);
      if (m === "tech" || m === "simple") setMode(m);
    } catch { /* storage unavailable */ }
    const s = loaded ?? seed();
    setRepos(s.repos); setLinks(s.links); setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ repos, links })); } catch { /* ignore */ }
  }, [repos, links, ready]);

  function changeMode(m: Mode) {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  }

  const nameOf = (id: string) => repos.find((r) => r.id === id)?.name ?? "?";

  function addRepo(r: Omit<Repo, "id">) {
    if (repos.length >= MAX_REPOS || !r.name.trim()) return;
    setRepos((prev) => [...prev, { id: uid(), ...r }]);
  }
  function removeRepo(id: string) {
    setRepos((prev) => prev.filter((r) => r.id !== id));
    setLinks((prev) => prev.filter((l) => l.from !== id && l.to !== id));
    if (active === id) setActive(null);
  }
  function addLink(from: string, to: string, type: LinkTypeId) {
    if (!from || !to || from === to) return;
    setLinks((prev) => [...prev, { id: uid(), from, to, type }]);
  }
  function resetAll() {
    const s = seed(); setRepos(s.repos); setLinks(s.links); setActive(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seg<View>
          value={view}
          onChange={setView}
          options={[
            ["learn", "Learn the basics"],
            ["repos", "Repositories"],
            ["map", "Map"],
          ]}
        />
        <Seg<Mode>
          value={mode}
          onChange={changeMode}
          ariaLabel="Explanation depth"
          options={[["simple", "Simple"], ["tech", "Technical"]]}
        />
      </div>

      <div className="mt-6">
        {view === "learn" && <LearnView mode={mode} />}
        {view === "repos" && (
          <ReposView mode={mode} repos={repos} onAdd={addRepo} onRemove={removeRepo} onReset={resetAll} />
        )}
        {view === "map" && (
          <MapView
            mode={mode} repos={repos} links={links} active={active}
            setActive={setActive} onAddLink={addLink}
            onRemoveLink={(id) => setLinks((p) => p.filter((l) => l.id !== id))}
            nameOf={nameOf}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- shared controls ---------- */

function Seg<T extends string>({
  value, onChange, options, ariaLabel,
}: { value: T; onChange: (v: T) => void; options: [T, string][]; ariaLabel?: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            value === v ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
}

/* ---------- Learn ---------- */

function LearnView({ mode }: { mode: Mode }) {
  return (
    <div>
      <p className="muted mb-5 max-w-2xl">
        Start here. These are the building blocks behind a crypto project like Circle&apos;s, each explained two ways.
        The <b className="text-white">Simple / Technical</b> switch above changes the depth everywhere on this page.
      </p>
      <p className="kicker mb-3">Foundations</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LEARN.map((it) => (
          <article key={it.title} className="card card-p min-w-0">
            <div className="mb-2 flex items-center gap-2.5">
              <Dot color={LAYER[it.color].color} />
              <h3 className="text-[15px] font-semibold tracking-tight">{it.title}</h3>
            </div>
            <p className={`text-sm leading-6 ${mode === "simple" ? "text-gray-200" : "text-gray-400"}`}>
              {mode === "simple" ? it.simple : it.tech}
            </p>
            <p className="mt-3 border-t border-dashed border-white/10 pt-2.5 font-mono text-xs text-gray-500">{it.term}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------- Repositories ---------- */

function ReposView({
  mode, repos, onAdd, onRemove, onReset,
}: {
  mode: Mode; repos: Repo[];
  onAdd: (r: Omit<Repo, "id">) => void; onRemove: (id: string) => void; onReset: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState("");
  const [layer, setLayer] = useState<LayerId>("bridge");
  const [simple, setSimple] = useState("");
  const [tech, setTech] = useState("");
  const full = repos.length >= MAX_REPOS;

  function submit(e: FormEvent) {
    e.preventDefault();
    onAdd({ name: name.trim(), url: url.trim(), lang: lang.trim(), layer, simple: simple.trim(), tech: tech.trim() });
    setName(""); setUrl(""); setLang(""); setSimple(""); setTech("");
  }

  return (
    <div>
      <p className="muted mb-5 max-w-2xl">
        Add the code repositories that make up a program, up to <b className="text-white">{MAX_REPOS}</b>. Give each one
        a layer so the Map can group it. This list is pre-loaded with Circle&apos;s bug-bounty scope as a worked example.
      </p>

      <form onSubmit={submit} className="card card-p mb-6" autoComplete="off">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name / identifier">
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="evm-gateway-contracts" />
          </Field>
          <Field label="Link (optional)">
            <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/org/repo" />
          </Field>
          <Field label="Language">
            <input className="input" list="atlas-langs" value={lang} onChange={(e) => setLang(e.target.value)} placeholder="Solidity" />
            <datalist id="atlas-langs">
              {["Solidity", "Rust", "Move", "Cairo", "Go", "TypeScript", "Web2"].map((l) => <option key={l} value={l} />)}
            </datalist>
          </Field>
          <Field label="Layer">
            <select className="input" value={layer} onChange={(e) => setLayer(e.target.value as LayerId)}>
              {LAYERS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="What it does, plain English">
            <textarea className="input min-h-[42px]" rows={2} value={simple} onChange={(e) => setSimple(e.target.value)} placeholder="One line a non-engineer would understand" />
          </Field>
          <Field label="What it does, technical">
            <textarea className="input min-h-[42px]" rows={2} value={tech} onChange={(e) => setTech(e.target.value)} placeholder="One line for an engineer" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={full}>Add repository</button>
          <span className="font-mono text-sm text-gray-400"><b className="text-white">{repos.length}</b> / {MAX_REPOS} repositories</span>
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={onReset}>Reset to Circle example</button>
        </div>
        {full && <p className="mt-2 text-xs text-yellow-300/90">You&apos;ve reached the {MAX_REPOS}-repository limit. Remove one to add another.</p>}
      </form>

      {repos.length === 0 ? (
        <div className="well px-6 py-10 text-center">
          <p className="text-sm font-medium">No repositories yet</p>
          <p className="mt-1 text-xs text-gray-500">Add one above, or reset to the Circle example.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((r) => {
            const L = LAYER[r.layer];
            return (
              <div key={r.id} className="card min-w-0 border-l-4 p-4" style={{ borderLeftColor: L.color }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 break-words font-mono text-[13px]">
                    {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{r.name}</a> : r.name}
                  </div>
                  <button type="button" onClick={() => onRemove(r.id)} aria-label={`Remove ${r.name}`} className="shrink-0 rounded px-1 text-gray-500 hover:text-red-300">✕</button>
                </div>
                <div className="my-2 flex flex-wrap gap-1.5">
                  <span className="badge text-black" style={{ background: L.color }}>{L.name}</span>
                  {r.lang && <span className="badge badge-gray">{r.lang}</span>}
                </div>
                <p className="text-[13px] leading-5 text-gray-400">{(mode === "simple" ? r.simple : r.tech) || r.simple || "-"}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Map ---------- */

function MapView({
  mode, repos, links, active, setActive, onAddLink, onRemoveLink, nameOf,
}: {
  mode: Mode; repos: Repo[]; links: Link[]; active: string | null;
  setActive: (id: string | null) => void;
  onAddLink: (from: string, to: string, type: LinkTypeId) => void;
  onRemoveLink: (id: string) => void;
  nameOf: (id: string) => string;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<LinkTypeId>("builton");

  return (
    <div>
      <p className="muted mb-5 max-w-2xl">
        How the pieces connect. A per-repo scanner sees one repo at a time; the value is the graph <b className="text-white">between</b> them -
        where a single bug counts for two repos, and where the money is actually printed.
      </p>

      <p className="kicker mb-3">Worked example, the Circle ecosystem</p>
      <figure className="m-0 mb-6">
        <div className="card overflow-x-auto p-3">
          <CircleDiagram />
        </div>
        <figcaption className="mt-2.5 px-1 text-xs leading-5 text-gray-500">
          The money flows top-to-bottom: the web2 control plane drives on-chain <b className="text-gray-300">Gateway</b> and
          {" "}<b className="text-gray-300">CCTP</b>, both of which create USDC by going through the <b className="text-gray-300">FiatToken</b>.
          Accent edges are verified code links, <span className="font-mono">xreserve</span> is built on <span className="font-mono">gateway</span>,
          and <span className="font-mono">stellar-cctp</span> shares role crates with <span className="font-mono">stablecoin-xlm</span>.
          All CCTP copies trust one off-chain attester, so a design flaw is systemic while a porting bug is per-chain.
        </figcaption>
      </figure>

      <p className="kicker mb-3">Connection types</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINK_TYPES.map((t) => (
          <div key={t.id} className="card card-p min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="inline-block w-6 border-t-2"
                style={{ borderColor: t.key ? "#8fb0ff" : "#6b7686", borderTopStyle: t.dashed ? "dashed" : "solid" }}
              />
              <h3 className="text-[13.5px] font-semibold tracking-tight">{t.name}</h3>
            </div>
            <p className="text-[13px] leading-5 text-gray-400">{mode === "simple" ? t.simple : t.tech}</p>
          </div>
        ))}
      </div>

      <p className="kicker mb-3">Your repositories, by layer</p>
      <div className="callout callout-info mb-4 text-xs">Click a repository chip to highlight every connection it takes part in.</div>
      <div className="mb-6 flex flex-col gap-3">
        {LAYERS.map((L) => {
          const rs = repos.filter((r) => r.layer === L.id);
          if (!rs.length) return null;
          return (
            <div key={L.id} className="card card-p min-w-0">
              <div className="mb-2.5 flex items-center gap-2.5">
                <Dot color={L.color} />
                <b className="text-[13.5px]">{L.name}</b>
                <span className="ml-auto font-mono text-[11px] text-gray-500">{rs.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rs.map((r) => {
                  const n = links.filter((l) => l.from === r.id || l.to === r.id).length;
                  const on = active === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActive(on ? null : r.id)}
                      className={`chip font-mono transition ${on ? "!border-accent text-white ring-1 ring-accent" : "hover:border-accent/60"}`}
                    >
                      {r.name}{n > 0 && <span className="ml-1.5 text-[10px] text-gray-500">{n}↗</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="h2">Connections</h2>
      <p className="mt-0.5 text-sm text-gray-500">Define how two repositories relate. One bug in a shared or depended-on repo often affects both.</p>
      <form
        onSubmit={(e) => { e.preventDefault(); onAddLink(from, to, type); }}
        className="my-4 flex flex-wrap items-end gap-3"
      >
        <Field label="From"><select className="input" value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Select…</option>{repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Relationship"><select className="input" value={type} onChange={(e) => setType(e.target.value as LinkTypeId)}>{LINK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="To"><select className="input" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Select…</option>{repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <button type="submit" className="btn btn-primary" disabled={!from || !to || from === to}>Add link</button>
      </form>

      {links.length === 0 ? (
        <div className="well px-6 py-8 text-center text-sm text-gray-500">No connections yet. Add one above to map how two repositories relate.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {links.map((l) => {
            const t = LINK_TYPE[l.type];
            const hl = active != null && (l.from === active || l.to === active);
            return (
              <div key={l.id} className={`card flex flex-wrap items-center gap-3 p-3.5 ${hl ? "ring-1 ring-accent" : ""}`}>
                <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[12.5px]">
                  <span>{nameOf(l.from)}</span>
                  <span className="text-gray-600">→</span>
                  <span className={`chip ${t.key ? "!border-accent text-accent" : ""}`}>{t.name}</span>
                  <span className="text-gray-600">→</span>
                  <span>{nameOf(l.to)}</span>
                </div>
                <p className="min-w-0 flex-1 text-[12.5px] text-gray-400">{mode === "simple" ? t.simple : t.tech}</p>
                <button type="button" onClick={() => onRemoveLink(l.id)} aria-label="Remove link" className="ml-auto shrink-0 rounded px-1 text-gray-500 hover:text-red-300">✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Circle ecosystem diagram (static, dark theme) ---------- */

function CircleDiagram() {
  const TXT = "#d7dce3", CAP = "#8891a0", EDGE = "#6b7686", ACC = "#8fb0ff";
  const ZONE = "#121923", ZS = "rgba(255,255,255,0.09)", CHIP = "#0c1118";
  const cW2 = LAYER.web2.color, cGw = LAYER.gateway.color, cBr = LAYER.bridge.color, cTk = LAYER.token.color, cPay = LAYER.payments.color, cWal = LAYER.wallet.color;
  const cap = { fill: CAP, fontFamily: "ui-sans-serif,system-ui,sans-serif", fontSize: 12.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" as const };
  const lbl = { fill: TXT, fontFamily: "ui-monospace,monospace", fontSize: 12 };
  const lblSm = { fill: TXT, fontFamily: "ui-monospace,monospace", fontSize: 10.5 };
  const edl = { fill: CAP, fontFamily: "ui-monospace,monospace", fontSize: 10.5 };
  const edlK = { ...edl, fill: ACC };

  const Chip = ({ x, y, w, h, color, children, sm }: { x: number; y: number; w: number; h: number; color: string; children: ReactNode; sm?: boolean }) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={CHIP} stroke={color} />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" style={sm ? lblSm : lbl}>{children}</text>
    </>
  );

  return (
    <svg viewBox="0 0 860 560" role="img" aria-label="Layered diagram: a web2 control plane controls on-chain Gateway and CCTP services, which both mint USDC through the FiatToken; xReserve is built on Gateway; CCTP shares one attestation trust; payments and wallet stand alone." className="block h-auto w-full" style={{ minWidth: 620 }}>
      <defs>
        <marker id="atlas-ah" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={EDGE} /></marker>
        <marker id="atlas-ahk" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={ACC} /></marker>
      </defs>

      <text x={430} y={22} textAnchor="middle" style={cap}>Control plane · web2</text>
      <rect x={250} y={30} width={360} height={52} rx={10} fill={ZONE} stroke={ZS} />
      <Chip x={266} y={44} w={106} h={24} color={cW2} sm>api.circle.com</Chip>
      <Chip x={378} y={44} w={106} h={24} color={cW2} sm>app.circle.com</Chip>
      <Chip x={490} y={44} w={106} h={24} color={cW2} sm>console</Chip>

      <line x1={430} y1={82} x2={430} y2={120} stroke={EDGE} strokeWidth={1.6} markerEnd="url(#atlas-ah)" />
      <text x={438} y={105} style={edl}>controls / orchestrates</text>

      <text x={235} y={150} textAnchor="middle" style={cap}>Gateway · unified balance</text>
      <rect x={60} y={158} width={350} height={128} rx={12} fill={ZONE} stroke={ZS} />
      <Chip x={120} y={176} w={230} h={30} color={cGw}>evm-gateway-contracts</Chip>
      <Chip x={120} y={236} w={230} h={30} color={cGw}>evm-xreserve-contracts</Chip>
      <path d="M118 251 C92 251 92 191 118 191" fill="none" stroke={ACC} strokeWidth={2.2} markerEnd="url(#atlas-ahk)" />
      <text x={24} y={224} style={edlK}>built on</text>

      <text x={625} y={150} textAnchor="middle" style={cap}>CCTP · cross-chain transfer</text>
      <rect x={450} y={158} width={350} height={128} rx={12} fill={ZONE} stroke={ZS} />
      <rect x={462} y={168} width={326} height={76} rx={9} fill="none" stroke={ACC} strokeDasharray="4 4" opacity={0.8} />
      <text x={470} y={182} style={edlK}>one shared attestation trust</text>
      <Chip x={472} y={190} w={70} h={22} color={cBr} sm>EVM</Chip>
      <Chip x={548} y={190} w={70} h={22} color={cBr} sm>Sui</Chip>
      <Chip x={624} y={190} w={70} h={22} color={cBr} sm>Solana</Chip>
      <Chip x={700} y={190} w={78} h={22} color={cBr} sm>+ Aptos…</Chip>
      <Chip x={472} y={216} w={150} h={22} color={cBr} sm>Starknet · Stellar · Noble</Chip>
      <circle cx={739} cy={262} r={12} fill="rgba(143,176,255,0.12)" stroke={ACC} />
      <text x={739} y={266} textAnchor="middle" style={{ ...lblSm, fill: ACC }}>🔑</text>
      <text x={632} y={266} textAnchor="end" style={edl}>Circle attester service →</text>

      <line x1={235} y1={286} x2={300} y2={372} stroke={EDGE} strokeWidth={1.6} markerEnd="url(#atlas-ah)" />
      <line x1={625} y1={286} x2={560} y2={372} stroke={EDGE} strokeWidth={1.6} markerEnd="url(#atlas-ah)" />
      <text x={360} y={332} textAnchor="middle" style={edl}>mints via</text>

      <text x={430} y={366} textAnchor="middle" style={cap}>USDC token · FiatToken</text>
      <rect x={150} y={374} width={560} height={96} rx={12} fill={ZONE} stroke={ZS} />
      <Chip x={166} y={392} w={124} h={24} color={cTk} sm>stablecoin-evm</Chip>
      <Chip x={298} y={392} w={124} h={24} color={cTk} sm>stablecoin-sui</Chip>
      <Chip x={430} y={392} w={124} h={24} color={cTk} sm>stablecoin-xlm</Chip>
      <Chip x={562} y={392} w={132} h={24} color={cTk} sm>…per chain</Chip>
      <Chip x={232} y={424} w={200} h={24} color={cTk} sm>noble-fiattokenfactory</Chip>
      <Chip x={440} y={424} w={200} h={24} color={cTk} sm>stablecoin-aptos / -near</Chip>

      <path d="M492 416 C492 452 740 452 740 300" fill="none" stroke={ACC} strokeWidth={2.2} opacity={0.9} markerEnd="url(#atlas-ahk)" />
      <text x={600} y={464} textAnchor="middle" style={edlK}>shares code (role crates)</text>

      <text x={430} y={500} textAnchor="middle" style={cap}>Standalone</text>
      <Chip x={250} y={508} w={166} h={26} color={cPay} sm>evm-cpn · payments</Chip>
      <Chip x={444} y={508} w={166} h={26} color={cWal} sm>buidl-wallet</Chip>
    </svg>
  );
}
