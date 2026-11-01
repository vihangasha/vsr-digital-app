
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    try {
        // Security: require an authenticated session before accessing Firestore.
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized. Please log in.",
                },
                {
                    status: 401,
                    headers: {
                        "Cache-Control": "no-store",
                    },
                }
            );
        }

        // Fetch active affairs directly from the server-side Admin SDK.
        // No client-provided collection names or query parameters are accepted.
        const snapshot = await adminDb
            .collection("activeAffairs")
            .get();

        const realRecords = snapshot.docs.filter(
            (doc) => doc.id !== "regNo"
        );

        const activeAffairs = realRecords.map((doc) => {
            const data = doc.data();

            return {
                regNo: String(data.regNo || doc.id),
                nic: String(data.nic || ""),
                issuedAmount: Number(data.issuedAmount) || 0,
                paidAmount: Number(data.paidAmount) || 0,
                paidCount: Number(data.paidCount) || 0,
                dueAmount: Number(data.dueAmount) || 0,
                dueCount: Number(data.dueCount) || 0,
                nextPayDate: String(data.nextPayDate || ""),
            };
        });

        return NextResponse.json(
            {
                success: true,
                count: activeAffairs.length,
                activeAffairs,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "private, no-store, max-age=0",
                    "Vary": "Cookie",
                },
            }
        );
    } catch (error) {
        console.error("GET /api/dashboard/active-affairs/get:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch active affairs.",
            },
            {
                status: 500,
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
