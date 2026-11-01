import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

        const snapshot = await adminDb
            .collection("withdrawals")
            .get();

        const withdrawals = snapshot.docs
            .map((doc) => {
                const data = doc.data();

                return {
                    withdrawId: data.withdrawId || doc.id,
                    amount: Number(data.amount) || 0,
                    date: data.date || "",
                    time: data.time || "",
                    withdrawnBy: data.withdrawnBy || "Unknown",
                    createdAt: data.createdAt?.toMillis?.() || 0,
                };
            })
            // Ignore empty or invalid withdrawal documents.
            .filter(
                (withdrawal) =>
                    withdrawal.amount > 0 &&
                    withdrawal.date &&
                    withdrawal.time &&
                    withdrawal.withdrawnBy !== "Unknown"
            )
            .sort((a, b) => b.createdAt - a.createdAt);

        const totalWithdrawn = withdrawals.reduce(
            (total, withdrawal) => total + withdrawal.amount,
            0
        );

        return NextResponse.json({
            success: true,
            data: {
                withdrawals,
                totalWithdrawn,
            },
        });
    } catch (error) {
        console.error("GET /api/audit/withdrawals/get:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch withdrawals.",
            },
            { status: 500 }
        );
    }
}
