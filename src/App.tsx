import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { db, firebaseEnabled } from './firebase';
import './App.css';

// ─── Types ────────────────────────────────────────────────
interface TableDef {
  id: string;
  label: string;
  seats: number;
  leftCol: number;
}

interface ModalState {
  seatId: string;
  seatNum: number;
  tableLabel: string;
}

type Guests = Record<string, string>;

// ─── Table definitions ────────────────────────────────────
const TABLES: TableDef[] = [
  { id: 'top',   label: 'Stół Honorowy', seats: 2,  leftCol: 1  },
  { id: 'left',  label: 'Stół Lewy',     seats: 42, leftCol: 21 },
  { id: 'c1',    label: 'Stół 1',        seats: 24, leftCol: 12 },
  { id: 'c2',    label: 'Stół 2',        seats: 24, leftCol: 12 },
  { id: 'c3',    label: 'Stół 3',        seats: 24, leftCol: 12 },
  { id: 'right', label: 'Stół Prawy',    seats: 36, leftCol: 18 },
];

const TOTAL = TABLES.reduce((s, t) => s + t.seats, 0); // 152

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Seat ─────────────────────────────────────────────────
function Seat({
  tableId, num, guestName, isHighlighted, onClick,
}: {
  tableId: string;
  num: number;
  guestName: string;
  isHighlighted: boolean;
  onClick: (seatId: string) => void;
}) {
  const seatId = `${tableId}-${num}`;
  const label = guestName || `Miejsce ${num} — wolne`;
  const classes = ['seat', guestName ? 'occupied' : '', isHighlighted ? 'highlight' : '']
    .filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={() => onClick(seatId)} title={label} role="button" aria-label={label}>
      {guestName ? getInitials(guestName) : num}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────
function TableView({
  table, guests, search, onSeatClick,
}: {
  table: TableDef;
  guests: Guests;
  search: string;
  onSeatClick: (seatId: string, seatNum: number, tableLabel: string) => void;
}) {
  const q = search.toLowerCase().trim();
  const leftNums  = Array.from({ length: table.leftCol },             (_, i) => i + 1);
  const rightNums = Array.from({ length: table.seats - table.leftCol }, (_, i) => table.leftCol + i + 1);

  function handleClick(seatId: string) {
    const num = parseInt(seatId.split('-').pop()!);
    onSeatClick(seatId, num, table.label);
  }

  function seatProps(n: number) {
    const seatId = `${table.id}-${n}`;
    const name = guests[seatId] || '';
    return {
      tableId: table.id,
      num: n,
      guestName: name,
      isHighlighted: !!q && !!name.toLowerCase().includes(q),
      onClick: handleClick,
    };
  }

  return (
    <div className="table">
      <div className="table-title">
        {table.label} <span>({table.seats})</span>
      </div>
      <div className="table-body">
        <div className="seat-col">{leftNums.map(n => <Seat key={n} {...seatProps(n)} />)}</div>
        <div className="table-surface" />
        <div className="seat-col">{rightNums.map(n => <Seat key={n} {...seatProps(n)} />)}</div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────
function Modal({
  modal, initialName, onSave, onDelete, onClose,
}: {
  modal: ModalState;
  initialName: string;
  onSave: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

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
            if (e.key === 'Enter') onSave(name);
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Imię i nazwisko gościa..."
        />
        <div className="modal-actions">
          <button className="btn btn-save" onClick={() => onSave(name)}>Zapisz</button>
          {initialName && (
            <button className="btn btn-delete" onClick={onDelete}>Usuń</button>
          )}
          <button className="btn btn-cancel" onClick={onClose}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────
export default function App() {
  const [guests, setGuests] = useState<Guests>({});
  const [modal, setModal]   = useState<ModalState | null>(null);
  const [search, setSearch] = useState('');

  const occupied = Object.values(guests).filter(Boolean).length;

  useEffect(() => {
    if (!db) {
      try {
        const saved = JSON.parse(localStorage.getItem('stoly-gosc') || '{}');
        setGuests(saved);
      } catch { /* ignore */ }
      return;
    }
    return onValue(ref(db, 'guests'), (snap) => {
      setGuests(snap.val() ?? {});
    });
  }, []);

  function openModal(seatId: string, seatNum: number, tableLabel: string) {
    setModal({ seatId, seatNum, tableLabel });
  }

  async function handleSave(name: string) {
    if (!modal) return;
    const trimmed = name.trim();
    if (!trimmed) { await handleDelete(); return; }

    if (db) {
      await set(ref(db, `guests/${modal.seatId}`), trimmed);
    } else {
      const next = { ...guests, [modal.seatId]: trimmed };
      setGuests(next);
      localStorage.setItem('stoly-gosc', JSON.stringify(next));
    }
    setModal(null);
  }

  async function handleDelete() {
    if (!modal) return;
    if (db) {
      await remove(ref(db, `guests/${modal.seatId}`));
    } else {
      const { [modal.seatId]: _removed, ...rest } = guests;
      setGuests(rest);
      localStorage.setItem('stoly-gosc', JSON.stringify(rest));
    }
    setModal(null);
  }

  const topTable    = TABLES.find((t) => t.id === 'top')!;
  const leftTable   = TABLES.find((t) => t.id === 'left')!;
  const rightTable  = TABLES.find((t) => t.id === 'right')!;
  const centerTables = TABLES.filter((t) => ['c1', 'c2', 'c3'].includes(t.id));

  return (
    <div className="app">
      {/* ── Header ── */}
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
            &nbsp;·&nbsp;
            Wolne: <strong>{TOTAL - occupied}</strong>
          </div>
        </div>
        {!firebaseEnabled && (
          <div className="setup-notice">
            Tryb lokalny — dane widoczne tylko na tym urządzeniu.
            Uzupełnij <code>src/firebase-config.ts</code>, żeby wszyscy widzieli zmiany na żywo.
          </div>
        )}
      </header>

      {/* ── Hall ── */}
      <div className="hall-scroll">
        <div className="hall">
          <div className="hall-top">
            <TableView table={topTable} guests={guests} search={search} onSeatClick={openModal} />
          </div>
          <div className="hall-main">
            <TableView table={leftTable} guests={guests} search={search} onSeatClick={openModal} />
            <div className="center-area">
              {centerTables.map((t) => (
                <TableView key={t.id} table={t} guests={guests} search={search} onSeatClick={openModal} />
              ))}
            </div>
            <TableView table={rightTable} guests={guests} search={search} onSeatClick={openModal} />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <div className="legend">
          <span><span className="dot empty" /> Wolne</span>
          <span><span className="dot occupied" /> Zajęte</span>
          {search && <span><span className="dot highlight" /> Wynik wyszukiwania</span>}
        </div>
        <div className={`status-badge ${firebaseEnabled ? 'status-live' : 'status-local'}`}>
          {firebaseEnabled ? '🟢 Synchronizacja na żywo' : '💾 Tylko lokalnie'}
        </div>
      </footer>

      {/* ── Modal ── */}
      {modal && (
        <Modal
          modal={modal}
          initialName={guests[modal.seatId] || ''}
          onSave={(name) => { void handleSave(name); }}
          onDelete={() => { void handleDelete(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
