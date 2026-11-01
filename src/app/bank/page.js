"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    ChevronUp,
    Landmark,
    ArrowDownToLine,
    TrendingUp,
} from "lucide-react";
import Navbar from "../components/navbar/navbar";
import "../styles/home/home.css";
import "../styles/installments/installments.css";
import "../styles/bank/bank.css";

const RESERVE = 100000;

const fmt = (n, digits = 2) =>
    Number(n).toLocaleString("en-LK", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

const money = (n, digits = 2) => `LKR ${fmt(n, digits)}`;

const EMPTY_SUMMARY = {
    loanedAmount: 0,
    installmentsReceived: 0,
    interestReceived: 0,
    withdrawn: 0,
};

async function fetchAuditSummary() {
    const response = await fetch("/api/audit/get", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.data) {
        throw new Error(
            result?.message || "Failed to load bank summary."
        );
    }

    return {
        loanedAmount: Number(result.data.totalIssued) || 0,
        installmentsReceived: Number(result.data.totalReceived) || 0,
        interestReceived:
            Number(result.data.totalInterestReceived) || 0,
    };
}

async function fetchWithdrawals() {
    const response = await fetch("/api/audit/fetch-withdrawals/", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.data) {
        throw new Error(
            result?.message || "Failed to load withdrawal history."
        );
    }

    return result.data;
}


// Withdrawal persistence is connected to the API.
async function submitWithdrawal(amount) {
    const response = await fetch("/api/audit/withdraw", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ amount }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.withdrawal) {
        throw new Error(
            result?.message || "Failed to record withdrawal."
        );
    }

    return result.withdrawal;
}


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

function useScrollReveal() {
    useEffect(() => {
        const els = document.querySelectorAll("[data-reveal]");

        if (typeof IntersectionObserver === "undefined") {
            els.forEach((el) => el.classList.add("is-visible"));
            return;
        }

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        io.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -40px 0px",
            }
        );

        els.forEach((el) => io.observe(el));

        return () => io.disconnect();
    }, []);
}

function useCountUp(target, duration = 1000, replayKey = 0) {
    const [value, setValue] = useState(0);
    const from = useRef(0);
    const lastKey = useRef(replayKey);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            from.current = target;
            lastKey.current = replayKey;
            setValue(target);
            return;
        }

        if (lastKey.current !== replayKey) {
            lastKey.current = replayKey;
            from.current = 0;
        }

        const begin = from.current;
        const start = performance.now();
        let raf;

        const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const v = begin + (target - begin) * eased;

            from.current = v;
            setValue(v);

            if (p < 1) {
                raf = requestAnimationFrame(tick);
            }
        };

        raf = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(raf);
    }, [target, duration, replayKey]);

    return value;
}

function Amount({
    value,
    digits = 0,
    replayKey = 0,
    showCurrency = true,
}) {
    const v = useCountUp(value, 1000, replayKey);

    return (
        <>
            {showCurrency && <span className="bank-ccy">LKR </span>}
            {fmt(v, digits)}
        </>
    );
}

function Percent({ value, replayKey = 0 }) {
    const v = useCountUp(value, 1200, replayKey);
    return <>{Math.round(v)}%</>;
}

export default function BankPage() {
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summaryError, setSummaryError] = useState("");

    const [amount, setAmount] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState("idle");
    const [notice, setNotice] = useState("");
    const [recent, setRecent] = useState([]);
    const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
    const [withdrawalsError, setWithdrawalsError] = useState("");
    const [today, setToday] = useState("");
    const [barIn, setBarIn] = useState(false);

    const [bannerOpen, setBannerOpen] = useState(false);
    const [openCount, setOpenCount] = useState(0);
    const [heroH, setHeroH] = useState(0);
    const [heroReady, setHeroReady] = useState(false);

    const heroRef = useRef(null);
    const settingsRef = useRef(null);
    const closeRef = useRef(null);
    const wasOpen = useRef(false);

    useScrollReveal();

    const assets = summary.loanedAmount;
    const received = summary.installmentsReceived;
    const profit = summary.interestReceived;

    const totalBalance =
        RESERVE + summary.interestReceived - summary.withdrawn;

    const withdrawable = Math.max(totalBalance - RESERVE, 0);

    const scale = Math.max(assets, received, profit, 1);

    const barWidth = (v) =>
        `${Math.min((v / scale) * 100, 100).toFixed(2)}%`;

    const collectedPct =
        assets > 0 ? (received / assets) * 100 : 0;

    const ringFill = Math.min(collectedPct, 100) / 100;

    const reserveAmt = Math.min(Math.max(totalBalance, 0), RESERVE);

    // Fetch the real summary from /api/audit/get.
    useEffect(() => {
        let cancelled = false;

        setToday(
            new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            })
        );

        const id = requestAnimationFrame(() => setBarIn(true));

        async function loadSummary() {
            setSummaryLoading(true);
            setSummaryError("");

            try {
                const fetchedSummary = await fetchAuditSummary();

                if (!cancelled) {
                    setSummary((current) => ({
                        ...current,
                        ...fetchedSummary,
                    }));
                }
            } catch (err) {
                if (!cancelled) {
                    setSummaryError(
                        err?.message || "Couldn't load the bank summary."
                    );
                }
            } finally {
                if (!cancelled) {
                    setSummaryLoading(false);
                }
            }
        }

        loadSummary();

        return () => {
            cancelled = true;
            cancelAnimationFrame(id);
        };
    }, []);

    const reservePct =
        totalBalance > 0
            ? (Math.min(totalBalance, RESERVE) / totalBalance) * 100
            : 0;

    const profitPct =
        totalBalance > 0
            ? (withdrawable / totalBalance) * 100
            : 0;

    // Measure the banner so the roll-up animation works at each screen size.
    useLayoutEffect(() => {
        const el = heroRef.current;
        if (!el) return;

        const measure = () => setHeroH(el.offsetHeight);

        measure();

        const ro =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(measure)
                : null;

        ro?.observe(el, { box: "border-box" });
        window.addEventListener("resize", measure);
        document.fonts?.ready.then(measure);

        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => setHeroReady(true))
        );

        return () => {
            cancelAnimationFrame(id);
            ro?.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadWithdrawals() {
            setWithdrawalsLoading(true);
            setWithdrawalsError("");

            try {
                const data = await fetchWithdrawals();

                if (cancelled) return;

                setRecent(
                    data.withdrawals.map((withdrawal) => ({
                        key: withdrawal.withdrawId,
                        withdrawId: withdrawal.withdrawId,
                        amount: withdrawal.amount,
                        date: withdrawal.date,
                        time: withdrawal.time,
                        withdrawnBy: withdrawal.withdrawnBy,
                    }))
                );

                setSummary((current) => ({
                    ...current,
                    withdrawn: data.totalWithdrawn,
                }));
            } catch (err) {
                if (!cancelled) {
                    setWithdrawalsError(
                        err?.message || "Couldn't load withdrawal history."
                    );
                }
            } finally {
                if (!cancelled) {
                    setWithdrawalsLoading(false);
                }
            }
        }

        loadWithdrawals();

        return () => {
            cancelled = true;
        };
    }, []);


    const toggleBanner = () => setBannerOpen((open) => !open);
    const closeBanner = () => setBannerOpen(false);

    useEffect(() => {
        if (!bannerOpen) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                setBannerOpen(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);

        return () => window.removeEventListener("keydown", onKeyDown);
    }, [bannerOpen]);

    useEffect(() => {
        if (bannerOpen) {
            setOpenCount((c) => c + 1);
            closeRef.current?.focus({ preventScroll: true });
        } else if (
            wasOpen.current &&
            heroRef.current?.contains(document.activeElement)
        ) {
            settingsRef.current?.focus({ preventScroll: true });
        }

        wasOpen.current = bannerOpen;
    }, [bannerOpen]);

    const handleAmountChange = (e) => {
        const cleaned = e.target.value.replace(/[^0-9.,]/g, "");

        setAmount(cleaned);
        setError("");
        setNotice("");
    };


    const handleWithdraw = async (e) => {
        e.preventDefault();

        const value =
            Math.round(Number(amount.replace(/,/g, "")) * 100) / 100;

        if (!value || value <= 0) {
            setError("Enter an amount greater than 0.");
            return;
        }

        if (value > withdrawable) {
            setError(
                withdrawable > 0
                    ? `You can withdraw up to ${money(withdrawable)}. ${money(RESERVE, 0)} must stay in the bank for loans.`
                    : `There is no profit to withdraw yet. ${money(RESERVE, 0)} must stay in the bank for loans.`
            );
            return;
        }

        setStatus("saving");
        setError("");

        try {
            const savedWithdrawal = await submitWithdrawal(value);

            setSummary((current) => ({
                ...current,
                withdrawn: current.withdrawn + savedWithdrawal.amount,
            }));

            setRecent((previous) => [
                {
                    key: savedWithdrawal.withdrawId,
                    withdrawId: savedWithdrawal.withdrawId,
                    amount: savedWithdrawal.amount,
                    date: savedWithdrawal.date,
                    time: savedWithdrawal.time,
                    withdrawnBy: savedWithdrawal.withdrawnBy,
                },
                ...previous,
            ]);

            setNotice(
                `${money(savedWithdrawal.amount)} withdrawn as profit.`
            );
            setAmount("");
        } catch (error) {
            setError(
                error.message ||
                "Couldn't complete the withdrawal. Check your connection and try again."
            );
        } finally {
            setStatus("idle");
        }
    };


    const totalWithdrawals = recent.reduce(
        (sum, withdrawal) => sum + withdrawal.amount,
        0
    );

    const ledger = [
        {
            key: "assets",
            label: "Assets",
            caption: "Loaned out to customers",
            value: assets,
            Icon: Landmark,
        },
        {
            key: "received",
            label: "Received",
            caption: "Installments collected",
            value: received,
            Icon: ArrowDownToLine,
        },
        {
            key: "profit",
            label: "Profit",
            caption: "Interest collected",
            value: profit,
            Icon: TrendingUp,
        },
    ];

    return (
        <main className="min-h-screen bg-[#1a1a1a]">
            <div className="home-navbar-fixed">
                <Navbar />
            </div>

            <div className="home-page bank-page">
                <div
                    className={`bank-scrim${bannerOpen ? " is-visible" : ""}`}
                    onClick={closeBanner}
                    aria-hidden="true"
                />

                <section
                    ref={heroRef}
                    className={`bank-hero ${bannerOpen ? "is-open" : "is-collapsed"}${heroReady ? " is-ready" : ""}`}
                    style={
                        heroH
                            ? { "--bank-hero-h": `${heroH}px` }
                            : undefined
                    }
                >
                    <div className="bank-hero__glow" />

                    <div className="bank-hero__stripes">
                        <span className="bank-hero__stripe bank-hero__stripe--1" />
                        <span className="bank-hero__stripe bank-hero__stripe--2" />
                        <span className="bank-hero__stripe bank-hero__stripe--8" />
                        <span className="bank-hero__stripe bank-hero__stripe--9" />
                        <span className="bank-hero__stripe bank-hero__stripe--11" />
                        <span className="bank-hero__stripe bank-hero__stripe--12" />
                    </div>

                    <div className="bank-hero__stripes bank-hero__stripes--low">
                        <span className="bank-hero__stripe bank-hero__stripe--3" />
                        <span className="bank-hero__stripe bank-hero__stripe--4" />
                        <span className="bank-hero__stripe bank-hero__stripe--5" />
                        <span className="bank-hero__stripe bank-hero__stripe--6" />
                        <span className="bank-hero__stripe bank-hero__stripe--7" />
                        <span className="bank-hero__stripe bank-hero__stripe--10" />
                    </div>

                    <div className="bank-hero__content" id="bank-hero-panel">
                        <div className="bank-hero__top">
                            <div className="bank-hero__heading">
                                <h1 className="bank-hero__title">
                                    BANK BALANCE
                                </h1>
                                <span className="bank-hero__meta">
                                    {today}
                                </span>
                            </div>

                            <button
                                ref={closeRef}
                                type="button"
                                className="bank-hero__btn"
                                onClick={closeBanner}
                                aria-label="Roll up banner"
                                title="Roll up"
                            >
                                <ChevronUp size={18} strokeWidth={2.3} />
                            </button>
                        </div>

                        <div className="bank-hero__grid">
                            <ul
                                className="bank-ledger"
                                aria-label="Assets, received and profit"
                            >
                                {ledger.map(
                                    (
                                        {
                                            key,
                                            label,
                                            caption,
                                            value,
                                            Icon,
                                        },
                                        i
                                    ) => (
                                        <li
                                            key={key}
                                            className={`bank-ledger__row bank-ledger__row--${key}`}
                                            style={{
                                                "--i": i,
                                                "--w": barWidth(value),
                                            }}
                                        >
                                            <span
                                                className="bank-ledger__icon"
                                                aria-hidden="true"
                                            >
                                                <Icon
                                                    size={18}
                                                    strokeWidth={2.1}
                                                />
                                            </span>

                                            <span className="bank-ledger__name">
                                                <span className="bank-ledger__label">
                                                    {label}
                                                </span>
                                                <span className="bank-ledger__caption">
                                                    {caption}
                                                </span>
                                            </span>

                                            <span className="bank-ledger__value">
                                                <Amount
                                                    value={value}
                                                    replayKey={openCount}
                                                />
                                            </span>

                                            <span
                                                className="bank-ledger__track"
                                                aria-hidden="true"
                                            >
                                                <span className="bank-ledger__fill" />
                                            </span>
                                        </li>
                                    )
                                )}
                            </ul>

                            <div
                                className="bank-ring"
                                role="img"
                                aria-label={`${Math.round(collectedPct)}% of assets collected`}
                                style={{ "--p": ringFill }}
                            >
                                <svg
                                    viewBox="0 0 120 120"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <circle
                                        className="bank-ring__track"
                                        cx="60"
                                        cy="60"
                                        r="54"
                                    />
                                    <circle
                                        className="bank-ring__arc"
                                        cx="60"
                                        cy="60"
                                        r="54"
                                    />
                                </svg>

                                <div className="bank-ring__center">
                                    <span className="bank-ring__pct">
                                        <Percent
                                            value={collectedPct}
                                            replayKey={openCount}
                                        />
                                    </span>
                                    <span className="bank-ring__label">
                                        of assets collected
                                    </span>
                                </div>
                            </div>

                            <div className="bank-hero__foot">
                                <div className="bank-foot-stat">
                                    <span className="bank-foot-stat__label">
                                        Total bank balance
                                    </span>
                                    <span className="bank-foot-stat__value">
                                        <Amount
                                            value={totalBalance}
                                            replayKey={openCount}
                                        />
                                    </span>
                                </div>

                                <div className="bank-foot-stat">
                                    <span className="bank-foot-stat__label">
                                        Available to withdraw
                                    </span>
                                    <span className="bank-foot-stat__value">
                                        <Amount
                                            value={withdrawable}
                                            replayKey={openCount}
                                        />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bank-hero__bar">
                        <h1 className="bank-hero__bar-title">
                            BANK BALANCE
                            <span className="bank-hero__bar-ccy">
                                in LKR
                            </span>
                        </h1>

                        <ul
                            className="bank-bar-metrics"
                            aria-label="Bank summary"
                        >
                            {ledger.map(({ key, label, value }) => (
                                <li
                                    key={key}
                                    className="bank-bar-metric"
                                >
                                    <span className="bank-bar-metric__label">
                                        {label}
                                    </span>
                                    <span className="bank-bar-metric__value">
                                        <Amount value={value} />
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <button
                            ref={settingsRef}
                            type="button"
                            className="bank-hero__settings"
                            onClick={toggleBanner}
                            aria-label="Open bank overview"
                            aria-expanded={bannerOpen}
                            aria-controls="bank-hero-panel"
                            title="Overview"
                        >
                            <CogIcon size={20} />
                        </button>
                    </div>
                </section>

                <div className="bank-body">
                    {(summaryLoading || summaryError) && (
                        <div className="bank-notices">
                            {summaryLoading && (
                                <p
                                    className="bank-status"
                                    role="status"
                                    aria-live="polite"
                                >
                                    Loading bank summary…
                                </p>
                            )}

                            {summaryError && (
                                <p className="bank-error" role="alert">
                                    {summaryError} Refresh the page to try
                                    again.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="bank-layout">
                        {/* ---------- Balance breakdown ---------- */}
                        <section
                            className="bank-panel bank-breakdown"
                            aria-labelledby="breakdown-title"
                            data-reveal
                        >
                            <h2
                                id="breakdown-title"
                                className="bank-panel__title"
                            >
                                Balance breakdown
                            </h2>

                            <div
                                className="bank-split"
                                role="img"
                                aria-label={`Loan capital ${money(reserveAmt, 0)}, profit ${money(withdrawable, 0)}`}
                            >
                                <div className="bank-split__track">
                                    <span
                                        className="bank-split__reserve"
                                        style={{
                                            width: barIn
                                                ? `${reservePct}%`
                                                : "0%",
                                        }}
                                    />
                                    <span
                                        className="bank-split__profit"
                                        style={{
                                            width: barIn
                                                ? `${profitPct}%`
                                                : "0%",
                                        }}
                                    />
                                </div>

                                <div className="bank-split__legend">
                                    <div className="bank-split__key">
                                        <span className="bank-split__name">
                                            <i className="bank-split__swatch bank-split__swatch--reserve" />
                                            Loan capital
                                        </span>
                                        <span className="bank-split__amt">
                                            {money(reserveAmt)}
                                        </span>
                                    </div>

                                    <div className="bank-split__key">
                                        <span className="bank-split__name">
                                            <i className="bank-split__swatch bank-split__swatch--profit" />
                                            Owner&apos;s profit
                                        </span>
                                        <span className="bank-split__amt">
                                            {money(withdrawable)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <dl className="bank-statement">
                                <div className="bank-statement__row">
                                    <dt>
                                        Loan capital
                                        <span className="bank-statement__hint">
                                            Must stay in the bank
                                        </span>
                                    </dt>
                                    <dd>{money(RESERVE)}</dd>
                                </div>

                                <div className="bank-statement__row">
                                    <dt>
                                        <span
                                            className="bank-statement__sign"
                                            aria-hidden="true"
                                        >
                                            +
                                        </span>
                                        Interest received
                                    </dt>
                                    <dd>{money(summary.interestReceived)}</dd>
                                </div>

                                <div className="bank-statement__row">
                                    <dt>
                                        <span
                                            className="bank-statement__sign"
                                            aria-hidden="true"
                                        >
                                            −
                                        </span>
                                        Profit withdrawn
                                    </dt>
                                    <dd>{money(summary.withdrawn)}</dd>
                                </div>

                                <div className="bank-statement__row bank-statement__row--total">
                                    <dt>Total bank balance</dt>
                                    <dd>{money(totalBalance)}</dd>
                                </div>
                            </dl>
                        </section>

                        {/* ---------- Withdraw profit ---------- */}
                        <div className="bank-aside">
                            <section
                                className="bank-panel bank-panel--action"
                                aria-labelledby="withdraw-title"
                                data-reveal
                                style={{ "--reveal-delay": "90ms" }}
                            >
                                <h2
                                    id="withdraw-title"
                                    className="bank-panel__title"
                                >
                                    Withdraw profit
                                </h2>

                                <div className="bank-available">
                                    <span className="bank-available__label">
                                        Available to withdraw
                                    </span>
                                    <strong className="bank-available__value">
                                        {money(withdrawable)}
                                    </strong>
                                </div>

                                <p className="bank-rule">
                                    {money(RESERVE, 0)} stays in the bank for
                                    loans. Only what&apos;s above that, like
                                    interest received, can be withdrawn.
                                </p>

                                {notice && (
                                    <div
                                        className="collect-notice bank-notice"
                                        role="status"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            width="18"
                                            height="18"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path
                                                className="collect-notice__tick"
                                                d="M5 12.5l4.5 4.5L19 7.5"
                                            />
                                        </svg>
                                        {notice}
                                    </div>
                                )}

                                <form
                                    className="bank-form"
                                    onSubmit={handleWithdraw}
                                    noValidate
                                >
                                    <div className="bank-field">
                                        <div className="bank-field__head">
                                            <label
                                                className="bank-field__label"
                                                htmlFor="withdraw-amount"
                                            >
                                                Amount (LKR)
                                            </label>

                                            <button
                                                type="button"
                                                className="bank-linkbtn"
                                                onClick={() => {
                                                    setAmount(
                                                        String(withdrawable)
                                                    );
                                                    setError("");
                                                    setNotice("");
                                                }}
                                                disabled={
                                                    withdrawable <= 0 ||
                                                    status === "saving"
                                                }
                                            >
                                                Use all available
                                            </button>
                                        </div>

                                        <input
                                            id="withdraw-amount"
                                            className="collect-input"
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            placeholder={
                                                withdrawable > 0
                                                    ? `Up to ${fmt(withdrawable)}`
                                                    : "No profit available"
                                            }
                                            value={amount}
                                            onChange={handleAmountChange}
                                            disabled={status === "saving"}
                                            aria-invalid={
                                                error ? "true" : "false"
                                            }
                                            aria-describedby={
                                                error
                                                    ? "withdraw-error"
                                                    : undefined
                                            }
                                        />

                                        {error && (
                                            <p
                                                id="withdraw-error"
                                                className="bank-error"
                                                role="alert"
                                            >
                                                {error}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className="collect-btn collect-btn--primary"
                                        disabled={
                                            status === "saving" ||
                                            withdrawable <= 0 ||
                                            !amount.trim()
                                        }
                                    >
                                        {status === "saving" ? (
                                            <>
                                                <span
                                                    className="collect-spinner"
                                                    aria-hidden="true"
                                                />{" "}
                                                Withdrawing
                                            </>
                                        ) : (
                                            "Withdraw profit"
                                        )}
                                    </button>
                                </form>
                            </section>
                        </div>

                        {/* ---------- Withdrawals made ---------- */}
                        <section
                            className="bank-panel bank-panel--quiet bank-history"
                            aria-labelledby="history-title"
                            data-reveal
                            style={{ "--reveal-delay": "140ms" }}
                        >
                            <div className="bank-history__head">
                                <h2
                                    id="history-title"
                                    className="bank-panel__title"
                                >
                                    Withdrawals made
                                </h2>

                                {recent.length > 0 && (
                                    <span className="bank-history__total">
                                        {money(totalWithdrawals)}
                                    </span>
                                )}
                            </div>

                            {withdrawalsLoading ? (
                                <p className="bank-empty">Loading withdrawals...</p>
                            ) : withdrawalsError ? (
                                <p className="bank-empty" role="alert">
                                    {withdrawalsError}
                                </p>
                            ) : recent.length === 0 ? (
                                <p className="bank-empty">
                                    No withdrawals have been made yet.
                                </p>
                            ) : (
                                <ul className="bank-log">
                                    {recent.map((r) => (
                                        <li
                                            key={r.key}
                                            className="bank-log__item"
                                        >
                                            <div>
                                                <div className="bank-log__name">
                                                    Owner&apos;s profit
                                                </div>
                                                <div className="bank-log__meta">
                                                    {r.date} · {r.time}
                                                </div>
                                                <div className="bank-log__meta">
                                                    Withdrawn by: {r.withdrawnBy}
                                                </div>
                                            </div>

                                            <div className="bank-log__amount">
                                                {money(r.amount)}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}