
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import Navbar from "../components/navbar/navbar";
import ThermalBill from "../components/thermalBill/thermalBill";
import "../styles/home/home.css";
import "../styles/installments/installments.css";

const TABS = [
    { id: "all", label: "All tasks" },
    { id: "daily", label: "Daily" },
    { id: "weekly", label: "Weekly" },
    { id: "monthly-int", label: "Monthly-int" },
    { id: "monthly", label: "Monthly" },
];

const emptySession = {
    regNo: "",
    status: "idle",
    customer: null,
    notice: "",
};

const initialSessions = Object.fromEntries(
    TABS.map((tab) => [tab.id, { ...emptySession }])
);

const money = (value) =>
    `Rs. ${Number(value ?? 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const PLAN_BY_PREFIX = [
    { prefix: "MINT-", tab: "monthly-int", label: "Monthly-int" },
    { prefix: "D-", tab: "daily", label: "Daily" },
    { prefix: "W-", tab: "weekly", label: "Weekly" },
    { prefix: "M-", tab: "monthly", label: "Monthly" },
];

function tabForRegistration(regNo = "") {
    const value = String(regNo).trim().toUpperCase();

    return (
        PLAN_BY_PREFIX.find((item) => value.startsWith(item.prefix))
            ?.tab ?? "daily"
    );
}

function planLabel(regNo = "") {
    const value = String(regNo).trim().toUpperCase();

    return (
        PLAN_BY_PREFIX.find((item) => value.startsWith(item.prefix))
            ?.label ?? "Installment"
    );
}

function customerFromTask(task) {
    return {
        regNo: task.regNo,
        name: task.name || "Customer",
        address: task.address || "—",
        nic: task.nic || "—",
        paid: Number(task.affairPaidAmount ?? task.paidAmount ?? 0),
        due: Number(task.outstanding ?? task.dueAmount ?? 0),
        installment: {
            no: Number(task.paidCount ?? 0) + 1,
            total: Number(task.plan ?? 0),
            amount: Number(task.installment ?? 0),
        },
        raw: task,
    };
}

async function getTasksToday() {
    const response = await fetch("/api/collect-payments/get", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
        throw new Error(
            data.error || "Could not load today's collection tasks."
        );
    }

    return data;
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

function SurfaceDecor() {
    return (
        <div className="collect-surface__bg" aria-hidden="true">
            <div className="collect-surface__glow" />
            {[1, 2, 3, 4, 5, 6].map((number) => (
                <span
                    key={number}
                    className={`collect-surface__stripe collect-surface__stripe--${number}`}
                />
            ))}
        </div>
    );
}

export default function CollectPage() {
    const [activeTab, setActiveTab] = useState(TABS[0].id);
    const [sessions, setSessions] = useState(initialSessions);
    const [recent, setRecent] = useState([]);
    const [receipt, setReceipt] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [today, setToday] = useState("");
    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [tasksError, setTasksError] = useState("");
    const [passedTasks, setPassedTasks] = useState({});

    const tabRefs = useRef({});
    const tabsScrollRef = useRef(null);
    const tabsDrag = useRef(null);
    const suppressTabClick = useRef(false);
    const firstTabsScroll = useRef(true);
    const [bannerOpen, setBannerOpen] = useState(false);
    const heroRef = useRef(null);
    const settingsRef = useRef(null);
    const collapseTimer = useRef(null);
    const wasOpen = useRef(false);

    const [indicator, setIndicator] = useState({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        ready: false,
    });

    useEffect(() => {
        setToday(
            new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            })
        );
    }, []);

    const refreshTasks = async () => {
        setTasksLoading(true);
        setTasksError("");

        try {
            const data = await getTasksToday();
            setTasks(Array.isArray(data.tasks) ? data.tasks : []);
        } catch (error) {
            setTasksError(
                error.message || "Could not load today's tasks."
            );
        } finally {
            setTasksLoading(false);
        }
    };

    useEffect(() => {
        refreshTasks();
    }, []);

    const clearCollapseTimer = () => {
        if (collapseTimer.current) {
            clearTimeout(collapseTimer.current);
            collapseTimer.current = null;
        }
    };

    const closeBanner = (delay = 0) => {
        clearCollapseTimer();

        if (delay > 0) {
            collapseTimer.current = setTimeout(
                () => setBannerOpen(false),
                delay
            );
        } else {
            setBannerOpen(false);
        }
    };

    const toggleBanner = () => {
        clearCollapseTimer();
        setBannerOpen((open) => !open);
    };

    useEffect(
        () => () => clearTimeout(collapseTimer.current),
        []
    );

    useEffect(() => {
        if (!bannerOpen) return;

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                setBannerOpen(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [bannerOpen]);

    useEffect(() => {
        if (bannerOpen) {
            tabRefs.current[activeTab]?.focus({
                preventScroll: true,
            });
        } else if (
            wasOpen.current &&
            heroRef.current?.contains(document.activeElement)
        ) {
            settingsRef.current?.focus({ preventScroll: true });
        }

        wasOpen.current = bannerOpen;
    }, [bannerOpen, activeTab]);

    useLayoutEffect(() => {
        const measure = () => {
            const element = tabRefs.current[activeTab];
            if (!element) return;

            setIndicator({
                left: element.offsetLeft,
                top: element.offsetTop,
                width: element.offsetWidth,
                height: element.offsetHeight,
                ready: true,
            });
        };

        measure();
        window.addEventListener("resize", measure);

        return () => window.removeEventListener("resize", measure);
    }, [activeTab]);

    /* ---- Scrollable tab bar: edge fades, centring and mouse drag ---- */

    const updateTabsEdges = () => {
        const el = tabsScrollRef.current;
        if (!el) return;

        const max = el.scrollWidth - el.clientWidth;
        el.dataset.scrollStart = el.scrollLeft <= 1 ? "true" : "false";
        el.dataset.scrollEnd =
            max <= 1 || el.scrollLeft >= max - 1 ? "true" : "false";
    };

    useLayoutEffect(() => {
        const scroller = tabsScrollRef.current;
        const element = tabRefs.current[activeTab];

        if (scroller && element) {
            const reduce = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;
            const left =
                element.offsetLeft -
                (scroller.clientWidth - element.offsetWidth) / 2;

            scroller.scrollTo({
                left: Math.max(0, left),
                behavior:
                    reduce || firstTabsScroll.current ? "auto" : "smooth",
            });
            firstTabsScroll.current = false;
        }

        updateTabsEdges();
    }, [activeTab, bannerOpen]);

    useEffect(() => {
        window.addEventListener("resize", updateTabsEdges);
        return () => window.removeEventListener("resize", updateTabsEdges);
    }, []);

    const handleTabsPointerDown = (event) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;

        const el = tabsScrollRef.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;

        tabsDrag.current = {
            startX: event.clientX,
            startLeft: el.scrollLeft,
            moved: false,
        };
    };

    const handleTabsPointerMove = (event) => {
        const drag = tabsDrag.current;
        const el = tabsScrollRef.current;
        if (!drag || !el) return;

        const dx = event.clientX - drag.startX;

        if (!drag.moved && Math.abs(dx) > 5) {
            drag.moved = true;
            el.classList.add("is-dragging");
            el.setPointerCapture?.(event.pointerId);
        }

        if (drag.moved) el.scrollLeft = drag.startLeft - dx;
    };

    const endTabsDrag = (event) => {
        const drag = tabsDrag.current;
        const el = tabsScrollRef.current;
        if (!drag) return;

        tabsDrag.current = null;
        el?.classList.remove("is-dragging");
        if (el?.hasPointerCapture?.(event.pointerId)) {
            el.releasePointerCapture(event.pointerId);
        }

        if (drag.moved) {
            suppressTabClick.current = true;
            setTimeout(() => {
                suppressTabClick.current = false;
            }, 0);
        }
    };

    const selectTab = (id, collapse = false) => {
        setActiveTab(id);

        if (collapse) {
            closeBanner(420);
        }
    };

    const handleTabKeyDown = (event) => {
        const index = TABS.findIndex((tab) => tab.id === activeTab);
        let next = null;

        if (event.key === "ArrowRight") {
            next = (index + 1) % TABS.length;
        } else if (event.key === "ArrowLeft") {
            next = (index - 1 + TABS.length) % TABS.length;
        } else if (event.key === "Home") {
            next = 0;
        } else if (event.key === "End") {
            next = TABS.length - 1;
        }

        if (next === null) return;

        event.preventDefault();
        selectTab(TABS[next].id);
        tabRefs.current[TABS[next].id]?.focus({
            preventScroll: true,
        });
    };

    const openTask = (task) => {
        const id = activeTab;

        setSessions((previous) => ({
            ...previous,
            [id]: {
                regNo: task.regNo || "",
                status: "found",
                customer: customerFromTask(task),
                notice: "",
            },
        }));

        setPassedTasks((previous) => ({
            ...previous,
            [task.regNo]: false,
        }));

        closeBanner();

        setTimeout(() => {
            document
                .getElementById("collect-panel")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
        }, 100);
    };

    const markTaskPassed = async (task) => {
        if (!task?.regNo || passedTasks[task.regNo]) return;

        setPassedTasks((previous) => ({
            ...previous,
            [task.regNo]: "loading",
        }));

        try {
            const response = await fetch(
                "/api/collect-payments/daypass",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        regNo: task.regNo,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "Could not pass this collection."
                );
            }

            setPassedTasks((previous) => ({
                ...previous,
                [task.regNo]: true,
            }));

            setTasks((previous) =>
                previous.filter((item) => item.regNo !== task.regNo)
            );

            await refreshTasks();
        } catch (error) {
            setPassedTasks((previous) => ({
                ...previous,
                [task.regNo]: false,
            }));

            alert(error.message || "Failed to pass collection.");
        }
    };

    // Record a scheduled installment or full settlement.
    const collectPayment = async (paymentType) => {
        const sessionCustomer = sessions[activeTab]?.customer;

        if (!sessionCustomer?.regNo || paymentLoading) return;

        const isMint = String(sessionCustomer.regNo)
            .trim()
            .toUpperCase()
            .startsWith("MINT-");

        if (paymentType === "settlement" && !isMint) {
            alert("Full settlement is available only for MINT accounts.");
            return;
        }

        const amount = Number(sessionCustomer.installment?.amount ?? 0);

        if (
            paymentType === "installment" &&
            (!Number.isFinite(amount) || amount <= 0)
        ) {
            alert(
                "The installment amount is invalid. Refresh today's tasks and try again."
            );
            return;
        }

        const description =
            paymentType === "settlement"
                ? "full settlement"
                : "scheduled installment";

        const confirmationDetails =
            paymentType === "settlement"
                ? "The system will fetch the latest outstanding principal from Firebase and add one month's interest. The final amount will be calculated by the server."
                : `Amount: ${money(amount)}`;

        const confirmed = window.confirm(
            `Confirm ${description} for ${sessionCustomer.name} (${sessionCustomer.regNo})?\n\n` +
            `${confirmationDetails}\n\nContinue?`
        );

        if (!confirmed) return;

        setPaymentLoading(true);

        setSessions((previous) => ({
            ...previous,
            [activeTab]: {
                ...previous[activeTab],
                status: "collecting",
                notice: "Processing payment...",
            },
        }));

        try {
            const response = await fetch("/api/collect-payments/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    regNo: sessionCustomer.regNo,
                    paymentType,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success || !data.payment?.paymentID) {
                throw new Error(
                    data.error || "Payment failed. No receipt number was returned."
                );
            }

            const payment = {
                ...data.payment,
                name: data.payment.name || sessionCustomer.name,
            };

            setRecent((previous) => [payment, ...previous]);
            setReceipt(payment);

            setSessions((previous) => ({
                ...previous,
                [activeTab]: {
                    ...previous[activeTab],
                    status: "found",
                    notice:
                        `Payment successful!\nReceipt No: ${payment.paymentID}\n` +
                        `Collected: ${money(payment.amount)}`,
                },
            }));

            setTasks((previous) =>
                previous.filter(
                    (task) => task.regNo !== sessionCustomer.regNo
                )
            );

            await refreshTasks();
        } catch (error) {
            setSessions((previous) => ({
                ...previous,
                [activeTab]: {
                    ...previous[activeTab],
                    status: "found",
                    notice: error.message || "Payment failed.",
                },
            }));

            alert(error.message || "Payment failed.");
        } finally {
            setPaymentLoading(false);
        }
    };

    const tab = TABS.find((item) => item.id === activeTab);
    const session = sessions[activeTab];
    const { status, customer } = session;

    const visibleTasks =
        activeTab === "all"
            ? tasks
            : tasks.filter(
                (task) => tabForRegistration(task.regNo) === activeTab
            );

    return (
        <main className="min-h-screen bg-[#171717]">
            <div className="home-navbar-fixed">
                <Navbar />
            </div>

            <div className="home-page collect-page">
                <div
                    className={`collect-scrim${bannerOpen ? " is-visible" : ""}`}
                    onClick={() => closeBanner()}
                    aria-hidden="true"
                />

                <section
                    ref={heroRef}
                    className={`home-hero collect-hero ${bannerOpen ? "is-open" : "is-collapsed"
                        }`}
                >
                    <div className="home-hero__glow" />

                    <div className="home-hero__stripes">
                        {Array.from({ length: 12 }).map((_, index) => (
                            <span
                                key={index}
                                className={`home-hero__stripe home-hero__stripe--${index + 1}`}
                            />
                        ))}
                    </div>

                    <div
                        className="collect-hero__content"
                        id="collect-hero-panel"
                    >
                        <div className="collect-hero__top">
                            <div className="collect-hero__heading">
                                <h1 className="collect-hero__title">
                                    INSTALLMENTS
                                </h1>
                                <span className="collect-hero__meta">
                                    {today}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="collect-hero__btn collect-hero__btn--icon"
                                onClick={() => closeBanner()}
                                aria-label="Roll up banner"
                                title="Roll up"
                            >
                                <ChevronUp size={18} strokeWidth={2.3} />
                            </button>
                        </div>

                        <div className="collect-tabs">
                            <div
                                ref={tabsScrollRef}
                                className="collect-tabs__scroll"
                                role="tablist"
                                aria-label="Filter tasks"
                                onKeyDown={handleTabKeyDown}
                                onScroll={updateTabsEdges}
                                onPointerDown={handleTabsPointerDown}
                                onPointerMove={handleTabsPointerMove}
                                onPointerUp={endTabsDrag}
                                onPointerCancel={endTabsDrag}
                                onPointerLeave={endTabsDrag}
                            >
                                <span
                                    className={`collect-tabs__indicator${indicator.ready ? " is-ready" : ""
                                        }`}
                                    style={{
                                        width: indicator.width,
                                        height: indicator.height,
                                        transform: `translate(${indicator.left}px, ${indicator.top}px)`,
                                    }}
                                    aria-hidden="true"
                                />

                                {TABS.map((item) => (
                                    <button
                                        key={item.id}
                                        ref={(element) => {
                                            tabRefs.current[item.id] = element;
                                        }}
                                        type="button"
                                        role="tab"
                                        id={`tab-${item.id}`}
                                        aria-selected={activeTab === item.id}
                                        aria-controls="collect-panel"
                                        tabIndex={activeTab === item.id ? 0 : -1}
                                        className={`collect-tabs__btn${activeTab === item.id ? " is-active" : ""
                                            }`}
                                        onClick={() => {
                                            if (suppressTabClick.current) return;
                                            selectTab(item.id, true);
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="collect-hero__bar">
                        <h1 className="collect-hero__bar-title">
                            INSTALLMENTS
                        </h1>

                        <span
                            key={activeTab}
                            className="collect-hero__bar-tab"
                            aria-live="polite"
                        >
                            {tab.label}
                        </span>

                        <button
                            ref={settingsRef}
                            type="button"
                            className="collect-hero__settings"
                            onClick={toggleBanner}
                            aria-label="Open installment settings"
                            aria-expanded={bannerOpen}
                            aria-controls="collect-hero-panel"
                            title="Settings"
                        >
                            <CogIcon size={20} />
                        </button>
                    </div>
                </section>

                <section className="collect-content">
                    <div className="collect-surface">
                        <SurfaceDecor />

                        <header className="collect-header">
                            <h2>
                                {activeTab === "all"
                                    ? "Installment"
                                    : `${tab.label} Installment`}
                            </h2>
                            <p>
                                Choose a task from today's list, then collect
                                the current installment.
                            </p>
                        </header>

                        <section className="collect-section collect-section--tasks">
                            <div className="collect-section__intro">
                                <h3>
                                    Tasks Today{" "}
                                    <span className="collect-count">
                                        {tasksLoading ? "…" : visibleTasks.length}
                                    </span>
                                </h3>

                                <p>
                                    {activeTab === "all"
                                        ? "Accounts scheduled for collection today."
                                        : `${tab.label} accounts scheduled for collection today.`}
                                </p>

                                <button
                                    type="button"
                                    className="collect-btn collect-btn--light collect-refresh"
                                    onClick={refreshTasks}
                                    disabled={tasksLoading}
                                >
                                    {tasksLoading ? (
                                        <>
                                            <span
                                                className="collect-spinner"
                                                aria-hidden="true"
                                            />
                                            Refreshing
                                        </>
                                    ) : (
                                        "Refresh"
                                    )}
                                </button>
                            </div>

                            <div className="collect-section__body">
                                <div className="collect-task-summary">
                                    <div>
                                        <span>Scheduled accounts</span>
                                        <strong>
                                            {tasksLoading ? "—" : visibleTasks.length}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Total scheduled</span>
                                        <strong>
                                            {money(
                                                visibleTasks.reduce(
                                                    (sum, task) =>
                                                        sum +
                                                        Number(task.installment || 0),
                                                    0
                                                )
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Not passed</span>
                                        <strong>
                                            {tasksLoading
                                                ? "—"
                                                : visibleTasks.filter(
                                                    (task) => !passedTasks[task.regNo]
                                                ).length}
                                        </strong>
                                    </div>
                                </div>

                                <div
                                    className="collect-sheet collect-task-sheet"
                                    aria-live="polite"
                                >
                                    {tasksLoading ? (
                                        <div
                                            className="collect-skeleton"
                                            aria-label="Loading today's tasks"
                                        >
                                            {Array.from({ length: 4 }).map(
                                                (_, index) => (
                                                    <span
                                                        key={index}
                                                        className="collect-skeleton__row"
                                                        style={{ "--i": index }}
                                                    />
                                                )
                                            )}
                                        </div>
                                    ) : tasksError ? (
                                        <p className="collect-msg">{tasksError}</p>
                                    ) : visibleTasks.length === 0 ? (
                                        <p className="collect-empty">
                                            {activeTab === "all" || tasks.length === 0
                                                ? "No collection tasks are scheduled for today."
                                                : `No ${tab.label.toLowerCase()} tasks are scheduled for today.`}
                                        </p>
                                    ) : (
                                        <ul className="collect-task-list">
                                            {visibleTasks.map((task) => (
                                                <li
                                                    className={`collect-task${passedTasks[task.regNo]
                                                        ? " is-passed"
                                                        : ""
                                                        }`}
                                                    key={task.regNo || task.insID}
                                                >
                                                    <div className="collect-task__details">
                                                        <div className="collect-task__name">
                                                            {task.name || "Customer"}
                                                        </div>

                                                        <div className="collect-log__meta">
                                                            <span className="collect-badge">
                                                                {task.regNo}
                                                            </span>
                                                            <span>
                                                                {task.nic || "NIC unavailable"}
                                                            </span>
                                                            <span>
                                                                {planLabel(task.regNo)}
                                                            </span>
                                                        </div>

                                                        <div className="collect-task__numbers">
                                                            <span>
                                                                Installment{" "}
                                                                <strong>
                                                                    {money(task.installment)}
                                                                </strong>
                                                            </span>
                                                            <span>
                                                                Outstanding{" "}
                                                                <strong>
                                                                    {money(
                                                                        task.outstanding ??
                                                                        task.dueAmount
                                                                    )}
                                                                </strong>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="collect-task__actions">
                                                        <button
                                                            type="button"
                                                            className="collect-btn collect-btn--dark"
                                                            onClick={() => openTask(task)}
                                                        >
                                                            Collect
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="collect-btn collect-btn--pass"
                                                            onClick={() => markTaskPassed(task)}
                                                            disabled={
                                                                passedTasks[task.regNo] === true ||
                                                                passedTasks[task.regNo] === "loading"
                                                            }
                                                        >
                                                            {passedTasks[task.regNo] === "loading"
                                                                ? "Passing..."
                                                                : passedTasks[task.regNo] === true
                                                                    ? "Passed"
                                                                    : "Pass"}
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </section>

                        <div
                            key={activeTab}
                            id="collect-panel"
                            className="collect-panel"
                            role="tabpanel"
                            aria-labelledby={`tab-${activeTab}`}
                        >
                            <section className="collect-section">
                                <div className="collect-section__intro">
                                    <h3>Account</h3>
                                    <p>Check the amounts before you collect.</p>
                                </div>

                                <div className="collect-section__body">
                                    <div className="collect-sheet" aria-live="polite">
                                        {status === "idle" && (
                                            <p className="collect-empty">
                                                Click Collect on a task to see the account.
                                            </p>
                                        )}

                                        {(status === "found" ||
                                            status === "collecting") &&
                                            customer && (
                                                <div className="collect-account">
                                                    {session.notice && (
                                                        <div
                                                            className="collect-notice"
                                                            role="status"
                                                        >
                                                            {session.notice}
                                                        </div>
                                                    )}

                                                    <div className="collect-account__head">
                                                        <div className="collect-account__name">
                                                            {customer.name}
                                                        </div>
                                                        <span className="collect-badge">
                                                            {customer.regNo}
                                                        </span>
                                                    </div>

                                                    <dl className="collect-account__grid">
                                                        <div
                                                            className="collect-row"
                                                            style={{ "--i": 0 }}
                                                        >
                                                            <dt>Address</dt>
                                                            <dd>{customer.address}</dd>
                                                        </div>

                                                        <div
                                                            className="collect-row"
                                                            style={{ "--i": 1 }}
                                                        >
                                                            <dt>NIC</dt>
                                                            <dd>{customer.nic}</dd>
                                                        </div>

                                                        <div
                                                            className="collect-row"
                                                            style={{ "--i": 2 }}
                                                        >
                                                            <dt>Paid</dt>
                                                            <dd className="collect-row__num">
                                                                {money(customer.paid)}
                                                            </dd>
                                                        </div>

                                                        <div
                                                            className="collect-row"
                                                            style={{ "--i": 3 }}
                                                        >
                                                            <dt>Outstanding</dt>
                                                            <dd className="collect-row__num">
                                                                {money(customer.due)}
                                                            </dd>
                                                        </div>
                                                    </dl>

                                                    <div className="collect-account__foot">
                                                        <div className="collect-due">
                                                            <span className="collect-due__label">
                                                                Current installment
                                                            </span>
                                                            <span className="collect-due__amount">
                                                                {money(customer.installment.amount)}
                                                            </span>
                                                            <span className="collect-due__hint">
                                                                Installment{" "}
                                                                {customer.installment.no} of{" "}
                                                                {customer.installment.total}
                                                            </span>
                                                        </div>

                                                        <div className="collect-payment-actions">
                                                            <button
                                                                type="button"
                                                                className="collect-btn collect-btn--dark"
                                                                onClick={() => collectPayment("installment")}
                                                                disabled={
                                                                    paymentLoading ||
                                                                    status === "collecting"
                                                                }
                                                            >
                                                                {paymentLoading
                                                                    ? "Processing..."
                                                                    : "Collect Installment"}
                                                            </button>

                                                            {String(customer.regNo || "")
                                                                .trim()
                                                                .toUpperCase()
                                                                .startsWith("MINT-") && (
                                                                    <button
                                                                        type="button"
                                                                        className="collect-btn collect-btn--pass"
                                                                        onClick={() => collectPayment("settlement")}
                                                                        disabled={
                                                                            paymentLoading ||
                                                                            status === "collecting"
                                                                        }
                                                                    >
                                                                        Full Settlement
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <section className="collect-section collect-section--last">
                            <div className="collect-section__intro">
                                <h3>
                                    This session{" "}
                                    <span className="collect-count">
                                        {recent.length}
                                    </span>
                                </h3>
                                <p>
                                    Collections completed since you opened this page.
                                </p>
                            </div>

                            <div className="collect-section__body">
                                <div className="collect-sheet">
                                    {recent.length === 0 ? (
                                        <p className="collect-empty">
                                            No payments collected in this session yet.
                                        </p>
                                    ) : (
                                        <ul className="collect-task-list">
                                            {recent.map((payment) => (
                                                <li
                                                    className="collect-task"
                                                    key={payment.paymentID}
                                                >
                                                    <div className="collect-task__details">
                                                        <div className="collect-task__name">
                                                            {payment.name || "Customer"}
                                                        </div>

                                                        <div className="collect-log__meta">
                                                            <span className="collect-badge">
                                                                {payment.regNo}
                                                            </span>
                                                            <span>
                                                                Receipt: {payment.paymentID}
                                                            </span>
                                                        </div>

                                                        <div className="collect-task__numbers">
                                                            <span>
                                                                {payment.paymentType === "settlement"
                                                                    ? "Full settlement"
                                                                    : "Installment"}
                                                            </span>
                                                            <strong>
                                                                {money(payment.amount)}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                </section>
            </div>

            {receipt && (
                <ThermalBill
                    receipt={receipt}
                    logoSrc="/logo/logo-invrt.png"
                    autoPrint
                    onClose={() => setReceipt(null)}
                />
            )}
        </main>
    );
}
