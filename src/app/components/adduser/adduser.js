"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, ShieldCheck, UserRound, X } from "lucide-react";
import "../../styles/adduser/adduser.css";

/* ------------------------------------------------------------------
   Config
   Only two roles exist. The value is exactly what gets stored in
   the Firestore `role` field. Edit the notes to match your app.
------------------------------------------------------------------ */

const ROLES = [
    { value: "admin", label: "Admin", note: "Manages users and settings", Icon: ShieldCheck },
    { value: "agent", label: "Agent", note: "Handles day-to-day work", Icon: UserRound },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;
const TOTAL_STEPS = 5; // name, email, role, password, confirm password

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */

function formatToday() {
    return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

// Turns Firebase / Firestore errors into plain sentences
function friendlyError(err) {
    switch (err?.code) {
        case "auth/email-already-in-use":
            return "That email already has an account. Use a different email.";
        case "auth/invalid-email":
            return "That email address is not valid.";
        case "auth/weak-password":
            return "That password is too weak. Choose a longer one.";
        case "permission-denied":
        case "auth/insufficient-permission":
            return "You do not have permission to create users.";
        case "auth/network-request-failed":
            return "No connection. Check your internet and try again.";
        default:
            return err?.message || "The user could not be created. Try again.";
    }
}

/* ------------------------------------------------------------------
   Small pieces
------------------------------------------------------------------ */

// Reveals every [data-au-reveal] element as it scrolls into view.
// The panel is only marked "is-ready" here, so nothing stays hidden if this never runs.
function useReveal(rootRef) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const els = root.querySelectorAll("[data-au-reveal]");

        if (typeof IntersectionObserver === "undefined") {
            els.forEach((el) => el.classList.add("is-in"));
            return;
        }

        root.classList.add("is-ready");
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-in");
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [rootRef]);
}

function Section({ title, description, children }) {
    return (
        <section className="adduser-section" data-au-reveal>
            <div className="adduser-section__intro">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
            <div className="adduser-section__fields">{children}</div>
        </section>
    );
}

// auto  = filled by the system (read only), so no required star
// group = the control is a set of radios, so the caption is not a <label>
function Field({ id, label, i = 0, wide = false, auto = false, group = false, error = false, hint, children }) {
    const Caption = group ? "span" : "label";
    const captionProps = group ? { id: `${id}-label` } : { htmlFor: id };

    return (
        <div className={`adduser-field${wide ? " adduser-field--wide" : ""}${error ? " adduser-field--error" : ""}`} style={{ "--i": i }}>
            <Caption className="adduser-label" {...captionProps}>
                {label}{" "}
                {auto ? <em className="adduser-auto">auto</em> : <span className="adduser-star" aria-hidden="true">*</span>}
            </Caption>
            {children}
            {hint && <small id={`${id}-hint`}>{hint}</small>}
        </div>
    );
}

function Status({ ok = false, children }) {
    return (
        <span className={`adduser-status ${ok ? "adduser-status--ok" : "adduser-status--err"}`}>
            {ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
            {children}
        </span>
    );
}

/* ------------------------------------------------------------------
   Form

   Props
   onClose    -> called by the X and Cancel buttons
   onSubmit   -> async (data) => void. Throw to show an error in the form.
                 data = { name, email, password, role }
   createdBy  -> "system" or "admin", worked out on the server from the session
                 (see getCreatedBy in src/lib/auth/session.js). Display only:
                 the server sets the real value again when it saves the user.
------------------------------------------------------------------ */

export default function AddUser({ onClose, onSubmit, createdBy = "" }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState({});
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [createdOn, setCreatedOn] = useState("");

    const rootRef = useRef(null);
    useReveal(rootRef);

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    // Set on the client so server and browser never disagree about "today"
    useEffect(() => {
        setCreatedOn(formatToday());
    }, []);

    /* ---------- Validation ---------- */

    const nameOk = name.trim().length >= 2;
    const emailOk = EMAIL_RE.test(email);
    const roleOk = Boolean(role);
    const passwordOk = password.length >= MIN_PASSWORD;
    const matchOk = confirm.length > 0 && confirm === password;
    const isValid = nameOk && emailOk && roleOk && passwordOk && matchOk;

    const done = [nameOk, emailOk, roleOk, passwordOk, matchOk].filter(Boolean).length;

    // Errors only appear after the person leaves a field (or has typed enough to be wrong)
    const emailError = touched.email && email.length > 0 && !emailOk;
    const passwordError = touched.password && password.length > 0 && !passwordOk;
    const mismatch = confirm.length > 0 && confirm !== password && (touched.confirm || confirm.length >= password.length);

    const touch = (key) => () => setTouched((t) => ({ ...t, [key]: true }));
    const edited = () => setSubmitError("");

    /* ---------- Handlers ---------- */

    const handleName = (e) => {
        edited();
        setName(e.target.value.replace(/^\s+/, "").replace(/\s{2,}/g, " "));
    };

    const handleEmail = (e) => {
        edited();
        setEmail(e.target.value.replace(/\s/g, "").toLowerCase());
    };

    const handleRole = (value) => {
        edited();
        setRole(value);
    };

    const handlePassword = (e) => {
        edited();
        setPassword(e.target.value);
    };

    const handleConfirm = (e) => {
        edited();
        setConfirm(e.target.value);
    };

    const handleReset = () => {
        setName("");
        setEmail("");
        setRole("");
        setPassword("");
        setConfirm("");
        setShowPassword(false);
        setTouched({});
        setSubmitError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid || busy) return;

        setBusy(true);
        setSubmitError("");

        try {
            if (onSubmit) {
                await onSubmit({
                    name: name.trim(),
                    email,
                    password,
                    role,
                });
            }
            handleReset();
        } catch (err) {
            setSubmitError(friendlyError(err));
        } finally {
            setBusy(false);
        }
    };

    /* ---------- Hints ---------- */

    let emailHint = "They will sign in with this address";
    if (emailError) {
        emailHint = <Status>Enter a full address, like name@example.com</Status>;
    } else if (emailOk) {
        emailHint = <Status ok>Valid email address</Status>;
    }

    let passwordHint = `At least ${MIN_PASSWORD} characters`;
    if (passwordError) {
        const left = MIN_PASSWORD - password.length;
        passwordHint = <Status>{left} more {left === 1 ? "character" : "characters"} needed</Status>;
    } else if (passwordOk) {
        passwordHint = <Status ok>Long enough</Status>;
    }

    let confirmHint = "Type the same password again";
    if (mismatch) {
        confirmHint = <Status>Passwords do not match</Status>;
    } else if (matchOk) {
        confirmHint = <Status ok>Passwords match</Status>;
    }

    const roleHint = "Every user is either an admin or an agent";

    /* ---------- Render ---------- */

    return (
        <div className="adduser-panel" ref={rootRef}>
            <div className="adduser-card">
                {/* Same look as the page hero */}
                <div className="adduser-bg" aria-hidden="true">
                    <div className="adduser-bg__glow" />
                    <span className="adduser-stripe adduser-stripe--1" />
                    <span className="adduser-stripe adduser-stripe--2" />
                    <span className="adduser-stripe adduser-stripe--3" />
                    <span className="adduser-stripe adduser-stripe--4" />
                    <span className="adduser-stripe adduser-stripe--5" />
                    <span className="adduser-stripe adduser-stripe--6" />
                </div>

                <header className="adduser-header">
                    <div>
                        <h2>Add User</h2>
                        <p>Add a person who can sign in, and choose what they can do.</p>
                    </div>

                    <button type="button" className="adduser-close" onClick={onClose} aria-label="Close add user form">
                        <X size={18} strokeWidth={2.2} />
                    </button>
                </header>

                <form className="adduser-form" onSubmit={handleSubmit} noValidate>
                    <Section title="Account" description="Their name and the email address they will use to sign in.">
                        <Field id="name" label="Full name" i={0} wide>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                autoComplete="off"
                                placeholder="e.g. John Doe"
                                value={name}
                                onChange={handleName}
                                required
                            />
                        </Field>

                        <Field id="email" label="Email" i={1} wide error={emailError} hint={emailHint}>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                inputMode="email"
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="name@example.com"
                                value={email}
                                onChange={handleEmail}
                                onBlur={touch("email")}
                                aria-invalid={emailError || undefined}
                                aria-describedby="email-hint"
                                required
                            />
                        </Field>
                    </Section>

                    <Section title="Access" description="Pick a role, then set the first password. They can change it after signing in.">
                        <Field id="role" label="Role" i={0} wide group hint={roleHint}>
                            <div className="adduser-roles" role="radiogroup" aria-labelledby="role-label" aria-describedby="role-hint">
                                {ROLES.map(({ value, label, note, Icon }) => (
                                    <label key={value} className="adduser-role">
                                        <input
                                            type="radio"
                                            name="role"
                                            value={value}
                                            checked={role === value}
                                            onChange={() => handleRole(value)}
                                            required
                                        />
                                        <span className="adduser-role__body">
                                            <Icon size={22} aria-hidden="true" />
                                            <span className="adduser-role__text">
                                                <strong>{label}</strong>
                                                <small>{note}</small>
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </Field>

                        <Field id="password" label="Password" i={1} error={passwordError} hint={passwordHint}>
                            <div className="adduser-group">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={handlePassword}
                                    onBlur={touch("password")}
                                    aria-invalid={passwordError || undefined}
                                    aria-describedby="password-hint"
                                    required
                                />
                                <button
                                    type="button"
                                    className="adduser-affix adduser-affix--end adduser-affix--btn"
                                    onClick={() => setShowPassword((s) => !s)}
                                    aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                                </button>
                            </div>
                        </Field>

                        <Field id="confirm" label="Confirm password" i={2} error={mismatch} hint={confirmHint}>
                            <input
                                id="confirm"
                                name="confirm"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Repeat password"
                                value={confirm}
                                onChange={handleConfirm}
                                onBlur={touch("confirm")}
                                aria-invalid={mismatch || undefined}
                                aria-describedby="confirm-hint"
                                required
                            />
                        </Field>
                    </Section>

                    <Section title="Record" description="Added by the system when the user is saved.">
                        <Field id="createdBy" label="Created by" i={0} auto>
                            <input id="createdBy" type="text" value={createdBy} readOnly tabIndex={-1} />
                        </Field>
                        <Field id="createdOn" label="Created on" i={1} auto>
                            <input id="createdOn" type="text" value={createdOn} readOnly tabIndex={-1} />
                        </Field>
                    </Section>

                    {submitError && (
                        <p className="adduser-alert" role="alert">
                            <AlertCircle size={18} aria-hidden="true" />
                            {submitError}
                        </p>
                    )}

                    <footer className="adduser-footer" data-au-reveal>
                        <div className="adduser-progress">
                            <span className="adduser-progress__text" aria-live="polite">
                                {done} of {TOTAL_STEPS} fields complete
                            </span>
                            <div
                                className="adduser-progress__bar"
                                role="progressbar"
                                aria-label="Form completion"
                                aria-valuemin={0}
                                aria-valuemax={TOTAL_STEPS}
                                aria-valuenow={done}
                            >
                                <span className="adduser-progress__fill" style={{ width: `${(done / TOTAL_STEPS) * 100}%` }} />
                            </div>
                        </div>

                        <div className="adduser-actions">
                            <button type="button" className="adduser-btn adduser-btn--text" onClick={handleReset} disabled={busy}>
                                Clear
                            </button>
                            <button type="button" className="adduser-btn adduser-btn--ghost" onClick={onClose} disabled={busy}>
                                Cancel
                            </button>
                            <button type="submit" className="adduser-btn adduser-btn--primary" disabled={!isValid || busy}>
                                {busy ? "Creating user…" : "Create user"}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    );
}