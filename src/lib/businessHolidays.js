
/* -------------------------------------------------------
   BUSINESS HOLIDAYS - CENTRAL CONFIGURATION
   Sri Lanka
------------------------------------------------------- */

// Poya dates are maintained centrally.
// Add new years here when the official calendar is available.

const POYA_DATES = {
    2026: [
        "2026-01-03",
        "2026-02-01",
        "2026-03-02",
        "2026-04-01",
        "2026-05-01",
        "2026-05-02",
        "2026-05-30",
        "2026-06-29",
        "2026-07-29",
        "2026-08-27",
        "2026-09-26",
        "2026-10-25",
        "2026-11-24",
        "2026-12-23",
    ],

    2027: [
        "2027-01-22",
        "2027-02-20",
        "2027-03-22",
        "2027-04-20",
        "2027-05-19",
        "2027-05-20",
        "2027-06-18",
        "2027-07-18",
        "2027-08-16",
        "2027-09-15",
        "2027-10-15",
        "2027-11-13",
        "2027-12-13",
    ],
};

/* -------------------------------------------------------
   DATE HELPERS
------------------------------------------------------- */

export function todayColombo() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

/* -------------------------------------------------------
   GET ALL BUSINESS HOLIDAYS FOR A YEAR
------------------------------------------------------- */

export function getBusinessHolidayDates(year) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error("Invalid holiday calendar year.");
    }

    const holidays = new Set(
        POYA_DATES[year] || []
    );

    // January 1 - New Year
    holidays.add(`${year}-01-01`);

    // April 14–20 - Sinhala and Tamil New Year period
    for (let day = 14; day <= 20; day++) {
        holidays.add(
            `${year}-04-${String(day).padStart(2, "0")}`
        );
    }

    return [...holidays].sort();
}

/* -------------------------------------------------------
   CHECK BUSINESS HOLIDAY
------------------------------------------------------- */

export function isBusinessHoliday(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return false;
    }

    const dateString = date.toISOString().slice(0, 10);
    const year = date.getUTCFullYear();

    return getBusinessHolidayDates(year).includes(dateString);
}

/* -------------------------------------------------------
   NEXT COLLECTION DATE
------------------------------------------------------- */

export function getNextBusinessPayDate(prefix) {
    const daysByPrefix = {
        D: 1,
        W: 7,
        M: 30,
        MINT: 30,
    };

    const days = daysByPrefix[prefix];

    // Cheque loans have no scheduled collection date.
    if (days === undefined) {
        return "";
    }

    const date = new Date(
        `${todayColombo()}T00:00:00.000Z`
    );

    date.setUTCDate(date.getUTCDate() + days);

    // Move collection date forward if it falls on a holiday.
    while (isBusinessHoliday(date)) {
        date.setUTCDate(date.getUTCDate() + 1);
    }

    return date.toISOString().slice(0, 10);
}


/* -------------------------------------------------------
   ADVANCE NEXT COLLECTION DATE
   Used by payment / collection APIs.
------------------------------------------------------- */

export function getNextBusinessPayDateFrom(regNo, currentDate) {
    const prefix = String(regNo ?? "")
        .trim()
        .toUpperCase()
        .split("-")[0];

    const daysToAdd = {
        D: 1,
        W: 7,
        M: 30,
        MINT: 30,
    }[prefix];

    // Cheque accounts have no scheduled collection date.
    if (daysToAdd === undefined) {
        return "";
    }

    // Validate the previous scheduled date.
    if (
        typeof currentDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(currentDate)
    ) {
        throw new Error(
            `Invalid nextPayDate for ${regNo}: expected YYYY-MM-DD.`
        );
    }

    const [year, month, day] = currentDate
        .split("-")
        .map(Number);

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new Error(
            `Invalid nextPayDate for ${regNo}: expected a valid calendar date.`
        );
    }

    // Advance from the PREVIOUS scheduled date.
    date.setUTCDate(date.getUTCDate() + daysToAdd);

    // Skip all configured business holidays.
    while (isBusinessHoliday(date)) {
        date.setUTCDate(date.getUTCDate() + 1);
    }

    return date.toISOString().slice(0, 10);
}


