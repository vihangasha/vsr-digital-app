"use client";

import { useEffect } from "react";
import {
    ArrowLeft,
    Briefcase,
    CreditCard,
    FileText,
    History,
    Pencil,
    Phone,
    Trash2,
    UserRound,
} from "lucide-react";
// Card, hero background and stripes come from the registration form's stylesheet
import "../../styles/customerRegistration/registration.css";
import "../../styles/customerProfile/profile.css";

const LOAN_TYPES = [
    { label: "Daily", field: "dailyRegNo" },
    { label: "Weekly", field: "weeklyRegNo" },
    { label: "Monthly", field: "monthlyRegNo" },
    { label: "Monthly Interest", field: "MintRegNo" },
    { label: "Cheque", field: "chqRegNo" },
];

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */

const clean = (value) => (value === null || value === undefined ? "" : String(value).trim());

const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// "Nimal Perera" -> "NP", "Nimal" -> "N"
const getInitials = (name) => {
    const parts = clean(name).split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
};

/* ------------------------------------------------------------------
   Small pieces
------------------------------------------------------------------ */

function Panel({ icon: Icon, title, children }) {
    return (
        <section className="custprofile-panel">
            <h3>
                <span className="custprofile-panel__icon" aria-hidden="true">
                    <Icon size={16} strokeWidth={2.1} />
                </span>
                {title}
            </h3>
            {children}
        </section>
    );
}

function Item({ label, value, wide = false }) {
    const text = clean(value);
    return (
        <div className={`custprofile-item${wide ? " custprofile-item--wide" : ""}`}>
            <dt>{label}</dt>
            <dd className={text ? undefined : "is-empty"}>{text || "Not provided"}</dd>
        </div>
    );
}

/* ------------------------------------------------------------------
   Profile
------------------------------------------------------------------ */

export default function CustomerProfile({ customer, onClose, onEdit, onDelete }) {
    // The profile replaces the table, so start from the top of the page
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    // Esc goes back to the table
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && onClose) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!customer) return null;

    const name = clean(customer.fullName || customer.name) || "Unnamed customer";
    const contact = clean(customer.contact || customer.tele);
    const nic = clean(customer.nic || customer.id);
    const businessType = clean(customer.businessType);
    const status = clean(customer.status);
    const loyalty = clean(customer.loyalty);
    const since = formatDate(customer.createdAt);

    const registrations = LOAN_TYPES.map(({ label, field }) => ({ label, reg: clean(customer[field]) }));
    const activeCount = registrations.filter((r) => r.reg).length;

    return (
        <div className="regdebtor-panel custprofile">
            <article className="regdebtor-card custprofile-card" aria-labelledby="custprofile-name">
                {/* Same look as the page hero and the registration form */}
                <div className="regdebtor-bg" aria-hidden="true">
                    <div className="regdebtor-bg__glow" />
                    <span className="regdebtor-stripe regdebtor-stripe--1" />
                    <span className="regdebtor-stripe regdebtor-stripe--2" />
                    <span className="regdebtor-stripe regdebtor-stripe--3" />
                    <span className="regdebtor-stripe regdebtor-stripe--4" />
                    <span className="regdebtor-stripe regdebtor-stripe--5" />
                    <span className="regdebtor-stripe regdebtor-stripe--6" />
                </div>

                {/* Top bar */}
                <div className="custprofile-top">
                    <button type="button" className="custprofile-btn" onClick={onClose}>
                        <ArrowLeft size={16} strokeWidth={2.2} />
                        All customers
                    </button>

                    <div className="custprofile-actions">
                        <button type="button" className="custprofile-btn" onClick={() => onEdit && onEdit(customer)}>
                            <Pencil size={15} strokeWidth={2.2} />
                            Edit
                        </button>
                        <button
                            type="button"
                            className="custprofile-btn custprofile-btn--danger"
                            onClick={() => onDelete && onDelete(customer)}
                        >
                            <Trash2 size={15} strokeWidth={2.2} />
                            Delete
                        </button>
                    </div>
                </div>

                {/* Identity */}
                <header className="custprofile-identity">
                    <div className="custprofile-avatar" aria-hidden="true">
                        {getInitials(name)}
                    </div>

                    <div className="custprofile-identity__text">
                        <h2 id="custprofile-name">{name}</h2>

                        <p className="custprofile-sub">
                            {businessType && <span>{businessType}</span>}
                            {since !== "—" && <span>Customer since {since}</span>}
                        </p>

                        {(status || contact) && (
                            <div className="custprofile-tags">
                                {status && (
                                    <span className="custprofile-tag">
                                        <span className="custprofile-tag__dot" aria-hidden="true" />
                                        {status}
                                    </span>
                                )}
                                {contact && (
                                    <a
                                        className="custprofile-tag custprofile-tag--link"
                                        href={`tel:${contact.replace(/[^\d+]/g, "")}`}
                                    >
                                        <Phone size={14} strokeWidth={2.2} aria-hidden="true" />
                                        {contact}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </header>

                {/* At a glance */}
                <dl className="custprofile-stats">
                    <div className="custprofile-stat">
                        <dt>Credit accounts</dt>
                        <dd>
                            {activeCount}
                            <span> of {LOAN_TYPES.length}</span>
                        </dd>
                    </div>
                    <div className="custprofile-stat">
                        <dt>Loyalty tier</dt>
                        <dd>{loyalty || "—"}</dd>
                    </div>
                    <div className="custprofile-stat">
                        <dt>Member since</dt>
                        <dd>{since}</dd>
                    </div>
                    <div className="custprofile-stat">
                        <dt>Last updated</dt>
                        <dd>{formatDate(customer.updatedAt)}</dd>
                    </div>
                </dl>

                {/* Details */}
                <div className="custprofile-grid">
                    <div className="custprofile-col">
                        <Panel icon={UserRound} title="Personal details">
                            <dl className="custprofile-list">
                                <Item label="NIC" value={nic} />
                                <Item label="Telephone" value={contact} />
                                <Item label="Permanent address" value={customer.permanentAddress} wide />
                            </dl>
                        </Panel>

                        <Panel icon={Briefcase} title="Business">
                            <dl className="custprofile-list">
                                <Item label="Business type" value={businessType} />
                                <Item label="Business registration no." value={customer.businessRegNo} />
                                <Item label="Business address" value={customer.businessAddress} wide />
                            </dl>
                        </Panel>

                        <Panel icon={FileText} title="Loan">
                            <dl className="custprofile-list">
                                <Item label="Purpose of loan" value={customer.loanPurpose} wide />
                                <Item label="Route to house" value={customer.routeToHouse} wide />
                            </dl>
                        </Panel>
                    </div>

                    <aside className="custprofile-col">
                        <Panel icon={CreditCard} title="Registration numbers">
                            <ul className="custprofile-regs">
                                {registrations.map(({ label, reg }) => (
                                    <li key={label} className={`custprofile-reg${reg ? "" : " is-empty"}`}>
                                        <span className="custprofile-reg__type">{label}</span>
                                        {reg ? (
                                            <span className="custprofile-code">{reg}</span>
                                        ) : (
                                            <span className="custprofile-reg__none">Not registered</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Panel>

                        <Panel icon={History} title="Record">
                            <dl className="custprofile-list custprofile-list--single">
                                <Item label="Created by" value={customer.createdBy} />
                                <Item label="Updated by" value={customer.updatedBy} />
                            </dl>
                        </Panel>
                    </aside>
                </div>
            </article>
        </div>
    );
}