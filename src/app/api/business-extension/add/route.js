
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

/* -------------------------------------------------------
   DATE HELPERS
------------------------------------------------------- */

// Get today's date in Sri Lanka as YYYY-MM-DD.
function getSriLankaDate() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day}`;
}

// Add exactly one calendar day to a YYYY-MM-DD date.
function addOneDay(dateString) {
    const date = new Date(`${dateString}T00:00:00.000Z`);

    date.setUTCDate(date.getUTCDate() + 1);

    return date.toISOString().slice(0, 10);
}

/* -------------------------------------------------------
   MAIN API
------------------------------------------------------- */

export async function POST(request) {
    try {
        /* -----------------------------------------------
           1. AUTHENTICATION
        ----------------------------------------------- */

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

        /* -----------------------------------------------
           2. REQUEST BODY
        ----------------------------------------------- */

        let body;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid request body.",
                },
                { status: 400 }
            );
        }

        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid request data.",
                },
                { status: 400 }
            );
        }

        const passedReason = String(
            body.passedReason ?? body.remarks ?? ""
        ).trim();

        if (!passedReason) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Please provide a reason for extending the business day.",
                },
                { status: 400 }
            );
        }

        if (passedReason.length > 500) {
            return NextResponse.json(
                {
                    success: false,
                    error: "The reason cannot exceed 500 characters.",
                },
                { status: 400 }
            );
        }

        /* -----------------------------------------------
           3. DATE CALCULATION
        ----------------------------------------------- */

        const passedDate = getSriLankaDate();
        const nextDate = addOneDay(passedDate);

        /* -----------------------------------------------
           4. FIRESTORE REFERENCES
        ----------------------------------------------- */

        const currentAffairsQuery = adminDb
            .collection("current-affairs")
            .where("nextPayDate", "==", passedDate);

        const installmentsQuery = adminDb
            .collection("installments")
            .where("nextPayDate", "==", passedDate);

        const extensionRef = adminDb
            .collection("business-extensions")
            .doc();

        const passedBy = String(
            currentUser.uid ||
            currentUser.email ||
            "unknown"
        );

        /* -----------------------------------------------
           5. ATOMIC DATE EXTENSION + AUDIT RECORD
        ----------------------------------------------- */

        const result = await adminDb.runTransaction(
            async (transaction) => {
                // Find all affairs and installments due today.
                const currentAffairsSnapshot =
                    await transaction.get(currentAffairsQuery);

                const installmentsSnapshot =
                    await transaction.get(installmentsQuery);

                const totalAffected =
                    currentAffairsSnapshot.size +
                    installmentsSnapshot.size;

                // Firestore transactions support a maximum
                // of 500 writes. One write is reserved for audit.
                if (totalAffected > 499) {
                    const error = new Error(
                        "Too many records match today's date. No records were changed."
                    );

                    error.status = 400;
                    throw error;
                }

                // Do not create an audit record if nothing
                // actually needs to be extended.
                if (totalAffected === 0) {
                    return {
                        extended: false,
                        currentAffairsUpdated: 0,
                        installmentsUpdated: 0,
                    };
                }

                // Move current-affairs dates forward by one day.
                currentAffairsSnapshot.docs.forEach((doc) => {
                    transaction.update(doc.ref, {
                        nextPayDate: nextDate,
                    });
                });

                // Move installments dates forward by one day.
                installmentsSnapshot.docs.forEach((doc) => {
                    transaction.update(doc.ref, {
                        nextPayDate: nextDate,
                    });
                });

                // Create one audit record for this extension.
                transaction.set(extensionRef, {
                    extensionID: extensionRef.id,
                    passedBy,
                    passedDate,
                    passedReason,
                });

                return {
                    extended: true,
                    currentAffairsUpdated:
                        currentAffairsSnapshot.size,
                    installmentsUpdated:
                        installmentsSnapshot.size,
                };
            }
        );

        /* -----------------------------------------------
           6. NO MATCHING RECORDS
        ----------------------------------------------- */

        if (!result.extended) {
            return NextResponse.json(
                {
                    success: true,
                    extended: false,
                    message:
                        "No current affairs or installments have a next payment date matching today. Nothing was changed.",
                    passedDate,
                    currentAffairsUpdated: 0,
                    installmentsUpdated: 0,
                },
                { status: 200 }
            );
        }

        /* -----------------------------------------------
           7. SUCCESS RESPONSE
        ----------------------------------------------- */

        return NextResponse.json(
            {
                success: true,
                extended: true,
                message:
                    "Business operations successfully extended by one day.",

                extension: {
                    extensionID: extensionRef.id,
                    passedBy,
                    passedDate,
                    passedReason,
                    nextDate,
                },

                currentAffairsUpdated:
                    result.currentAffairsUpdated,

                installmentsUpdated:
                    result.installmentsUpdated,

                totalUpdated:
                    result.currentAffairsUpdated +
                    result.installmentsUpdated,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("Business extension error:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error.message ||
                    "Failed to extend the business date.",
            },
            { status: error.status || 500 }
        );
    }
}
