import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { firestore } from "../firebase.native";
import { FirestoreService } from "../services/firestoreService";
import { useServiceCart } from "../context/ServiceCartContext";

type SelectedSlot = { date: string; time: string };

type SlotBlockResult = {
  ok: boolean;
  slots: SelectedSlot[];
  reason?: string;
};

type RecurringSchedule = {
  unit: string;
  anchorDate: string; // yyyy-mm-dd
  weekday: number; // 0=Sun..6=Sat
  timeSlot: string; // UI label e.g. "9:00 AM - 11:00 AM"
};

// NOTE: MonthlySchedule was previously defined but unused in this screen.

export default function SelectDateTimeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addService } = useServiceCart();
  const insets = useSafeAreaInsets();

  const instanceIdRef = useRef(`SDT-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  useEffect(() => {
    const instanceId = instanceIdRef.current;
    console.log("🧭 SelectDateTime", instanceId, "MOUNT");
    return () => {
      console.log("🧭 SelectDateTime", instanceId, "UNMOUNT");
    };
  }, []);

  useEffect(() => {
    const unsubFocus = navigation.addListener("focus", () => {
      console.log("🧭 SelectDateTime", instanceIdRef.current, "FOCUS");
    });
    const unsubBlur = navigation.addListener("blur", () => {
      console.log("🧭 SelectDateTime", instanceIdRef.current, "BLUR");
    });
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  const { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues, fromServiceServices, isPackageBooking, selectedPackage: selectedPackageParam, serviceQuantities, selectedCompanyId, selectedCompany } = route.params;

  useEffect(() => {
    console.log("🧭 SelectDateTime", instanceIdRef.current, "ROUTE PARAMS", {
      keys: Object.keys(route?.params || {}),
      isPackageBooking,
      selectedCompanyId,
      selectedCompanyName: (selectedCompany as any)?.name,
      selectedPackageType: typeof selectedPackageParam,
    });
  }, [isPackageBooking, route?.params, selectedCompany, selectedCompanyId, selectedPackageParam]);

  const selectedPackage = useMemo(() => {
    // Some flows pass the package object, others pass a JSON stringified snapshot.
    // Normalize to an object so unit parsing works reliably.
    if (!selectedPackageParam) return selectedPackageParam;
    if (typeof selectedPackageParam === 'string') {
      const s = selectedPackageParam.trim();
      if (s.startsWith('{') && s.endsWith('}')) {
        try {
          return JSON.parse(s);
        } catch {
          return selectedPackageParam;
        }
      }
    }
    return selectedPackageParam;
  }, [selectedPackageParam]);

  const selectedPackageId = String((selectedPackage as any)?.id || '');
  const selectedPackageName = String((selectedPackage as any)?.name || '');
  const selectedPackagePrice = (selectedPackage as any)?.price;
  const selectedPackageDuration = (selectedPackage as any)?.duration;

  const serviceIdKey = String(selectedIssueIds?.[0] || "");
  const selectedIssueIdsKey = useMemo(() => JSON.stringify(selectedIssueIds ?? []), [selectedIssueIds]);
  const selectedPackagePriceKey = String(selectedPackagePrice ?? "");
  const selectedPackageDurationKey = String(selectedPackageDuration ?? "");

  const selectedPackageUnit = String((selectedPackage as any)?.unit || '').toLowerCase();
  const isMonthlyPackage = isPackageBooking === true && selectedPackageUnit === 'month';
  // IMPORTANT:
  // “Day” packages are *single-day* bookings in our UX (pick exactly 1 day within next 7 days).
  // Only week/month should generate multiple occurrences.
  const isRecurringPackage = isPackageBooking === true && ['week', 'weekly', 'month', 'monthly'].includes(selectedPackageUnit);
  const needsDayConfirmation = isRecurringPackage && (isMonthlyPackage || selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly');
  const isDailyPackage = isPackageBooking === true && (selectedPackageUnit === 'day' || selectedPackageUnit === 'daily');

  const isSundayISO = (dateISO: string) => {
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) return false;
    return d.getDay() === 0;
  };

  // ---- Calendar grid helpers (ISO date strings: YYYY-MM-DD) ----
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const getMonthKey = (iso: string): string => String(iso || "").slice(0, 7); // YYYY-MM

  const addMonthsKey = (monthKey: string, deltaMonths: number): string => {
    const [yStr, mStr] = String(monthKey).split('-');
    const y0 = Number(yStr);
    const m0 = Number(mStr);
    if (!Number.isFinite(y0) || !Number.isFinite(m0)) return monthKey;

    const dt = new Date(y0, (m0 - 1) + Number(deltaMonths || 0), 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    return `${y}-${pad2(m)}`;
  };

  const startOfMonthISO = (monthKey: string): string => `${monthKey}-01`;

  const daysInMonth = (monthKey: string): number => {
    const [yStr, mStr] = monthKey.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    // day 0 of next month is last day of current month
    return new Date(y, m, 0).getDate();
  };

  const dayOfWeekSun0 = (iso: string): number => {
    const [yStr, mStr, dStr] = iso.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    return new Date(y, m - 1, d).getDay(); // 0..6
  };

  const makeISO = (monthKey: string, day: number): string => `${monthKey}-${pad2(day)}`;

  const buildMonthGrid = (monthKey: string): { iso: string | null; dayNumber: number | null; isSunday: boolean }[] => {
    const firstIso = startOfMonthISO(monthKey);
    const firstDow = dayOfWeekSun0(firstIso); // 0..6
    const total = daysInMonth(monthKey);

  const cells: { iso: string | null; dayNumber: number | null; isSunday: boolean }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ iso: null, dayNumber: null, isSunday: false });
    for (let day = 1; day <= total; day++) {
      const iso = makeISO(monthKey, day);
      cells.push({ iso, dayNumber: day, isSunday: isSundayISO(iso) });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: null, dayNumber: null, isSunday: false });
    return cells;
  };

  const addDaysISO = (dateISO: string, days: number) => {
    // Safer than new Date('YYYY-MM-DD') on some Android/JSC builds.
    // Build a local Date from components to avoid parsing quirks/timezone shifts.
    try {
      const [yStr, mStr, dStr] = String(dateISO).split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const d0 = Number(dStr);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d0)) return dateISO;
      const dt = new Date(y, m - 1, d0);
      if (Number.isNaN(dt.getTime())) return dateISO;
      dt.setDate(dt.getDate() + Number(days || 0));
      if (Number.isNaN(dt.getTime())) return dateISO;
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    } catch {
      return dateISO;
    }
  };

  const buildRecurringSchedule = (anchorDateISO: string, timeSlotLabel: string): RecurringSchedule | null => {
    if (!anchorDateISO || !timeSlotLabel) return null;
    const d = new Date(anchorDateISO);
    if (Number.isNaN(d.getTime())) return null;
    return {
      unit: selectedPackageUnit,
      anchorDate: anchorDateISO,
      weekday: d.getDay(),
      timeSlot: timeSlotLabel,
    };
  };

  const generateRecurringOccurrences = (anchorDateISO: string, timeSlotLabel: string): SelectedSlot[] => {
    const out: SelectedSlot[] = [];
    if (!anchorDateISO || !timeSlotLabel) return out;
    const anchor = new Date(anchorDateISO);
    if (Number.isNaN(anchor.getTime())) return out;

    if (selectedPackageUnit === 'day' || selectedPackageUnit === 'daily') {
      // Day-unit packages are single-day bookings.
      // The UI already enforces “pick exactly 1 day within next 7 days”, so
      // we should only create ONE occurrence here.
      out.push({ date: anchorDateISO, time: timeSlotLabel });
      return out;
    }

    if (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly') {
      // Weekly plan (current UX): user selects 7 days in a block.
      // We still allow defaults to prefill 7 days starting from the anchor.
      for (let i = 0; i < 7; i++) {
        const dISO = addDaysISO(anchorDateISO, i);
        out.push({ date: dISO, time: timeSlotLabel });
      }
      return out;
    }

    // month/monthly => user must pick exactly 30 days.
    // Prefill 30 sequential days from anchor (spills into next month as needed).
    for (let i = 0; i < 30; i++) {
      const dISO = addDaysISO(anchorDateISO, i);
      out.push({ date: dISO, time: timeSlotLabel });
    }

    return out;
  };

  // Debug: Log initial params once per *real* mount (avoid log spam on rerenders)
  useEffect(() => {
    console.log('🚀 SelectDateTimeScreen MOUNTED with params:', JSON.stringify({
      serviceTitle,
      categoryId,
      issues,
      selectedIssueIds,
      selectedIssues: selectedIssues?.map((s: any) => s.name),
      fromServiceServices,
      isPackageBooking,
      serviceQuantities,
      selectedCompanyId,
      selectedCompanyName: selectedCompany?.companyName || selectedCompany?.serviceName,
      selectedPackage: selectedPackage ? {
        name: (selectedPackage as any)?.name,
        price: (selectedPackage as any)?.price,
        id: (selectedPackage as any)?.id,
      } : null,
    }, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State for slots
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean>>({});
  const [seriesAvailability, setSeriesAvailability] = useState<Record<string, boolean>>({});
  const [seriesConflicts, setSeriesConflicts] = useState<Record<string, string[]>>({});
  const [loadingSeriesAvailability, setLoadingSeriesAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityFreshByDate, setAvailabilityFreshByDate] = useState<Record<string, boolean>>({});
  const availabilityReqIdRef = useRef(0);
  const [availabilityStatusText, setAvailabilityStatusText] = useState<string>('');
  const [blockError, setBlockError] = useState<string | null>(null);
  const [planPickError, setPlanPickError] = useState<string | null>(null);

  // Guards against in-flight async loops / stale completions.
  const seriesValidationReqRef = useRef(0);
  const fetchSlotsReqRef = useRef(0);

  const isVerifyingAvailability = loadingAvailability || loadingSeriesAvailability;

  // Predefined slots for services (non-package bookings)
  const defaultSlots = useMemo(
    () => [
      "9:00 AM - 11:00 AM",
      "11:00 AM - 1:00 PM",
      "1:00 PM - 3:00 PM",
      "3:00 PM - 5:00 PM",
      "5:00 PM - 7:00 PM",
      "7:00 PM - 9:00 PM",
    ],
    []
  );

  const [time, setTime] = useState("");
  const [confirmedPlanDates, setConfirmedPlanDates] = useState<string[]>([]);
  const confirmedPlanDatesKey = useMemo(() => confirmedPlanDates.join('|'), [confirmedPlanDates]);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to tomorrow instead of today
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // IMPORTANT: Use local date parts (not toISOString) to avoid UTC date shifting.
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const isServiceFlow = isPackageBooking !== true;

  const isDayBookedForTimeSlot = (iso: string, timeSlotLabel: string) => {
    const key = `${iso}|${timeSlotLabel}`;
    // slotAvailability: true/false, where false means fully booked
    if (slotAvailability && Object.prototype.hasOwnProperty.call(slotAvailability, key)) {
      return slotAvailability[key] === false;
    }
    return false;
  };

  // Service-flow “duration accumulation” (slot-block) implementation:
  // Each time window in `defaultSlots` is treated as one 2-hour slot.
  // For non-package services, we derive how many contiguous slots are needed from the
  // selected service(s) `duration` + `durationUnit`, multiplied by quantity.
  type DurationUnit = 'minute' | 'minutes' | 'min' | 'hour' | 'hours' | 'hr' | 'day' | 'days' | 'week' | 'weeks' | 'month' | 'months';

  const normalizeDurationUnit = useCallback((u: any): DurationUnit | null => {
    if (!u) return null;
    const s = String(u).trim().toLowerCase();
    if (
      s === 'minute' || s === 'minutes' || s === 'min' ||
      s === 'hour' || s === 'hours' || s === 'hr' ||
      s === 'day' || s === 'days' ||
      s === 'week' || s === 'weeks' ||
      s === 'month' || s === 'months'
    ) return s as DurationUnit;
    return null;
  }, []);

  const parseSlotHours = (label: string): number => {
    // Expected label format: "9:00 AM - 11:00 AM".
    // Fallback to 2 hours if parsing fails.
    try {
      const parts = String(label).split('-').map((p) => p.trim());
      if (parts.length !== 2) return 2;
      const toMinutes = (t: string) => {
        const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return null;
        let hh = Number(m[1]);
        const mm = Number(m[2]);
        const ap = m[3].toUpperCase();
        if (ap === 'PM' && hh !== 12) hh += 12;
        if (ap === 'AM' && hh === 12) hh = 0;
        return hh * 60 + mm;
      };
      const a = toMinutes(parts[0]);
      const b = toMinutes(parts[1]);
      if (a == null || b == null) return 2;
      const diff = b - a;
      // Handle overnight ranges (shouldn't happen, but avoid negative duration).
      const minutes = diff > 0 ? diff : diff + 24 * 60;
      const hours = minutes / 60;
      return hours > 0 ? hours : 2;
    } catch {
      return 2;
    }
  };

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const durationToMinutes = useCallback((duration: any, unitRaw: any): number | null => {
    const d = Number(duration);
    if (!Number.isFinite(d) || d <= 0) return null;
    const unit = normalizeDurationUnit(unitRaw);
    if (!unit) return null;

    switch (unit) {
      case 'minute':
      case 'minutes':
      case 'min':
        return d;
      case 'hour':
      case 'hours':
      case 'hr':
        return d * 60;
      case 'day':
      case 'days':
        return d * 24 * 60;
      case 'week':
      case 'weeks':
        return d * 7 * 24 * 60;
      case 'month':
      case 'months':
        return d * 30 * 24 * 60;
    }
  }, [normalizeDurationUnit]);

  const formatTime12h = (totalMinutes: number) => {
    const m = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    let hh = Math.floor(m / 60);
    const mm = m % 60;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const hh12 = hh % 12 || 12;
    return `${hh12}:${String(mm).padStart(2, '0')} ${ampm}`;
  };

  // Legacy helper (kept for reference); service flow now generates duration-based start times.
  // const buildSlotsForIntervalMinutes = useCallback((intervalMinutes: number): string[] => {
  //   const dayStartM = 9 * 60;
  //   const dayEndM = 21 * 60;
  //   const step = Math.round(intervalMinutes);
  //   if (!Number.isFinite(step) || step <= 0) return [];
  //   const out: string[] = [];
  //   for (let start = dayStartM; start + step <= dayEndM; start += step) {
  //     const end = start + step;
  //     out.push(`${formatTime12h(start)} - ${formatTime12h(end)}`);
  //   }
  //   return out;
  // }, []);

  const buildStartTimesForDurationMinutes = useCallback((durationMinutes: number, stepMinutes: number): string[] => {
    // Generate start-time labels (single time like "9:00 AM") for a business day.
    // The chosen start time represents a continuous block of `durationMinutes`.
    const dayStartM = 9 * 60;
    const dayEndM = 21 * 60;

    const dur = Math.round(Number(durationMinutes));
    const step = Math.round(Number(stepMinutes));
    if (!Number.isFinite(dur) || dur <= 0) return [];
    if (!Number.isFinite(step) || step <= 0) return [];

    const out: string[] = [];
    for (let start = dayStartM; start + dur <= dayEndM; start += step) {
      out.push(formatTime12h(start));
    }
    return out;
  }, []);

  const parseTimeToMinutes = (t: string): number | null => {
    // Accept "9:00 AM". (We intentionally do NOT accept time ranges here.)
    const m = String(t).trim().match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
    if (!m) return null;
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    const ap = m[3].toUpperCase();
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
    if (ap === 'PM' && hh !== 12) hh += 12;
    if (ap === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
  };

  const formatDurationWindowLabel = useCallback((startLabel: string, durationMinutes: number): string => {
    const startM = parseTimeToMinutes(startLabel);
    const dur = Math.round(Number(durationMinutes));
    if (startM == null || !Number.isFinite(dur) || dur <= 0) return startLabel;
    const endM = startM + dur;
    return `${formatTime12h(startM)} - ${formatTime12h(endM)}`;
  }, []);

  // NOTE: We compute the final required duration *after* duration hydration state is declared.

  const buildAtomicIntervalsForDuration = useCallback((startLabel: string, durationMinutes: number, atomicMinutes: number): string[] => {
    // Convert a chosen start time (e.g. "9:00 AM") into an array of atomic time windows
    // (e.g. "9:00 AM - 9:30 AM", "9:30 AM - 10:00 AM" ...) whose availability we validate.
    const startM = parseTimeToMinutes(startLabel);
    const dur = Math.round(Number(durationMinutes));
    const step = Math.round(Number(atomicMinutes));
    if (startM == null || !Number.isFinite(dur) || dur <= 0) return [];
    if (!Number.isFinite(step) || step <= 0) return [];

    const out: string[] = [];
    const pieces = Math.ceil(dur / step);
    for (let i = 0; i < pieces; i++) {
      const a = startM + i * step;
      const b = Math.min(startM + (i + 1) * step, startM + dur);
      out.push(`${formatTime12h(a)} - ${formatTime12h(b)}`);
    }
    return out;
  }, []);

  const slotsPerDay = defaultSlots.length;
  const singleSlotHours = parseSlotHours(defaultSlots?.[0] ?? "");

  const [hydratedServiceMeta, setHydratedServiceMeta] = useState<{ id: string; duration?: any; durationUnit?: any }[]>([]);

  // Some flows only pass lightweight service objects in `selectedIssues` (without duration fields).
  // Hydrate duration metadata from Firestore so slot intervals can be generated reliably.
  useEffect(() => {
    if (!isServiceFlow) return;
    // In the singular-service flow, some upstream screens may still pass app_services ids
    // in selectedIssueIds. For duration-based slot generation we want the company-specific
    // service_services doc. Prefer `selectedCompany.id` when present.
    const selectedCompanyServiceDocId = (selectedCompany as any)?.id ? String((selectedCompany as any).id) : null;

    const idsToHydrate = (
      selectedCompanyServiceDocId
        ? [selectedCompanyServiceDocId]
        : (Array.isArray(selectedIssueIds) ? selectedIssueIds : [])
    ).filter(Boolean) as string[];

    if (idsToHydrate.length === 0) {
      setHydratedServiceMeta([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
  const metas: { id: string; duration?: any; durationUnit?: any }[] = [];
        for (const id of idsToHydrate) {
          if (!id) continue;
          try {
            const snap = await firestore().collection('service_services').doc(String(id)).get();
            const data: any = snap.exists ? snap.data() : null;
            metas.push({ id: String(id), duration: data?.duration, durationUnit: data?.durationUnit });
          } catch {
            metas.push({ id: String(id) });
          }
        }
        if (!cancelled) setHydratedServiceMeta(metas);
      } catch {
        if (!cancelled) setHydratedServiceMeta([]);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isServiceFlow, (selectedCompany as any)?.id, JSON.stringify(selectedIssueIds)]);

  const effectiveServiceIntervalMinutes = (() => {
    if (!isServiceFlow) return null;

    const fromRoute = (Array.isArray(selectedIssues) ? selectedIssues : [])
      .map((s: any) => durationToMinutes(s?.duration, s?.durationUnit))
      .filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0) as number[];

    const fromHydrated = (Array.isArray(hydratedServiceMeta) ? hydratedServiceMeta : [])
      .map((s: any) => durationToMinutes(s?.duration, s?.durationUnit))
      .filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0) as number[];

    const candidates = [...fromRoute, ...fromHydrated];
    if (candidates.length === 0) return null;
    const minMins = Math.min(...candidates);
    return clamp(minMins, 15, 12 * 60);
  })();

  // For dynamic service booking slots, we need a required continuous duration.
  // Requirement: reserve total time = SUM(duration(service) * quantity(service)) for all selected services.
  const requiredDurationMinutes = useMemo(() => {
    if (!isServiceFlow) return 0;

    // ✅ Most reliable source in the singular-company service flow:
    // `selectedCompany` represents the chosen `service_services` doc for that company.
    // If duration is present here, use it directly so slot blocking is consistent per company
    // even when selectedIssueIds/selectedIssues are app_services-shaped.
    const selectedCompanyMins = durationToMinutes(
      (selectedCompany as any)?.duration,
      (selectedCompany as any)?.durationUnit,
    );
    if (selectedCompanyMins && selectedCompanyMins > 0) {
      // Quantity preference order:
      // 1) quantity attached to selectedCompany itself
      // 2) total of serviceQuantities map (common when only one service is being booked)
      // 3) fallback 1
      const embeddedQty = Number((selectedCompany as any)?.quantity);
      const qtyFromEmbedded = (Number.isFinite(embeddedQty) && embeddedQty > 0) ? Math.round(embeddedQty) : null;
      const totalQty = (serviceQuantities && typeof serviceQuantities === 'object')
        ? Object.values(serviceQuantities).reduce((acc: number, v: any) => acc + Math.max(0, Number(v) || 0), 0)
        : 0;
      const qty = Math.max(1, qtyFromEmbedded ?? (totalQty > 0 ? Math.round(totalQty) : 1));
      return selectedCompanyMins * qty;
    }

    const resolveQtyForService = (svc: any, idx: number): number => {
      // Best signal: selectedIssues already carries quantity (if upstream attached it)
      // e.g. ServiceCategoryScreen builds { id, quantity, service } and passes objects through.
      const embeddedQty = Number((svc as any)?.quantity);
      if (Number.isFinite(embeddedQty) && embeddedQty > 0) return Math.round(embeddedQty);

      // Quantities can be keyed by different id fields depending on upstream screen.
      // Prefer a direct match on the service object's id, then fall back to selectedIssueIds[idx].
      const serviceIdRaw = svc?.id ?? svc?._id ?? svc?.issueId;
      const idCandidates = [
        serviceIdRaw != null ? String(serviceIdRaw) : null,
        (Array.isArray(selectedIssueIds) && selectedIssueIds[idx] != null) ? String(selectedIssueIds[idx]) : null,
      ].filter(Boolean) as string[];

      for (const key of idCandidates) {
        const v = (serviceQuantities as any)?.[key];
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return Math.round(n);
      }
      return 1;
    };

    const services = Array.isArray(selectedIssues) ? selectedIssues : [];

    // Build a quick lookup of hydrated duration data keyed by service id.
    const hydratedById = new Map<string, { duration?: any; durationUnit?: any }>();
    (Array.isArray(hydratedServiceMeta) ? hydratedServiceMeta : []).forEach((m: any) => {
      const id = String(m?.id ?? '');
      if (!id) return;
      hydratedById.set(id, { duration: m?.duration, durationUnit: m?.durationUnit });
    });

    const fromRoute = services
      .map((svc: any, idx: number) => {
        const qty = Math.max(1, resolveQtyForService(svc, idx));

        // Route objects sometimes only carry {id, quantity}. If duration is missing, use hydrated values.
        const svcId = String(svc?.id ?? svc?._id ?? svc?.issueId ?? (Array.isArray(selectedIssueIds) ? selectedIssueIds[idx] : '') ?? '');
        const hydrated = svcId ? hydratedById.get(svcId) : undefined;

        const mins = durationToMinutes(
          svc?.duration ?? hydrated?.duration,
          svc?.durationUnit ?? hydrated?.durationUnit,
        );

        return mins && mins > 0 ? mins * qty : 0;
      })
      .filter((v: number) => Number.isFinite(v) && v > 0);

    const fromHydrated = (Array.isArray(hydratedServiceMeta) ? hydratedServiceMeta : [])
      .map((svc: any) => {
        const mins = durationToMinutes(svc?.duration, svc?.durationUnit);
        return mins && mins > 0 ? mins : 0;
      })
      .filter((v: number) => Number.isFinite(v) && v > 0);

    // Prefer route objects because they carry quantities; hydrated is a fallback when duration isn't present in route.
    if (fromRoute.length > 0) {
      const total = fromRoute.reduce((acc: number, v: number) => acc + v, 0);

      // If upstream quantities are provided but we didn't apply them (common id mismatch),
      // and the selected services look like the same service repeated with quantity,
      // prefer totalQty × baseDuration.
      const totalQty = (serviceQuantities && typeof serviceQuantities === 'object')
        ? Object.values(serviceQuantities).reduce((acc: number, v: any) => acc + Math.max(0, Number(v) || 0), 0)
        : 0;
      if (totalQty > 1) {
        const durations = services
          .map((svc: any) => durationToMinutes(svc?.duration, svc?.durationUnit))
          .filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0) as number[];
        const uniq = Array.from(new Set(durations));
        const base = uniq.length === 1 ? uniq[0] : null;
        if (base) {
          const fallback = base * Math.round(totalQty);
          if (fallback > total) return fallback;
        }
      }

      return total;
    }

    // If route services exist but we failed to map quantities (id mismatch), try a safe fallback:
    // If ALL selected services share the same duration unit/value, multiply that duration by TOTAL quantity.
    // This matches the common UX where a user increases quantity of the same service (e.g., 30 min × 3).
    if (services.length > 0) {
      const durations = services
        .map((svc: any) => durationToMinutes(svc?.duration, svc?.durationUnit))
        .filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0) as number[];
      const uniq = Array.from(new Set(durations));
      const base = uniq.length === 1 ? uniq[0] : null;
      const totalQty = (serviceQuantities && typeof serviceQuantities === 'object')
        ? Object.values(serviceQuantities).reduce((acc: number, v: any) => acc + Math.max(0, Number(v) || 0), 0)
        : 0;
      if (base && totalQty > 1) {
        return base * Math.round(totalQty);
      }
    }

    if (fromHydrated.length > 0) {
      // If we only have hydrated durations, we can't reliably apply per-service quantities.
      // Fall back to summing durations (still better than 0) and treat quantity as 1 each.
      return fromHydrated.reduce((acc: number, v: number) => acc + v, 0);
    }

    return 0;
  }, [durationToMinutes, hydratedServiceMeta, isServiceFlow, selectedCompany, selectedIssueIds, selectedIssues, serviceQuantities]);

  useEffect(() => {
    if (!__DEV__ || !isServiceFlow) return;
    const services = Array.isArray(selectedIssues) ? selectedIssues : [];
    const qtys = services.map((s: any) => ({
      id: String(s?.id ?? s?._id ?? s?.issueId ?? ''),
      quantity: s?.quantity,
      duration: s?.duration,
      durationUnit: s?.durationUnit,
    }));
    console.log('🧩 ServiceFlow duration debug', {
      selectedIssueIds,
      serviceQuantities,
      services: qtys,
      requiredDurationMinutes,
    });
  }, [isServiceFlow, requiredDurationMinutes, selectedIssueIds, selectedIssues, serviceQuantities]);

  // Choose a base atomic interval for availability validation.
  // If service duration is known to be smaller, we can validate with that granularity
  // (clamped to 15 minutes minimum).
  const atomicIntervalMinutes = useMemo(() => {
    if (!isServiceFlow) return null;
    return effectiveServiceIntervalMinutes ? clamp(effectiveServiceIntervalMinutes, 15, 120) : 30;
  }, [effectiveServiceIntervalMinutes, isServiceFlow]);

  const computeSlotsForService = (service: any): number => {
    // In ServiceCategoryScreen, quantities are keyed by `item.id`.
    const serviceId = service?.id ?? service?._id ?? service?.issueId;
    const qty = Math.max(1, Number(serviceQuantities?.[serviceId] ?? 1) || 1);
    const rawDuration = Number(service?.duration);
    const unit = normalizeDurationUnit(service?.durationUnit);

    // If duration is missing or invalid, fallback to 1 slot per quantity to preserve legacy behavior.
    if (!Number.isFinite(rawDuration) || rawDuration <= 0 || !unit) {
      return qty;
    }

    // Convert the service duration into hours.
    let hours = 0;
    switch (unit) {
      case 'minute':
      case 'minutes':
      case 'min':
        hours = rawDuration / 60;
        break;
      case 'hour':
      case 'hours':
      case 'hr':
        hours = rawDuration;
        break;
      case 'day':
      case 'days':
        hours = rawDuration * 24;
        break;
      case 'week':
      case 'weeks':
        hours = rawDuration * 7 * 24;
        break;
      case 'month':
      case 'months':
        // Month isn't really meaningful for an in-day time slot grid; interpret as 30 days.
        hours = rawDuration * 30 * 24;
        break;
    }

    const slotsNeeded = Math.ceil(hours / Math.max(0.25, singleSlotHours));
    return Math.max(1, slotsNeeded) * qty;
  };

  const requiredSlots = (() => {
    if (!isServiceFlow) return 1;

    // Prefer new duration fields when present.
    if (Array.isArray(selectedIssues) && selectedIssues.length > 0) {
      // Important: a booking has ONE chosen start time window. If multiple services are in the cart,
      // we should block enough time to satisfy the LONGEST selected service (not sum of all services),
      // otherwise requiredSlots becomes unrealistically large.
      const maxSlots = selectedIssues.reduce((acc: number, svc: any) => Math.max(acc, computeSlotsForService(svc)), 0);
      return Math.max(1, maxSlots);
    }

    // Fallback: old quantity-based behavior.
    if (!serviceQuantities || typeof serviceQuantities !== 'object') return 1;
    const sum = Object.values(serviceQuantities).reduce(
      (acc: number, v: any) => acc + (Number(v) || 0),
      0
    );
    return Math.max(1, sum);
  })();

  const getVisibleDaysForServiceFlow = useCallback(() => {
    // We show enough days so that long bookings can spill into next day(s).
    // Example: if requiredSlots is 6 and we have 4 slots/day, we need at least 2 days.
    if (!isServiceFlow) return 7;
    const days = Math.ceil(requiredSlots / Math.max(1, slotsPerDay));
    // Keep some extra buffer while still being bounded.
    return Math.min(30, Math.max(7, days + 1));
  }, [isServiceFlow, requiredSlots, slotsPerDay]);

  const toLocalISODate = useCallback((dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // In service flow, user picks ONE start slot and we auto-accumulate a contiguous block.
  const [startSlot, setStartSlot] = useState<SelectedSlot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);

  const getNextNDays = useCallback((fromDateISO: string, n: number) => {
    const res: string[] = [];
    const base = new Date(fromDateISO);
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      res.push(toLocalISODate(d));
    }
    return res;
  }, [toLocalISODate]);

  const buildSlotBlock = useCallback((start: SelectedSlot, slotsForDay: string[]): SlotBlockResult => {
    // Accumulate across the visible dates that UI exposes.
    // For service flow we may need >7 days for long durations.
    const visibleDates = getNextNDays(start.date, isServiceFlow ? getVisibleDaysForServiceFlow() : 7);
    const startIndex = slotsForDay.indexOf(start.time);
    if (startIndex < 0) {
      return { ok: false, slots: [], reason: "Start slot not found" };
    }

    const out: SelectedSlot[] = [];
    let remaining = requiredSlots;

    for (let dayIdx = 0; dayIdx < visibleDates.length && remaining > 0; dayIdx++) {
      const date = visibleDates[dayIdx];
      const begin = dayIdx === 0 ? startIndex : 0;
      for (let i = begin; i < slotsForDay.length && remaining > 0; i++) {
        // If we have availability info, skip booked slots.
        const key = `${date}|${slotsForDay[i]}`;
        const isAvailable = slotAvailability[key];
        if (slotAvailability && Object.keys(slotAvailability).length > 0 && isAvailable === false) {
          continue;
        }

        out.push({ date, time: slotsForDay[i] });
        remaining--;
      }
    }

    if (remaining > 0) {
      return {
        ok: false,
        slots: out,
        reason: "Not enough slots in the next days",
      };
    }

    return { ok: true, slots: out };
  }, [getNextNDays, getVisibleDaysForServiceFlow, isServiceFlow, requiredSlots, slotAvailability]);

  const computeAvailabilityForDate = async (dateISO: string, slotsForDay: string[]) => {
    // Monthly packages are date-based subscriptions. We shouldn't hide slots based on
    // per-worker availability checks (those checks are meant for one-off services).
    // Treat all defined time windows as selectable.
    if (isRecurringPackage) {
      return;
    }
    // Service flow => compute "any company available" (existing behavior)
    // Package flow => compute availability for the chosen company only (new behavior)
    const filterToCompanyId = isServiceFlow ? null : (typeof selectedCompanyId === 'string' ? selectedCompanyId : null);
    if (!isServiceFlow && !filterToCompanyId) {
      // No chosen company yet; don't block user with a broken availability map.
      return;
    }
    if (!dateISO || !Array.isArray(slotsForDay) || slotsForDay.length === 0) return;

    const reqId = ++availabilityReqIdRef.current;
    setLoadingAvailability(true);
    setAvailabilityError(null);
  // Mark this date as not-yet-fresh so UI won't show stale "Available" badges.
  setAvailabilityFreshByDate((prev) => ({ ...prev, [dateISO]: false }));
  setAvailabilityStatusText('Fetching providers…');

    try {
      // Step 1: determine which company IDs we should consider.
      let companyIds: string[] = [];

      if (filterToCompanyId) {
        companyIds = [filterToCompanyId];
      } else {
        // Service flow: fetch candidate companies for the selected service.
        const companies = await FirestoreService.getCompaniesByServiceIds(
          Array.isArray(selectedIssueIds) ? selectedIssueIds : [],
          categoryId
        );

        // Step 1b: keep only companies that have at least one active worker.
        // This avoids doing expensive booking checks for companies that can't ever satisfy the slot.
        const rawCompanyIds = (companies || []).map((c: any) => c.companyId || c.id).filter(Boolean);
        for (const id of rawCompanyIds) {
          try {
            const workersSnap = await firestore()
              .collection('service_workers')
              .where('companyId', '==', id)
              .where('isActive', '==', true)
              .limit(1)
              .get();
            if (!workersSnap.empty) companyIds.push(id);
          } catch {
            // If worker check fails, keep the company (better UX than hiding everything)
            companyIds.push(id);
          }
        }
      }

      if (companyIds.length === 0) {
        // No providers at all => everything booked.
        const next: Record<string, boolean> = { ...slotAvailability };
        for (const t of slotsForDay) next[`${dateISO}|${t}`] = false;
        if (availabilityReqIdRef.current === reqId) {
          setSlotAvailability(next);
          setAvailabilityFreshByDate((prev) => ({ ...prev, [dateISO]: true }));
          setAvailabilityStatusText('');
        }
        return;
      }

  // Step 2: for each slot, see if ANY company is available (service flow)
  // or whether the chosen company is available (package flow).
      // We do this with a small concurrency pool to speed it up without melting the device/Firestore.
      const next: Record<string, boolean> = { ...slotAvailability };
      // Recompute for this date every time to avoid stale cache when bookings change.
      // (Otherwise a day might remain "all booked" even after cancellations, or vice versa.)
      //
      // IMPORTANT (service-flow + dynamic duration):
      // We render `slotsForDay` as START labels (e.g. "9:00 AM") but we disable a start by checking
      // the availability of its *atomic windows* (e.g. "9:00 AM - 9:30 AM").
      // Therefore, for service flow we must compute availability for those atomic window keys.
      const dur = requiredDurationMinutes;
      const atomic = atomicIntervalMinutes ?? 30;
      const toCompute = (isServiceFlow && dur > 0)
        ? slotsForDay
            .flatMap((startLabel) => buildAtomicIntervalsForDuration(startLabel, dur, atomic))
            .map((t) => ({ t, key: `${dateISO}|${t}` }))
        : slotsForDay.map((t) => ({ t, key: `${dateISO}|${t}` }));

      if (availabilityReqIdRef.current === reqId) {
        setAvailabilityStatusText(`Checking ${toCompute.length} time slots…`);
      }

      const maxConcurrency = 3;
      let idx = 0;
      const worker = async () => {
        while (idx < toCompute.length) {
          const current = toCompute[idx++];
          let anyAvailable = false;

          // Small optimization: limit checks. If there are many companies, check first few first.
          const idsToCheck = filterToCompanyId ? companyIds : companyIds.slice(0, 12);
          for (const companyId of idsToCheck) {
            const result = await FirestoreService.checkCompanyWorkerAvailability(
              companyId,
              dateISO,
              current.t,
              Array.isArray(selectedIssueIds) ? selectedIssueIds : undefined,
              serviceTitle
            );
            if (result?.available === true) {
              anyAvailable = true;
              break;
            }
          }

          // IMPORTANT:
          // Our UI suffix logic treats `true` as "available" and `false` as "booked".
          // If we ever fail to compute (undefined) we should be conservative and block,
          // BUT here we always compute a boolean; so store it explicitly.
          next[current.key] = anyAvailable === true;
        }
      };

      await Promise.all(Array.from({ length: Math.min(maxConcurrency, toCompute.length) }, () => worker()));

      if (availabilityReqIdRef.current === reqId) {
        if (__DEV__) {
          const keysForDate = Object.keys(next).filter((k) => k.startsWith(`${dateISO}|`));
          const bookedCount = keysForDate.filter((k) => next[k] === false).length;
          const availableCount = keysForDate.filter((k) => next[k] === true).length;
          console.log(`📅 Availability map updated for ${dateISO}: available=${availableCount}, booked=${bookedCount}, total=${keysForDate.length}`);
          // Print a small sample to validate time-key formatting matches UI slot labels.
          console.log(`🧩 Sample keys for ${dateISO}:`, keysForDate.slice(0, 6));
          console.log(`🧩 Sample booked keys for ${dateISO}:`, keysForDate.filter((k) => next[k] === false).slice(0, 6));
        }
        setSlotAvailability({ ...next });
        setAvailabilityFreshByDate((prev) => ({ ...prev, [dateISO]: true }));
        setAvailabilityStatusText('');
      }
    } catch (e: any) {
      console.log('⚠️ Failed to compute slot availability:', e);
      if (availabilityReqIdRef.current === reqId) {
        setAvailabilityError('Could not load availability. Showing all slots.');
        // If we fail, leave availability empty so UI doesn't block user.
        setSlotAvailability({});
        // Consider it "fresh" so user can proceed, but they won't see misleading per-slot availability.
        setAvailabilityFreshByDate((prev) => ({ ...prev, [dateISO]: true }));
        setAvailabilityStatusText('');
      }
    } finally {
      if (availabilityReqIdRef.current === reqId) {
        setLoadingAvailability(false);
      }
    }
  };



  const computeSeriesAvailabilityForTimeSlot = async (anchorDateISO: string, slotLabel: string) => {
    if (!isRecurringPackage) return;
    if (!anchorDateISO || !slotLabel) return;

    const companyId = typeof selectedCompanyId === 'string' ? selectedCompanyId : null;
    if (!companyId) return;

  const reqId = ++seriesValidationReqRef.current;
    setLoadingSeriesAvailability(true);
    setAvailabilityError(null);

    try {
      const timeoutMs = 20000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Series availability check timed out')), timeoutMs)
      );

      const t0 = __DEV__ ? Date.now() : 0;
      const maxOccurrencesToCheck = 40;
      const pickedDates = (needsDayConfirmation && Array.isArray(confirmedPlanDates) && confirmedPlanDates.length > 0)
        ? [...confirmedPlanDates].sort()
        : null;

      const fullSelectionRequired = needsDayConfirmation
        ? ((selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly') ? 7 : 30)
        : 0;
      const hasFullDaySelection = !needsDayConfirmation
        ? true
        : (Array.isArray(confirmedPlanDates) && confirmedPlanDates.length === fullSelectionRequired);

      const occurrences = (pickedDates
        ? pickedDates.map((d) => ({ date: d, time: slotLabel }))
        : generateRecurringOccurrences(anchorDateISO, slotLabel)
      ).slice(0, maxOccurrencesToCheck);

      if (occurrences.length === 0) {
        // Don't wipe previously-known conflicts; just don't add any new ones.
        setSeriesConflicts((prev) => prev);
        // Only publish seriesAvailability once the user has full selection.
        setSeriesAvailability(hasFullDaySelection ? { [slotLabel]: false } : {});
        return;
      }

      // Performance note:
      // Previously this loop awaited each occurrence serially (up to 40)
      // which can be slow on mobile networks. We batch with limited concurrency.
      const selectedIds = Array.isArray(selectedIssueIds) ? selectedIssueIds : undefined;
      const conflicts: string[] = [];
      let ok = true;

      const maxConcurrency = 4;
      const maxConflictsToCollect = 12; // avoid huge logs/state updates; we only need enough to show red-cross markers
      let idx = 0;

      const worker = async () => {
        while (idx < occurrences.length) {
          const current = occurrences[idx++];

          // If already not ok and we've collected enough conflicts, stop doing more network calls.
          if (!ok && conflicts.length >= maxConflictsToCollect) return;

          const result = await FirestoreService.checkCompanyWorkerAvailability(
            companyId,
            current.date,
            current.time,
            selectedIds,
            serviceTitle
          );

          if (result?.available !== true) {
            ok = false;
            if (conflicts.length < maxConflictsToCollect) {
              conflicts.push(current.date);
            }
          }
        }
      };

      await Promise.race([
        Promise.all(Array.from({ length: Math.min(maxConcurrency, occurrences.length) }, () => worker())),
        timeoutPromise,
      ]);

      // Ignore stale completion.
      if (seriesValidationReqRef.current !== reqId) return;

      // Always publish conflicts so the calendar can show booked markers while picking days.
      // IMPORTANT: merge with previous so markers don't "disappear" between runs.
      setSeriesConflicts((prev) => {
        const prevForSlot = Array.isArray(prev?.[slotLabel]) ? prev[slotLabel] : [];
        const merged = Array.from(new Set([...(prevForSlot || []), ...(conflicts || [])])).sort();
        return { ...prev, [slotLabel]: merged };
      });

    // Only publish seriesAvailability for weekly/monthly once the user has selected all required days.
    setSeriesAvailability(hasFullDaySelection ? { [slotLabel]: ok } : {});

      if (__DEV__) {
        console.log('🧪 DEBUG(seriesAvailability): computed', {
          unit: selectedPackageUnit,
          occurrencesChecked: occurrences.length,
          conflictsCollected: conflicts.length,
          ok,
          hasFullDaySelection,
          ms: Date.now() - t0,
        });
      }

      // IMPORTANT: Don't mutate confirmedPlanDates here.
      // This function is triggered by a useEffect that depends on confirmedPlanDates;
      // changing them here can create a validation loop and keep the screen "stuck" in loading.
      // We keep conflicts separately (seriesConflicts) and only block Continue.
    } catch (e: any) {
      console.log('⚠️ Failed to compute series availability:', e);
      // Ignore stale completion.
      if (seriesValidationReqRef.current !== reqId) return;
      setAvailabilityError('Could not validate recurring availability. Please try again.');
      setSeriesAvailability({});
      setSeriesConflicts({});
    } finally {
      // Only clear loading if this is still the latest request.
      if (seriesValidationReqRef.current === reqId) {
        setLoadingSeriesAvailability(false);
      }
    }
  };

  // Fetch slots based on booking type
  useEffect(() => {
    const fetchSlots = async () => {
      const reqId = ++fetchSlotsReqRef.current;
      try {
        setLoadingSlots(true);
        setAvailabilityError(null);

        const timeoutMs = 15000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Fetch slots timed out')), timeoutMs)
        );
        
        console.log('🔍 SelectDateTimeScreen - Route params:', {
          isPackageBooking,
          isPackageBookingType: typeof isPackageBooking,
          isPackageBookingTruthy: !!isPackageBooking,
          selectedPackage,
          hasSelectedPackage: !!selectedPackage,
          serviceId: selectedIssueIds?.[0],
          fromServiceServices
        });
        
  // Check if this is a package booking (explicit true check)
  if (isPackageBooking === true && selectedPackage != null) {
          // For packages: fetch slots from Firestore
          console.log('📦 PACKAGE BOOKING - Fetching slots from Firestore for package:', selectedPackage);
          
          // Get the service ID from selectedIssueIds
          const serviceId = selectedIssueIds?.[0];
          
          if (serviceId) {
            console.log('📦 Querying service_services collection for serviceId:', serviceId);
            const serviceDoc = await Promise.race([
              firestore().collection('service_services').doc(serviceId).get(),
              timeoutPromise,
            ]);

            // Ignore stale request.
            if (fetchSlotsReqRef.current !== reqId) return;
            
            if (serviceDoc.exists) {
              const serviceData = serviceDoc.data();
              console.log('📦 Full service data from Firestore:', JSON.stringify(serviceData, null, 2));
              
              let packageSlots: string[] = [];
              
              // Check if service has packages array
              if (serviceData?.packages && Array.isArray(serviceData.packages)) {
                console.log('📦 Found packages array in service, searching for matching package...');
                
                // Find the selected package in the packages array
                const matchingPackage = serviceData.packages.find((pkg: any) => {
                  // Prefer strong identity if present.
                  if (selectedPackageId && pkg?.id && pkg.id === selectedPackageId) return true;
                  if (selectedPackageName && pkg?.name && pkg.name === selectedPackageName) return true;

                  // Many flows only pass a partial package snapshot (e.g. {price: 1}).
                  // Fall back to matching on unit+duration+price.
                  const unitA = String(pkg?.unit || '').toLowerCase();
                  const unitB = String((selectedPackage as any)?.unit || '').toLowerCase();
                  const durA = pkg?.duration;
                  const durB = selectedPackageDuration;
                  const priceA = pkg?.price;
                  const priceB = selectedPackagePrice;
                  if (unitA && unitB && unitA === unitB) {
                    if (durA != null && durB != null && durA === durB) {
                      if (priceA != null && priceB != null) return priceA === priceB;
                      return true;
                    }
                    if (priceA != null && priceB != null && priceA === priceB) return true;
                  }

                  return false;
                });
                
                if (matchingPackage) {
                  console.log('📦 Found matching package:', matchingPackage);
                  
                  // Check for availability.timeSlots structure (as shown in screenshot)
                  if (matchingPackage.availability?.timeSlots && Array.isArray(matchingPackage.availability.timeSlots)) {
                    console.log('📦 Found availability.timeSlots in package');
                    packageSlots = matchingPackage.availability.timeSlots.map((slot: any) => {
                      // Convert 24-hour format to 12-hour format with AM/PM
                      const formatTime = (time: string) => {
                        const [hours, minutes] = time.split(':');
                        const hour = parseInt(hours);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const hour12 = hour % 12 || 12;
                        return `${hour12}:${minutes} ${ampm}`;
                      };
                      
                      return `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
                    });
                  }
                  // Fallback: Check for direct slots array
                  else if (matchingPackage.slots && Array.isArray(matchingPackage.slots)) {
                    console.log('📦 Found direct slots array in package');
                    packageSlots = matchingPackage.slots;
                  }
                  // Fallback: Check for timeSlots array
                  else if (matchingPackage.timeSlots && Array.isArray(matchingPackage.timeSlots)) {
                    console.log('📦 Found timeSlots array in package');
                    packageSlots = matchingPackage.timeSlots;
                  }
                }
              }
              
              // If no slots found in packages array, try service-level slots
              if (packageSlots.length === 0) {
                console.log('📦 No slots in package, checking service-level slots...');
                packageSlots = serviceData?.slots || serviceData?.timeSlots || serviceData?.availableSlots || [];
              }
              
              // If still no slots, check selectedPackage object directly
              if (packageSlots.length === 0 && selectedPackage.availability?.timeSlots) {
                console.log('📦 Checking selectedPackage.availability.timeSlots from route params');
                packageSlots = selectedPackage.availability.timeSlots.map((slot: any) => {
                  const formatTime = (time: string) => {
                    const [hours, minutes] = time.split(':');
                    const hour = parseInt(hours);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour % 12 || 12;
                    return `${hour12}:${minutes} ${ampm}`;
                  };
                  return `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
                });
              }
              
              console.log('📦 Final packageSlots:', packageSlots);
              
              if (packageSlots.length > 0) {
                console.log('✅ Found slots from Firestore:', packageSlots);
                setSlots(packageSlots);
                setTime((prev) => (prev && packageSlots.includes(prev) ? prev : packageSlots[0])); // keep existing if still valid
              } else {
                console.log('⚠️ No slots found anywhere for package, using default slots as fallback');
                setSlots(defaultSlots);
                setTime((prev) => (prev && defaultSlots.includes(prev) ? prev : defaultSlots[2])); // Set middle slot as default
              }

              // For recurring packages, we don't compute per-worker slot availability here.
              // Clear any previous availability map so UI doesn't hide options.
              if (isRecurringPackage) {
                setSlotAvailability({});
              }
            } else {
              console.log('⚠️ Service document not found in Firestore, using default slots');
              setSlots(defaultSlots);
              setTime((prev) => (prev && defaultSlots.includes(prev) ? prev : defaultSlots[2]));
            }
          } else {
            console.log('⚠️ No service ID provided for package, using default slots');
            setSlots(defaultSlots);
            setTime((prev) => (prev && defaultSlots.includes(prev) ? prev : defaultSlots[2]));
          }
        } else {
          // For services: generate truly dynamic start times based on required duration.
          console.log('💰 SERVICE BOOKING (NOT PACKAGE) - Using duration-based dynamic slots');
          const dur = requiredDurationMinutes;
          const atomic = atomicIntervalMinutes ?? 30;
          // UX requirement: the next start time should equal the previous end time.
          // Availability is still validated at atomic granularity; this only controls the *displayed* start options.
          const step = dur > 0 ? dur : Math.max(15, atomic);

          // If we can't compute duration yet, fall back to legacy windows.
          const startTimes = dur > 0 ? buildStartTimesForDurationMinutes(dur, step) : [];
          const resolvedSlots = startTimes.length > 0 ? startTimes : defaultSlots;

          // Default to first start time for the day.
          const defaultTime = resolvedSlots[0] || '';

          setSlots(resolvedSlots);
          setTime((prev) => (prev && resolvedSlots.includes(prev) ? prev : defaultTime));

          // For service flow, preselect a START slot and auto-accumulate the block.
          if (isServiceFlow) {
            const start = { date: selectedDate, time: defaultTime };
            setStartSlot(start);
            // When using dynamic start times, selectedSlots is built from atomic intervals.
            // This keeps downstream validation (CompanySelection) working by validating each atomic interval.
            if (startTimes.length > 0 && dur > 0) {
              const atomicWindows = buildAtomicIntervalsForDuration(defaultTime, dur, atomic);
              // No spill: the start times list only includes starts that fully fit in-day.
              setSelectedSlots(atomicWindows.map((w) => ({ date: selectedDate, time: w })));
            } else {
              const block = buildSlotBlock(start, resolvedSlots);
              setSelectedSlots(block.slots);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error fetching slots:', error);
        if (fetchSlotsReqRef.current !== reqId) return;
        setAvailabilityError('Could not load time slots. Showing default slots.');
        // Fallback to default slots on error
        setSlots(defaultSlots);
        setTime((prev) => (prev && defaultSlots.includes(prev) ? prev : defaultSlots[2]));
      } finally {
        if (fetchSlotsReqRef.current === reqId) {
          setLoadingSlots(false);
        }
      }
    };

    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Stable primitives only. Do NOT depend on the selectedPackage object directly;
    // it changes identity often and causes repeated refetch loops.
  isPackageBooking,
  serviceIdKey,
    isServiceFlow,
    selectedDate,
    // Selected package identity fields
    selectedPackageId,
    selectedPackageName,
    selectedPackageUnit,
  selectedPackagePriceKey,
  selectedPackageDurationKey,
    // Flow toggles
    fromServiceServices,
    isRecurringPackage,
    // Service slot generation input
    effectiveServiceIntervalMinutes,
    // IMPORTANT: when hydrated duration arrives (or qty changes), we must rebuild the start-time list.
    requiredDurationMinutes,
  ]);

  // Compute availability for the selected date.
  // - Service flow: compute if any company can do the slot
  // - Package flow: compute if the chosen company can do the slot
  useEffect(() => {
    if (!selectedDate) return;
    if (!Array.isArray(slots) || slots.length === 0) return;

    // Recurring packages: no per-slot availability probing.
    if (isRecurringPackage) return;

    // In package flow, we need a chosen company to compute availability.
    if (!isServiceFlow && !selectedCompanyId) return;

    // IMPORTANT:
    // Do NOT wipe the entire availability map on every date change.
    // That erases previously-computed days and can make the UI look like "everything is booked"
    // (or "everything is available") while a new request is in-flight.
    // Instead, only mark the current date as stale and let the map act as a per-date cache.
    setAvailabilityFreshByDate((prev) => ({ ...prev, [selectedDate]: false }));
    if (__DEV__) {
      console.log('📅 computeAvailabilityForDate triggered:', {
        selectedDate,
        isServiceFlow,
        selectedCompanyId: selectedCompanyId || null,
        slotsCount: slots.length,
      });
    }
    computeAvailabilityForDate(selectedDate, slots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isServiceFlow, selectedDate, selectedCompanyId, JSON.stringify(selectedIssueIds), slots.join('|')]);

  // For recurring packages, validate the whole series (all occurrences) for the selected time window.
  // NOTE: For weekly/monthly "day confirmation" plans we still want BOOKED markers to show immediately
  // while the user is picking days. So:
  //   - We ALWAYS compute conflicts for the currently selected days.
  //   - We ONLY compute seriesAvailability[time] (ok for the *full series*) once the user picks 7/30.
  useEffect(() => {
    if (!isRecurringPackage) {
      setSeriesAvailability({});
      setSeriesConflicts({});
      return;
    }
    if (!selectedDate) return;
    if (!Array.isArray(slots) || slots.length === 0) return;
    if (typeof selectedCompanyId !== 'string' || !selectedCompanyId) return;

    // Only validate once the user has chosen a slot.
    if (typeof time !== 'string' || time.trim().length === 0) {
      setSeriesAvailability({});
      setSeriesConflicts({});
      return;
    }

    // Weekly day-confirmation plans have their own smarter prefetch + auto-pick effect below.
    // Running the generic debounced validator here can race it and overwrite state (making autopick
    // appear to "not work").
    if (
      needsDayConfirmation &&
      (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly')
    ) {
      return;
    }

    // Day-confirmation plans: debounce checks so we don't spam network while user taps dates.
    if (needsDayConfirmation) {
      const handle = setTimeout(() => {
        computeSeriesAvailabilityForTimeSlot(selectedDate, time);
      }, 450);
      return () => clearTimeout(handle);
    }

    computeSeriesAvailabilityForTimeSlot(selectedDate, time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecurringPackage, selectedDate, selectedCompanyId, time, selectedIssueIdsKey, needsDayConfirmation, confirmedPlanDatesKey, selectedPackageUnit]);

  // Weekly plan UX improvement:
  // As soon as the user picks a time slot:
  //  1) pre-check an upcoming window for that slot and mark booked days (✕)
  //  2) auto-select the nearest 7 AVAILABLE days to give the user a great default
  //     (user can still modify after)
  useEffect(() => {
    if (!needsDayConfirmation) return;
    const isWeekly = (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly');
    if (!isWeekly) return;
    if (typeof selectedCompanyId !== 'string' || !selectedCompanyId) return;
    const slotLabel = (typeof time === 'string' && time.trim().length > 0) ? time : null;
    if (!slotLabel) return;

    // Use selectedDate as anchor if present, else tomorrow.
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const minISO = addDaysISO(todayISO, 1);
    const anchor = selectedDate && selectedDate >= minISO ? selectedDate : minISO;
  // Check a reasonable future window so we can find 7 available days even if some are booked.
  const windowDays = 21;
  const windowISOs = Array.from({ length: windowDays }, (_, i) => addDaysISO(anchor, i));

    const reqId = ++seriesValidationReqRef.current;
    setLoadingSeriesAvailability(true);
    setAvailabilityError(null);

  const selectedIds = Array.isArray(selectedIssueIds) ? selectedIssueIds : undefined;

    (async () => {
      try {
        const maxConcurrency = 4;

        // Deterministic worker pool (avoids shared mutable idx/arrays races).
        const queue = [...windowISOs];
  const results: { dateISO: string; available: boolean }[] = [];

        const worker = async () => {
          while (queue.length > 0) {
            const dateISO = queue.shift();
            if (!dateISO) break;
            const result = await FirestoreService.checkCompanyWorkerAvailability(
              selectedCompanyId,
              dateISO,
              slotLabel,
              selectedIds,
              serviceTitle
            );
            results.push({ dateISO, available: result?.available === true });
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(maxConcurrency, windowISOs.length) }, () => worker())
        );

        if (seriesValidationReqRef.current !== reqId) return;

        const available = results.filter((r) => r.available).map((r) => r.dateISO);
        const conflicts = results.filter((r) => !r.available).map((r) => r.dateISO);

        // Replace (not merge) so markers are accurate for this slotLabel.
        const uniqueConflicts = Array.from(new Set(conflicts)).sort();
        setSeriesConflicts((prev) => ({ ...prev, [slotLabel]: uniqueConflicts }));

  // Auto-pick nearest available days.
  // IMPORTANT: never auto-select booked/conflict days.
  // Defensive: even if the backend returns inconsistent availability flags,
  // always exclude anything we consider a conflict for this slot.
  const availableNotConflicted = available.filter((d) => !uniqueConflicts.includes(d));
  const picked = availableNotConflicted.slice(0, 7).sort();

        if (__DEV__) {
          console.log('🗓️ Weekly autopick results', {
            slotLabel,
            anchor,
            windowDays,
            checked: results.length,
            availableCount: available.length,
            conflictCount: conflicts.length,
            availableNotConflictedCount: availableNotConflicted.length,
            picked,
          });
        }

        setConfirmedPlanDates((prev) => {
          // If user already has 7 picked, don't override.
          if (Array.isArray(prev) && prev.length >= 7) return prev;

          // If we found at least 1 available day, always replace the placeholder seed.
          // If fewer than 7 are available in the window, pick as many as we can.
          if (picked.length > 0) return picked;

          // If nothing is available, NEVER keep conflict days selected by default.
          // Purge any known conflicts for this slot.
          const safePrev = Array.isArray(prev)
            ? prev.filter((d) => !uniqueConflicts.includes(d))
            : [];
          return safePrev;
        });

        // Only set seriesAvailability when we have 7 picked days.
        setSeriesAvailability(picked.length === 7 ? { [slotLabel]: true } : {});
      } catch (e: any) {
        if (seriesValidationReqRef.current !== reqId) return;
        console.log('⚠️ Weekly seeding availability check failed:', e);
        setAvailabilityError('Could not validate weekly availability. Please try again.');
      } finally {
        if (seriesValidationReqRef.current === reqId) {
          setLoadingSeriesAvailability(false);
        }
      }
    })();
  }, [needsDayConfirmation, selectedPackageUnit, selectedCompanyId, time, selectedDate, selectedIssueIds, serviceTitle]);

  // IMPORTANT UX:
  // For weekly/monthly "day confirmation" plans we should NEVER mutate the user's selection
  // based on verification results. Doing so makes it feel like the app "marks their choice as booked".
  // Instead:
  //  - keep confirmedPlanDates exactly as the user tapped
  //  - render conflicts as ✕ markers (booked/disabled for NEW taps)
  //  - block Continue until the user has selected the required count with no conflicts

  const getNext7Days = () => {
    const days = [];
    const today = new Date();

    // Start from tomorrow (i = 1) instead of today (i = 0)
    for (let i = 1; i < 8; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      days.push({
        // IMPORTANT: use local YYYY-MM-DD (not UTC) to avoid selecting the wrong day
        // in timezones where toISOString() crosses a date boundary.
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        label: {
          day: d.toLocaleDateString("en-US", { weekday: "short" }), // Mon, Tue
          date: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }), // 22 Jan
        },
        full: d.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      });
    }

    return days;
  };

  const dates = getNext7Days();

  // Day-unit packages should only use the calendar picker.
  // The horizontal "Select Date" row is a legacy single-booking UX and becomes a duplicate prompt.
  const isDayUnitPackage = !isServiceFlow && !isRecurringPackage && (selectedPackageUnit === 'day' || selectedPackageUnit === 'daily');

  // Day-unit package: ensure we always have a computed availability map for the currently selected day.
  // The 7-day prefetch runs async and can be interrupted; without this, slots can remain stuck as "Verifying".
  useEffect(() => {
    if (!isDayUnitPackage) return;
    if (!selectedDate) return;
    if (!Array.isArray(slots) || slots.length === 0) return;
    if (typeof selectedCompanyId !== 'string' || !selectedCompanyId) return;

    const hasAnyKeyForDate = !!(
      slotAvailability &&
      Object.keys(slotAvailability).some((k) => k.startsWith(`${selectedDate}|`))
    );

    if (hasAnyKeyForDate) return;

    if (__DEV__) {
      console.log('📌 Day-unit: forcing availability compute for selectedDate', {
        selectedDate,
        slotsCount: slots.length,
      });
    }

    computeAvailabilityForDate(selectedDate, slots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDayUnitPackage, selectedCompanyId, selectedDate, slots.join('|')]);



  // Day-unit packages: show availability in the *existing* calendar (no extra "Pick your day" section).
  // We prefetch the next 7 days so the calendar can mark fully-booked days.
  const dayUnitWindowISOs = useMemo(() => {
    if (!isDayUnitPackage) return [] as string[];
    return dates.map((d) => d.key);
  }, [dates, isDayUnitPackage]);

  // Day-unit packages should never keep a selectedDate outside the next-7-days window.
  // If it happens (e.g., stale state coming in as 2026-02-17), snap to the first day in the window immediately.
  // This prevents the slots list from showing perpetual "Verifying" for a date we aren't prefetching.
  useEffect(() => {
    if (!isDayUnitPackage) return;
    if (!Array.isArray(dayUnitWindowISOs) || dayUnitWindowISOs.length === 0) return;
    if (!selectedDate) return;
    if (dayUnitWindowISOs.includes(selectedDate)) return;
    setSelectedDate(dayUnitWindowISOs[0]);
  }, [isDayUnitPackage, dayUnitWindowISOs, selectedDate]);

  const getDaySlotKeys = useCallback((iso: string) => {
    if (!iso || !Array.isArray(slots) || slots.length === 0) return [] as string[];
    return slots.map((s) => `${iso}|${s}`);
  }, [slots]);

  const isDayComputed = useCallback((iso: string) => {
    const keys = getDaySlotKeys(iso);
    return keys.some((k) => slotAvailability && Object.prototype.hasOwnProperty.call(slotAvailability, k));
  }, [getDaySlotKeys, slotAvailability]);

  const dayHasAnyAvailability = useCallback((iso: string) => {
    const keys = getDaySlotKeys(iso);
    const hasAnyKey = keys.some((k) => slotAvailability && Object.prototype.hasOwnProperty.call(slotAvailability, k));
    if (!hasAnyKey) return false;
    return keys.some((k) => (slotAvailability as any)?.[k] === true);
  }, [getDaySlotKeys, slotAvailability]);

  const isDayFullyBooked = useCallback((iso: string) => {
    const keys = getDaySlotKeys(iso);
    const hasAnyKey = keys.some((k) => slotAvailability && Object.prototype.hasOwnProperty.call(slotAvailability, k));
    if (!hasAnyKey) return false; // unknown
    return keys.every((k) => (slotAvailability as any)?.[k] === false);
  }, [getDaySlotKeys, slotAvailability]);

  useEffect(() => {
    if (!isDayUnitPackage) return;
    if (!Array.isArray(slots) || slots.length === 0) return;
    if (!selectedCompanyId) return;

    let cancelled = false;
    const run = async () => {
      // Prefetch next-7-day availability in parallel (bounded) so the UI doesn't stay
      // in "Verifying" for too long on slower networks/devices.
      const pending = dayUnitWindowISOs.filter((iso) => !isDayComputed(iso));
      if (pending.length === 0) return;

      const CONCURRENCY = 3;
      let idx = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
        while (!cancelled && idx < pending.length) {
          const iso = pending[idx++];
          try {
            await computeAvailabilityForDate(iso, slots);
          } catch (e) {
            // Availability failures should not break the rest of the prefetch.
            if (__DEV__) console.log('⚠️ Day-unit prefetch failed', { iso, e });
          }
        }
      });

      await Promise.all(workers);
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDayUnitPackage, selectedCompanyId, slots.join('|'), dayUnitWindowISOs.join('|')]);

  // On entry, auto-select the earliest available day inside the next-7-day window.
  // If we can't determine availability yet, fall back to the first day in the window.
  useEffect(() => {
    if (!isDayUnitPackage) return;
    if (!Array.isArray(dayUnitWindowISOs) || dayUnitWindowISOs.length === 0) return;
    const inWindow = dayUnitWindowISOs.includes(selectedDate);
    if (inWindow) return;

    const firstAvailable = dayUnitWindowISOs.find((iso) => dayHasAnyAvailability(iso));
    if (firstAvailable) setSelectedDate(firstAvailable);
    else setSelectedDate(dayUnitWindowISOs[0]);
  }, [dayHasAnyAvailability, dayUnitWindowISOs, isDayUnitPackage, selectedDate]);

  const isPlanCalendarPicker = !isServiceFlow && isRecurringPackage;
  const isWeeklyPlan = !isServiceFlow && isRecurringPackage && (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly');
  const isMonthlyPlan = !isServiceFlow && isRecurringPackage && (selectedPackageUnit === 'month' || selectedPackageUnit === 'monthly');
  const planSelectionLimit = isMonthlyPlan ? 30 : (isWeeklyPlan ? 7 : 0);

  // Monthly plans: if within [tomorrow, tomorrow+60 days] there are fewer than 30 available days for the chosen time slot,
  // tell the user to change the time slot. (Computed, no setState in render.)
  const monthlyNotEnoughDaysMessage = useMemo(() => {
    if (!needsDayConfirmation) return null;
    if (!isMonthlyPlan) return null;
    if (planSelectionLimit !== 30) return null;
    if (typeof time !== 'string' || time.trim().length === 0) return null;

    const slotLabel = time;
    const conflictsForSlot = Array.isArray(seriesConflicts?.[slotLabel]) ? seriesConflicts[slotLabel] : [];

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 61);

    // Count all days in this 60-day window that are not conflicted.
    let availableCount = 0;
    const cur = new Date(start);
    let guard = 0;
    while (cur.getTime() <= end.getTime() && guard < 70) {
      // IMPORTANT: use local YYYY-MM-DD (not UTC) to avoid off-by-one day issues.
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      if (!conflictsForSlot.includes(iso)) availableCount += 1;
      if (availableCount >= 30) break;
      cur.setDate(cur.getDate() + 1);
      guard += 1;
    }

    return availableCount < 30
      ? 'Please choose a different time slot — this slot doesn’t have 30 available days in the next 60 days.'
      : null;
  }, [isMonthlyPlan, needsDayConfirmation, planSelectionLimit, seriesConflicts, time]);

  const planSeededRef = useRef(false);
  useEffect(() => {
    // Reset seeding when switching between weekly/monthly modes.
    planSeededRef.current = false;
  }, [needsDayConfirmation, selectedPackageUnit]);

  // For plan/package flows, as soon as the user picks a start date we want a time window selected
  // so the full plan window is highlighted immediately on the calendar.
  useEffect(() => {
    if (!isRecurringPackage) return;
    if (!selectedDate) return;
    if (typeof time === 'string' && time.trim().length > 0) return;
    if (!Array.isArray(slots) || slots.length === 0) return;
    setTime(String(slots[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecurringPackage, selectedDate, slots.join('|')]);

  // When the user changes the selected time slot, clear previously merged conflicts
  // so we don't render stale booked markers from a different slot.
  const lastTimeRef = useRef<string>('');
  useEffect(() => {
    if (!needsDayConfirmation) return;
    const t = typeof time === 'string' ? time : '';
    if (!t || t.trim().length === 0) return;
    if (lastTimeRef.current && lastTimeRef.current !== t) {
      setSeriesAvailability({});
      setSeriesConflicts({});
    }
    lastTimeRef.current = t;
  }, [needsDayConfirmation, time]);

  // When entering day-confirmation mode, ensure we have a sane anchor date.
  // IMPORTANT: Do NOT seed a fixed 7/30-day window here.
  // Weekly plans should be auto-picked using real availability (see weekly autopick effect).
  // Monthly plans rely on user selection + conflict markers.
  useEffect(() => {
    if (!needsDayConfirmation) {
      setConfirmedPlanDates([]);
      planSeededRef.current = false;
      return;
    }

    // Only do minimal initialization once per mode entry.
    if (planSeededRef.current) return;

    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const fallbackStartISO = addDaysISO(todayISO, 1);

    // If selectedDate isn't set, fall back to tomorrow.
    setSelectedDate((prev) => {
      if (typeof prev === 'string' && prev.trim().length > 0) return prev;
      return fallbackStartISO;
    });

    // IMPORTANT:
    // Don't preselect a day here. Tomorrow can be booked for the chosen slot, and we don't want the
    // system to ever select booked days by default.
    // Weekly autopick will select the best available days once the user picks a slot/time.
    setConfirmedPlanDates((prev) => (Array.isArray(prev) ? prev : []));

    planSeededRef.current = true;
  }, [needsDayConfirmation, selectedPackageUnit]);

  const onPickSlot = (date: string, slot: string) => {
    if (!isServiceFlow) {
      // package/single-slot flow
      setSelectedDate(date);
      setTime(slot);
      return;
    }

    // Defensive guard: even if the UI accidentally allows a press, never allow selecting a booked slot.
    if (isSlotBooked(date, slot)) {
      if (__DEV__) {
        console.log('🚫 Ignoring pick of booked slot', { date, slot });
      }
      return;
    }

    // Service-flow dynamic slots:
    // `slot` is a start time label like "9:00 AM".
    // We convert it into atomic windows and validate the full block.
    const dur = requiredDurationMinutes;
    const atomic = atomicIntervalMinutes ?? 30;

    setSelectedDate(date);
    setTime(slot);
    setStartSlot({ date, time: slot });

    if (!dur || dur <= 0) {
      // Fallback to legacy behavior if duration isn't ready.
      const start = { date, time: slot };
      const block = buildSlotBlock(start, slots);
      setSelectedSlots(block.slots);
      setBlockError(block.ok ? null : "Not enough continuous availability from this start time. Please pick another start slot or choose a different date.");
      return;
    }

    const atomicWindows = buildAtomicIntervalsForDuration(slot, dur, atomic);
    if (!atomicWindows || atomicWindows.length === 0) {
      setSelectedSlots([]);
      setBlockError('Could not build time block for this duration.');
      return;
    }

    if (__DEV__) {
      console.log('🕒 pick start slot => atomic block', {
        date,
        start: slot,
        dur,
        atomic,
        atomicCount: atomicWindows.length,
        first: atomicWindows[0],
        last: atomicWindows[atomicWindows.length - 1],
      });
    }

    // No spill: we only generate start times that fit in-day.
    // So the full block must be within the same day.
    const blockSlots = atomicWindows.map((w) => ({ date, time: w }));
    setSelectedSlots(blockSlots);
    setBlockError(null);
  };

  // If the selected date changes, clear any previous block error.
  useEffect(() => {
    setBlockError(null);
  }, [selectedDate]);

  // If the required duration changes (e.g., user changes quantity), rebuild the selected atomic block
  // for the currently chosen start time so UI + Continue stay consistent.
  useEffect(() => {
    if (!isServiceFlow) return;
    if (!startSlot?.date || !startSlot?.time) return;
    const dur = requiredDurationMinutes;
    const atomic = atomicIntervalMinutes ?? 30;
    if (!dur || dur <= 0) return;
    const atomicWindows = buildAtomicIntervalsForDuration(startSlot.time, dur, atomic);
    if (!atomicWindows || atomicWindows.length === 0) return;
    setSelectedSlots(atomicWindows.map((w) => ({ date: startSlot.date, time: w })));
  }, [atomicIntervalMinutes, buildAtomicIntervalsForDuration, isServiceFlow, requiredDurationMinutes, startSlot?.date, startSlot?.time]);

  const isSlotSelected = (date: string, slot: string) => {
    if (!isServiceFlow) return time === slot;
    // In service flow (dynamic duration), show selection on the chosen START time.
    // (The full atomic block is tracked in selectedSlots, but it isn't rendered as individual chips.)
    return startSlot?.date === date && startSlot?.time === slot;
  };

  const isSlotBooked = (date: string, slot: string) => {
    if (!isServiceFlow) return false;
    // In service-flow (dynamic duration), `slot` is a START label like "9:00 AM".
    // A start time is only usable if *all* atomic windows in its duration block are available.
    const dur = requiredDurationMinutes;
    const atomic = atomicIntervalMinutes ?? 30;
    // If we're still verifying, don't claim a slot is available.
    // Treat as "booked/disabled" to prevent wrong "slots available" messaging and premature continuation.
    if (loadingAvailability) return true;
    // If we haven't completed verification for this date yet, keep slots disabled.
    if (availabilityFreshByDate?.[date] !== true) return true;
    if (!slotAvailability || Object.keys(slotAvailability).length === 0) return false;

    if (!dur || dur <= 0) {
      // Legacy fallback: treat the provided label as a single slot key.
      return slotAvailability[`${date}|${slot}`] === false;
    }

    const atomicWindows = buildAtomicIntervalsForDuration(slot, dur, atomic);
    if (!atomicWindows || atomicWindows.length === 0) return true;

    // Unknown/uncomputed should be treated as unavailable (conservative) to avoid false positives.
    return atomicWindows.some((w) => slotAvailability[`${date}|${w}`] !== true);
  };

  const isAvailabilityFreshForSelectedDate = !isServiceFlow
    ? true
    : (availabilityFreshByDate?.[selectedDate] === true);
  const canInteractWithSlots = !isServiceFlow || (!loadingAvailability && !loadingSlots && isAvailabilityFreshForSelectedDate);
  const canContinue = (() => {
    if (loadingSlots) return false;
    if (isServiceFlow && loadingAvailability) return false;
    if (!isServiceFlow && isRecurringPackage && loadingSeriesAvailability) return false;
    if (isServiceFlow) {
      if (!!blockError) return false;
      // If the chosen START slot is booked (or verification isn't fresh), block Continue.
      if (startSlot?.date && startSlot?.time && isSlotBooked(startSlot.date, startSlot.time)) return false;
      // For dynamic duration slots, selection should represent the full atomic block for the duration.
      if (requiredDurationMinutes > 0) {
        const atomic = atomicIntervalMinutes ?? 30;
        const expected = Math.ceil(requiredDurationMinutes / Math.max(1, atomic));
        if (selectedSlots.length !== expected) return false;
      } else {
        // Fallback to legacy count-based blocking when duration isn't known.
        if (selectedSlots.length !== requiredSlots) return false;
      }
    }
    // For one-off services, block Continue until the current date's availability verification has completed.
    if (isServiceFlow && availabilityFreshByDate?.[selectedDate] !== true) return false;

    // Recurring packages (daily/weekly/monthly): require selecting a time window
    // and ensure we can generate at least 1 occurrence (Sundays are off).
    if (isRecurringPackage) {
      if (typeof time !== 'string' || time.trim().length === 0) return false;

      // Weekly/monthly: must pick the exact number of days.
      if (needsDayConfirmation) {
        const requiredDays = (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly') ? 7 : 30;
        if (!Array.isArray(confirmedPlanDates) || confirmedPlanDates.length !== requiredDays) return false;
      }

      const occ = needsDayConfirmation
        ? confirmedPlanDates.map((d) => ({ date: d, time }))
        : generateRecurringOccurrences(selectedDate, time);
      if (!occ || occ.length === 0) return false;

      // If we have a computed series map, require the chosen slot to be valid for the whole series.
      if (seriesAvailability && Object.keys(seriesAvailability).length > 0) {
        if (seriesAvailability[time] === false) return false;
      }

      return true;
    }

    return true;
  })();

  // Package/day flow guard:
  // We must not allow Continue until the selected slot's availability is computed for the selected day,
  // and we must block if the chosen slot is booked.
  const packageSlotKey = !isServiceFlow && !isRecurringPackage && selectedDate && time
    ? `${selectedDate}|${time}`
    : null;

  const packageSlotHasComputed = !!(
    packageSlotKey && slotAvailability && Object.prototype.hasOwnProperty.call(slotAvailability, packageSlotKey)
  );

  const packageSlotIsBooked = !!(packageSlotKey && packageSlotHasComputed && slotAvailability[packageSlotKey] === false);

  const packageSlotIsUnknown = !!(!isServiceFlow && !isRecurringPackage && (!time || !packageSlotHasComputed));

  const canContinueFinal = canContinue && !packageSlotIsUnknown && !packageSlotIsBooked;

  useEffect(() => {
    if (!__DEV__) return;
    const conflictsForSlot = (typeof time === 'string' && time.trim().length > 0)
      ? (seriesConflicts?.[time] || [])
      : [];
    console.log('🧪 DEBUG(canContinue)', {
      needsDayConfirmation,
      selectedPackageUnit,
      selectedDate,
      time,
      confirmedPlanDatesCount: confirmedPlanDates?.length,
      planSelectionLimit,
      conflictsForSlotCount: conflictsForSlot.length,
      seriesAvailabilityForSlot: seriesAvailability?.[time],
      canContinue,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canContinue]);

  const continueLabel = (() => {
    if (loadingSlots) return 'Loading slots…';
    if (isServiceFlow && loadingAvailability) return 'Checking availability…';
    if (isServiceFlow && availabilityFreshByDate?.[selectedDate] !== true) return 'Verifying availability…';
    if (isRecurringPackage && loadingSeriesAvailability) return 'Validating recurring availability…';
    if (isServiceFlow && !startSlot) return 'Select a start time';
    if (isServiceFlow && selectedSlots.length !== requiredSlots) return 'Select a start time';
    if (isServiceFlow && !!blockError) return 'Choose another time';
    if (isRecurringPackage && (!time || String(time).trim().length === 0)) return 'Pick a time';
    return 'Continue';
  })();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Date & Time</Text>

        <TouchableOpacity
          onPress={() => {
            try {
              navigation.navigate("HomeTab");
            } catch (e) {
              console.log("[SelectDateTime] Failed to navigate HomeTab", e);
            }
          }}
          style={styles.headerHomeBtn}
        >
          <Ionicons name="home-outline" size={20} color="#111" />
        </TouchableOpacity>
      </View>

      {/* Blocking modal when verifying availability */}
      <Modal transparent visible={isVerifyingAvailability} animationType="fade">
        <View style={styles.blockingModalOverlay}>
          <View style={styles.blockingModalCard}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.blockingModalTitle}>Verifying availability</Text>
            <Text style={styles.blockingModalSub}>Please wait…</Text>
          </View>
        </View>
      </Modal>

      {loadingSlots ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading available slots...</Text>
        </View>
      ) : (
        <>
          {/* Main Content: Date & Time Selection */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={[styles.slotsContent, { paddingBottom: 24 + 96 }]}
        >
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTitle}>Your schedule</Text>
                {isServiceFlow ? (
                  <Text style={styles.summaryPill}>Needs {requiredSlots} slot{requiredSlots > 1 ? 's' : ''}</Text>
                ) : isRecurringPackage ? (
                  <Text style={styles.summaryPill}>{isMonthlyPackage ? 'Monthly plan' : 'Plan'}</Text>
                ) : (
                  <Text style={styles.summaryPill}>1 slot</Text>
                )}
              </View>

              <Text style={styles.summarySub}>
                {isServiceFlow ? (
                  startSlot ? (
                    <>Start: <Text style={styles.summaryStrong}>{startSlot.date}</Text> • <Text style={styles.summaryStrong}>{startSlot.time}</Text></>
                  ) : (
                    <>Pick a start time to reserve a continuous block.</>
                  )
                ) : isRecurringPackage ? (
                  (() => {
                    const chosenSlot = (typeof time === 'string' && time.trim().length > 0)
                      ? time
                      : (Array.isArray(slots) && slots.length > 0 ? String(slots[0]) : '');
                    const preview = (selectedDate && chosenSlot) ? generateRecurringOccurrences(selectedDate, chosenSlot) : [];
                    const n = preview.length;
                    return (
                      <>
                        Pick a <Text style={styles.summaryStrong}>start date</Text> and a <Text style={styles.summaryStrong}>time window</Text>.
                        {isMonthlyPackage ? (
                          <>This monthly plan includes <Text style={styles.summaryStrong}>{n}</Text> visit{n === 1 ? '' : 's'} in this month.</>
                        ) : (
                          <>We’ll schedule <Text style={styles.summaryStrong}>{n}</Text> visit{n === 1 ? '' : 's'} automatically.</>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <>Pick one time slot for your package booking.</>
                )}
              </Text>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.legendText}>Selected</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 }]} />
                  <Text style={styles.legendText}>Available</Text>
                </View>
                {isServiceFlow && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#f1f5f9' }]} />
                    <Text style={styles.legendText}>Booked</Text>
                  </View>
                )}
              </View>

              {!!blockError && (
                <View style={styles.inlineAlert}>
                  <Text style={styles.inlineAlertText}>{blockError}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Plan calendar (single selector for weekly/monthly plans and day-unit packages) */}
          {!isServiceFlow && (needsDayConfirmation || isDailyPackage || isDayUnitPackage) && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTitle}>
                  {(isDailyPackage || isDayUnitPackage) ? 'Pick your day' : (isMonthlyPlan ? 'Monthly plan days' : 'Weekly plan days')}
                </Text>
                <Text style={styles.summaryPill}>
                  {(isDailyPackage || isDayUnitPackage)
                    ? `${confirmedPlanDates.length}/1`
                    : `${confirmedPlanDates.length}/${planSelectionLimit}`}
                </Text>
              </View>

              <Text style={styles.summarySub}>
                {(isDailyPackage || isDayUnitPackage)
                  ? 'Pick 1 day within the next 7 days. Tap again to remove.'
                  : 'Pick days from tomorrow onward. Tap again to remove a day.'}
              </Text>

              {(() => {
                const slotLabel = (typeof time === 'string' && time.trim().length > 0) ? time : null;
                const conflictsForSlot = slotLabel ? (seriesConflicts?.[slotLabel] || []) : [];
                const fullSeriesOk = slotLabel ? seriesAvailability?.[slotLabel] : undefined;

                let msg: string | null = null;

                // Priority order:
                // 1) direct user tap error
                // 2) slot full for full selection
                // 3) conflicts exist
                // 4) needs more days
                if (planPickError) msg = planPickError;
                else if (monthlyNotEnoughDaysMessage) msg = monthlyNotEnoughDaysMessage;
                else if (slotLabel && fullSeriesOk === false) msg = 'This time slot is currently full. Try selecting a different time slot.';
                else if (slotLabel && conflictsForSlot.length > 0) {
                  msg = 'Some selected dates are already booked for this time. Please remove the crossed dates and pick different days, or choose a different time slot.';
                } else if ((isDailyPackage || isDayUnitPackage) && confirmedPlanDates.length < 1) {
                  msg = 'This is a daily package — please select 1 day within the next 7 days.';
                } else if (!isDailyPackage && !!planSelectionLimit && confirmedPlanDates.length < planSelectionLimit) {
                  msg = isMonthlyPlan
                    ? `This is a monthly plan — please select ${planSelectionLimit} days.`
                    : `This is a weekly plan — please select ${planSelectionLimit} days.`;
                }

                if (!msg) return null;
                const danger = !!planPickError || fullSeriesOk === false || conflictsForSlot.length > 0;
                return (
                  <View style={danger ? styles.inlineAlertDanger : styles.inlineAlert}>
                    <Text style={danger ? styles.inlineAlertDangerText : styles.inlineAlertText}>{msg}</Text>
                  </View>
                );
              })()}

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.legendText}>Selected</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 }]} />
                  <Text style={styles.legendText}>Available</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#fee2e2' }]} />
                  <Text style={styles.legendText}>Booked</Text>
                </View>
              </View>

              {/** (Deduped) selection/conflict/full-slot banners are handled by the dynamic banner above */}

              {(() => {
                // IMPORTANT: use local YYYY-MM-DD (not UTC) to avoid off-by-one day issues.
                const today = new Date();
                const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const minISO = addDaysISO(todayISO, 1);
                const maxISO = (isDailyPackage || isDayUnitPackage) ? addDaysISO(minISO, 6) : addDaysISO(minISO, 60);

                // Only show the next month when the window crosses into it.
                const minMonthKey = getMonthKey(minISO);
                const maxMonthKey = getMonthKey(maxISO);
                // Ensure the 2nd calendar is the *immediate next month* (not a skipped month).
                // Example: if window spans Feb..Apr, we still render Feb + Mar (enough for the boundary).
                const monthKeys = minMonthKey === maxMonthKey ? [minMonthKey] : [minMonthKey, addMonthsKey(minMonthKey, 1)];

                const monthGrids = monthKeys.map((mk) => ({ monthKey: mk, cells: buildMonthGrid(mk) }));

                const slotLabelForCalendar = (typeof time === 'string' && time.trim().length > 0) ? time : null;
                const conflictsForSlot = slotLabelForCalendar
                  ? (seriesConflicts?.[slotLabelForCalendar] || [])
                  : [];

                // (Removed) local insufficient-days banner logic.
                // We now compute the monthly “not enough days in next 60 days” warning via monthlyNotEnoughDaysMessage.

                const toggleDate = (iso: string) => {
                  setPlanPickError(null);

                  // Day-unit packages are single-day bookings. Treat calendar tap as the active selectedDate.
                  if (isDayUnitPackage) {
                    setSelectedDate(iso);
                    setConfirmedPlanDates([iso]);
                    return;
                  }

                  setConfirmedPlanDates((prev) => {
                    const next = [...prev];
                    const exists = next.includes(iso);
                    if (exists) {
                      return next.filter((x) => x !== iso).sort();
                    }
                    const limit = isDailyPackage ? 1 : planSelectionLimit;
                    if (limit > 0 && next.length >= limit) {
                      return next;
                    }
                    next.push(iso);
                    // For daily package, keep exactly one selected date
                    if (isDailyPackage) return [iso];
                    return next.sort();
                  });
                };

                const renderMonth = (monthKey: string, cells: { iso: string | null; dayNumber: number | null; isSunday: boolean }[], prefix: string) => (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.calendarMonthTitle}>{monthKey}</Text>
                    <View style={styles.calendarHeaderRow}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <React.Fragment key={`${prefix}-dow-${d}-${i}`}>
                          <Text style={styles.calendarDowText}>{d}</Text>
                        </React.Fragment>
                      ))}
                    </View>
                    <View style={styles.calendarGrid}>
                      {cells.map((c, idx) => {
                        if (!c.iso || !c.dayNumber) {
                          return (
                            <React.Fragment key={`${prefix}-blank-${idx}`}>
                              <View style={styles.calendarCell} />
                            </React.Fragment>
                          );
                        }

                        const selected = isDayUnitPackage
                          ? (selectedDate === c.iso)
                          : confirmedPlanDates.includes(c.iso);
                        const tooEarly = c.iso < minISO;
                        const tooLate = c.iso > maxISO;
                        const isConflict = !!slotLabelForCalendar && conflictsForSlot.includes(c.iso);

                        // Day-unit packages: use per-slot availability to mark a day fully booked.
                        // Weekly/monthly recurring plans: conflicts ARE booked dates for the selected slot.
                        // For day-unit packages, treat "unknown" (not yet computed) days as booked/unavailable.
                        // This matches the stricter UX expectation: until we verify capacity, don't allow booking.
                        const dayUnitUnknown = isDayUnitPackage ? !isDayComputed(c.iso) : false;
                        const isBooked = isDayUnitPackage
                          ? (dayUnitUnknown || isDayFullyBooked(c.iso))
                          : (isConflict && !selected);

                        const localLimit = (isDailyPackage || isDayUnitPackage) ? 1 : planSelectionLimit;
                        const atLimit = !selected && localLimit > 0 && confirmedPlanDates.length >= localLimit;
                        // UX:
                        // - Weekly/monthly plans: show booked (✕) days based on conflictsForSlot and do NOT allow selecting them.
                        //   This prevents the frustrating flow where the user selects first and then gets told to deselect.
                        // - Day-unit packages: keep strict booked behavior based on per-slot availability.
                        // Weekly/monthly UX:
                        // - Always allow tapping an already-selected date so user can deselect.
                        // - Only block selecting NEW dates that we *know* are booked for the chosen time slot.
                        // - Before a time slot is chosen, don't disable days due to conflicts.
                        const disabled = isDayUnitPackage
                          ? (tooEarly || tooLate || (atLimit && !selected) || isBooked)
                          : (tooEarly || tooLate || (atLimit && !selected) || (!selected && isConflict));

                        return (
                          <TouchableOpacity
                            key={`${prefix}-${c.iso}`}
                            style={[
                              styles.calendarCell,
                              selected && styles.calendarCellSelected,
                              disabled && styles.calendarCellDisabled,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => {
                              if (tooEarly) return;
                              if (tooLate) return;
                              if (atLimit) return;

                              // Weekly/monthly: conflict means slot capacity reached for this time slot.
                              // Don't allow selecting NEW dates that are booked.
                              if (!isDayUnitPackage && !selected && isConflict) {
                                setPlanPickError(
                                  'This day is already booked for the selected time. Please choose another day, or select a different time slot.'
                                );
                                return;
                              }

                              // Day-unit packages: hard block selecting a fully booked day.
                              if (isDayUnitPackage && isBooked) {
                                setPlanPickError(
                                  'This day is already booked for the selected time. Please choose another day.'
                                );
                                return;
                              }

                              toggleDate(c.iso as string);
                            }}
                          >
                            <Text
                              style={[
                                styles.calendarCellText,
                                selected && styles.calendarCellTextSelected,
                                disabled && styles.calendarCellTextDisabled,
                              ]}
                            >
                              {c.dayNumber}
                            </Text>

                            {((isDayUnitPackage && isBooked) || isConflict) && (
                              <View style={styles.calendarConflictOverlay} pointerEvents="none">
                                <Text style={styles.calendarConflictText}>✕</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );

                return (
                  <View>
                    {monthGrids.map((m, idx) => (
                      <React.Fragment key={`month-${m.monthKey}-${idx}`}>
                        {renderMonth(m.monthKey, m.cells, `m${idx + 1}`)}
                      </React.Fragment>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Plan start-date preview calendar (recurring plan ranges). */}
          {isPlanCalendarPicker && !needsDayConfirmation && !isDailyPackage && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTitle}>Pick a start date</Text>
                <Text style={styles.summaryPill}>Calendar</Text>
              </View>

              <Text style={styles.summarySub}>
                Tap a date to start your plan. We’ll highlight the full schedule automatically.
              </Text>

              {(() => {
                // IMPORTANT: use local YYYY-MM-DD (not UTC) to avoid off-by-one day issues.
                const today = new Date();
                const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const minISO = addDaysISO(todayISO, 1);
                const monthKey = getMonthKey(selectedDate || minISO);
                const cells = buildMonthGrid(monthKey);

                const onPickStartDate = (iso: string) => {
                  if (iso < minISO) return;
                  setSelectedDate(iso);
                };

                const chosenSlot = (typeof time === 'string' && time.trim().length > 0)
                  ? time
                  : (Array.isArray(slots) && slots.length > 0 ? String(slots[0]) : '');

                const previewDates = (() => {
                  if (!selectedDate || !chosenSlot) return [] as string[];
                  return generateRecurringOccurrences(selectedDate, chosenSlot).map((x) => x.date);
                })();

                return (
                  <View style={{ marginTop: 10 }}>
                    <View style={styles.calendarHeaderRow}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <React.Fragment key={`${d}-${i}`}>
                          <Text style={styles.calendarDowText}>{d}</Text>
                        </React.Fragment>
                      ))}
                    </View>

                    <View style={styles.calendarGrid}>
                      {cells.map((c, idx) => {
                        if (!c.iso || !c.dayNumber) {
                          return (
                            <React.Fragment key={`blank-start-${idx}`}>
                              <View style={styles.calendarCell} />
                            </React.Fragment>
                          );
                        }

                        const isStart = selectedDate === c.iso;
                        const inPlan = previewDates.includes(c.iso);
                        const isBooked = chosenSlot ? isDayBookedForTimeSlot(c.iso, chosenSlot) : false;
                        const disabled = c.iso < minISO || isBooked;

                        return (
                          <TouchableOpacity
                            key={`start-${c.iso}`}
                            style={[
                              styles.calendarCell,
                              inPlan && styles.calendarCellSelected,
                              isStart && styles.calendarCellStart,
                              disabled && styles.calendarCellDisabled,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => onPickStartDate(c.iso as string)}
                          >
                            <Text
                              style={[
                                styles.calendarCellText,
                                (inPlan || isStart) && styles.calendarCellTextSelected,
                                disabled && styles.calendarCellTextDisabled,
                              ]}
                            >
                              {c.dayNumber}
                            </Text>

                            {isBooked && (
                              <View style={styles.calendarConflictOverlay} pointerEvents="none">
                                <Text style={[styles.calendarConflictText, { color: '#b91c1c' }]}>✕</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* Date Selection */}
          {!isPlanCalendarPicker && !isDayUnitPackage && (
            <>
              <Text style={styles.sectionTitle}>Select Date</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.dateScrollContainer}
                contentContainerStyle={styles.dateScrollContent}
              >
                {dates.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    onPress={() => setSelectedDate(d.key)}
                    style={[
                      styles.dateCard,
                      selectedDate === d.key && styles.dateCardActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateDay,
                        selectedDate === d.key && styles.dateDayActive,
                      ]}
                    >
                      {d.label.day}
                    </Text>
                    <Text
                      style={[
                        styles.dateText,
                        selectedDate === d.key && styles.dateTextActive,
                      ]}
                    >
                      {d.label.date}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Available Slots Section - Vertical Scroller */}
          <View style={styles.slotsHeaderRow}>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              {isServiceFlow ? 'Pick a start time' : (isRecurringPackage ? (isMonthlyPackage ? 'Pick a monthly time window' : 'Pick a recurring time window') : 'Pick a time')}
            </Text>
            {isServiceFlow && (
              <Text style={styles.slotCountText}>
                {requiredDurationMinutes > 0
                  ? `Time required: ${requiredDurationMinutes} mins (${selectedSlots.length} slot${selectedSlots.length === 1 ? '' : 's'} reserved)`
                  : `Time required: ${requiredSlots} slots`}
              </Text>
            )}
          </View>

          {isServiceFlow && (
            <Text style={styles.slotHelpText}>
              We’ll auto-reserve a continuous block within the same day.
            </Text>
          )}

          {isServiceFlow && loadingAvailability && (
            <View style={styles.availabilityRow}>
              <ActivityIndicator size="small" color="#64748b" />
              <Text style={styles.availabilityText}>Checking availability…</Text>
            </View>
          )}

          {!isServiceFlow && isRecurringPackage && loadingSeriesAvailability && (
            <View style={styles.availabilityRow}>
              <ActivityIndicator size="small" color="#64748b" />
              <Text style={styles.availabilityText}>Validating recurring availability…</Text>
            </View>
          )}

          {isServiceFlow && availabilityError && (
            <Text style={[styles.slotHelpText, { color: '#b45309' }]}>{availabilityError}</Text>
          )}

          {/* All Slots - Pill / Chip Layout */}
          <View style={styles.slotsVerticalContainer}>
            {isServiceFlow && !canInteractWithSlots && (
              <View style={styles.slotsBlockingOverlay} pointerEvents="none">
                <View style={styles.slotsBlockingCard}>
                  <ActivityIndicator size="small" color="#0f172a" />
                  <Text style={styles.slotsBlockingText}>
                    {availabilityStatusText && availabilityStatusText.trim().length > 0
                      ? availabilityStatusText
                      : 'Please wait, checking availability…'}
                  </Text>
                </View>
              </View>
            )}

            {slots.filter((slot) => {
              // IMPORTANT UX:
              // - Service flow: always show all slots (we disable booked ones).
              // - Recurring plans (week/month): show defined windows.
              // - Single-day package bookings: show all slots for the currently selected day and disable booked ones.
              //   Do NOT hide slots; otherwise one fully-booked day can make the UI look like "no slots exist".
              if (isServiceFlow) return true;
              if (isRecurringPackage) return true;
              return true;
            }).map((slot) => {
              const isSelected = isSlotSelected(selectedDate, slot);
              const isFresh = !isServiceFlow ? true : (availabilityFreshByDate?.[selectedDate] === true);
              // Booked logic:
              // - Service flow: use the detailed slotAvailability check (includes freshness/verification guards).
              // - Package flow (single-day / non-recurring): use computed slotAvailability map if available.
              //   Here `slotAvailability[key] === false` means no capacity for that slot.
              const key = `${selectedDate}|${slot}`;
              const hasComputedKey = !!(slotAvailability && Object.prototype.hasOwnProperty.call(slotAvailability, key));
              const booked = isServiceFlow
                ? isSlotBooked(selectedDate, slot)
                : (hasComputedKey ? slotAvailability[key] === false : false);
              const seriesKnown = isRecurringPackage && seriesAvailability && Object.keys(seriesAvailability).length > 0;
              const seriesOk = !seriesKnown ? true : (seriesAvailability[slot] !== false);
              // For package/day flow, we do NOT want to lock the UI while verification runs.
              // Unknown/uncomputed keys should render as Available (optimistic) but show a "Verifying" badge.
              // Booking is still prevented by the Continue guard + by disabling only the slots we KNOW are full.
              const verifying = !isServiceFlow && !isRecurringPackage && !hasComputedKey;
              // Booked slots should never be clickable.
              // For service flow, booked already includes freshness + atomic-block validation.
              const disabled = !canInteractWithSlots || booked || verifying || (isRecurringPackage && !seriesOk);
              if (__DEV__ && !isServiceFlow && !isRecurringPackage && slot === slots[0]) {
                const keysForDate = Object.keys(slotAvailability || {}).filter((k) => k.startsWith(`${selectedDate}|`));
                console.log('🧪 UI slot state (package/day):', {
                  selectedDate,
                  hasComputedKeysForDate: keysForDate.length,
                  firstKey: `${selectedDate}|${slots[0]}`,
                  firstKeyValue: (slotAvailability as any)?.[`${selectedDate}|${slots[0]}`],
                });
              }
              return (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotChip,
                    isServiceFlow && requiredDurationMinutes > 0 && styles.slotChipService,
                    !isServiceFlow && styles.slotChipPackage,
                    disabled && styles.slotChipBooked,
                    isSelected && styles.slotChipSelected,
                  ]}
                  onPress={() => {
                    if (disabled || booked) return;
                    onPickSlot(selectedDate, slot);
                  }}
                  activeOpacity={0.7}
                  disabled={disabled}
                >
                  <View style={styles.slotChipTopRow}>
                    <Text
                      style={[
                        styles.slotChipText,
                        isServiceFlow && requiredDurationMinutes > 0 && styles.slotChipTextService,
                        !isServiceFlow && styles.slotChipTextPackage,
                        booked && styles.slotChipTextBooked,
                        isSelected && styles.slotChipTextSelected,
                      ]}
                    >
                      {isServiceFlow
                        ? (requiredDurationMinutes > 0
                          ? formatDurationWindowLabel(slot, requiredDurationMinutes)
                          : slot)
                        : slot}
                    </Text>

                    {booked ? (
                      <View style={styles.badgeBooked}>
                        <Text style={styles.badgeBookedText}>Booked</Text>
                      </View>
                    ) : verifying ? (
                      <View style={styles.badgeBooked}>
                        <Text style={styles.badgeBookedText}>Verifying</Text>
                      </View>
                    ) : (!canInteractWithSlots || !isFresh) ? (
                      <View style={styles.badgeBooked}>
                        <Text style={styles.badgeBookedText}>Verifying</Text>
                      </View>
                    ) : (isRecurringPackage && seriesKnown && !seriesOk) ? (
                      <View style={styles.badgeBooked}>
                        <Text style={styles.badgeBookedText}>Not available</Text>
                      </View>
                    ) : isSelected ? (
                      <View style={styles.badgeSelected}>
                        <Text style={styles.badgeSelectedText}>Selected</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeAvailable}>
                        <Text style={styles.badgeAvailableText}>Available</Text>
                      </View>
                    )}
                  </View>

                  {isServiceFlow && requiredDurationMinutes > 0 && (
                    <Text
                      style={[
                        styles.slotChipDurationText,
                        isSelected && styles.slotChipDurationTextSelected,
                        booked && styles.slotChipDurationTextBooked,
                      ]}
                    >
                      {`${requiredDurationMinutes} min`}
                    </Text>
                  )}

                  {isServiceFlow && isSelected && startSlot?.date === selectedDate && startSlot?.time === slot && (
                    <Text style={styles.slotChipSubText}>Start</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

      {/* Bottom Continue Button */}
  <View style={styles.bottomBar} pointerEvents="box-none">
        <TouchableOpacity
          style={[
            styles.continueBtn,
            (!canContinueFinal || isVerifyingAvailability) && styles.continueBtnDisabled,
          ]}
          activeOpacity={0.7}
          onPress={async () => {
            if (!canContinueFinal || isVerifyingAvailability) return;

            const selected = dates.find(d => d.key === selectedDate);
            
            console.log('🎯 Navigating to CompanySelection with slot data:', {
              serviceTitle,
              categoryId,
              selectedIssueIds,
              selectedIssues,
              issues,
              selectedDate,
              selectedTime: time,
              selectedDateFull: selected?.full
            });

            const chosenDate = isServiceFlow ? (selectedSlots[0]?.date || selectedDate) : selectedDate;
            const chosenTime = isServiceFlow ? (selectedSlots[0]?.time || time) : time;

            if (isPackageBooking === true) {
              // Package flow: company+package was selected up-front.
              // Add to cart directly here so we can completely skip CompanySelection.
              const companyObj = selectedCompany;
              const companyId = typeof selectedCompanyId === 'string' ? selectedCompanyId : (companyObj?.id || null);

              if (!companyId || !companyObj) {
                console.log('⚠️ Package flow missing selected company; falling back to CompanySelection');
                navigation.navigate("CompanySelection", {
                  serviceTitle,
                  categoryId,
                  selectedIssueIds,
                  selectedIssues,
                  issues,
                  selectedDate: chosenDate,
                  selectedTime: chosenTime,
                  selectedDateFull: selected?.full,
                  fromServiceServices,
                  isPackageBooking,
                  selectedPackage,
                  selectedCompanyId,
                });
                return;
              }

              // Determine booking type from serviceTitle (same heuristic used elsewhere)
              let bookingType: any = 'electrician';
              const lowerTitle = (serviceTitle || '').toLowerCase();
              if (lowerTitle.includes('plumber')) bookingType = 'plumber';
              else if (lowerTitle.includes('cleaning')) bookingType = 'cleaning';
              else if (lowerTitle.includes('health')) bookingType = 'health';
              else if (lowerTitle.includes('daily') || lowerTitle.includes('wages')) bookingType = 'dailywages';
              else if (lowerTitle.includes('car') || lowerTitle.includes('wash')) bookingType = 'carwash';

              const pkgPrice = Number((selectedPackage as any)?.price);
              const computedPrice = (Number.isFinite(pkgPrice) && pkgPrice > 0) ? pkgPrice : Number((companyObj as any)?.price || 0);

              addService({
                serviceTitle,
                categoryId,
                issues: (Array.isArray(selectedIssues) ? selectedIssues : []).map((issue: any) => ({
                  name: issue?.name || issue,
                  price: typeof issue?.price === 'number' ? issue.price : 0,
                  quantity: 1,
                })),
                company: {
                  id: companyObj.id,
                  companyId: (companyObj as any).companyId || companyObj.id,
                  name: (companyObj as any).companyName || (companyObj as any).serviceName,
                  price: (companyObj as any).price,
                  rating: (companyObj as any).rating,
                  verified: (companyObj as any).isActive,
                },
                selectedDate: chosenDate,
                selectedTime: chosenTime,
                bookingType,
                unitPrice: computedPrice,
                totalPrice: computedPrice,
                additionalInfo: {
                  isPackageService: true,
                  packageName: (selectedPackage as any)?.name,
                  packageType: (selectedPackage as any)?.type,
                  packageDuration: (selectedPackage as any)?.duration,
                  packageFeatures: (selectedPackage as any)?.features,
                  schedule: isRecurringPackage ? buildRecurringSchedule(chosenDate, chosenTime) : undefined,
                  occurrences: isRecurringPackage
                    ? (needsDayConfirmation
                        ? confirmedPlanDates.map((d) => ({ date: d, time: chosenTime }))
                        : generateRecurringOccurrences(chosenDate, chosenTime))
                    : undefined,
                  package: {
                    id: (selectedPackage as any)?.id,
                    name: (selectedPackage as any)?.name,
                    price: (selectedPackage as any)?.price,
                    description: (selectedPackage as any)?.description,
                    duration: (selectedPackage as any)?.duration,
                    unit: (selectedPackage as any)?.unit,
                    frequency: (selectedPackage as any)?.frequency,
                    type: (selectedPackage as any)?.type,
                  },
                },
              });

              navigation.navigate("ServiceCart");
            } else {
              // Direct-price service flow: company was already selected earlier.
              // After slot selection, go straight to cart/checkout.
              const companyObj = selectedCompany;
              const companyId = typeof selectedCompanyId === 'string' ? selectedCompanyId : (companyObj?.id || null);

              if (!companyObj || !companyId) {
                // This should never happen in the direct-price flow because the user
                // must select a company before reaching slots. Avoid looping back.
                console.warn('⚠️ Direct-price flow missing company selection; cannot add to cart', {
                  selectedCompanyId,
                  hasSelectedCompany: !!selectedCompany,
                });
                return;
              }

              // Determine booking type from serviceTitle
              let bookingType: any = 'electrician';
              const lowerTitle = (serviceTitle || '').toLowerCase();
              if (lowerTitle.includes('plumber')) bookingType = 'plumber';
              else if (lowerTitle.includes('cleaning')) bookingType = 'cleaning';
              else if (lowerTitle.includes('health')) bookingType = 'health';
              else if (lowerTitle.includes('daily') || lowerTitle.includes('wages')) bookingType = 'dailywages';
              else if (lowerTitle.includes('car') || lowerTitle.includes('wash')) bookingType = 'carwash';

              // Direct-price service:
              // - `quantity` is controlled by the cart item quantity stepper.
              // - `unitPrice` should be the PER-UNIT price from the selected company/service_services doc.
              // - `issues` here are mainly for describing selected services; we keep quantity=1 for each.
              const cartIssues = (Array.isArray(selectedIssues) ? selectedIssues : []).map((issue: any) => {
                const unitPrice = typeof issue?.price === 'number' ? issue.price : 0;
                return {
                  name: issue?.name || issue,
                  price: unitPrice,
                  quantity: 1,
                };
              });

              // IMPORTANT: offers + per-unit base price live on the service_services doc.
              // `selectedCompany` SHOULD be that doc, but in some cases it can be a lightweight object.
              // So we defensively refetch the service_services doc by id right before adding to cart.
              let baseUnitPrice = typeof (companyObj as any)?.price === 'number'
                ? (companyObj as any).price
                : (typeof cartIssues?.[0]?.price === 'number' ? cartIssues[0].price : 0);

              let offersForCart: any =
                (cartIssues as any)?.[0]?.quantityOffers
                || (cartIssues as any)?.[0]?.data?.quantityOffers
                || (selectedIssues as any)?.[0]?.quantityOffers
                || (selectedIssues as any)?.[0]?.data?.quantityOffers
                || (companyObj as any)?.quantityOffers
                || null;

              await (async () => {
                try {
                  const serviceDocId = String((companyObj as any)?.id || companyId || '');
                  if (serviceDocId) {
                    const snap = await firestore().collection('service_services').doc(serviceDocId).get();
                    const data: any = snap.exists ? snap.data() : null;
                    if (data) {
                      if (typeof data.price === 'number' && data.price > 0) baseUnitPrice = data.price;
                      if (data.quantityOffers && Array.isArray(data.quantityOffers)) offersForCart = data.quantityOffers;
                    }
                  }
                } catch (e) {
                  // Non-fatal; we can still continue with whatever was passed via navigation.
                  if (__DEV__) console.log('⚠️ Failed to refetch service_services for offers', e);
                }
              })();

              // Preserve the user-selected quantity from the service screen.
              // In the direct-price service flow we typically have a single service, so we can safely
              // sum the `serviceQuantities` map.
              const selectedQty = (serviceQuantities && typeof serviceQuantities === 'object')
                ? Math.max(
                    1,
                    Object.values(serviceQuantities).reduce(
                      (acc: number, v: any) => acc + Math.max(0, Number(v) || 0),
                      0
                    )
                  )
                : 1;

              addService({
                serviceTitle,
                categoryId,
                issues: cartIssues,
                company: {
                  id: companyObj.id,
                  companyId: (companyObj as any).companyId || companyObj.id,
                  name: (companyObj as any).companyName || (companyObj as any).serviceName,
                  price: (companyObj as any).price,
                  rating: (companyObj as any).rating,
                  verified: (companyObj as any).isActive,
                },
                selectedDate: chosenDate,
                selectedTime: chosenTime,
                bookingType,
                unitPrice: baseUnitPrice,
                totalPrice: baseUnitPrice * selectedQty,
                quantity: selectedQty,
                additionalInfo: {
                  fromServiceServices: true,
                  isPackageService: false,
                  serviceQuantities,
                  selectedSlots: isServiceFlow ? selectedSlots : undefined,
                  startSlot: isServiceFlow ? startSlot : undefined,
                  // Quantity offer support (company-specific offers come from the selected service_services doc).
                  // By persisting these into the cart item, the cart can auto-apply the best eligible tier
                  // when the user increases/decreases quantity.
                  baseOfferUnitPrice: baseUnitPrice,
                  // Offers exist on the company-specific service_services doc(s).
                  // Some flows set `selectedCompany` to a service_company object which won't carry quantityOffers.
                  // Prefer offers stored on the selected issue object or any embedded offers payload.
                  quantityOffers: offersForCart,
                },
              });

              navigation.navigate("ServiceCart");
            }
          }}
        >
          <Text style={styles.continueBtnText}>{continueLabel}</Text>
        </TouchableOpacity>
      </View>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc",
  },

  // Header
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },

  backButton: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 8,
    zIndex: 2,
  },

  headerHomeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 8,
    zIndex: 2,
  },

  blockingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  blockingModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  blockingModalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 6,
  },
  blockingModalSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textAlign: "center",
    marginTop: 10,
  },

  // Right Side - Slots Container
  slotsContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // ScrollView content wrapper (so the ScrollView itself can flex/scroll properly)
  slotsContent: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },

  summaryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
    color: "#065f46",
    fontWeight: "800",
    fontSize: 12,
  },
  summarySub: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  summaryStrong: {
    color: "#0f172a",
    fontWeight: "800",
  },

  // Calendar grid (monthly/weekly plan confirmation)
  calendarMonthTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 6,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  calendarDowText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#64748b",
    fontWeight: "800",
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    marginBottom: 6,
  },
  calendarCellSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  calendarCellStart: {
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  calendarCellDisabled: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  calendarCellText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  calendarCellTextSelected: {
    color: "#ffffff",
  },
  calendarCellTextDisabled: {
    color: "#94a3b8",
  },
  calendarConflictOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarConflictText: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "900",
  },

  // Confirm-days list (calendar-like)
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  dayRowSelected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#4CAF50',
  },
  dayRowUnselected: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  dayRowText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayRowTextSelected: {
    color: '#065f46',
  },
  dayRowTextUnselected: {
    color: '#0f172a',
  },
  dayRowPill: {
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '800',
  },
  dayRowPillSelected: {
    backgroundColor: '#4CAF50',
    color: '#ffffff',
  },
  dayRowPillUnselected: {
    backgroundColor: '#e2e8f0',
    color: '#334155',
  },
  legendRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
  },
  inlineAlert: {
    marginTop: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 10,
    borderRadius: 12,
  },
  inlineAlertText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  inlineAlertDanger: {
    marginTop: 10,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    padding: 10,
    borderRadius: 12,
  },
  inlineAlertDangerText: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: "800",
  },

  slotsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotCountText: {
    marginTop: 24,
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    opacity: 0.8,
  },
  slotHelpText: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },

  availabilityRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  availabilityText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },

  // Date Selection
  dateScrollContainer: {
    marginBottom: 8,
  },

  dateScrollContent: {
    paddingRight: 18,
  },

  dateCard: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    minWidth: 80,
  },

  dateCardActive: {
    backgroundColor: "#0f8e35ff",
    borderColor: "#0f8e35ff",
  },

  dateDay: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },

  dateDayActive: {
    color: "#ffffff",
  },

  dateText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },

  dateTextActive: {
    color: "#ffffff",
  },

  // Slots container: wrap chips across rows (pills)
  slotsVerticalContainer: {
    marginTop: 12,
    marginBottom: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  slotsBlockingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsBlockingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  slotsBlockingText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '800',
  },

  slotChip: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 44,
    // Grid-style: aim for 3 columns with consistent widths.
    flexBasis: '31%',
    maxWidth: '31%',
  },
  // Service-flow dynamic duration slots: larger 2-column cards
  slotChipService: {
    flexBasis: '48%',
    maxWidth: '48%',
    borderRadius: 14,
    minHeight: 62,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  // Package (including weekly/monthly) slots: rectangular tiles (avoid pill distortion)
  slotChipPackage: {
    borderRadius: 12,
    flexBasis: '48%',
    maxWidth: '48%',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  slotChipSelected: {
    backgroundColor: '#0f8e35ff',
    borderColor: '#0f8e35ff',
  },
  slotChipBooked: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    opacity: 0.85,
  },
  slotChipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 16,
    flexShrink: 1,
    // Keep text inside fixed-width grid chips
    flexGrow: 1,
    minWidth: 0,
  },
  slotChipTextService: {
    fontSize: 13,
    fontWeight: '900',
  },
  slotChipTextPackage: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  slotChipTextSelected: {
    color: '#ffffff',
  },
  slotChipTextBooked: {
    color: '#94a3b8',
  },
  slotChipSubText: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    opacity: 0.9,
  },

  slotChipDurationText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    color: '#334155',
  },
  slotChipDurationTextSelected: {
    color: '#ffffff',
    opacity: 0.95,
  },
  slotChipDurationTextBooked: {
    color: '#94a3b8',
  },
  badgeAvailable: {
    backgroundColor: "#eff6ff",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  badgeAvailableText: {
    color: "#1d4ed8",
    fontSize: 9,
    fontWeight: "800",
  },
  badgeSelected: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  badgeSelectedText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  badgeBooked: {
    backgroundColor: "#fee2e2",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  badgeBookedText: {
    color: "#b91c1c",
    fontSize: 9,
    fontWeight: "900",
  },

  slotCardVertical: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },

  slotCardVerticalSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
    elevation: 2,
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  slotCardVerticalBooked: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    opacity: 0.8,
  },

  slotTextVertical: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },

  slotTextVerticalSelected: {
    color: "#ffffff",
    fontWeight: "700",
  },

  slotTextVerticalBooked: {
    color: "#94a3b8",
  },

  bookedBadge: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },

  // Recommended Slot (Center, Green)
  recommendedSlot: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  recommendedSlotSelected: {
    backgroundColor: "#4CAF50",
  },

  recommendedLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  recommendedTime: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Other Slots - Horizontal Scroller
  slotsScrollContainer: {
    marginBottom: 20,
  },

  slotsScrollContent: {
    paddingRight: 16,
  },

  slotCard: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minWidth: 150,
    alignItems: "center",
  },

  slotCardSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
    borderWidth: 2,
  },

  slotText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },

  slotTextSelected: {
    color: "#3b82f6",
  },

  // Bottom Bar
  bottomBar: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },

  continueBtn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  continueBtnDisabled: {
    opacity: 0.5,
  },

  continueBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // Loading Container
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
});
