"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  ConfirmModal,
  DrawerFieldRow,
  InlineEditFieldContainer,
  InlineEditStatus,
  InlineEditTrigger,
  SAVED_DURATION_MS,
  Select,
  editInputClass,
  editTriggerClass,
} from "@/components/ui";
import { updateCustomerAction, deleteCustomerAction } from "@/app/(app)/customers/actions";
import { DetailPageDeleteFooter } from "@/components/detail/DetailPageDeleteFooter";
import { isInlineEditValueChanged } from "@/lib/inlineEdit";
import { ROUTES } from "@/lib/routes";
import type { CustomerWithDetails } from "@/types";

type EditField =
  | "name"
  | "url"
  | "contactName"
  | "contactEmail"
  | "accountManager"
  | "logoUrl"
  | "color"
  | null;

type Props = {
  customer: CustomerWithDetails;
  allConsultants: { id: string; name: string }[];
  isAdmin: boolean;
};

export function CustomerDrawerOverview({
  customer,
  allConsultants,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(customer.name);
  const [url, setUrl] = useState(customer.url ?? "");
  const [contactName, setContactName] = useState(customer.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(customer.contactEmail ?? "");
  const [accountManagerId, setAccountManagerId] = useState(
    customer.accountManagerId ?? ""
  );
  const [accountManagerName, setAccountManagerName] = useState(
    customer.accountManagerName ?? ""
  );
  const [logoUrl, setLogoUrl] = useState(customer.logoUrl ?? "");
  const [color, setColor] = useState(customer.color);
  const [isActive, setIsActive] = useState(customer.isActive);
  const [isInternal, setIsInternal] = useState(customer.isInternal);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [lastSavedField, setLastSavedField] = useState<EditField>(null);
  const originalEditValueRef = useRef("");
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function startEdit(field: EditField, value: string) {
    setError(null);
    originalEditValueRef.current = value;
    setEditValue(value);
    setEditingField(field);
  }

  function cancelEdit() {
    setEditValue(originalEditValueRef.current);
    setEditingField(null);
    setError(null);
  }

  function markSaved(field: EditField) {
    setLastSavedField(field);
    setShowSaved(true);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => {
      savedTimeoutRef.current = null;
      setLastSavedField(null);
      setShowSaved(false);
    }, SAVED_DURATION_MS);
  }

  async function saveField(field: Exclude<EditField, null>, value: string) {
    const trimmed = value.trim();
    if (field === "name" && !trimmed) {
      setError("Customer name is required");
      return;
    }

    setError(null);
    setEditingField(null);
    setSubmitting(true);
    try {
      switch (field) {
        case "name":
          await updateCustomerAction(customer.id, { name: trimmed });
          setName(trimmed);
          break;
        case "url":
          await updateCustomerAction(customer.id, { url: trimmed || null });
          setUrl(trimmed);
          break;
        case "contactName":
          await updateCustomerAction(customer.id, {
            contact_name: trimmed || null,
          });
          setContactName(trimmed);
          break;
        case "contactEmail":
          await updateCustomerAction(customer.id, {
            contact_email: trimmed || null,
          });
          setContactEmail(trimmed);
          break;
        case "accountManager": {
          await updateCustomerAction(customer.id, {
            account_manager_id: value || null,
          });
          const selected = allConsultants.find(
            (consultant) => consultant.id === value
          );
          setAccountManagerId(value);
          setAccountManagerName(selected?.name ?? "");
          break;
        }
        case "logoUrl":
          await updateCustomerAction(customer.id, {
            logo_url: trimmed || null,
          });
          setLogoUrl(trimmed);
          break;
        case "color":
          await updateCustomerAction(customer.id, { color: trimmed || null });
          setColor(trimmed || customer.color);
          break;
      }
      markSaved(field);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update customer");
    } finally {
      setSubmitting(false);
    }
  }

  function commitEdit(overrideValue?: string) {
    if (editingField == null) return;
    const value = overrideValue ?? editValue;
    if (!isInlineEditValueChanged(originalEditValueRef.current, value)) {
      setEditingField(null);
      return;
    }
    void saveField(editingField, value);
  }

  async function toggleStatus() {
    const next = !isActive;
    setError(null);
    setSubmitting(true);
    try {
      await updateCustomerAction(customer.id, { is_active: next });
      setIsActive(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleType() {
    const next = !isInternal;
    setError(null);
    setSubmitting(true);
    try {
      await updateCustomerAction(customer.id, { is_internal: next });
      setIsInternal(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update type");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteCustomerAction(customer.id);
      setShowDeleteConfirm(false);
      router.push(ROUTES.customers);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete customer");
    } finally {
      setDeleting(false);
    }
  }

  const inlineStatus = submitting
    ? "saving"
    : showSaved
      ? "saved"
      : error
        ? "error"
        : "idle";

  function textField(
    label: string,
    field: Exclude<EditField, "accountManager" | "color" | null>,
    value: string,
    inputType: "text" | "url" | "email" = "text"
  ) {
    const displayValue = value || "—";
    return (
      <DrawerFieldRow label={label}>
        <InlineEditFieldContainer
          isEditing={editingField === field}
          onRequestClose={commitEdit}
          hideAccessory
          reserveStatusRow={false}
          showSavedIndicator={showSaved && lastSavedField === field}
          displayContent={
            <InlineEditTrigger
              boxed
              onClick={() => startEdit(field, value)}
              className={value ? "" : "text-text-tertiary"}
            >
              <span
                className={`truncate text-sm ${
                  field === "url" || field === "contactEmail"
                    ? "text-text-link"
                    : "text-text-primary"
                }`}
              >
                {displayValue}
              </span>
            </InlineEditTrigger>
          }
          editContent={
            <input
              type={inputType}
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={() => commitEdit()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitEdit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEdit();
                }
              }}
              className={editInputClass}
              autoFocus
            />
          }
          statusContent={
            <InlineEditStatus status={inlineStatus} message={error} />
          }
        />
      </DrawerFieldRow>
    );
  }

  return (
    <>
      <div className="flex min-h-full flex-col">
        {error ? (
          <p className="px-6 pt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="px-6">
          {textField("Name", "name", name)}
          {textField("URL", "url", url, "url")}
          {textField("Contact name", "contactName", contactName)}
          {textField("Contact email", "contactEmail", contactEmail, "email")}

          <DrawerFieldRow label="Account manager">
            <InlineEditFieldContainer
              isEditing={editingField === "accountManager"}
              onRequestClose={commitEdit}
              hideAccessory
              reserveStatusRow={false}
              showSavedIndicator={
                showSaved && lastSavedField === "accountManager"
              }
              displayContent={
                <InlineEditTrigger
                  boxed
                  showChevron
                  onClick={() =>
                    startEdit("accountManager", accountManagerId)
                  }
                  className={
                    accountManagerName ? "" : "text-text-tertiary"
                  }
                >
                  <span className="truncate text-sm">
                    {accountManagerName || "—"}
                  </span>
                </InlineEditTrigger>
              }
              editContent={
                <Select
                  value={editValue}
                  onValueChange={(value) => {
                    setEditValue(value);
                    commitEdit(value);
                  }}
                  onBlur={() => commitEdit()}
                  variant="inlineEdit"
                  options={[
                    { value: "", label: "—" },
                    ...(accountManagerId &&
                    accountManagerName &&
                    !allConsultants.some(
                      (consultant) => consultant.id === accountManagerId
                    )
                      ? [
                          {
                            value: accountManagerId,
                            label: accountManagerName,
                          },
                        ]
                      : []),
                    ...allConsultants.map((consultant) => ({
                      value: consultant.id,
                      label: consultant.name,
                    })),
                  ]}
                  placeholder="—"
                  className="min-w-0 w-full flex-1"
                  triggerClassName={editTriggerClass}
                />
              }
              statusContent={
                <InlineEditStatus status={inlineStatus} message={error} />
              }
            />
          </DrawerFieldRow>
        </div>

        <div className="border-t border-border-subtle px-6">
          <DrawerFieldRow label="Status">
            <Badge
              variant={isActive ? "active" : "inactive"}
              interactive
              onClick={() => void toggleStatus()}
              disabled={submitting}
            >
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </DrawerFieldRow>
          <DrawerFieldRow label="Type">
            <Badge
              variant="muted"
              interactive
              onClick={() => void toggleType()}
              disabled={submitting}
            >
              {isInternal ? "Internal" : "Standard"}
            </Badge>
          </DrawerFieldRow>
        </div>

        <div className="border-t border-border-subtle px-6">
          {textField("Logo URL", "logoUrl", logoUrl, "url")}
          <DrawerFieldRow label="Color">
            <InlineEditFieldContainer
              isEditing={editingField === "color"}
              onRequestClose={commitEdit}
              hideAccessory
              reserveStatusRow={false}
              showSavedIndicator={showSaved && lastSavedField === "color"}
              displayContent={
                <InlineEditTrigger
                  boxed
                  onClick={() => startEdit("color", color)}
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
                    <span
                      className="h-4 w-4 shrink-0 rounded-sm border border-border-default"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="truncate">{color}</span>
                  </span>
                </InlineEditTrigger>
              }
              editContent={
                <input
                  type="color"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onBlur={() => commitEdit()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEdit();
                    }
                  }}
                  className="h-9 w-full cursor-pointer rounded-md border border-form bg-bg-default p-1"
                  autoFocus
                  aria-label="Customer color"
                />
              }
              statusContent={
                <InlineEditStatus status={inlineStatus} message={error} />
              }
            />
          </DrawerFieldRow>
        </div>

        {isAdmin ? (
          <div className="mt-auto border-t border-border-subtle px-6 pb-6 pt-2">
            <DetailPageDeleteFooter
              onRequestDelete={() => setShowDeleteConfirm(true)}
              disabled={submitting || deleting}
              label="Delete customer"
              className="pt-2"
            />
          </div>
        ) : null}
      </div>

      {isAdmin ? (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete customer"
          message={`Delete ${name}? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </>
  );
}
