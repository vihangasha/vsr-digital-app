
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const REGISTRATION_TYPES = {
    "Daily Collect": {
        field: "daily",
        prefix: "D",
    },
    "Monthly Collect": {
        field: "monthly",
        prefix: "M",
    },
    "Monthly Interest": {
        field: "monthly-int",
        prefix: "MINT",
    },
    "Weekly Installment": {
        field: "weekly",
        prefix: "W",
    },
    "Cheque Cashing": {
        field: "chqRegNo",
        prefix: "CH",
    },
};

export async function GET(request) {
    try {
        // 1. Authenticate user
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

        // 2. Read credit type and prefix
        const { searchParams } = new URL(request.url);

        const creditType = searchParams.get("creditType");
        const requestedPrefix = searchParams.get("prefix");

        const config = REGISTRATION_TYPES[creditType];

        if (!config) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid credit type.",
                },
                { status: 400 }
            );
        }

        // 3. Validate the requested prefix
        if (requestedPrefix !== config.prefix) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid registration prefix.",
                },
                { status: 400 }
            );
        }

        // 4. Read the existing helper document
        const helperRef = adminDb
            .collection("autonum-helper")
            .doc("helperID");

        const helperSnapshot = await helperRef.get();

        if (!helperSnapshot.exists) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Auto-number helper document not found.",
                },
                { status: 404 }
            );
        }

        // 5. Get the current number for the selected credit type
        const helperData = helperSnapshot.data();
        const registrationNo = helperData[config.field];

        // 6. Validate the stored number
        const escapedPrefix = config.prefix.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const numberPattern = new RegExp(
            `^${escapedPrefix}-\\d{4,}$`
        );

        if (
            typeof registrationNo !== "string" ||
            !numberPattern.test(registrationNo.trim())
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid registration number stored in helper field: ${config.field}.`,
                },
                { status: 500 }
            );
        }

        // 7. Return the existing number WITHOUT incrementing it
        return NextResponse.json(
            {
                success: true,
                registrationNo: registrationNo.trim(),
                creditType,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                },
            }
        );

    } catch (error) {
        console.error("Auto-number GET API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Unable to retrieve registration number.",
            },
            { status: 500 }
        );
    }
}
