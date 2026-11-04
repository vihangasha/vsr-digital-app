
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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
    "Content-Security-Policy":
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
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

    if (!origin || origin !== request.nextUrl.origin) {
        return false;
    }

    if (fetchSite && fetchSite !== "same-origin") {
        return false;
    }

    return true;
}

function getLoyaltyFromBehavior(behavior) {
    const normalized = String(behavior ?? "")
        .trim()
        .toLowerCase();

    const loyaltyMap = {
        "": "diamond",
        "on time": "diamond",
        neutral: "gold",
        flagged: "silver",
        desserter: "bronze",
    };

    if (
        !Object.prototype.hasOwnProperty.call(
            loyaltyMap,
            normalized
        )
    ) {
        throw new Error(
            `Unsupported affair behavior: "${normalized}". Finalization stopped.`
        );
    }

    return loyaltyMap[normalized];
}

export async function PUT(request) {
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
                    error: "You do not have permission to finalize affairs.",
                },
                403
            );
        }

        // -----------------------------------------
        // 4. REQUEST VALIDATION
        // -----------------------------------------

        const body = await request.json().catch(() => null);

        const regNo = String(body?.regNo || "")
            .trim()
            .toUpperCase();

        if (!regNo || regNo.length > 100) {
            return jsonResponse(
                {
                    success: false,
                    error: "A valid registration number is required.",
                },
                400
            );
        }

        const affairRef = adminDb
            .collection("activeAffairs")
            .doc(regNo);

        const finalizedCollection = adminDb.collection(
            "finalized-affairs"
        );

        // Firestore generates a random document ID.
        const finalizedRef = finalizedCollection.doc();

        const finalizedBy =
            user.name ||
            user.email ||
            user.uid ||
            "Unknown";

        // -----------------------------------------
        // 5. ATOMIC FINALIZATION TRANSACTION
        // -----------------------------------------

        const result = await adminDb.runTransaction(
            async (transaction) => {
                // READ 1: Original active affair.
                const affairSnap = await transaction.get(
                    affairRef
                );

                if (!affairSnap.exists) {
                    throw new Error(
                        "This affair does not exist in active affairs. It may already have been finalized."
                    );
                }

                const affair = affairSnap.data();

                // Confirm that this is a pending affair.
                if (
                    String(affair.status || "")
                        .trim()
                        .toLowerCase() !== "pending"
                ) {
                    throw new Error(
                        "Only pending affairs can be finalized."
                    );
                }

                // Validate NIC.
                const nic = String(affair.nic || "").trim();

                if (!nic) {
                    throw new Error(
                        "The affair does not contain a valid NIC."
                    );
                }

                // Determine customer's new loyalty.
                const loyalty = getLoyaltyFromBehavior(
                    affair.behavior
                );

                // READ 2: Check for an existing finalized record
                // using regNo, NOT the Firestore document ID.
                const finalizedQuery = finalizedCollection
                    .where("regNo", "==", regNo)
                    .limit(1);

                const finalizedSnap = await transaction.get(
                    finalizedQuery
                );

                if (!finalizedSnap.empty) {
                    throw new Error(
                        "This registration number has already been finalized."
                    );
                }

                // READ 3: Find exactly one customer by NIC.
                const customerQuery = adminDb
                    .collection("customers")
                    .where("nic", "==", nic)
                    .limit(2);

                const customerSnap = await transaction.get(
                    customerQuery
                );

                if (customerSnap.empty) {
                    throw new Error(
                        "No customer record was found for this NIC. The affair was not finalized."
                    );
                }

                if (customerSnap.size !== 1) {
                    throw new Error(
                        "Multiple customer records were found for this NIC. Finalization stopped to prevent updating the wrong customer."
                    );
                }

                const customerDoc = customerSnap.docs[0];
                const customerRef = customerDoc.ref;
                const previousLoyalty =
                    customerDoc.data().loyalty ?? null;

                // -----------------------------------------
                // PREPARE COMPLETE FINALIZED DOCUMENT
                // -----------------------------------------

                // Preserve every original activeAffairs field.
                // Override/add only the finalization fields.
                const finalizedData = {
                    ...affair,

                    regNo,

                    status: "finalized",

                    appliedLoyalty: loyalty,

                    finalizedAt:
                        FieldValue.serverTimestamp(),

                    finalizedBy,

                    finalizedByUID: user.uid || null,
                };

                // -----------------------------------------
                // ALL READS ARE COMPLETE.
                // NOW PERFORM WRITES.
                // -----------------------------------------

                // 1. Create a new document with an automatically
                // generated Firestore ID.
                transaction.create(
                    finalizedRef,
                    finalizedData
                );

                // 2. Update the customer's loyalty.
                transaction.update(customerRef, {
                    loyalty,
                    updatedAt:
                        FieldValue.serverTimestamp(),
                });

                // 3. Delete the original active affair.
                transaction.delete(affairRef);

                return {
                    documentId: finalizedRef.id,
                    regNo,
                    nic,
                    customerID: customerDoc.id,
                    previousLoyalty,
                    appliedLoyalty: loyalty,
                    behavior: affair.behavior ?? null,
                };
            }
        );

        // -----------------------------------------
        // 6. SUCCESS RESPONSE
        // -----------------------------------------

        return jsonResponse({
            success: true,
            message: "Affair successfully finalized.",
            finalizedAffair: result,
        });

    } catch (error) {
        console.error(
            "PUT /api/affair-finalizing/put:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Affair finalization failed.";

        const status =
            message === "Unauthorized."
                ? 401
                : /permission/i.test(message)
                    ? 403
                    : /required|valid registration/i.test(message)
                        ? 400
                        : 409;

        return jsonResponse(
            {
                success: false,
                error: message,
            },
            status
        );
    }
}
