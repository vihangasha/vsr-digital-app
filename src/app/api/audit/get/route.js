import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        const snapshot = await adminDb.collection("installments").get();

        let totalIssued = 0;
        let totalReceived = 0;
        let totalInterestReceived = 0;
        let totalOutstanding = 0;
        let activeLoans = 0;
        let closedLoans = 0;

        snapshot.forEach((doc) => {
            const loan = doc.data();

            const issuedAmount = Number(loan.issuedAmount) || 0;
            const paidAmount = Number(loan.paidAmount) || 0;
            const interestPaid = Number(loan.interestPaid) || 0;
            const outstanding = Number(loan.outstanding) || 0;
            const status = String(loan.status || "").toLowerCase();

            totalIssued += issuedAmount;
            totalReceived += paidAmount;
            totalInterestReceived += interestPaid;

            if (status === "active") {
                totalOutstanding += outstanding;
                activeLoans++;
            } else if (
                status === "closed" ||
                status === "settled" ||
                status === "completed"
            ) {
                closedLoans++;
            }
        });

        const roundMoney = (value) =>
            Math.round((value + Number.EPSILON) * 100) / 100;

        return NextResponse.json({
            success: true,
            data: {
                totalIssued: roundMoney(totalIssued),
                totalReceived: roundMoney(totalReceived),
                totalInterestReceived: roundMoney(totalInterestReceived),
                totalOutstanding: roundMoney(totalOutstanding),
                activeLoans,
                closedLoans,
                totalLoans: snapshot.size,
            },
        });
    } catch (error) {
        console.error("Audit summary error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to load audit summary" },
            { status: 500 }
        );
    }
}