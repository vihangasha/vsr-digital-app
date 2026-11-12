"use client";

import { useEffect, useState } from "react";
import {
    ArrowLeft,
    Briefcase,
    Check,
    CreditCard,
    FileText,
    History,
    Pencil,
    Phone,
    Plus,
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
    { label: "Monthly Int", field: "MintRegNo" },
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

// One line of the Registration numbers panel.
// Has a number: shows the chip. No number: "Not registered" + a round "+".
// Clicking "+" fetches the number: Save appears on the left, the number (with a green tick)
// on the right, and the "+" goes away. Esc cancels.
function RegRow({ label, reg, previewNumber, armed, busy, error, onToggle, onSave }) {
    return (
        <li className={`custprofile-reg${reg ? "" : " is-empty"}${armed ? " is-armed" : ""}`}>
            <span className="custprofile-reg__type">{label}</span>

            {reg ? (
                <span className="custprofile-code">{reg}</span>
            ) : (
                <span
                    className="custprofile-reg__end"
                    onClick={(e) => {
                        // the dashed area acts like the "+" (buttons inside handle themselves)
                        if (e.target.closest("button")) return;
                        if (!armed && !busy) onToggle();
                    }}
                >
                    {armed ? (
                        <>
                            {/* Save stays on the left */}
                            <button
                                type="button"
                                className="custprofile-reg__save"
                                onClick={onSave}
                                disabled={busy || !previewNumber}
                            >
                                {busy ? (
                                    <>
                                        <span className="custprofile-reg__spinner" />
                                        Saving
                                    </>
                                ) : (
                                    <>
                                        <Check size={12} strokeWidth={3} />
                                        Save
                                    </>
                                )}
                            </button>

                            {/* fetched number on the right, with a green tick before it */}
                            <span className="custprofile-fetched">
                                <span className="custprofile-fetched__tick" aria-hidden="true">
                                    <Check size={11} strokeWidth={3.5} />
                                </span>
                                <span className="custprofile-fetched__no">{previewNumber}</span>
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="custprofile-reg__none">Not registered</span>

                            {/* the round "+" only exists until the number is fetched */}
                            <button
                                type="button"
                                className="custprofile-reg__add"
                                onClick={onToggle}
                                disabled={busy}
                                aria-label={`Add ${label} registration number`}
                                title={`Add ${label} registration number`}
                            >
                                <Plus size={14} strokeWidth={3} aria-hidden="true" />
                            </button>
                        </>
                    )}
                </span>
            )}

            {error && (
                <span className="custprofile-reg__error" role="alert">
                    {error}
                </span>
            )}
        </li>
    );
}

/* ------------------------------------------------------------------
   Profile
------------------------------------------------------------------ */

// onRegister(customer, field) should resolve to the new registration number
// (a string) for that loan type, e.g. onRegister(customer, "weeklyRegNo").
export default function CustomerProfile({ customer, onClose, onEdit, onDelete, onRegister }) {
    // Per loan type: which rows have their Save button open, which are saving,
    // any error, and numbers registered during this visit.
    const [armed, setArmed] = useState({});
    const [busy, setBusy] = useState({});
    const [errors, setErrors] = useState({});
    const [fetchedNumbers, setFetchedNumbers] = useState({});

    const anyArmed = Object.values(armed).some(Boolean);

    // The profile replaces the table, so start from the top of the page
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    // Esc closes an open Save button first; with none open it goes back to the table
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "Escape") return;
            if (anyArmed) {
                setArmed({});
                return;
            }
            if (onClose) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, anyArmed]);

    const [assignedNumbers, setAssignedNumbers] = useState({});

    const REGISTRATION_CONFIG = {
        dailyRegNo: {
            creditType: "Daily Collect",
            prefix: "D",
        },
        weeklyRegNo: {
            creditType: "Weekly Installment",
            prefix: "W",
        },
        monthlyRegNo: {
            creditType: "Monthly Collect",
            prefix: "M",
        },
        MintRegNo: {
            creditType: "Monthly Interest",
            prefix: "MINT",
        },
        chqRegNo: {
            creditType: "Cheque Cashing",
            prefix: "CH",
        },
    };

    const toggleArmed = async (field) => {
        if (busy[field]) return;

        // Clicking + again cancels the preview.
        if (armed[field]) {
            setArmed((prev) => ({ ...prev, [field]: false }));
            setErrors((prev) => ({ ...prev, [field]: "" }));
            setFetchedNumbers((prev) => ({ ...prev, [field]: "" }));
            return;
        }

        const config = REGISTRATION_CONFIG[field];

        if (!config) {
            setErrors((prev) => ({
                ...prev,
                [field]: "Invalid registration type.",
            }));
            return;
        }

        setErrors((prev) => ({ ...prev, [field]: "" }));
        setBusy((prev) => ({ ...prev, [field]: true }));

        try {
            const response = await fetch(
                `/api/auto-number/get?creditType=${encodeURIComponent(config.creditType)}&prefix=${encodeURIComponent(config.prefix)}`,
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        "Cache-Control": "no-cache",
                    },
                }
            );

            const responseText = await response.text();

            let result;

            try {
                result = JSON.parse(responseText);
            } catch {
                console.error("Non-JSON API response:", {
                    status: response.status,
                    response: responseText.slice(0, 500),
                });

                throw new Error(
                    `API returned an unexpected response (HTTP ${response.status}). Check the API route and server logs.`
                );
            }

            if (!response.ok) {
                throw new Error(
                    result.error || "Unable to fetch registration number."
                );
            }

            if (!result.registrationNo) {
                throw new Error("No registration number returned.");
            }

            // Store only in local profile state. Nothing is saved to Firestore.
            setFetchedNumbers((prev) => ({
                ...prev,
                [field]: result.registrationNo,
            }));

            setArmed((prev) => ({
                ...prev,
                [field]: true,
            }));
        } catch (error) {
            setErrors((prev) => ({
                ...prev,
                [field]: error.message || "Unable to fetch registration number.",
            }));
        } finally {
            setBusy((prev) => ({ ...prev, [field]: false }));
        }
    };

    const saveRegistrationNumber = async (field) => {
        if (busy[field]) return;

        const config = REGISTRATION_CONFIG[field];
        const registrationNo = fetchedNumbers[field];
        const customerNic = clean(customer.nic || customer.id);

        if (!config || !registrationNo || !customerNic) {
            setErrors((prev) => ({
                ...prev,
                [field]: "Missing customer or registration information.",
            }));
            return;
        }

        setBusy((prev) => ({ ...prev, [field]: true }));
        setErrors((prev) => ({ ...prev, [field]: "" }));

        try {
            const response = await fetch(
                "/api/customers/assign-registration",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        nic: customerNic,
                        prefix: config.prefix,
                        registrationNo,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Unable to assign registration number."
                );
            }

            // Update the profile immediately after successful API response.
            setAssignedNumbers((prev) => ({
                ...prev,
                [field]: result.registrationNo,
            }));

            // Clear the preview and close the Save state.
            setFetchedNumbers((prev) => ({
                ...prev,
                [field]: "",
            }));

            setArmed((prev) => ({
                ...prev,
                [field]: false,
            }));

        } catch (error) {
            setErrors((prev) => ({
                ...prev,
                [field]: error.message || "Unable to save registration number.",
            }));
        } finally {
            setBusy((prev) => ({
                ...prev,
                [field]: false,
            }));
        }
    };

    if (!customer) return null;

    const name = clean(customer.fullName || customer.name) || "Unnamed customer";
    const contact = clean(customer.contact || customer.tele);
    const nic = clean(customer.nic || customer.id);
    const businessType = clean(customer.businessType);
    const status = clean(customer.status);
    const loyalty = clean(customer.loyalty);
    const since = formatDate(customer.createdAt);

    const registrations = LOAN_TYPES.map(({ label, field }) => ({
        label,
        field,
        reg: clean(assignedNumbers[field] || customer[field]),
    }));
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
                                {registrations.map(({ label, field, reg }) => (
                                    <RegRow
                                        key={field}
                                        label={label}
                                        reg={reg}
                                        previewNumber={fetchedNumbers[field]}
                                        armed={Boolean(armed[field])}
                                        busy={Boolean(busy[field])}
                                        error={errors[field]}
                                        onToggle={() => toggleArmed(field)}
                                        onSave={() => saveRegistrationNumber(field)}
                                    />
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