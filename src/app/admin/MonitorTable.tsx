"use client";

import { useState } from "react";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { Alert } from "@/components/Alert";
import { buildDailyReportReminderMessage, buildWhatsAppDeepLink, toWhatsAppNumber } from "@/lib/whatsapp";

export interface MonitorRow {
  schoolId: string;
  schoolName: string;
  emisCode: string;
  headteacherName: string | null;
  headteacherMobile: string | null;
  submitted: boolean;
  dropout: number;
  publicAdmission: number;
  privateAdmission: number;
  freshAdmission: number;
  totalEnrollment: number;
}

interface Props {
  rows: MonitorRow[];
  /** The currently selected date, already formatted for display (DD-MM-YYYY). */
  selectedDateDisplay: string;
  /** Reminders only make sense for today — a past date's "today" wording would be misleading. */
  remindersEnabled: boolean;
}

type FilterKey = "all" | "submitted" | "not_submitted" | "reminder_available" | "no_mobile";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Schools" },
  { key: "submitted", label: "✓ Submitted" },
  { key: "not_submitted", label: "✕ Not Submitted" },
  { key: "reminder_available", label: "📱 Reminder Available" },
  { key: "no_mobile", label: "⚠ No Mobile Number" },
];

function isReminderEligible(row: MonitorRow): boolean {
  return !row.submitted && Boolean(toWhatsAppNumber(row.headteacherMobile));
}

function isMissingMobile(row: MonitorRow): boolean {
  return !row.submitted && !toWhatsAppNumber(row.headteacherMobile);
}

/** Opens WhatsApp with the reminder pre-filled for one school. Never sends
 * anything automatically — the Admin still has to press Send inside
 * WhatsApp. Must be called synchronously from inside a click handler (no
 * `await` before it) or mobile Chrome's pop-up blocker will kill it. */
function openReminderWindow(row: MonitorRow, selectedDateDisplay: string) {
  const waNumber = toWhatsAppNumber(row.headteacherMobile);
  if (!waNumber) return;
  const message = buildDailyReportReminderMessage(
    { school_name: row.schoolName, emis_code: row.emisCode },
    selectedDateDisplay
  );
  const url = buildWhatsAppDeepLink(message, waNumber);
  window.open(url, "_blank");
}

interface BulkFlowState {
  queue: MonitorRow[];
  index: number;
  openedCurrent: boolean;
}

export function MonitorTable({ rows, selectedDateDisplay, remindersEnabled }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openedReminders, setOpenedReminders] = useState<Set<string>>(new Set());
  const [bulkConfirmQueue, setBulkConfirmQueue] = useState<MonitorRow[] | null>(null);
  const [bulkFlow, setBulkFlow] = useState<BulkFlowState | null>(null);
  const [bulkDoneMessage, setBulkDoneMessage] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const searched = query
    ? rows.filter(
        (r) => r.schoolName.toLowerCase().includes(query) || r.emisCode.toLowerCase().includes(query)
      )
    : rows;

  const filtered = searched.filter((r) => {
    switch (filter) {
      case "submitted":
        return r.submitted;
      case "not_submitted":
        return !r.submitted;
      case "reminder_available":
        return isReminderEligible(r);
      case "no_mobile":
        return isMissingMobile(r);
      default:
        return true;
    }
  });

  function markOpened(schoolId: string) {
    setOpenedReminders((prev) => new Set(prev).add(schoolId));
  }

  /** Single-row button — unchanged behavior: opens directly, synchronously. */
  function handleOpenSingleReminder(row: MonitorRow) {
    openReminderWindow(row, selectedDateDisplay);
    markOpened(row.schoolId);
  }

  /**
   * The bulk entry point. This MUST stay synchronous end-to-end for the
   * one-school case — no state updates or confirmation step in between the
   * click and window.open() — otherwise mobile Chrome treats the popup as
   * not-user-initiated and blocks it (exactly the bug being fixed here).
   */
  function handleRemindAllClick() {
    setBulkDoneMessage(null);
    const eligible = filtered.filter(isReminderEligible);
    if (eligible.length === 0) return;

    if (eligible.length === 1) {
      openReminderWindow(eligible[0], selectedDateDisplay);
      markOpened(eligible[0].schoolId);
      setBulkDoneMessage(
        `Opened the WhatsApp reminder for ${eligible[0].schoolName}. No message was sent automatically — ` +
          "the chat still needs you to press Send."
      );
      return;
    }

    // Multiple schools: mobile browsers block automatic multi-popup loops,
    // so instead of opening several windows.open() calls back to back, walk
    // the admin through them one tap at a time.
    setBulkConfirmQueue(eligible);
  }

  function handleStartSequentialReminders() {
    if (!bulkConfirmQueue) return;
    setBulkFlow({ queue: bulkConfirmQueue, index: 0, openedCurrent: false });
    setBulkConfirmQueue(null);
  }

  function handleOpenCurrentInFlow() {
    if (!bulkFlow) return;
    const row = bulkFlow.queue[bulkFlow.index];
    openReminderWindow(row, selectedDateDisplay);
    markOpened(row.schoolId);
    setBulkFlow((prev) => (prev ? { ...prev, openedCurrent: true } : prev));
  }

  function handleNextInFlow() {
    if (!bulkFlow) return;
    const nextIndex = bulkFlow.index + 1;
    if (nextIndex >= bulkFlow.queue.length) {
      const total = bulkFlow.queue.length;
      setBulkFlow(null);
      setBulkDoneMessage(
        `Went through all ${total} reminders. No messages were sent automatically — each WhatsApp chat still ` +
          "needs you to press Send."
      );
      return;
    }
    setBulkFlow({ queue: bulkFlow.queue, index: nextIndex, openedCurrent: false });
  }

  function handleCancelBulkFlow() {
    setBulkFlow(null);
  }

  const eligibleInView = filtered.filter(isReminderEligible).length;

  return (
    <div className="space-y-3">
      {remindersEnabled && (
        <>
          {bulkFlow ? (
            <SequentialReminderPanel
              state={bulkFlow}
              onOpen={handleOpenCurrentInFlow}
              onNext={handleNextInFlow}
              onCancel={handleCancelBulkFlow}
            />
          ) : bulkConfirmQueue ? (
            <BulkConfirmPanel
              count={bulkConfirmQueue.length}
              onStart={handleStartSequentialReminders}
              onCancel={() => setBulkConfirmQueue(null)}
            />
          ) : (
            <button
              type="button"
              onClick={handleRemindAllClick}
              disabled={eligibleInView === 0}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1ebc59] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              📱 Remind All Pending Schools{eligibleInView > 0 ? ` (${eligibleInView})` : ""}
            </button>
          )}
          {bulkDoneMessage && <Alert type="success">{bulkDoneMessage}</Alert>}
        </>
      )}

      <Input
        placeholder="Search by School Name or EMIS Code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === f.key
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No schools match your search or filter" />
      ) : (
        <>
          {/* Mobile card list (below 768px) — avoids horizontal scrolling on small screens */}
          <div className="divide-y divide-brand-50 md:hidden">
            {filtered.map((r) => (
              <div key={r.schoolId} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-900">{r.schoolName}</p>
                    <p className="text-xs text-gray-500">EMIS: {r.emisCode}</p>
                    <p className="text-xs text-gray-500">{r.headteacherName ?? "Not assigned"}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.submitted ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.submitted ? "✅ Submitted" : "❌ Not Submitted"}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                  <MobileStat label="Drop Out" value={r.submitted ? r.dropout : "—"} />
                  <MobileStat label="Public" value={r.submitted ? r.publicAdmission : "—"} />
                  <MobileStat label="Private" value={r.submitted ? r.privateAdmission : "—"} />
                  <MobileStat label="Fresh" value={r.submitted ? r.freshAdmission : "—"} />
                </dl>
                {r.submitted && (
                  <p className="mt-1 text-right text-xs font-semibold text-brand-800">
                    Total Enrollment: {r.totalEnrollment}
                  </p>
                )}
                {remindersEnabled && !r.submitted && (
                  <div className="mt-3">
                    <ReminderButton
                      row={r}
                      opened={openedReminders.has(r.schoolId)}
                      onOpen={() => handleOpenSingleReminder(r)}
                      fullWidth
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tablet/desktop table (768px and up) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-gray-500">
                  <th className="py-2 pr-2">School Name</th>
                  <th className="py-2 pr-2">EMIS Code</th>
                  <th className="py-2 pr-2">Headteacher</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Drop Out</th>
                  <th className="py-2 pr-2">Public</th>
                  <th className="py-2 pr-2">Private</th>
                  <th className="py-2 pr-2">Fresh</th>
                  <th className="py-2 pr-2">Total</th>
                  {remindersEnabled && <th className="py-2 pr-2">Reminder</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.schoolId} className="border-b border-brand-50">
                    <td className="py-2 pr-2 font-medium text-brand-900">{r.schoolName}</td>
                    <td className="py-2 pr-2 text-gray-600">{r.emisCode}</td>
                    <td className="py-2 pr-2 text-gray-600">{r.headteacherName ?? "Not assigned"}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.submitted ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.submitted ? "✅ Submitted" : "❌ Not Submitted"}
                      </span>
                    </td>
                    <td className="py-2 pr-2">{r.submitted ? r.dropout : "—"}</td>
                    <td className="py-2 pr-2">{r.submitted ? r.publicAdmission : "—"}</td>
                    <td className="py-2 pr-2">{r.submitted ? r.privateAdmission : "—"}</td>
                    <td className="py-2 pr-2">{r.submitted ? r.freshAdmission : "—"}</td>
                    <td className="py-2 pr-2 font-semibold">{r.submitted ? r.totalEnrollment : "—"}</td>
                    {remindersEnabled && (
                      <td className="py-2 pr-2">
                        {!r.submitted && (
                          <ReminderButton
                            row={r}
                            opened={openedReminders.has(r.schoolId)}
                            onOpen={() => handleOpenSingleReminder(r)}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function BulkConfirmPanel({
  count,
  onStart,
  onCancel,
}: {
  count: number;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
      <p className="text-sm font-semibold text-brand-900">
        You have {count} pending schools with valid mobile numbers.
      </p>
      <p className="mt-1 text-sm text-gray-700">
        WhatsApp reminders will be opened one at a time because mobile browsers block multiple automatic
        pop-ups. Each chat will still need you to press Send yourself.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onStart}
          className="min-h-[48px] flex-1 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1ebc59]"
        >
          Start Reminders
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SequentialReminderPanel({
  state,
  onOpen,
  onNext,
  onCancel,
}: {
  state: BulkFlowState;
  onOpen: () => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const row = state.queue[state.index];
  const isLast = state.index === state.queue.length - 1;

  return (
    <div className="rounded-xl border-2 border-brand-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">
          {state.index + 1} of {state.queue.length} reminders processed
        </p>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-gray-400 hover:text-gray-600">
          ✕ Close
        </button>
      </div>

      <div className="mt-2">
        <p className="font-semibold text-brand-900">{row.schoolName}</p>
        <p className="text-xs text-gray-500">EMIS: {row.emisCode}</p>
        <p className="text-xs text-gray-500">Headteacher: {row.headteacherName ?? "Not assigned"}</p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 min-h-[48px] w-full rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1ebc59]"
      >
        📱 Open WhatsApp Reminder
      </button>

      {state.openedCurrent && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-brand-700">
            ✓ Reminder Opened — remember to press Send inside WhatsApp.
          </p>
          <button
            type="button"
            onClick={onNext}
            className="min-h-[48px] w-full rounded-xl border-2 border-brand-600 bg-white px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            {isLast ? "Finish" : "Next School →"}
          </button>
        </div>
      )}
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-brand-50 p-1.5">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-xs font-bold text-brand-900">{value}</p>
    </div>
  );
}

function ReminderButton({
  row,
  opened,
  onOpen,
  fullWidth = false,
}: {
  row: MonitorRow;
  opened: boolean;
  onOpen: () => void;
  fullWidth?: boolean;
}) {
  const eligible = isReminderEligible(row);

  if (!eligible) {
    return (
      <button
        type="button"
        disabled
        className={`min-h-[48px] cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-400 ${
          fullWidth ? "w-full" : ""
        }`}
      >
        ⚠ No Mobile Number
      </button>
    );
  }

  return (
    <div className={fullWidth ? "w-full" : "inline-flex flex-col items-start gap-1"}>
      <button
        type="button"
        onClick={onOpen}
        className={`min-h-[48px] rounded-xl bg-[#25D366] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1ebc59] ${
          fullWidth ? "w-full" : ""
        }`}
      >
        📱 WhatsApp Reminder
      </button>
      {opened && <p className="mt-1 text-xs font-semibold text-brand-700">✓ Reminder Opened</p>}
    </div>
  );
}
