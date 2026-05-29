import { useState, useEffect, useRef } from "react";
import { ref, onValue, set, remove } from "firebase/database";
import { db, firebaseEnabled } from "./firebase";
import "./App.css";

// ─── Types ────────────────────────────────────────────────
interface TableDef {
	id: string;
	label: string;
	seats: number;
	leftCol: number;
}

interface LTableConfig {
	id: string;
	label: string;
	row: number; // miejsca w KAŻDYM z dwóch rzędów poziomego ramienia (naprzeciw siebie)
	col: number; // miejsca w KAŻDEJ z dwóch kolumn pionowego ramienia (naprzeciw siebie)
	dir: "left" | "right";
}

interface ModalState {
	seatId: string;
	seatNum: number;
	tableLabel: string;
}

type Guests = Record<string, string>;

// ─── Table definitions ────────────────────────────────────
// Stoły prostokątne
const RECT_TABLES: TableDef[] = [
	{ id: "top", label: "Stół Honorowy", seats: 2, leftCol: 1 },
	{ id: "c1", label: "Stół 1", seats: 24, leftCol: 12 },
	{ id: "c2", label: "Stół 2", seats: 24, leftCol: 12 },
	{ id: "c3", label: "Stół 3", seats: 24, leftCol: 12 },
];

// Stoły w kształcie L: 2 rzędy po `row` (poziome ramię) + 2 kolumny po `col` (pionowe)
const L_TABLES: LTableConfig[] = [
	{ id: "left",  label: "Stół Lewy",  row: 7, col: 14, dir: "left"  }, // 2·7 + 2·14 = 42
	{ id: "right", label: "Stół Prawy", row: 6, col: 12, dir: "right" }, // 2·6 + 2·12 = 36
];

const lTotal = (t: LTableConfig) => 2 * t.row + 2 * t.col;

const TOTAL =
	RECT_TABLES.reduce((s, t) => s + t.seats, 0) +
	L_TABLES.reduce((s, t) => s + lTotal(t), 0); // 2+72+42+36 = 152

function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return name.slice(0, 2).toUpperCase();
}

// ─── Seat ─────────────────────────────────────────────────
function Seat({
	tableId,
	num,
	guestName,
	isHighlighted,
	onClick,
}: {
	tableId: string;
	num: number;
	guestName: string;
	isHighlighted: boolean;
	onClick: (seatId: string) => void;
}) {
	const seatId = `${tableId}-${num}`;
	const label = guestName || `Miejsce ${num} — wolne`;
	const cls = [
		"seat",
		guestName ? "occupied" : "",
		isHighlighted ? "highlight" : "",
	]
		.filter(Boolean)
		.join(" ");
	return (
		<div
			className={cls}
			onClick={() => onClick(seatId)}
			title={label}
			role="button"
		>
			{guestName ? getInitials(guestName) : num}
		</div>
	);
}

// ─── Rectangular table ────────────────────────────────────
function TableView({
	table,
	guests,
	search,
	onSeatClick,
}: {
	table: TableDef;
	guests: Guests;
	search: string;
	onSeatClick: (seatId: string, seatNum: number, tableLabel: string) => void;
}) {
	const q = search.toLowerCase().trim();
	const leftN = Array.from({ length: table.leftCol }, (_, i) => i + 1);
	const rightN = Array.from(
		{ length: table.seats - table.leftCol },
		(_, i) => table.leftCol + i + 1,
	);

	function sp(n: number) {
		const id = `${table.id}-${n}`;
		const name = guests[id] || "";
		return {
			tableId: table.id,
			num: n,
			guestName: name,
			isHighlighted: !!q && name.toLowerCase().includes(q),
			onClick: (sid: string) => onSeatClick(sid, n, table.label),
		};
	}

	return (
		<div className="table">
			<div className="table-title">
				{table.label} <span>({table.seats})</span>
			</div>
			<div className="table-body">
				<div className="seat-col">
					{leftN.map((n) => (
						<Seat key={n} {...sp(n)} />
					))}
				</div>
				<div className="table-surface" />
				<div className="seat-col">
					{rightN.map((n) => (
						<Seat key={n} {...sp(n)} />
					))}
				</div>
			</div>
		</div>
	);
}

// ─── L-shaped table ───────────────────────────────────────
// Geometria stołu L liczona w pikselach — gwarantuje, że miejsca są PO BOKACH
// powierzchni (blatu), nigdy na niej, a blat tworzy jeden ciągły kształt L.
const SEAT = 24; // średnica miejsca
const PITCH = 28; // odstęp między środkami miejsc wzdłuż krawędzi
const T = 16; // grubość blatu (powierzchni)
const G = 5; // odstęp między miejscem a blatem
const PAD = 12; // margines wewnętrzny
const TITLE_H = 24; // pasek na nazwę stołu

function LTableView({
	config,
	guests,
	search,
	onSeatClick,
}: {
	config: LTableConfig;
	guests: Guests;
	search: string;
	onSeatClick: (seatId: string, seatNum: number, tableLabel: string) => void;
}) {
	const q = search.toLowerCase().trim();

	// ── Współrzędne kluczowych linii (wariant "left"; "right" jest lustrem) ──
	// Pionowe ramię (lewa kolumna | blat | prawa kolumna):
	const xLeftCol = PAD;
	const xVSurf = xLeftCol + SEAT + G; // pionowy blat
	const xRightCol = xVSurf + T + G; // prawa kolumna pionowego ramienia
	const vArm = xRightCol + SEAT + PAD; // wewnętrzna (prawa) krawędź pionowego ramienia

	// Poziome ramię (górny rząd / blat / dolny rząd):
	const yTopRow = TITLE_H + PAD;
	const yHSurf = yTopRow + SEAT + G; // poziomy blat
	const yBotRow = yHSurf + T + G;
	const hArm = yBotRow + SEAT + PAD; // dolna krawędź poziomego ramienia

	// Rzędy poziome zaczynają się ZA pionowym ramieniem → narożnik pozostaje pusty.
	// Kolumny pionowe zaczynają się POD poziomym ramieniem → narożnik pozostaje pusty.
	const xRowStart = vArm + G;
	const yColStart = hArm + G;

	// ── Lista miejsc {n, x, y} ──
	// Górny i dolny rząd dzielą to samo X (naprzeciw siebie przez poziomy blat).
	// Lewa i prawa kolumna dzielą to samo Y (naprzeciw siebie przez pionowy blat).
	const seats: { n: number; x: number; y: number }[] = [];
	let n = 1;
	for (let i = 0; i < config.row; i++)
		seats.push({ n: n++, x: xRowStart + i * PITCH, y: yTopRow }); // górny rząd
	for (let i = 0; i < config.row; i++)
		seats.push({ n: n++, x: xRowStart + i * PITCH, y: yBotRow }); // dolny rząd
	for (let i = 0; i < config.col; i++)
		seats.push({ n: n++, x: xLeftCol, y: yColStart + i * PITCH }); // lewa kolumna
	for (let i = 0; i < config.col; i++)
		seats.push({ n: n++, x: xRightCol, y: yColStart + i * PITCH }); // prawa kolumna

	// ── Zasięgi blatu i wymiary kontenera ──
	const xRowEnd = xRowStart + (config.row - 1) * PITCH + SEAT;
	const yColEnd = yColStart + (config.col - 1) * PITCH + SEAT;

	const W = xRowEnd + PAD;
	const H = yColEnd + PAD;

	const total = lTotal(config);
	const flip = config.dir === "right";
	const fx = (x: number, w: number = SEAT) => (flip ? W - x - w : x); // lustro X

	// Kontur L (polygon SVG)
	const s = 1;
	const poly = flip
		? `${s},${s} ${W - s},${s} ${W - s},${H - s} ${W - vArm},${H - s} ${W - vArm},${hArm} ${s},${hArm}`
		: `${s},${s} ${W - s},${s} ${W - s},${hArm} ${vArm},${hArm} ${vArm},${H - s} ${s},${H - s}`;

	return (
		<div className="l-table" style={{ width: W, height: H }}>
			<svg className="l-svg" width={W} height={H}>
				<polygon points={poly} className="l-body" />
				{/* Poziomy odcinek blatu */}
				<rect
					x={fx(xVSurf, xRowEnd - xVSurf)}
					y={yHSurf}
					width={xRowEnd - xVSurf}
					height={T}
					rx={3}
					className="l-surf"
				/>
				{/* Pionowy odcinek blatu — nachodzi na poziomy w narożniku (ciągłe L) */}
				<rect
					x={fx(xVSurf, T)}
					y={yHSurf}
					width={T}
					height={yColEnd - yHSurf}
					rx={3}
					className="l-surf"
				/>
			</svg>

			<div className="l-label" style={{ width: W }}>
				{config.label} <span>({total})</span>
			</div>

			{seats.map((p) => {
				const id = `${config.id}-${p.n}`;
				const name = guests[id] || "";
				const cls = [
					"seat",
					name ? "occupied" : "",
					q && name.toLowerCase().includes(q) ? "highlight" : "",
				]
					.filter(Boolean)
					.join(" ");
				return (
					<div
						key={p.n}
						className={cls}
						style={{ position: "absolute", left: fx(p.x), top: p.y }}
						title={name || `Miejsce ${p.n} — wolne`}
						role="button"
						onClick={() => onSeatClick(id, p.n, config.label)}
					>
						{name ? getInitials(name) : p.n}
					</div>
				);
			})}
		</div>
	);
}

// ─── Modal ────────────────────────────────────────────────
function Modal({
	modal,
	initialName,
	onSave,
	onDelete,
	onClose,
}: {
	modal: ModalState;
	initialName: string;
	onSave: (name: string) => void;
	onDelete: () => void;
	onClose: () => void;
}) {
	const [name, setName] = useState(initialName);
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		setTimeout(() => inputRef.current?.focus(), 80);
	}, []);

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-box" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h2>{modal.tableLabel}</h2>
					<p className="modal-sub">Miejsce {modal.seatNum}</p>
				</div>
				<input
					ref={inputRef}
					type="text"
					className="modal-input"
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") onSave(name);
						if (e.key === "Escape") onClose();
					}}
					placeholder="Imię i nazwisko gościa..."
				/>
				<div className="modal-actions">
					<button className="btn btn-save" onClick={() => onSave(name)}>
						Zapisz
					</button>
					{initialName && (
						<button className="btn btn-delete" onClick={onDelete}>
							Usuń
						</button>
					)}
					<button className="btn btn-cancel" onClick={onClose}>
						Anuluj
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── App ──────────────────────────────────────────────────
export default function App() {
	const [guests, setGuests] = useState<Guests>(() => {
		if (db) return {};
		try { return JSON.parse(localStorage.getItem("stoly-gosc") || "{}"); }
		catch { return {}; }
	});
	const [modal, setModal] = useState<ModalState | null>(null);
	const [search, setSearch] = useState("");

	const occupied = Object.values(guests).filter(Boolean).length;

	useEffect(() => {
		if (!db) return;
		return onValue(ref(db, "guests"), (snap) => setGuests(snap.val() ?? {}));
	}, []);

	function openModal(seatId: string, seatNum: number, tableLabel: string) {
		setModal({ seatId, seatNum, tableLabel });
	}

	async function handleSave(name: string) {
		if (!modal) return;
		const t = name.trim();
		if (!t) {
			await handleDelete();
			return;
		}
		if (db) {
			await set(ref(db, `guests/${modal.seatId}`), t);
		} else {
			const next = { ...guests, [modal.seatId]: t };
			setGuests(next);
			localStorage.setItem("stoly-gosc", JSON.stringify(next));
		}
		setModal(null);
	}

	async function handleDelete() {
		if (!modal) return;
		if (db) {
			await remove(ref(db, `guests/${modal.seatId}`));
		} else {
			const { [modal.seatId]: _, ...rest } = guests;
			setGuests(rest);
			localStorage.setItem("stoly-gosc", JSON.stringify(rest));
		}
		setModal(null);
	}

	const topTable = RECT_TABLES.find((t) => t.id === "top")!;
	const centerTables = RECT_TABLES.filter((t) =>
		["c1", "c2", "c3"].includes(t.id),
	);
	const leftL = L_TABLES[0];
	const rightL = L_TABLES[1];

	return (
		<div className="app">
			<header className="app-header">
				<h1>Plan Sali</h1>
				<div className="header-controls">
					<input
						type="search"
						className="search-input"
						placeholder="Szukaj gościa..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<div className="stats">
						Zajęte: <strong>{occupied}</strong> / {TOTAL}
						&nbsp;·&nbsp; Wolne: <strong>{TOTAL - occupied}</strong>
					</div>
				</div>
				{!firebaseEnabled && (
					<div className="setup-notice">
						Tryb lokalny — dane widoczne tylko na tym urządzeniu. Uzupełnij{" "}
						<code>src/firebase-config.ts</code>, żeby wszyscy widzieli zmiany na
						żywo.
					</div>
				)}
			</header>

			<div className="hall-scroll">
				<div className="hall">
					{/* Jeden rząd: L-lewy | [Honorowy + stoły centralne] | L-prawy */}
					<div className="hall-main">
						<LTableView config={leftL}  guests={guests} search={search} onSeatClick={openModal} />
						<div className="center-col">
							<div className="honorowy-row">
								<TableView table={topTable} guests={guests} search={search} onSeatClick={openModal} />
							</div>
							<div className="center-area">
								{centerTables.map((t) => (
									<TableView key={t.id} table={t} guests={guests} search={search} onSeatClick={openModal} />
								))}
							</div>
						</div>
						<LTableView config={rightL} guests={guests} search={search} onSeatClick={openModal} />
					</div>
				</div>
			</div>

			<footer className="app-footer">
				<div className="legend">
					<span>
						<span className="dot empty" /> Wolne
					</span>
					<span>
						<span className="dot occupied" /> Zajęte
					</span>
					{search && (
						<span>
							<span className="dot highlight" /> Wynik wyszukiwania
						</span>
					)}
				</div>
				<div
					className={`status-badge ${firebaseEnabled ? "status-live" : "status-local"}`}
				>
					{firebaseEnabled ? "🟢 Synchronizacja na żywo" : "💾 Tylko lokalnie"}
				</div>
			</footer>

			{modal && (
				<Modal
					modal={modal}
					initialName={guests[modal.seatId] || ""}
					onSave={(n) => {
						void handleSave(n);
					}}
					onDelete={() => {
						void handleDelete();
					}}
					onClose={() => setModal(null)}
				/>
			)}
		</div>
	);
}
