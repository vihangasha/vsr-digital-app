"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  KeyRound,
  LogOut,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";
import Navbar from "./components/navbar/navbar";
import AddUser from "./components/adduser/adduser";
import "./styles/home/home.css";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// `key` is the field read from each row object, `label` is the column heading.
const ACTIVE_AFFAIRS_COLUMNS = [
  { key: "regNo", label: "Reg No" },
  { key: "nic", label: "NIC" },
  { key: "issuedAmount", label: "Issued" },
  { key: "paidAmount", label: "Returned" },
  { key: "paidCount", label: "Count" },
  { key: "dueAmount", label: "Due" },
  { key: "dueCount", label: "Due Count" },
  { key: "nextPayDate", label: "Next Return" },
];


const RECEIVABLES_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "customer", label: "Customer" },
  { key: "nic", label: "NIC" },
  { key: "regNo", label: "Reg No" },
  { key: "issued", label: "Issued" },
  { key: "payable", label: "Payable" },
  { key: "returned", label: "Returned" },
  { key: "due", label: "Due" },
  { key: "period", label: "Period" },
  { key: "nextReturn", label: "Next Return" },
  { key: "createdDate", label: "Created Date" },
  { key: "createdBy", label: "Created By" },
  { key: "updatedDate", label: "Updated Date" },
  { key: "updatedBy", label: "Updated By" },
];

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */

// morning 5-12, afternoon 12-17, evening 17-21, night 21-5
function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Up Late";
}

const pad = (n) => String(n).padStart(2, "0");

function buildMonthCells(year, month) {
  const startOffset = new Date(year, month, 1).getDay();
  // 6 rows x 7 columns so the calendar never changes height between months
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - startOffset + i));
}

/* ------------------------------------------------------------------
   Icons
------------------------------------------------------------------ */

// Solid (filled) cogwheel for the settings button (same icon as the Customers page)
function CogIcon({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10.06 4.55 L10.29 1.74 L13.71 1.74 L13.94 4.55 A7.7 7.7 0 0 1 15.90 5.36 L18.05 3.54 L20.46 5.95 L18.64 8.10 A7.7 7.7 0 0 1 19.45 10.06 L22.26 10.29 L22.26 13.71 L19.45 13.94 A7.7 7.7 0 0 1 18.64 15.90 L20.46 18.05 L18.05 20.46 L15.90 18.64 A7.7 7.7 0 0 1 13.94 19.45 L13.71 22.26 L10.29 22.26 L10.06 19.45 A7.7 7.7 0 0 1 8.10 18.64 L5.95 20.46 L3.54 18.05 L5.36 15.90 A7.7 7.7 0 0 1 4.55 13.94 L1.74 13.71 L1.74 10.29 L4.55 10.06 A7.7 7.7 0 0 1 5.36 8.10 L3.54 5.95 L5.95 3.54 L8.10 5.36 A7.7 7.7 0 0 1 10.06 4.55 Z M8.6 12a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------
   Cards
------------------------------------------------------------------ */

function Card({ i = 0, className = "", children }) {
  return (
    <section className={`home-card ${className}`} style={{ "--i": i }}>
      {children}
    </section>
  );
}

function CardHead({ title, description, action }) {
  return (
    <header className="home-card__head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

function ClockCard({ now }) {
  const hours = now ? pad(now.getHours() % 12 || 12) : "--";
  const minutes = now ? pad(now.getMinutes()) : "--";
  const seconds = now ? pad(now.getSeconds()) : "--";
  const meridiem = now ? (now.getHours() < 12 ? "AM" : "PM") : "";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Card i={1} className="home-clock">
      <CardHead title="Local time" description={now ? timeZone.replace("_", " ") : ""} />
      <div className="home-clock__time" role="timer" aria-live="off">
        <span>
          {hours}:{minutes}
        </span>
        <span className="home-clock__seconds">{seconds}</span>
        <span className="home-clock__meridiem">{meridiem}</span>
      </div>
    </Card>
  );
}

function CalendarCard({ now }) {
  const [view, setView] = useState(null); // { year, month }, set once the clock mounts

  useEffect(() => {
    if (now && !view) setView({ year: now.getFullYear(), month: now.getMonth() });
  }, [now, view]);

  const cells = useMemo(() => (view ? buildMonthCells(view.year, view.month) : []), [view]);

  const shiftMonth = (delta) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const title = view
    ? new Date(view.year, view.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Calendar";

  return (
    <Card i={2} className="home-calendar">
      <CardHead
        title={title}
        action={
          view && (
            <div className="home-calendar__nav">
              <button type="button" className="home-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={16} strokeWidth={2.2} />
              </button>
              <button type="button" className="home-icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          )
        }
      />

      <div className="home-calendar__grid" role="grid" aria-label={title}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="home-calendar__weekday" role="columnheader">
            {d}
          </span>
        ))}
        {cells.map((date) => {
          const isToday = now && date.toDateString() === now.toDateString();
          const outside = date.getMonth() !== view.month;
          return (
            <span
              key={date.toISOString()}
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              className={`home-calendar__day${outside ? " is-outside" : ""}${isToday ? " is-today" : ""}`}
            >
              {date.getDate()}
            </span>
          );
        })}
      </div>

      {view && (
        <button
          type="button"
          className="home-link-btn"
          onClick={() => setView({ year: now.getFullYear(), month: now.getMonth() })}
        >
          Jump to today
        </button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------
   Table panel (used by Active Affairs Status and All Receivables)
------------------------------------------------------------------ */

function DataPanel({ i = 0, title, description, columns, rows, loading = false, rowKey, searchLabel }) {
  const [query, setQuery] = useState("");

  const visibleRows = rows.filter((row) =>
    columns
      .map((c) => row[c.key] ?? "")
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );

  let emptyMessage = "";
  if (loading) emptyMessage = "Loading records...";
  else if (rows.length === 0) emptyMessage = "No records yet.";
  else if (visibleRows.length === 0) emptyMessage = "No records match your search. Clear it to see all records.";

  return (
    <Card i={i}>
      <CardHead title={title} description={description} />

      <div className="home-search">
        <Search size={16} className="home-search__icon" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
        />
      </div>

      <div className="home-table-wrap">
        <table className="home-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row[rowKey] ?? index}>
                {columns.map((c) => (
                  <td key={c.key}>{row[c.key] ?? "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {emptyMessage && <p className="home-empty">{emptyMessage}</p>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Task Extender (right bar, below the calendar)
------------------------------------------------------------------ */

const MAX_EXTEND_DAYS = 10000;

function TaskExtenderCard({ onExtend }) {
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [charged, setCharged] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text }
  const chargeTimer = useRef(null);
  const noticeTimer = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(chargeTimer.current);
      clearTimeout(noticeTimer.current);
    },
    []
  );

  const showNotice = (type, text) => {
    clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    // The notice area is reserved, so clearing it leaves the card the same height.
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    // Charge the bolt (blue outline, cyan fill) on every press; CSS fades it back to normal.
    clearTimeout(chargeTimer.current);
    setCharged(true);
    chargeTimer.current = setTimeout(() => setCharged(false), 900);

    const count = Number(days);
    if (!Number.isInteger(count) || count < 1 || count > MAX_EXTEND_DAYS) {
      showNotice("error", "Enter a whole number of days from 1 to 10,000.");
      return;
    }

    setBusy(true);
    try {
      await onExtend?.(count);
      showNotice(
        "success",
        `Business operations are successfully shifted forward by ${count} ${count === 1 ? "day" : "days"}.`
      );
      setDays("");
    } catch (error) {
      showNotice("error", error.message || "Could not move the working days. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card i={3} className="home-extender">
      <CardHead title="Move working days" />

      <form className="home-extender__form" onSubmit={handleSubmit} noValidate>
        <label className="home-extender__label" htmlFor="extend-days">
          Enter duration in days
        </label>
        <div className="home-extender__row">
          <input
            id="extend-days"
            className="home-input"
            type="text"
            inputMode="numeric"
            maxLength={5}
            autoComplete="off"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="Days"
          />
          <button
            type="submit"
            className={`home-btn home-btn--primary home-btn--bolt${charged ? " is-charged" : ""}`}
            disabled={busy}
          >
            {/* Bolt = flash.png, drawn as stacked layers so CSS can animate each one */}
            <span className="home-btn__bolt-box" aria-hidden="true">
              <span className="home-bolt home-bolt--outline" />
              <span className="home-bolt home-bolt--fill" />
              <span className="home-bolt-charge">
                <span className="home-bolt home-bolt--charge-fill" />
                <span className="home-bolt home-bolt--charge-line" />
              </span>
            </span>
            Extend
          </button>
        </div>
      </form>

      {/* Reserved space: stays empty until a result arrives, so the card never resizes */}
      <p
        className={`home-extender__notice${notice ? ` is-${notice.type}` : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice?.text}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

export default function Home() {
  const router = useRouter();
  const [now, setNow] = useState(null); // null on the server, avoids a hydration mismatch
  const [query, setQuery] = useState("");

  const [showAddUser, setShowAddUser] = useState(false);

  // Starts with the signed-in user; 
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Rows for the two new table panels. Fill these from your API, e.g.
  // setActiveAffairs(data.affairs) / setReceivables(data.receivables).
  const [activeAffairs, setActiveAffairs] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [loadingAffairs, setLoadingAffairs] = useState(false);
  const [loadingReceivables, setLoadingReceivables] = useState(false);

  /* ------------------------------------------------------------------
   Profile data -  database
------------------------------------------------------------------ */
  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (!data.authenticated || !data.user) {
          router.replace("/login");
          return;
        }

        setCurrentUser(data.user);
      } catch (error) {
        console.error("Session loading error:", error);
        router.replace("/login");
      } finally {
        setLoadingUser(false);
      }
    }

    loadSession();
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;

    async function loadUsers() {
      try {
        const response = await fetch("/api/users/get", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load users.");
        }

        const data = await response.json();

        setUsers(data.users || []);
      } catch (error) {
        console.error("Users loading error:", error);
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, [currentUser]);


  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    async function loadActiveAffairs() {
      setLoadingAffairs(true);

      try {
        const response = await fetch(
          "/api/dashboard/active-affairs/get",
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Failed to load active affairs."
          );
        }

        if (!cancelled) {
          setActiveAffairs(
            Array.isArray(data.activeAffairs)
              ? data.activeAffairs
              : []
          );
        }
      } catch (error) {
        console.error("Active affairs loading error:", error);

        if (!cancelled) {
          setActiveAffairs([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingAffairs(false);
        }
      }
    }

    loadActiveAffairs();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);


  // Load Receivables from the authenticated API.
  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    async function loadReceivables() {
      setLoadingReceivables(true);

      try {
        const response = await fetch(
          "/api/dashboard/recievables/get",
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Failed to load receivables."
          );
        }

        if (!cancelled) {
          setReceivables(
            Array.isArray(data.receivables)
              ? data.receivables
              : []
          );
        }
      } catch (error) {
        console.error("Receivables loading error:", error);

        if (!cancelled) {
          setReceivables([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingReceivables(false);
        }
      }
    }

    loadReceivables();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  /*--------------------------------------------------------------------------*/

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ---- Rolling banner (same behaviour as the Customers page) ---- */

  // The banner starts rolled up; the cog button slides it down.
  const [bannerOpen, setBannerOpen] = useState(false);
  const heroRef = useRef(null);
  const settingsRef = useRef(null);
  const rollUpRef = useRef(null);
  const wasOpen = useRef(false);

  const toggleBanner = () => setBannerOpen((open) => !open);
  const closeBanner = () => setBannerOpen(false);

  // Escape rolls the banner up
  useEffect(() => {
    if (!bannerOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setBannerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bannerOpen]);

  // Keep keyboard focus sensible: into the banner on open, back to the cog on close
  useEffect(() => {
    if (bannerOpen) {
      rollUpRef.current?.focus({ preventScroll: true });
    } else if (wasOpen.current && heroRef.current?.contains(document.activeElement)) {
      settingsRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = bannerOpen;
  }, [bannerOpen]);

  const visibleUsers = users.filter((u) =>
    `${u.name} ${u.email} ${u.role}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );

  /* ---- CRUD placements: connect these to your forms / API later ---- */
  const handleAddUser = () => {
    setShowAddUser(true);
  };

  const handleCloseAddUser = () => {
    setShowAddUser(false);
  };

  // Called by the AddUser form. Throw an error here to show it inside the form.
  // TODO: replace the local update with your real create-user call (Firebase / API).
  const handleCreateUser = async ({ name, email, password, role }) => {
    const response = await fetch("/api/users/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create user.");
    }

    // Use the user returned by the server.
    setUsers((prev) => [...prev, data.user]);

    setShowAddUser(false);
  };

  const handleViewUser = (user) => { }; // Read: open user details
  const handleEditUser = (user) => { }; // Update: open the edit-user form
  const handleDeleteUser = (user) => { }; // Delete: confirm, then remove
  // Task Extender: shift business operations forward by `days`.
  // TODO: call your real endpoint here. Throw an Error to show it in the panel.
  const handleExtendTasks = async (days) => { };

  const handleEditProfile = () => { };
  const handleChangePassword = () => { };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session", {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  const greeting =
    now && currentUser
      ? `${getGreeting(now.getHours())}, ${currentUser.name}`
      : "Welcome back";
  const dateLabel = now
    ? now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";

  if (loadingUser) {
    return null;
  }

  if (!currentUser) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#fff]">
      <div className="home-navbar-fixed">
        <Navbar />
      </div>

      <div className="home-page">
        {/* Hero: rolls up into a thin strip, the cog button slides it back down */}
        <div
          className={`home-scrim${bannerOpen ? " is-visible" : ""}`}
          onClick={closeBanner}
          aria-hidden="true"
        />
        <section
          ref={heroRef}
          className={`home-hero ${bannerOpen ? "is-open" : "is-collapsed"}`}
        >
          <div className="home-hero__glow" />
          <div className="home-hero__stripes">
            <span className="home-hero__stripe home-hero__stripe--1" />
            <span className="home-hero__stripe home-hero__stripe--2" />
            <span className="home-hero__stripe home-hero__stripe--3" />
            <span className="home-hero__stripe home-hero__stripe--4" />
            <span className="home-hero__stripe home-hero__stripe--5" />
            <span className="home-hero__stripe home-hero__stripe--6" />
            <span className="home-hero__stripe home-hero__stripe--7" />
            <span className="home-hero__stripe home-hero__stripe--8" />
            <span className="home-hero__stripe home-hero__stripe--9" />
            <span className="home-hero__stripe home-hero__stripe--10" />
            <span className="home-hero__stripe home-hero__stripe--11" />
            <span className="home-hero__stripe home-hero__stripe--12" />
          </div>

          <div className="home-hero__content" id="home-hero-panel">
            <div className="home-identity">
              <div className="home-identity__name-row">
                <h1 className="home-identity__name">{greeting}</h1>
                <span className="home-identity__meta">{dateLabel}</span>
              </div>
              <p className="home-identity__role">Signed in as {currentUser.role}</p>
            </div>

            <div className="home-hero__actions">
              <button
                ref={rollUpRef}
                type="button"
                className="home-hero__btn home-hero__btn--ghost home-hero__btn--icon"
                onClick={closeBanner}
                aria-label="Roll up banner"
                title="Roll up"
              >
                <ChevronUp size={18} strokeWidth={2.3} />
              </button>
            </div>
          </div>

          {/* Rolled-up strip: greeting, date and the settings button */}
          <div className="home-hero__bar">
            <h1 className="home-hero__bar-title">{greeting}</h1>
            {dateLabel && <span className="home-hero__bar-tab">{dateLabel}</span>}
            <button
              ref={settingsRef}
              type="button"
              className="home-hero__settings"
              onClick={toggleBanner}
              aria-label="Open home settings"
              aria-expanded={bannerOpen}
              aria-controls="home-hero-panel"
              title="Settings"
            >
              <CogIcon size={20} />
            </button>
          </div>
        </section>



        {/* Cards */}
        {showAddUser && (
          <div className="home-adduser">
            <AddUser
              onClose={handleCloseAddUser}
              onSubmit={handleCreateUser}
              createdBy={
                currentUser.role === "developer"
                  ? "system"
                  : currentUser.role === "admin"
                    ? currentUser.name
                    : ""
              }
            />
          </div>
        )}
        <div className="home-content">
          <div className="home-main">
            {/* Profile */}
            <Card i={0}>
              <CardHead
                title="Profile"
                description="Your login information."
                action={
                  <button type="button" className="home-btn home-btn--danger" onClick={handleLogout}>
                    <LogOut size={16} strokeWidth={2.2} aria-hidden="true" />
                    Log out
                  </button>
                }
              />

              <div className="home-profile">
                <div className="home-profile__avatar" aria-hidden="true">
                  <UserRound size={34} strokeWidth={1.6} />
                </div>

                <dl className="home-profile__fields">
                  <div>
                    <dt>Full name</dt>
                    <dd>{currentUser.name}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{currentUser.role}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{currentUser.email}</dd>
                  </div>
                </dl>
              </div>

              <div className="home-card__actions">
                <button type="button" className="home-btn home-btn--ghost" onClick={handleEditProfile}>
                  <Pencil size={15} strokeWidth={2.2} aria-hidden="true" />
                  Edit profile
                </button>
                <button type="button" className="home-btn home-btn--ghost" onClick={handleChangePassword}>
                  <KeyRound size={15} strokeWidth={2.2} aria-hidden="true" />
                  Change password
                </button>
              </div>
            </Card>

            {/* User management */}
            <Card i={1}>
              <CardHead
                title="Users"
                description="Add, view, edit and remove the people who can sign in."
                action={
                  <button type="button" className="home-btn home-btn--primary" onClick={handleAddUser}>
                    <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" />
                    Add user
                  </button>
                }
              />

              <div className="home-search">
                <Search size={16} className="home-search__icon" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users"
                  aria-label="Search users"
                />
              </div>

              <div className="home-table-wrap">
                <table className="home-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th className="home-table__actions-head">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((user) => {
                      const isSelf = user.uid === currentUser.uid;
                      return (
                        <tr key={user.uid}>
                          <td>
                            {user.name}
                            {isSelf && <span className="home-badge">You</span>}
                          </td>
                          <td>{user.email}</td>
                          <td>{user.role}</td>
                          <td>{user.status}</td>
                          <td>
                            <div className="home-table__actions">
                              <button
                                type="button"
                                className="home-icon-btn"
                                onClick={() => handleViewUser(user)}
                                aria-label={`View ${user.name}`}
                              >
                                <Eye size={16} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                className="home-icon-btn"
                                onClick={() => handleEditUser(user)}
                                aria-label={`Edit ${user.name}`}
                              >
                                <Pencil size={16} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                className="home-icon-btn"
                                onClick={() => handleDeleteUser(user)}
                                disabled={isSelf}
                                title={isSelf ? "You can't delete your own account" : undefined}
                                aria-label={`Delete ${user.name}`}
                              >
                                <Trash2 size={16} strokeWidth={2} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {visibleUsers.length === 0 && (
                  <p className="home-empty">No users match your search. Clear it or use Add user to create one.</p>
                )}
              </div>
            </Card>

            {/* Active Affairs Status */}
            <DataPanel
              i={2}
              title="Active Affairs Status"
              description="Current status of every active affair."
              columns={ACTIVE_AFFAIRS_COLUMNS}
              rows={activeAffairs}
              loading={loadingAffairs}
              rowKey="regNo"
              searchLabel="Search active affairs"
            />

            {/* All Receivables */}
            <DataPanel
              i={3}
              title="All Receivables"
              description="Every receivable with its payment and audit details."
              columns={RECEIVABLES_COLUMNS}
              rows={receivables}
              loading={loadingReceivables}
              rowKey="id"
              searchLabel="Search receivables"
            />
          </div>

          {/* Right bar */}
          <aside className="home-side" aria-label="Clock, calendar and task extender">
            <ClockCard now={now} />
            <CalendarCard now={now} />
            <TaskExtenderCard onExtend={handleExtendTasks} />
          </aside>
        </div>
      </div>
    </main>
  );
}