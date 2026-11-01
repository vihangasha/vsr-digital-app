import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getColomboDateTime() {
    const now = new Date();

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(now);

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );

    return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}:${values.second}`,
    };
}

export async function POST(request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => null);
        const amount = Number(body?.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Enter a valid withdrawal amount.",
                },
                { status: 400 }
            );
        }

        const roundedAmount =
            Math.round((amount + Number.EPSILON) * 100) / 100;

        const { date, time } = getColomboDateTime();

        const withdrawnBy =
            user.name ||
            user.fullName ||
            user.email ||
            user.uid ||
            user.id;

        if (!withdrawnBy) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unable to identify the authenticated user.",
                },
                { status: 401 }
            );
        }

        // Generate the Firestore document ID first.
        const docRef = adminDb.collection("withdrawals").doc();

        const withdrawalData = {
            withdrawId: docRef.id,
            date,
            time,
            amount: roundedAmount,
            withdrawnBy: String(withdrawnBy),
            createdAt: FieldValue.serverTimestamp(),
        };

        // Save the withdrawal with its ID included as a field.
        await docRef.set(withdrawalData);

        return NextResponse.json(
            {
                success: true,
                message: "Withdrawal recorded successfully.",
                withdrawal: withdrawalData.createdAt
                    ? {
                        withdrawId: docRef.id,
                        date,
                        time,
                        amount: roundedAmount,
                        withdrawnBy: String(withdrawnBy),
                    }
                    : null,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/audit/withdraw:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to record the withdrawal.",
            },
            { status: 500 }
        );
    }
}
