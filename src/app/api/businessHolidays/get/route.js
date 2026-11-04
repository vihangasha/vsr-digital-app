
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getBusinessHolidayDates } from "@/lib/businessHolidays";

export async function GET(request) {
    try {
        // Authentication
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

        // Get requested year, defaulting to Colombo's current year.
        const { searchParams } = new URL(request.url);

        const requestedYear = searchParams.get("year");

        const currentYear = Number(
            new Intl.DateTimeFormat("en", {
                timeZone: "Asia/Colombo",
                year: "numeric",
            }).format(new Date())
        );

        const year = requestedYear === null
            ? currentYear
            : Number(requestedYear);

        if (
            !Number.isInteger(year) ||
            year < 2000 ||
            year > 2100 ||
            (requestedYear !== null &&
                !/^\d{4}$/.test(requestedYear))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid calendar year.",
                },
                { status: 400 }
            );
        }

        const holidays = getBusinessHolidayDates(year);

        return NextResponse.json(
            {
                success: true,
                year,
                count: holidays.length,
                holidays,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );

    } catch (error) {
        console.error("Business holidays API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to retrieve business holidays.",
            },
            { status: 500 }
        );
    }
}
