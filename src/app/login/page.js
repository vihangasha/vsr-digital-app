"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import "../styles/login/login.css";

const STRIPE_COUNT = 42;
const STRIPE_WIDTHS = [5, 6, 8, 10, 14, 16, 18];

// Deterministic pseudo-random generator (not Math.random) so the
// server-rendered markup and the client's first render match
// exactly. It uses only integer math (Math.imul and bit shifts),
// which is bit-for-bit identical in every JS engine. Math.sin is
// NOT: Node and the browser can differ in the last digits, which
// causes a hydration mismatch.
function seededFraction(seed) {
    let h = Math.imul(Math.round(seed * 1000) + 1, 2654435761);
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

// Same stripe field as the loading screen: alternating direction,
// phase-staggered, every stripe fully described by its own variables.
const stripes = Array.from({ length: STRIPE_COUNT }, (_, i) => {
    const left = -6 + (112 / (STRIPE_COUNT - 1)) * i;
    const width = STRIPE_WIDTHS[i % STRIPE_WIDTHS.length];
    const opacity = 0.08 + seededFraction(i) * 0.24;
    const duration = 2.4 + seededFraction(i + 0.37) * 2.1;
    const delay = -(seededFraction(i + 0.71) * duration);
    const direction = i % 2 === 0 ? "up" : "down";

    return {
        key: i,
        direction,
        style: {
            "--left": `${left.toFixed(3)}%`,
            "--w": `${width}px`,
            "--op": opacity.toFixed(3),
            "--dur": `${duration.toFixed(2)}s`,
            "--delay": `${delay.toFixed(2)}s`,
        },
    };
});

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();

        if (submitting) return;

        setError("");
        setSubmitting(true);

        try {
            // 1. Sign in with Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email.trim(),
                password
            );

            // 2. Get the Firebase ID token
            const idToken = await getIdToken(userCredential.user);

            // 3. Send the ID token to our Next.js server
            const res = await fetch("/api/auth/session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ idToken }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Unable to create session."
                );
            }

            // 4. Login successful
            router.push("/");
            router.refresh();

        } catch (error) {
            console.error("Login error:", error);

            switch (error.code) {
                case "auth/invalid-credential":
                case "auth/wrong-password":
                case "auth/user-not-found":
                    setError("Incorrect email or password.");
                    break;

                case "auth/invalid-email":
                    setError("Please enter a valid email address.");
                    break;

                case "auth/too-many-requests":
                    setError(
                        "Too many login attempts. Please try again later."
                    );
                    break;

                case "auth/network-request-failed":
                    setError(
                        "Can't reach Firebase. Check your connection and try again."
                    );
                    break;

                default:
                    setError(
                        error.message ||
                        "Something went wrong. Please try again."
                    );
            }

            setSubmitting(false);
        }
    }

    return (
        <main className="login">
            <div className="login__stripes" aria-hidden="true">
                {stripes.map((s) => (
                    <span
                        key={s.key}
                        className={`login__stripe login__stripe--${s.direction}`}
                        style={s.style}
                    />
                ))}
            </div>

            <section className="login__card" aria-labelledby="login-title">
                <div className="login__mark" aria-hidden="true">VSR</div>

                <h1 id="login-title" className="login__title">LOGIN</h1>
                <p className="login__subtitle">
                    Login credentials are provided by the System Administrator.
                </p>

                <form className="login__form" onSubmit={handleSubmit} noValidate={false}>
                    <div className="login__field">
                        <label className="login__label" htmlFor="login-email">Email</label>
                        <div className="login__control">
                            <input
                                id="login-email"
                                className="login__input"
                                type="email"
                                name="email"
                                autoComplete="username"
                                placeholder="example@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                aria-invalid={error ? "true" : "false"}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="login__field">
                        <label className="login__label" htmlFor="login-password">Password</label>
                        <div className="login__control">
                            <input
                                id="login-password"
                                className="login__input login__input--password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-invalid={error ? "true" : "false"}
                                required
                            />
                            <button
                                type="button"
                                className="login__toggle"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                aria-pressed={showPassword}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="login__error" role="alert">{error}</p>
                    )}

                    <button type="submit" className="login__submit" disabled={submitting}>
                        {submitting && <span className="login__spinner" aria-hidden="true" />}
                        {submitting ? "Signing in" : "Sign in"}
                    </button>
                </form>

                <p className="login__note">
                    Forget Password? Ask the Administrator to reset it.
                </p>
            </section>
        </main>
    );
}