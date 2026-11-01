
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
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

        // Get today's date in Sri Lanka time.
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Colombo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date());

        // Find active affairs whose next payment date is today.
        const affairsSnapshot = await adminDb
            .collection("activeAffairs")
            .where("nextPayDate", "==", today)
            .get();

        if (affairsSnapshot.empty) {
            return NextResponse.json({
                success: true,
                date: today,
                count: 0,
                tasks: [],
            });
        }

        // Load installment records matching each registration number.
        const tasks = await Promise.all(
            affairsSnapshot.docs.map(async (affairDoc) => {
                const affair = affairDoc.data();
                const regNo = String(
                    affair.regNo || affairDoc.id
                ).trim();

                if (!regNo) return null;

                const installmentSnapshot = await adminDb
                    .collection("installments")
                    .where("registrationNo", "==", regNo)
                    .limit(2)
                    .get();

                if (installmentSnapshot.empty) {
                    return {
                        regNo,
                        error: "No matching installment found.",
                    };
                }

                if (installmentSnapshot.size > 1) {
                    return {
                        regNo,
                        error:
                            "Multiple installments found for this registration number.",
                    };
                }

                const installmentDoc =
                    installmentSnapshot.docs[0];

                const installment = installmentDoc.data();

                // Do not show settled or inactive installments.
                if (
                    installment.status &&
                    installment.status !== "active"
                ) {
                    return null;
                }

                return {
                    regNo,
                    insID: installment.insID || installmentDoc.id,
                    nic: installment.nic || affair.nic || "",
                    name: installment.name || "",
                    issuedAmount: installment.issuedAmount ?? 0,
                    installment: installment.installment ?? 0,
                    intRate: installment.intRate ?? 0,
                    totalPayable: installment.totalPayable ?? null,
                    outstanding: installment.outstanding ?? 0,
                    paidAmount: installment.paidAmount ?? 0,
                    plan: installment.plan ?? 0,
                    planUnit: installment.planUnit || "",
                    issuedDate: installment.issuedDate || "",
                    nextPayDate: affair.nextPayDate || "",
                    paidCount: affair.paidCount ?? 0,
                    dueCount: affair.dueCount ?? 0,
                    affairPaidAmount: affair.paidAmount ?? 0,
                    dueAmount: affair.dueAmount ?? 0,
                    paidInt: affair.paidInt ?? 0,
                    behavior: affair.behavior || "",
                    status: installment.status || "active",
                };
            })
        );

        const validTasks = tasks.filter(Boolean);

        return NextResponse.json({
            success: true,
            date: today,
            count: validTasks.length,
            tasks: validTasks,
        });
    } catch (error) {
        console.error("Get collection tasks error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to load today's collection tasks.",
            },
            { status: 500 }
        );
    }
}
