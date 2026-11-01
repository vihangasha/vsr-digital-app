
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
    "Cache-Control": "private, no-store, max-age=0",
    "Vary": "Cookie",
};

function toDateString(value) {
    if (!value) return "";

    if (typeof value.toDate === "function") {
        return value.toDate().toISOString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "string") {
        return value;
    }

    return "";
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export async function GET() {
    try {
        // 1. Authenticate before accessing Firestore.
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized. Please log in.",
                },
                {
                    status: 401,
                    headers: NO_CACHE_HEADERS,
                }
            );
        }

        // 2. Fetch the installments collection.
        const snapshot = await adminDb
            .collection("installments")
            .get();

        // 3. Exclude the dummy document whose ID is "insID".
        // Real installment IDs remain their original Firestore document IDs.
        const validDocs = snapshot.docs.filter(
            (doc) => doc.id !== "insID"
        );

        // 4. Map real installments to the Receivables table.
        const receivables = validDocs.map((doc) => {
            const data = doc.data();

            return {
                id: doc.id,

                customer: String(data.name || ""),
                nic: String(data.nic || ""),
                regNo: String(data.registrationNo || ""),

                issued: toNumber(data.issuedAmount),

                payable:
                    data.totalPayable == null
                        ? null
                        : toNumber(data.totalPayable),

                returned: toNumber(data.paidAmount),
                due: toNumber(data.outstanding),

                period: [
                    data.plan == null ? "" : String(data.plan),
                    String(data.planUnit || ""),
                ]
                    .filter(Boolean)
                    .join(" "),

                nextReturn: String(data.nextPayDate || ""),

                createdDate: toDateString(data.createdAt),
                createdBy: String(data.createdBy || ""),

                updatedDate: toDateString(data.updatedAt),
                updatedBy: String(data.updatedBy || ""),
            };
        });

        // 5. Return the filtered records without caching.
        return NextResponse.json(
            {
                success: true,
                count: receivables.length,
                receivables,
            },
            {
                status: 200,
                headers: NO_CACHE_HEADERS,
            }
        );
    } catch (error) {
        // Keep internal error details on the server only.
        console.error(
            "GET /api/dashboard/recievables/get:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch receivables.",
            },
            {
                status: 500,
                headers: NO_CACHE_HEADERS,
            }
        );
    }
}
