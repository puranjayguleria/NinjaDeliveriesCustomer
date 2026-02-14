import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
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

type MonthlySchedule = {
  unit: 'month';
  anchorDate: string; // yyyy-mm-dd (user-selected date)
  weekday: number; // 0=Sun..6=Sat derived from anchorDate
  timeSlot: string; // UI slot label e.g. "9:00 AM - 11:00 AM"
};

export default function SelectDateTimeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addService } = useServiceCart();

  const { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues, fromServiceServices, isPackageBooking, selectedPackage: selectedPackageParam, serviceQuantities, selectedCompanyId, selectedCompany } = route.params;

  const selectedPackage = (() => {
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
  })();

  const selectedPackageUnit = String((selectedPackage as any)?.unit || '').toLowerCase();
  const isMonthlyPackage = isPackageBooking === true && selectedPackageUnit === 'month';
  const isRecurringPackage = isPackageBooking === true && ['day', 'daily', 'week', 'weekly', 'month', 'monthly'].includes(selectedPackageUnit);
  const needsDayConfirmation = isRecurringPackage && (isMonthlyPackage || selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly');

  const isSundayISO = (dateISO: string) => {
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) return false;
    return d.getDay() === 0;
  };

  // ---- Calendar grid helpers (ISO date strings: YYYY-MM-DD) ----
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const getMonthKey = (iso: string): string => String(iso || "").slice(0, 7); // YYYY-MM

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

  const buildMonthGrid = (monthKey: string): Array<{ iso: string | null; dayNumber: number | null; isSunday: boolean }> => {
    const firstIso = startOfMonthISO(monthKey);
    const firstDow = dayOfWeekSun0(firstIso); // 0..6
    const total = daysInMonth(monthKey);

    const cells: Array<{ iso: string | null; dayNumber: number | null; isSunday: boolean }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ iso: null, dayNumber: null, isSunday: false });
    for (let day = 1; day <= total; day++) {
      const iso = makeISO(monthKey, day);
      cells.push({ iso, dayNumber: day, isSunday: isSundayISO(iso) });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: null, dayNumber: null, isSunday: false });
    return cells;
  };

  const addDaysISO = (dateISO: string, days: number) => {
    const d = new Date(dateISO);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
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
      // Fixed window: 4 weeks from the selected start date (inclusive).
      for (let i = 0; i < 28; i++) {
        const dISO = addDaysISO(anchorDateISO, i);
        out.push({ date: dISO, time: timeSlotLabel });
      }
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

  // Debug: Log all route params immediately
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
      name: selectedPackage.name,
      price: selectedPackage.price,
      id: selectedPackage.id
    } : null
  }, null, 2));

  // State for slots
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean>>({});
  const [seriesAvailability, setSeriesAvailability] = useState<Record<string, boolean>>({});
  const [seriesConflicts, setSeriesConflicts] = useState<Record<string, string[]>>({});
  const [loadingSeriesAvailability, setLoadingSeriesAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Predefined slots for services (non-package bookings)
  const defaultSlots = [
    "9:00 AM - 11:00 AM",
    "11:00 AM - 1:00 PM", 
    "1:00 PM - 3:00 PM",
    "3:00 PM - 5:00 PM",
    "5:00 PM - 7:00 PM",
    "7:00 PM - 9:00 PM",
  ];

  const [time, setTime] = useState("");
  const [confirmedPlanDates, setConfirmedPlanDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to tomorrow instead of today
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });

  const isServiceFlow = isPackageBooking !== true;

  // Phase-1 “duration accumulation” (slot-block) implementation:
  // For service flow, required “time” scales with quantity, represented as # of contiguous slots.
  // Later we can replace this with real per-service durations and convert minutes -> slots.
  const requiredSlots = (() => {
    if (!isServiceFlow) return 1;
    if (!serviceQuantities || typeof serviceQuantities !== "object") return 1;
    const sum = Object.values(serviceQuantities).reduce(
      (acc: number, v: any) => acc + (Number(v) || 0),
      0
    );
    return Math.max(1, sum);
  })();

  // In service flow, user picks ONE start slot and we auto-accumulate a contiguous block.
  const [startSlot, setStartSlot] = useState<SelectedSlot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);

  const getNextNDays = (fromDateISO: string, n: number) => {
    const res: string[] = [];
    const base = new Date(fromDateISO);
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      res.push(d.toISOString().split("T")[0]);
    }
    return res;
  };

  const buildSlotBlock = (start: SelectedSlot, slotsForDay: string[]): SlotBlockResult => {
    // We can only accumulate within the next 7 days that UI exposes.
    const visibleDates = getNextNDays(start.date, 7);
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
  };

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

    setLoadingAvailability(true);
    setAvailabilityError(null);

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
        setSlotAvailability(next);
        return;
      }

  // Step 2: for each slot, see if ANY company is available (service flow)
  // or whether the chosen company is available (package flow).
      // We do this with a small concurrency pool to speed it up without melting the device/Firestore.
      const next: Record<string, boolean> = { ...slotAvailability };
      const toCompute = slotsForDay
        .map((t) => ({ t, key: `${dateISO}|${t}` }))
        .filter((x) => !(x.key in next));

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

          next[current.key] = anyAvailable;
        }
      };

      await Promise.all(Array.from({ length: Math.min(maxConcurrency, toCompute.length) }, () => worker()));

      setSlotAvailability({ ...next });
    } catch (e: any) {
      console.log('⚠️ Failed to compute slot availability:', e);
      setAvailabilityError('Could not load availability. Showing all slots.');
      // If we fail, leave availability empty so UI doesn't block user.
      setSlotAvailability({});
    } finally {
      setLoadingAvailability(false);
    }
  };

  const computeSeriesAvailabilityForTimeSlot = async (anchorDateISO: string, slotLabel: string) => {
    if (!isRecurringPackage) return;
    if (!anchorDateISO || !slotLabel) return;

    const companyId = typeof selectedCompanyId === 'string' ? selectedCompanyId : null;
    if (!companyId) return;

    setLoadingSeriesAvailability(true);
    setAvailabilityError(null);

    try {
      const maxOccurrencesToCheck = 40;
      const pickedDates = (needsDayConfirmation && Array.isArray(confirmedPlanDates) && confirmedPlanDates.length > 0)
        ? [...confirmedPlanDates].sort()
        : null;

      const occurrences = (pickedDates
        ? pickedDates.map((d) => ({ date: d, time: slotLabel }))
        : generateRecurringOccurrences(anchorDateISO, slotLabel)
      ).slice(0, maxOccurrencesToCheck);

      if (occurrences.length === 0) {
        setSeriesAvailability({ [slotLabel]: false });
        setSeriesConflicts({ [slotLabel]: [] });
        return;
      }

      const conflicts: string[] = [];
      let ok = true;
      for (const occ of occurrences) {
        const result = await FirestoreService.checkCompanyWorkerAvailability(
          companyId,
          occ.date,
          occ.time,
          Array.isArray(selectedIssueIds) ? selectedIssueIds : undefined,
          serviceTitle
        );

        if (result?.available !== true) {
          ok = false;
          conflicts.push(occ.date);
        }
      }

      setSeriesAvailability({ [slotLabel]: ok });
      setSeriesConflicts({ [slotLabel]: conflicts });

      // If the currently selected plan includes conflicting dates, drop them so the
      // user is forced to pick replacements (while seeing the red-cross markers).
      if (needsDayConfirmation && conflicts.length > 0) {
        setConfirmedPlanDates((prev) => prev.filter((d) => !conflicts.includes(d)));
      }
    } catch (e: any) {
      console.log('⚠️ Failed to compute series availability:', e);
      setAvailabilityError('Could not validate recurring availability. You may proceed, but some dates could be unavailable.');
      setSeriesAvailability({});
      setSeriesConflicts({});
    } finally {
      setLoadingSeriesAvailability(false);
    }
  };

  // Fetch slots based on booking type
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        
        console.log('🔍 SelectDateTimeScreen - Route params:', {
          isPackageBooking,
          isPackageBookingType: typeof isPackageBooking,
          isPackageBookingTruthy: !!isPackageBooking,
          selectedPackage: selectedPackage?.name,
          hasSelectedPackage: !!selectedPackage,
          serviceId: selectedIssueIds?.[0],
          fromServiceServices
        });
        
  // Check if this is a package booking (explicit true check)
  if (isPackageBooking === true && selectedPackage) {
          // For packages: fetch slots from Firestore
          console.log('📦 PACKAGE BOOKING - Fetching slots from Firestore for package:', selectedPackage.name);
          
          // Get the service ID from selectedIssueIds
          const serviceId = selectedIssueIds?.[0];
          
          if (serviceId) {
            console.log('📦 Querying service_services collection for serviceId:', serviceId);
            const serviceDoc = await firestore()
              .collection('service_services')
              .doc(serviceId)
              .get();
            
            if (serviceDoc.exists) {
              const serviceData = serviceDoc.data();
              console.log('📦 Full service data from Firestore:', JSON.stringify(serviceData, null, 2));
              
              let packageSlots: string[] = [];
              
              // Check if service has packages array
              if (serviceData?.packages && Array.isArray(serviceData.packages)) {
                console.log('📦 Found packages array in service, searching for matching package...');
                
                // Find the selected package in the packages array
                const matchingPackage = serviceData.packages.find((pkg: any) => 
                  pkg.id === selectedPackage.id || 
                  pkg.name === selectedPackage.name ||
                  JSON.stringify(pkg) === JSON.stringify(selectedPackage)
                );
                
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
                setTime(packageSlots[0]); // Set first slot as default
              } else {
                console.log('⚠️ No slots found anywhere for package, using default slots as fallback');
                setSlots(defaultSlots);
                setTime(defaultSlots[2]); // Set middle slot as default
              }

              // For recurring packages, we don't compute per-worker slot availability here.
              // Clear any previous availability map so UI doesn't hide options.
              if (isRecurringPackage) {
                setSlotAvailability({});
              }
            } else {
              console.log('⚠️ Service document not found in Firestore, using default slots');
              setSlots(defaultSlots);
              setTime(defaultSlots[2]);
            }
          } else {
            console.log('⚠️ No service ID provided for package, using default slots');
            setSlots(defaultSlots);
            setTime(defaultSlots[2]);
          }
        } else {
          // For services: use predefined slots
          console.log('💰 SERVICE BOOKING (NOT PACKAGE) - Using predefined slots');
          setSlots(defaultSlots);
          setTime(defaultSlots[2]); // Set middle slot as default

          // For service flow, preselect a START slot and auto-accumulate the block.
          if (isServiceFlow) {
            const defaultTime = defaultSlots[2];
            const start = { date: selectedDate, time: defaultTime };
            setStartSlot(start);
            const block = buildSlotBlock(start, defaultSlots);
            setSelectedSlots(block.slots);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching slots:', error);
        // Fallback to default slots on error
        setSlots(defaultSlots);
        setTime(defaultSlots[2]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [isPackageBooking, selectedPackage, selectedIssueIds, isServiceFlow, selectedDate, selectedCompanyId]);

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

    // Reset cache when the user changes service selection.
    setSlotAvailability({});
    computeAvailabilityForDate(selectedDate, slots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isServiceFlow, selectedDate, selectedCompanyId, JSON.stringify(selectedIssueIds), slots.join('|')]);

  // For recurring packages, validate the whole series (all occurrences) for the selected time window.
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

    // Weekly/monthly plans: validate only when the user has picked the full set of days.
    if (needsDayConfirmation) {
      const unitLimit = (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly') ? 7 : 30;
      if (!Array.isArray(confirmedPlanDates) || confirmedPlanDates.length !== unitLimit) {
        setSeriesAvailability({});
        setSeriesConflicts({});
        return;
      }
    }

    computeSeriesAvailabilityForTimeSlot(selectedDate, time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecurringPackage, selectedDate, selectedCompanyId, time, JSON.stringify(selectedIssueIds), needsDayConfirmation, confirmedPlanDates.join('|'), selectedPackageUnit]);

  const getNext7Days = () => {
    const days = [];
    const today = new Date();

    // Start from tomorrow (i = 1) instead of today (i = 0)
    for (let i = 1; i < 8; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      days.push({
        key: d.toISOString().split("T")[0],
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

  const isPlanCalendarPicker = !isServiceFlow && isRecurringPackage;
  const isWeeklyPlan = !isServiceFlow && isRecurringPackage && (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly');
  const isMonthlyPlan = !isServiceFlow && isRecurringPackage && (selectedPackageUnit === 'month' || selectedPackageUnit === 'monthly');
  const planSelectionLimit = isMonthlyPlan ? 30 : (isWeeklyPlan ? 7 : 0);

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

  // When anchor date/time changes (and unit requires it), seed the confirmation list.
  useEffect(() => {
    if (!needsDayConfirmation) {
      setConfirmedPlanDates([]);
      return;
    }
    // For weekly/monthly plans, the user selects the exact days on the calendar.
    // Seed a sensible default window from tomorrow.
    const todayISO = new Date().toISOString().split('T')[0];
    const startISO = addDaysISO(todayISO, 1);
    const limit = (selectedPackageUnit === 'week' || selectedPackageUnit === 'weekly') ? 7 : 30;

    setConfirmedPlanDates((prev) => {
      if (Array.isArray(prev) && prev.length > 0) {
        // Enforce max limit if a previous selection exists.
        return prev.slice(0, limit).sort();
      }
      const seeded = Array.from({ length: limit }, (_, i) => addDaysISO(startISO, i));
      return seeded;
    });

    // Keep selectedDate aligned for the rest of the screen (slot availability, summary, etc.).
    setSelectedDate((prev) => {
      if (typeof prev === 'string' && prev >= startISO) return prev;
      return startISO;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDayConfirmation, selectedDate, time, slots.join('|'), selectedPackageUnit]);

  const onPickSlot = (date: string, slot: string) => {
    if (!isServiceFlow) {
      // package/single-slot flow
      setSelectedDate(date);
      setTime(slot);
      return;
    }

    const start = { date, time: slot };
    setStartSlot(start);
    const block = buildSlotBlock(start, slots);
    setSelectedSlots(block.slots);
    if (!block.ok) {
      setBlockError(
        "Not enough continuous availability from this start time. Please pick another start slot or choose a different date."
      );
    } else {
      setBlockError(null);
    }
  };

  // If the selected date changes, clear any previous block error.
  useEffect(() => {
    setBlockError(null);
  }, [selectedDate]);

  const isSlotSelected = (date: string, slot: string) => {
    if (!isServiceFlow) return time === slot;
    // In service flow, highlight the entire accumulated block.
    return selectedSlots.some((x) => x.date === date && x.time === slot);
  };

  const isSlotBooked = (date: string, slot: string) => {
    if (!isServiceFlow) return false;
    if (!slotAvailability || Object.keys(slotAvailability).length === 0) return false;
    return slotAvailability[`${date}|${slot}`] === false;
  };

  const canInteractWithSlots = !isServiceFlow || (!loadingAvailability && !loadingSlots);
  const canContinue = (() => {
    if (loadingSlots) return false;
    if (isServiceFlow && loadingAvailability) return false;
    if (isServiceFlow && (!!blockError || selectedSlots.length !== requiredSlots)) return false;

    // Recurring packages (daily/weekly/monthly): require selecting a time window
    // and ensure we can generate at least 1 occurrence (Sundays are off).
    if (isRecurringPackage) {
      if (typeof time !== 'string' || time.trim().length === 0) return false;
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

  const continueLabel = (() => {
    if (loadingSlots) return 'Loading slots…';
    if (isServiceFlow && loadingAvailability) return 'Checking availability…';
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Date & Time</Text>
      </View>

      {loadingSlots ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading available slots...</Text>
        </View>
      ) : (
        <>
          {/* Main Content: Date & Time Selection */}
        <ScrollView
          style={styles.slotsContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
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

          {/* Plan calendar (single selector for weekly/monthly plans) */}
          {!isServiceFlow && needsDayConfirmation && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTitle}>{isMonthlyPlan ? 'Monthly plan days' : 'Weekly plan days'}</Text>
                <Text style={styles.summaryPill}>
                  {confirmedPlanDates.length}/{planSelectionLimit}
                </Text>
              </View>

              <Text style={styles.summarySub}>
                Pick days from tomorrow onward. Tap again to remove a day.
              </Text>

              {!!planSelectionLimit && confirmedPlanDates.length < planSelectionLimit && (
                <View style={styles.inlineAlert}>
                  <Text style={styles.inlineAlertText}>
                    {isMonthlyPlan
                      ? `This is a monthly plan — please select ${planSelectionLimit} days.`
                      : `This is a weekly plan — please select ${planSelectionLimit} days.`}
                  </Text>
                </View>
              )}

              {(() => {
                const conflictsForSlot = (typeof time === 'string' && time.trim().length > 0)
                  ? (seriesConflicts[time] || [])
                  : [];

                if (!conflictsForSlot || conflictsForSlot.length === 0) return null;

                return (
                  <View style={styles.inlineAlertDanger}>
                    <Text style={styles.inlineAlertDangerText}>
                      Some selected dates are already booked for this time. Please remove the crossed dates and pick different days.
                    </Text>
                  </View>
                );
              })()}

              {(() => {
                const todayISO = new Date().toISOString().split('T')[0];
                const minISO = addDaysISO(todayISO, 1);
                const keyThis = getMonthKey(selectedDate || minISO);
                const firstOfThis = startOfMonthISO(keyThis);
                const firstNext = startOfMonthISO(addDaysISO(firstOfThis, 32));
                const keyNext = getMonthKey(firstNext);

                const cellsThis = buildMonthGrid(keyThis);
                const cellsNext = buildMonthGrid(keyNext);

                const conflictsForSlot = (typeof time === 'string' && time.trim().length > 0)
                  ? (seriesConflicts[time] || [])
                  : [];

                const toggleDate = (iso: string) => {
                  setConfirmedPlanDates((prev) => {
                    const next = [...prev];
                    const exists = next.includes(iso);
                    if (exists) {
                      return next.filter((x) => x !== iso).sort();
                    }
                    if (planSelectionLimit > 0 && next.length >= planSelectionLimit) {
                      return next;
                    }
                    next.push(iso);
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

                        const selected = confirmedPlanDates.includes(c.iso);
                        const tooEarly = c.iso < minISO;
                        const isConflict = conflictsForSlot.includes(c.iso);
                        const atLimit = !selected && planSelectionLimit > 0 && confirmedPlanDates.length >= planSelectionLimit;
                        const disabled = tooEarly || atLimit || isConflict;

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
                              if (atLimit) return;
                              if (isConflict) return;
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

                            {isConflict && (
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
                    {renderMonth(keyThis, cellsThis, 'm1')}
                    {renderMonth(keyNext, cellsNext, 'm2')}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Plan start-date preview calendar (daily plan only) */}
          {isPlanCalendarPicker && !needsDayConfirmation && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTitle}>Pick a start date</Text>
                <Text style={styles.summaryPill}>Calendar</Text>
              </View>

              <Text style={styles.summarySub}>
                Tap a date to start your plan. We’ll highlight the full schedule automatically.
              </Text>

              {(() => {
                const todayISO = new Date().toISOString().split('T')[0];
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
                        const disabled = c.iso < minISO;

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
          {!isPlanCalendarPicker && (
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
                Time required: {requiredSlots} slots
              </Text>
            )}
          </View>

          {isServiceFlow && (
            <Text style={styles.slotHelpText}>
              We’ll auto-reserve a continuous block. If today doesn’t have enough, it continues into the next day.
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

          {/* All Slots - Vertical Layout */}
          <View style={styles.slotsVerticalContainer}>
            {isServiceFlow && !canInteractWithSlots && (
              <View style={styles.slotsBlockingOverlay} pointerEvents="none">
                <View style={styles.slotsBlockingCard}>
                  <ActivityIndicator size="small" color="#0f172a" />
                  <Text style={styles.slotsBlockingText}>Please wait, checking availability…</Text>
                </View>
              </View>
            )}

            {slots.filter((slot) => {
              // For package bookings we want to show ONLY available slots,
              // except recurring packages (daily/weekly/monthly) where we show defined windows.
              if (isServiceFlow) return true;
              if (isRecurringPackage) return true;
              if (!slotAvailability || Object.keys(slotAvailability).length === 0) return true;
              const key = `${selectedDate}|${slot}`;
              return slotAvailability[key] !== false;
            }).map((slot) => {
              const isSelected = isSlotSelected(selectedDate, slot);
              const booked = isSlotBooked(selectedDate, slot);
              const seriesKnown = isRecurringPackage && seriesAvailability && Object.keys(seriesAvailability).length > 0;
              const seriesOk = !seriesKnown ? true : (seriesAvailability[slot] !== false);
              const disabled = !canInteractWithSlots || booked || (isRecurringPackage && !seriesOk);
              return (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotChip,
                    disabled && styles.slotChipBooked,
                    isSelected && styles.slotChipSelected,
                  ]}
                  onPress={() => {
                    if (disabled) return;
                    onPickSlot(selectedDate, slot);
                  }}
                  activeOpacity={0.7}
                  disabled={disabled}
                >
                  <View style={styles.slotChipTopRow}>
                    <Text
                      style={[
                        styles.slotChipText,
                        booked && styles.slotChipTextBooked,
                        isSelected && styles.slotChipTextSelected,
                      ]}
                    >
                      {slot}
                    </Text>

                    {booked ? (
                      <View style={styles.badgeBooked}>
                        <Text style={styles.badgeBookedText}>Booked</Text>
                      </View>
                    ) : !canInteractWithSlots ? (
                      <View style={styles.badgeBooked}>
                        <Text style={styles.badgeBookedText}>Loading</Text>
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

                  {isServiceFlow && isSelected && startSlot?.date === selectedDate && startSlot?.time === slot && (
                    <Text style={styles.slotChipSubText}>Start</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

      {/* Bottom Continue Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.continueBtn,
            !canContinue && styles.continueBtnDisabled,
          ]}
          activeOpacity={0.7}
          onPress={() => {
            if (!canContinue) return;

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
              navigation.navigate("CompanySelection", {
                serviceTitle,
                categoryId,
                selectedIssueIds,
                selectedIssues,
                issues,
                selectedDate: chosenDate,
                selectedTime: chosenTime,
                selectedDateFull: selected?.full,
                fromServiceServices, // Pass the flag forward
                isPackageBooking, // Pass package flag
                selectedPackage, // Pass package info
                serviceQuantities,
                selectedSlots: isServiceFlow ? selectedSlots : undefined,
                startSlot: isServiceFlow ? startSlot : undefined,
              });
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
    paddingTop: 50,
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

  // Right Side - Slots Container
  slotsContainer: {
    flex: 1,
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

  // Slots - Vertical Layout
  slotsVerticalContainer: {
    marginTop: 12,
    marginBottom: 20,
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
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  slotChipSelected: {
    backgroundColor: "#0f8e35ff",
    borderColor: "#0f8e35ff",
  },
  slotChipBooked: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    opacity: 0.85,
  },
  slotChipTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  slotChipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    flexShrink: 1,
  },
  slotChipTextSelected: {
    color: "#ffffff",
  },
  slotChipTextBooked: {
    color: "#94a3b8",
  },
  slotChipSubText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
    opacity: 0.9,
  },
  badgeAvailable: {
    backgroundColor: "#eff6ff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  badgeAvailableText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  badgeSelected: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  badgeSelectedText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  badgeBooked: {
    backgroundColor: "#fee2e2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  badgeBookedText: {
    color: "#b91c1c",
    fontSize: 12,
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
