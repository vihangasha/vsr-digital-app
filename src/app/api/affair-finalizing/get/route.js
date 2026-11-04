
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

function jsonResponse(data, status = 200) {
    return NextResponse.json(data, {
        status,
        headers: SECURITY_HEADERS,
    });
}

function isSameOrigin(request) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");

    if (origin && origin !== request.nextUrl.origin) {
        return false;
    }

    if (fetchSite === "cross-site") {
        return false;
    }

    return true;
}

function serializeValue(value) {
    if (value === null || value === undefined) {
        return value ?? null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (
        typeof value === "object" &&
        typeof value.toDate === "function"
    ) {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }

    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                serializeValue(item),
            ])
        );
    }

    return value;
}

export async function GET(request) {
    try {
        // -----------------------------------------
        // 1. SAME-ORIGIN VALIDATION
        // -----------------------------------------

        if (!isSameOrigin(request)) {
            return jsonResponse(
                {
                    success: false,
                    error: "Cross-origin requests are not permitted.",
                },
                403
            );
        }

        // -----------------------------------------
        // 2. AUTHENTICATION
        // -----------------------------------------

        const user = await getCurrentUser();

        if (!user) {
            return jsonResponse(
                {
                    success: false,
                    error: "Unauthorized.",
                },
                401
            );
        }

        // -----------------------------------------
        // 3. ROLE VALIDATION
        // -----------------------------------------

        const role = String(user.role || "")
            .trim()
            .toLowerCase();

        if (!["developer", "admin"].includes(role)) {
            return jsonResponse(
                {
                    success: false,
                    error: "You do not have permission to access affair finalization.",
                },
                403
            );
        }

        // -----------------------------------------
        // 4. FETCH PENDING AFFAIRS
        // -----------------------------------------

        const snapshot = await adminDb
            .collection("activeAffairs")
            .where("status", "==", "pending")
            .get();

        const pendingAffairs = snapshot.docs.map((doc) => {
            const data = doc.data();

            return {
                ...serializeValue(data),

                // The activeAffairs document ID is the registration number.
                regNo: doc.id,

                // Preserve NIC as a string.
                nic: String(data.nic || "").trim(),

                behavior: data.behavior ?? null,
            };
        });

        // -----------------------------------------
        // 5. RESPONSE
        // -----------------------------------------

        return jsonResponse({
            success: true,
            count: pendingAffairs.length,
            pendingAffairs,
        });

    } catch (error) {
        console.error(
            "GET /api/affair-finalizing/get:",
            error
        );

        return jsonResponse(
            {
                success: false,
                error: "Failed to retrieve pending affairs.",
            },
            500
        );
    }
}
