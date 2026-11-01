
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { FieldValue } from "firebase-admin/firestore";

const REGISTRATION_FIELDS = {
    D: "dailyRegNo",
    W: "weeklyRegNo",
    M: "monthlyRegNo",
    MINT: "MintRegNo",
    C: "chqRegNo",
};

function normalizeRegistrationNo(value) {
    const match = /^(MINT|D|M|W|C)-?(\d+)$/i.exec(
        String(value ?? "").trim()
    );

    if (!match) return "";

    return `${match[1].toUpperCase()}-${match[2]}`;
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

// Configured Sri Lankan Poya dates for 2026 and 2027.
const POYA_DATES = new Set([
    // 2026
    "2026-01-03",
    "2026-02-01",
    "2026-03-02",
    "2026-04-01",
    "2026-05-01",
    "2026-05-02", // Day following Vesak Poya
    "2026-05-30",
    "2026-06-29",
    "2026-07-29",
    "2026-08-27",
    "2026-09-26",
    "2026-10-25",
    "2026-11-24",
    "2026-12-23",

    // 2027
    "2027-01-22",
    "2027-02-20",
    "2027-03-22",
    "2027-04-20",
    "2027-05-19",
    "2027-05-20", // Day following Vesak Poya
    "2027-06-18",
    "2027-07-18",
    "2027-08-16",
    "2027-09-15",
    "2027-10-15",
    "2027-11-13",
    "2027-12-13",
]);

function todayColombo() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function isCompanyHoliday(date) {
    const dateString = date.toISOString().slice(0, 10);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    // Company is closed on January 1.
    if (month === 1 && day === 1) {
        return true;
    }

    // Company closes April 14–20 inclusive.
    // April 13 remains an operating day.
    if (month === 4 && day >= 14 && day <= 20) {
        return true;
    }

    // Includes configured Poya dates and the day after Vesak.
    return POYA_DATES.has(dateString);
}

// Calculate the first collection date and skip consecutive holidays.
function getNextPayDate(prefix) {
    const daysByPrefix = {
        D: 1,
        W: 7,
        M: 30,
        MINT: 30,
    };

    const days = daysByPrefix[prefix];

    // Cheque Cashing has no scheduled collection date.
    if (days === undefined) {
        return "";
    }

    const date = new Date(`${todayColombo()}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);

    while (isCompanyHoliday(date)) {
        date.setUTCDate(date.getUTCDate() + 1);
    }

    return date.toISOString().slice(0, 10);
}

export async function POST(request) {
    try {
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

        const body = await request.json();

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
        const registrationField = REGISTRATION_FIELDS[prefix];

        const issuedAmount = Number(body.urgencyFund);
        const plan = Number(body.plan);
        const intRate = Number(body.interestRate);
        const installment = Number(body.installment);
        const interestAmount = Number(body.interestAmount);

        const totalPayable =
            body.totalPayable == null
                ? null
                : Number(body.totalPayable);

        const issuedDate = String(body.dateOfFund ?? "").trim();

        if (
            !Number.isFinite(issuedAmount) ||
            issuedAmount <= 0 ||
            !Number.isInteger(plan) ||
            plan < 1 ||
            !Number.isFinite(intRate) ||
            intRate < 0 ||
            !Number.isFinite(interestAmount) ||
            interestAmount < 0 ||
            !Number.isFinite(installment) ||
            installment < 0 ||
            (
                totalPayable !== null &&
                (
                    !Number.isFinite(totalPayable) ||
                    totalPayable < 0
                )
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid installment calculation values.",
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

        const planUnit = String(body.planUnit || "").toLowerCase();
        const allowedUnits = ["days", "weeks", "months"];

        if (!allowedUnits.includes(planUnit)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid installment plan unit.",
                },
                { status: 400 }
            );
        }

        // Find the customer by the selected registration number.
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

        const nic = String(
            customer.nic || customerDoc.id
        ).trim();

        const name = String(
            customer.fullName || body.name || ""
        ).trim();

        if (!name || !nic) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Customer name or NIC is missing.",
                },
                { status: 400 }
            );
        }

        const actor =
            currentUser.role === "developer"
                ? "system"
                : currentUser.uid ||
                currentUser.email ||
                "system";

        // Calculate once so both records receive the same date.
        const nextPayDate = getNextPayDate(prefix);

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

        // Preserve existing outstanding-balance behavior.
        const outstanding = totalPayable ?? issuedAmount;

        const installmentData = {
            insID,
            nic,
            name,
            registrationNo,

            issuedAmount,
            installment,
            intRate,
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
            dueAmount: totalPayable ?? issuedAmount,
        };

        // Create both records atomically.
        await adminDb.runTransaction(async (transaction) => {
            const existingAffair =
                await transaction.get(affairRef);

            const affairsForNic =
                await transaction.get(affairsForNicQuery);

            if (existingAffair.exists) {
                const error = new Error(
                    "An active affair already exists for this registration number."
                );
                error.status = 409;
                throw error;
            }

            if (affairsForNic.size >= 2) {
                const error = new Error(
                    "This customer already has two active affairs."
                );
                error.status = 409;
                throw error;
            }

            transaction.set(installmentRef, installmentData);
            transaction.set(affairRef, affairData);
        });

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
