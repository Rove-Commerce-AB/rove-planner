"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction, deleteCustomerAction } from "@/app/(app)/customers/actions";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import { Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmModal,
  DetailPageHeader,
  FieldLabel,
  FieldValue,
  IconButton,
  InlineEditFieldContainer,
  InlineEditStatus,
  InlineEditTrigger,
  Panel,
  PanelSectionTitle,
  SAVED_DURATION_MS,
  editTriggerClass,
  Select,
  editInputClass,
} from "@/components/ui";
import { CustomerRatesTab } from "./CustomerRatesTab";
import { AddProjectModal } from "./AddProjectModal";
import { AddCustomerConsultantModal } from "./AddCustomerConsultantModal";
import { AddCustomerRateModal } from "./AddCustomerRateModal";
import { removeConsultantFromCustomer } from "@/lib/customerConsultants";
import type { CustomerWithDetails } from "@/types";
import type { CustomerConsultant } from "@/lib/customerConsultants";
import { isInlineEditValueChanged } from "@/lib/inlineEdit";
import { useSidePanel } from "@/contexts/SidePanelContext";

const tableBorder = "border-panel";

type EditField =
  | "name"
  | "url"
  | "accountManager"
  | "color"
  | "logoUrl"
  | null;

type Props = {
  customer: CustomerWithDetails;
  initialConsultants: CustomerConsultant[];
  allConsultants: { id: string; name: string }[];
};

export function CustomerDetailClient({
  customer: initialCustomer,
  initialConsultants,
  allConsultants,
}: Props) {
  const router = useRouter();
  const { refreshCustomers } = useSidePanel();
  const [name, setName] = useState(initialCustomer.name);
  const [accountManagerId, setAccountManagerId] = useState<string | null>(
    initialCustomer.accountManagerId ?? null
  );
  const [accountManagerName, setAccountManagerName] = useState<string | null>(
    initialCustomer.accountManagerName ?? null
  );
  const [color, setColor] = useState(
    initialCustomer.color ?? DEFAULT_CUSTOMER_COLOR
  );
  const [logoUrl, setLogoUrl] = useState(initialCustomer.logoUrl ?? "");
  const [url, setUrl] = useState(initialCustomer.url ?? "");
  const [isActive, setIsActive] = useState(initialCustomer.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false);
  const [showInactiveProjects, setShowInactiveProjects] = useState(false);
  const [addConsultantModalOpen, setAddConsultantModalOpen] = useState(false);
  const [addRateModalOpen, setAddRateModalOpen] = useState(false);
  const [removingConsultantId, setRemovingConsultantId] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const colorEditWrapperRef = useRef<HTMLDivElement>(null);
  const [showRemoveConsultantConfirm, setShowRemoveConsultantConfirm] = useState(false);
  const [consultantToRemove, setConsultantToRemove] = useState<CustomerConsultant | null>(null);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState<string>("");
  const originalEditValueRef = useRef<string>("");
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFieldRef = useRef<EditField>(null);
  const [logoImageError, setLogoImageError] = useState(false);

  const syncFromInitial = useCallback(() => {
    setName(initialCustomer.name);
    setAccountManagerId(initialCustomer.accountManagerId ?? null);
    setAccountManagerName(initialCustomer.accountManagerName ?? null);
    setColor(initialCustomer.color ?? DEFAULT_CUSTOMER_COLOR);
    setLogoUrl(initialCustomer.logoUrl ?? "");
    setIsActive(initialCustomer.isActive ?? true);
    setLogoImageError(false);
  }, [initialCustomer]);

  useEffect(() => {
    syncFromInitial();
  }, [syncFromInitial]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const saveField = async (field: EditField, value: string) => {
    if (field == null) return;
    setError(null);
    const trimmed = value.trim();
    if (field === "name" && !trimmed) {
      setError("Company name is required");
      return;
    }
    switch (field) {
      case "name":
        setName(trimmed);
        break;
      case "accountManager": {
        const chosen = allConsultants.find((c) => c.id === value);
        setAccountManagerId(value || null);
        setAccountManagerName(chosen?.name ?? null);
        break;
      }
      case "color":
        setColor(trimmed || DEFAULT_CUSTOMER_COLOR);
        break;
      case "logoUrl":
        setLogoUrl(trimmed || "");
        break;
      case "url":
        setUrl(trimmed || "");
        break;
      default:
        break;
    }
    lastSavedFieldRef.current = field;
    setEditingField(null);
    setShowSaved(true);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => {
      savedTimeoutRef.current = null;
      lastSavedFieldRef.current = null;
      setShowSaved(false);
    }, SAVED_DURATION_MS);
    setSubmitting(true);
    try {
      switch (field) {
        case "name":
          await updateCustomerAction(initialCustomer.id, { name: trimmed });
          break;
        case "accountManager":
          await updateCustomerAction(initialCustomer.id, {
            account_manager_id: value || null,
          });
          break;
        case "color":
          await updateCustomerAction(initialCustomer.id, {
            color: trimmed || null,
          });
          break;
        case "logoUrl":
          await updateCustomerAction(initialCustomer.id, {
            logo_url: trimmed || null,
          });
          break;
        case "url":
          await updateCustomerAction(initialCustomer.id, {
            url: trimmed || null,
          });
          break;
        default:
          break;
      }
      if (field !== "logoUrl") refreshCustomers();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
      setShowSaved(false);
      lastSavedFieldRef.current = null;
      switch (field) {
        case "name": setName(initialCustomer.name); break;
        case "accountManager":
          setAccountManagerId(initialCustomer.accountManagerId ?? null);
          setAccountManagerName(initialCustomer.accountManagerName ?? null);
          break;
        case "color": setColor(initialCustomer.color ?? DEFAULT_CUSTOMER_COLOR); break;
        case "logoUrl": setLogoUrl(initialCustomer.logoUrl ?? ""); break;
        case "url": setUrl(initialCustomer.url ?? ""); break;
        default: break;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (field: EditField, value: string) => {
    setError(null);
    const normalized =
      field === "color" && value
        ? value.startsWith("#")
          ? value.slice(0, 7)
          : `#${value.slice(0, 6)}`
        : value;
    originalEditValueRef.current = normalized;
    setEditValue(normalized);
    setEditingField(field);
  };

  const cancelEdit = () => {
    setEditValue(originalEditValueRef.current);
    setEditingField(null);
    setError(null);
  };

  const commitEdit = (overrideValue?: string) => {
    if (editingField == null) return;
    const val = overrideValue ?? editValue;
    if (!isInlineEditValueChanged(originalEditValueRef.current, val)) {
      setEditingField(null);
      return;
    }
    saveField(editingField, val);
  };

  const inlineEditStatus =
    submitting ? "saving" : showSaved ? "saved" : error ? "error" : "idle";

  const handleToggleActive = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await updateCustomerAction(initialCustomer.id, { is_active: !isActive });
      setIsActive(!isActive);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteCustomerAction(initialCustomer.id);
      setShowDeleteConfirm(false);
      router.push("/customers");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveConsultant = (consultant: CustomerConsultant) => {
    setConsultantToRemove(consultant);
    setShowRemoveConsultantConfirm(true);
  };

  const confirmRemoveConsultant = async () => {
    if (!consultantToRemove) return;
    setError(null);
    setRemovingConsultantId(consultantToRemove.id);
    try {
      await removeConsultantFromCustomer(initialCustomer.id, consultantToRemove.id);
      setShowRemoveConsultantConfirm(false);
      setConsultantToRemove(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove consultant");
    } finally {
      setRemovingConsultantId(null);
    }
  };

  return (
    <>
      <DetailPageHeader
        avatar={
          editingField === "logoUrl" ? (
            <input
              type="url"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => commitEdit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              placeholder="https://example.com/logo.png"
              className="h-9 w-full min-w-0 rounded border border-form bg-bg-default px-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              autoFocus
              aria-label="Logo URL"
            />
          ) : logoUrl && !logoImageError ? (
            <button
              type="button"
              onClick={() => startEdit("logoUrl", logoUrl)}
              className="flex h-full w-full min-h-[4rem] cursor-pointer items-center justify-center overflow-hidden rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2"
              aria-label="Change logo URL"
            >
              <img
                src={logoUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startEdit("logoUrl", logoUrl)}
              className="cursor-pointer rounded-lg border-2 border-dashed border-form px-4 py-2.5 text-sm text-text-primary opacity-70 transition-colors hover:border-brand-signal/50 hover:bg-bg-muted/30 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2"
              aria-label="Add logo"
            >
              Add logo
            </button>
          )
        }
        avatarContainerClassName={
          editingField === "logoUrl"
            ? "flex h-14 min-w-[12rem] w-48 flex-shrink-0 items-center justify-center rounded-lg border border-form bg-bg-default px-2"
            : logoUrl && !logoImageError
              ? "flex h-20 min-w-[10rem] max-w-[14rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-lg px-3 py-2"
              : "flex flex-shrink-0 items-center"
        }
        title={logoUrl && !logoImageError ? "" : name}
      />

      <div>
        {error && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-5">
          {/* GENERAL INFORMATION */}
          <Panel>
            <PanelSectionTitle>GENERAL INFORMATION</PanelSectionTitle>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
              <div>
                <FieldLabel>Company name</FieldLabel>
                <InlineEditFieldContainer
                    isEditing={editingField === "name"}
                    onRequestClose={commitEdit}
                    showSavedIndicator={showSaved && lastSavedFieldRef.current === "name"}
                    displayContent={
                      <InlineEditTrigger onClick={() => startEdit("name", name)}>
                        <FieldValue>{name}</FieldValue>
                      </InlineEditTrigger>
                    }
                    editContent={
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => commitEdit()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className={editInputClass}
                        placeholder="Company AB"
                        autoFocus
                      />
                    }
                    statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
                  />
              </div>

              <div>
                <FieldLabel>URL</FieldLabel>
                <InlineEditFieldContainer
                    isEditing={editingField === "url"}
                    onRequestClose={commitEdit}
                    showSavedIndicator={showSaved && lastSavedFieldRef.current === "url"}
                    displayContent={
                      <InlineEditTrigger onClick={() => startEdit("url", url)}>
                        <FieldValue>{url || "—"}</FieldValue>
                      </InlineEditTrigger>
                    }
                    editContent={
                      <input
                        type="url"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => commitEdit()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className={editInputClass}
                        placeholder="https://example.com"
                        autoFocus
                      />
                    }
                    statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
                  />
              </div>

              <div>
                <FieldLabel>Account Manager</FieldLabel>
                <InlineEditFieldContainer
                    isEditing={editingField === "accountManager"}
                    onRequestClose={commitEdit}
                    showSavedIndicator={showSaved && lastSavedFieldRef.current === "accountManager"}
                    displayContent={
                      <InlineEditTrigger
                        onClick={() =>
                          startEdit("accountManager", accountManagerId ?? "")
                        }
                      >
                        <FieldValue>{accountManagerName ?? "—"}</FieldValue>
                      </InlineEditTrigger>
                    }
                    editContent={
                      <Select
                        value={editValue}
                        onValueChange={(v) => {
                          setEditValue(v);
                          commitEdit(v);
                        }}
                        onBlur={() => commitEdit()}
                        options={[
                          { value: "", label: "—" },
                          ...allConsultants.map((c) => ({
                            value: c.id,
                            label: c.name,
                          })),
                        ]}
                        placeholder="—"
                        className="min-w-0 flex-1 w-full"
                        triggerClassName={editTriggerClass}
                      />
                    }
                    statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
                  />
              </div>

              </div>

              <div className="space-y-1.5">
              <div>
                <FieldLabel>Color</FieldLabel>
                <InlineEditFieldContainer
                    isEditing={editingField === "color"}
                    onRequestClose={commitEdit}
                    showSavedIndicator={showSaved && lastSavedFieldRef.current === "color"}
                    displayContent={
                      <InlineEditTrigger onClick={() => startEdit("color", color)}>
                        <span className="flex items-center gap-3">
                          <span
                            className="inline-block h-6 w-6 flex-shrink-0 rounded border border-form"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          <FieldValue>{color}</FieldValue>
                        </span>
                      </InlineEditTrigger>
                    }
                    editContent={
                      <div ref={colorEditWrapperRef} className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
                        <input
                          ref={colorInputRef}
                          type="color"
                          key={editValue}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="sr-only"
                          aria-label="Välj färg"
                        />
                        <button
                          type="button"
                          onClick={() => colorInputRef.current?.click()}
                          className="h-10 w-14 shrink-0 cursor-pointer rounded border border-form p-0 transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-signal/20 focus:ring-inset"
                          style={{ backgroundColor: editValue }}
                          title="Öppna färgväljare"
                        />
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => {
                            const next = e.relatedTarget as Node | null;
                            if (next && colorEditWrapperRef.current?.contains(next)) return;
                            commitEdit();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          placeholder={DEFAULT_CUSTOMER_COLOR}
                          className={editInputClass}
                          autoFocus
                        />
                      </div>
                    }
                    statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
                  />
              </div>

              <div>
                <FieldLabel>Status</FieldLabel>
                <Badge
                  variant={isActive ? "active" : "inactive"}
                  interactive
                  onClick={handleToggleActive}
                  disabled={submitting}
                >
                  {isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              </div>
            </div>
          </Panel>

          {/* PROJECTS */}
          <Panel>
            <PanelSectionTitle
              action={
                <IconButton
                  aria-label="Add project"
                  onClick={() => setAddProjectModalOpen(true)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <Plus className="h-4 w-4" />
                </IconButton>
              }
            >
              PROJECTS
            </PanelSectionTitle>
            <div className="overflow-x-auto p-3 pt-0">
              {initialCustomer.projects.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-primary opacity-60">
                  No projects for this customer.
                </p>
              ) : (
                <>
                  <ul className="space-y-0.5">
                    {[...(showInactiveProjects ? initialCustomer.projects : initialCustomer.projects.filter((p) => p.isActive))]
                      .sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1))
                      .map((p) => (
                        <li
                          key={p.id}
                          className={`flex h-[2.25rem] cursor-pointer items-center gap-4 rounded-md px-2 transition-colors hover:bg-bg-muted/50 ${!p.isActive ? "opacity-60" : ""}`}
                          onClick={() => router.push(`/projects/${p.id}`)}
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                            {p.name}
                          </span>
                        </li>
                      ))}
                  </ul>
                  {!showInactiveProjects && initialCustomer.projects.some((p) => !p.isActive) && (
                    <button
                      type="button"
                      onClick={() => setShowInactiveProjects(true)}
                      className="mt-2 w-full rounded-md py-2 text-center text-sm font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                      aria-label="Show inactive projects"
                    >
                      Show inactive ({initialCustomer.projects.filter((p) => !p.isActive).length})
                    </button>
                  )}
                  {showInactiveProjects && initialCustomer.projects.some((p) => !p.isActive) && (
                    <button
                      type="button"
                      onClick={() => setShowInactiveProjects(false)}
                      className="mt-2 w-full rounded-md py-2 text-center text-sm font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                      aria-label="Hide inactive projects"
                    >
                      Hide inactive
                    </button>
                  )}
                </>
              )}
            </div>
          </Panel>

          {/* CONSULTANTS + RATES/TASKS */}
          <div className="mt-0 flex flex-col gap-5">
            <Panel>
              <PanelSectionTitle
                action={
                  <IconButton
                    aria-label="Add consultant"
                    onClick={() => setAddConsultantModalOpen(true)}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <Plus className="h-4 w-4" />
                  </IconButton>
                }
              >
                CONSULTANTS
              </PanelSectionTitle>
              <div className="overflow-x-auto p-3 pt-0">
                {initialConsultants.length === 0 ? (
                  <p className="py-4 text-center text-sm text-text-primary opacity-60">
                    No consultants assigned. Add consultants to limit which projects are available when allocating.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {initialConsultants.map((c) => (
                      <li
                        key={c.id}
                        className="flex h-[2.25rem] items-center gap-4 rounded-md px-2 transition-colors hover:bg-bg-muted/50"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                          {c.name}
                        </span>
                        <IconButton
                          variant="ghostDanger"
                          aria-label={`Remove ${c.name}`}
                          onClick={() => handleRemoveConsultant(c)}
                          disabled={removingConsultantId !== null}
                          className="shrink-0 self-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelSectionTitle
                action={
                  <IconButton
                    aria-label="Add rate"
                    onClick={() => setAddRateModalOpen(true)}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <Plus className="h-4 w-4" />
                  </IconButton>
                }
              >
                RATES/TASKS
              </PanelSectionTitle>
              <div className="p-3 pt-0">
                {ratesError && (
                  <p className="mb-4 text-sm text-danger">{ratesError}</p>
                )}
                <CustomerRatesTab
                  mode="edit"
                  customerId={initialCustomer.id}
                  onError={setRatesError}
                  showDescription={false}
                />
              </div>
            </Panel>
          </div>

          <div className="pt-4">
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={submitting || deleting}
            >
              Delete customer
            </Button>
          </div>
        </div>
      </div>

      <AddProjectModal
        isOpen={addProjectModalOpen}
        onClose={() => setAddProjectModalOpen(false)}
        onSuccess={() => router.refresh()}
        initialCustomerId={initialCustomer.id}
        redirectToProject={false}
      />

      <AddCustomerConsultantModal
        isOpen={addConsultantModalOpen}
        onClose={() => setAddConsultantModalOpen(false)}
        onSuccess={() => router.refresh()}
        customerId={initialCustomer.id}
        existingConsultants={initialConsultants}
      />

      <AddCustomerRateModal
        isOpen={addRateModalOpen}
        onClose={() => setAddRateModalOpen(false)}
        onSuccess={() => router.refresh()}
        customerId={initialCustomer.id}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete customer"
        message={`Delete ${name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />

      <ConfirmModal
        isOpen={showRemoveConsultantConfirm}
        title="Remove consultant"
        message={
          consultantToRemove
            ? `Remove ${consultantToRemove.name} from this customer? They will no longer see this customer's projects in Add Allocation.`
            : ""
        }
        confirmLabel="Remove"
        variant="primary"
        onClose={() => {
          setShowRemoveConsultantConfirm(false);
          setConsultantToRemove(null);
        }}
        onConfirm={confirmRemoveConsultant}
      />
    </>
  );
}
