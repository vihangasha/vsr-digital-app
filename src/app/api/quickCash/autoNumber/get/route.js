
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

// Always fetch the latest counter value.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
    try {
        // --------------------------------------------------
        // 1. Restrict requests to same-origin browser fetches
        // --------------------------------------------------

        const requestOrigin = new URL(request.url).origin;
        const origin = request.headers.get("origin");
        const fetchSite = request.headers.get("sec-fetch-site");
        const fetchMode = request.headers.get("sec-fetch-mode");

        // Reject cross-origin and non-browser navigation requests.
        if (
            fetchSite !== "same-origin" ||
            (origin && origin !== requestOrigin) ||
            fetchMode === "navigate"
        ) {
            return NextResponse.json(
                { success: false, error: "Forbidden request." },
                { status: 403 }
            );
        }

        // --------------------------------------------------
        // 2. Authenticate signed-in user
        // --------------------------------------------------

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

        // --------------------------------------------------
        // 3. Fetch CHQ registration number only
        // --------------------------------------------------

        const helperSnapshot = await adminDb
            .collection("autonum-helper")
            .doc("helperID")
            .get();

        if (!helperSnapshot.exists) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Auto-number configuration not found.",
                },
                { status: 500 }
            );
        }

        const helperData = helperSnapshot.data();

        const chqRegNo = String(
            helperData?.chqRegNo || ""
        ).trim().toUpperCase();

        // --------------------------------------------------
        // 4. Validate CHQ number
        // --------------------------------------------------

        if (!/^CH-\d{4,}$/.test(chqRegNo)) {
            console.error("Invalid CHQ auto-number configuration.");

            return NextResponse.json(
                {
                    success: false,
                    error: "CHQ auto-number configuration is invalid.",
                },
                { status: 500 }
            );
        }

        // --------------------------------------------------
        // 5. Return number without consuming it
        // --------------------------------------------------

        return NextResponse.json(
            {
                success: true,
                chqRegNo,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                    Pragma: "no-cache",
                },
            }
        );

    } catch (error) {
        console.error("Quick Cash CHQ auto-number fetch error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Unable to fetch CHQ registration number.",
            },
            { status: 500 }
        );
    }
}
