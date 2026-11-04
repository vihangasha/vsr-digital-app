
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { FieldValue } from "firebase-admin/firestore";

import {
    getNextBusinessPayDate,
} from "@/lib/businessHolidays";

/* -------------------------------------------------------
   CONFIGURATION
------------------------------------------------------- */

const REGISTRATION_FIELDS = {
    D: "dailyRegNo",
    W: "weeklyRegNo",
    M: "monthlyRegNo",
    MINT: "MintRegNo",
    C: "chqRegNo",
};

const PLAN_RULES = {
    D: {
        unit: "days",
        max: 60,
    },
    W: {
        unit: "weeks",
        max: 54,
    },
    M: {
        unit: "months",
        max: 12,
    },
    MINT: {
        unit: "months",
        max: 11,
    },
    C: {
        unit: "days",
        max: null,
    },
};

const SELECTABLE_INTEREST_RATES = [5, 6, 7, 8, 9, 10];

/* -------------------------------------------------------
   REGISTRATION NUMBER
------------------------------------------------------- */

function normalizeRegistrationNo(value) {
    const match = /^(MINT|D|M|W|C)-?(\d+)$/i.exec(
        String(value ?? "").trim()
    );

    if (!match) return "";

    return `${match[1].toUpperCase()}-${match[2]}`;
}

/* -------------------------------------------------------
   DATE VALIDATION
------------------------------------------------------- */

function isValidDate(value) {
    if (typeof value !== "string") return false;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

/* -------------------------------------------------------
   INTEREST CALCULATIONS
------------------------------------------------------- */

function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Daily interest rates are monthly rates.
function getDailyInterestRate(days) {
    if (!Number.isInteger(days) || days < 1) {
        return null;
    }

    if (days >= 60) return 10;
    if (days === 59) return 9;
    if (days === 58) return 8;
    if (days === 57) return 7;
    if (days === 56) return 6;

    return 5;
}

// Calculate monthly interest periods.
// Partial months count as a full monthly period.
function getInterestPeriods(prefix, plan) {
    if (!Number.isInteger(plan) || plan < 1) {
        return 0;
    }

    switch (prefix) {
        case "D":
        case "C":
            return Math.ceil(plan / 30);

        case "W":
            return Math.ceil((plan * 7) / 30);

        case "M":
        case "MINT":
            return plan;

        default:
            return 0;
    }
}

// Determine the permitted monthly interest rate.
function getExpectedInterestRate(prefix, plan) {
    if (prefix === "D") {
        return getDailyInterestRate(plan);
    }

    if (prefix === "C") {
        return 10;
    }

    return null;
}

function approximatelyEqual(a, b) {
    return (
        Number.isFinite(a) &&
        Number.isFinite(b) &&
        Math.abs(a - b) <= 0.01
    );
}

/* -------------------------------------------------------
   MAIN API
------------------------------------------------------- */

export async function POST(request) {
    try {
        /* -----------------------------------------------
           1. AUTHENTICATION
        ----------------------------------------------- */

        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized. Please log in.",
                },
                { status: 401 }
            );
        }

        /* -----------------------------------------------
           2. REQUEST BODY
        ----------------------------------------------- */

        let body;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid request body.",
                },
                { status: 400 }
            );
        }

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid request data.",
                },
                { status: 400 }
            );
        }

        /* -----------------------------------------------
           3. REGISTRATION NUMBER
        ----------------------------------------------- */

        const registrationNo = normalizeRegistrationNo(
            body.registrationNo
        );

        const registrationMatch =
            /^(MINT|D|M|W|C)-\d+$/.exec(registrationNo);

        if (!registrationMatch) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid registration number.",
                },
                { status: 400 }
            );
        }

        const prefix = registrationMatch[1];

        const registrationField =
            REGISTRATION_FIELDS[prefix];

        /* -----------------------------------------------
           4. BASIC INPUT VALIDATION
        ----------------------------------------------- */

        const issuedAmount = Number(body.urgencyFund);
        const plan = Number(body.plan);
        const submittedRate = Number(body.interestRate);

        const issuedDate = String(
            body.dateOfFund ?? ""
        ).trim();

        if (
            !Number.isFinite(issuedAmount) ||
            issuedAmount <= 0 ||
            !Number.isInteger(plan) ||
            plan < 1
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid fund amount or installment plan.",
                },
                { status: 400 }
            );
        }

        if (!isValidDate(issuedDate)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid issue date.",
                },
                { status: 400 }
            );
        }

        /* -----------------------------------------------
           5. PLAN UNIT AND DURATION VALIDATION
        ----------------------------------------------- */

        const planRule = PLAN_RULES[prefix];

        const planUnit = String(
            body.planUnit ?? ""
        ).trim().toLowerCase();

        if (planUnit !== planRule.unit) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        `Invalid plan unit for ${prefix} registration. ` +
                        `Expected ${planRule.unit}.`,
                },
                { status: 400 }
            );
        }

        if (
            planRule.max !== null &&
            plan > planRule.max
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        `Maximum ${planRule.max} ${planRule.unit} ` +
                        `allowed for ${prefix} loans.`,
                },
                { status: 400 }
            );
        }

        /* -----------------------------------------------
           6. SERVER-SIDE INTEREST RATE VALIDATION
        ----------------------------------------------- */

        let expectedRate;

        if (prefix === "D") {
            expectedRate = getDailyInterestRate(plan);
        } else if (prefix === "C") {
            expectedRate = 10;
        } else {
            expectedRate = submittedRate;

            if (
                !SELECTABLE_INTEREST_RATES.includes(expectedRate)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Interest rate must be 5%, 6%, 7%, 8%, 9% or 10% per month.",
                    },
                    { status: 400 }
                );
            }
        }

        if (
            !Number.isFinite(submittedRate) ||
            submittedRate !== expectedRate
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        `Invalid interest rate. The correct monthly rate ` +
                        `for this loan is ${expectedRate}%.`,
                },
                { status: 400 }
            );
        }

        /* -----------------------------------------------
           7. SERVER-SIDE MONTHLY INTEREST CALCULATION
        ----------------------------------------------- */

        const interestPeriods = getInterestPeriods(
            prefix,
            plan
        );

        if (interestPeriods < 1) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unable to calculate interest periods.",
                },
                { status: 400 }
            );
        }

        // One month's interest.
        const monthlyInterestAmount = round2(
            (issuedAmount * expectedRate) / 100
        );

        // Total interest for all monthly periods.
        const interestAmount = round2(
            monthlyInterestAmount * interestPeriods
        );

        // MINT collects monthly interest only.
        const installment =
            prefix === "MINT"
                ? monthlyInterestAmount
                : round2(
                    (issuedAmount + interestAmount) / plan
                );

        // MINT principal is not included in regular payments.
        const totalPayable =
            prefix === "MINT"
                ? null
                : round2(issuedAmount + interestAmount);

        /* -----------------------------------------------
           8. VERIFY FRONTEND CALCULATIONS
        ----------------------------------------------- */

        const submittedPeriods = Number(body.interestPeriods);

        const submittedMonthlyInterest = Number(
            body.monthlyInterestAmount
        );

        const submittedInterestAmount = Number(
            body.interestAmount
        );

        const submittedInstallment = Number(
            body.installment
        );

        const submittedTotalPayable =
            body.totalPayable == null
                ? null
                : Number(body.totalPayable);

        if (
            !Number.isInteger(submittedPeriods) ||
            submittedPeriods !== interestPeriods
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Interest period mismatch. Please refresh and try again.",
                },
                { status: 400 }
            );
        }

        if (
            !approximatelyEqual(
                submittedMonthlyInterest,
                monthlyInterestAmount
            ) ||
            !approximatelyEqual(
                submittedInterestAmount,
                interestAmount
            ) ||
            !approximatelyEqual(
                submittedInstallment,
                installment
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "The submitted interest or installment calculation is incorrect. Please refresh and try again.",
                },
                { status: 400 }
            );
        }

        if (prefix === "MINT") {
            if (submittedTotalPayable !== null) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "MINT loans must not include principal in regular monthly payments.",
                    },
                    { status: 400 }
                );
            }
        } else if (
            !approximatelyEqual(
                submittedTotalPayable,
                totalPayable
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "The submitted total payable is incorrect.",
                },
                { status: 400 }
            );
        }

        /* -----------------------------------------------
           9. CUSTOMER LOOKUP
        ----------------------------------------------- */

        const customerQuery = await adminDb
            .collection("customers")
            .where(registrationField, "==", registrationNo)
            .limit(2)
            .get();

        if (customerQuery.empty) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "No customer found for this registration number.",
                },
                { status: 404 }
            );
        }

        if (customerQuery.size > 1) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "This registration number belongs to multiple customers.",
                },
                { status: 409 }
            );
        }

        const customerDoc = customerQuery.docs[0];
        const customer = customerDoc.data();

        // Use customer data from Firestore, not the request body.
        const nic = String(
            customer.nic || customerDoc.id || ""
        ).trim();

        const name = String(
            customer.fullName || customer.name || ""
        ).trim();

        if (!name || !nic) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Customer name or NIC is missing in the customer record.",
                },
                { status: 400 }
            );
        }

        /* -----------------------------------------------
           10. AUDIT AND COLLECTION DATE
        ----------------------------------------------- */

        const actor =
            currentUser.role === "developer"
                ? "system"
                : currentUser.uid ||
                currentUser.email ||
                "system";

        // Use centrally maintained business holiday dates.
        const nextPayDate = getNextBusinessPayDate(prefix);

        /* -----------------------------------------------
           11. FIRESTORE REFERENCES
        ----------------------------------------------- */

        const installmentRef = adminDb
            .collection("installments")
            .doc();

        const insID = installmentRef.id;

        // Registration number is the activeAffairs document ID.
        const affairRef = adminDb
            .collection("activeAffairs")
            .doc(registrationNo);

        const affairsForNicQuery = adminDb
            .collection("activeAffairs")
            .where("nic", "==", nic);

        /*
         * For normal loans, outstanding includes principal
         * and accumulated interest.
         *
         * For MINT, outstanding represents principal only.
         */
        const outstanding =
            prefix === "MINT"
                ? issuedAmount
                : totalPayable;

        /* -----------------------------------------------
           12. INSTALLMENT DOCUMENT
        ----------------------------------------------- */

        const installmentData = {
            insID,

            nic,
            name,
            registrationNo,

            issuedAmount,

            installment,
            intRate: expectedRate,

            // Monthly interest calculation details.
            interestPeriods,
            monthlyInterestAmount,
            interestAmount,

            plan,
            planUnit,

            totalPayable,

            issuedDate,
            nextPayDate,

            outstanding,
            paidAmount: 0,

            status: "active",

            createdAt: FieldValue.serverTimestamp(),
            createdBy: actor,

            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actor,
        };

        /* -----------------------------------------------
           13. ACTIVE AFFAIR DOCUMENT
        ----------------------------------------------- */

        const affairData = {
            regNo: registrationNo,
            nic,

            issuedAmount,
            nextPayDate,

            behavior: "",
            daysPassed: 0,

            paidCount: 0,
            dueCount: plan,

            paidAmount: 0,

            // Preserve the existing activeAffairs balance
            // interpretation: MINT starts with principal outstanding.
            dueAmount: outstanding,
        };

        /* -----------------------------------------------
           14. ATOMIC FIRESTORE TRANSACTION
        ----------------------------------------------- */

        await adminDb.runTransaction(async (transaction) => {
            const existingAffair = await transaction.get(
                affairRef
            );

            const affairsForNic = await transaction.get(
                affairsForNicQuery
            );

            // Duplicate registration protection.
            if (existingAffair.exists) {
                const error = new Error(
                    "An active affair already exists for this registration number."
                );

                error.status = 409;
                throw error;
            }

            // Maximum two active affairs per NIC.
            if (affairsForNic.size >= 2) {
                const error = new Error(
                    "This customer already has two active affairs."
                );

                error.status = 409;
                throw error;
            }

            // Both records are created atomically.
            transaction.set(
                installmentRef,
                installmentData
            );

            transaction.set(
                affairRef,
                affairData
            );
        });

        /* -----------------------------------------------
           15. SUCCESS RESPONSE
        ----------------------------------------------- */

        return NextResponse.json(
            {
                success: true,
                message:
                    "Installment and active affair created successfully.",

                installment: {
                    ...installmentData,
                    createdAt: null,
                    updatedAt: null,
                },

                activeAffair: affairData,
            },
            { status: 201 }
        );

    } catch (error) {
        if (error.status === 409) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message,
                },
                { status: 409 }
            );
        }

        console.error("Add installment error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to create installment.",
            },
            { status: 500 }
        );
    }
}
