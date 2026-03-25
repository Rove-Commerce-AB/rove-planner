"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { Check, Trash2 } from "lucide-react";
import type { FeatureRequest } from "@/lib/featureRequests";
import {
  IconButton,
  InlineEditStatus,
  Panel,
  PanelSectionTitle,
  SavedCheckmark,
  editInputListClass,
  INLINE_EDIT_STATUS_ROW_MIN_H,
} from "@/components/ui";

export function SettingsFeatureRequestsSection({
  featureRequests,
  editingFeatureRequestId,
  setEditingFeatureRequestId,
  editingFeatureRequestValue,
  setEditingFeatureRequestValue,
  saveFeatureRequestInline,
  cancelFeatureRequestEdit,
  showSavedFeatureRequest,
  lastSavedFeatureRequestIdRef,
  savingFeatureRequest,
  featureRequestError,
  togglingImplementedId,
  handleToggleImplemented,
  setFeatureRequestError,
  setFeatureRequestToDelete,
}: {
  featureRequests: FeatureRequest[];
  editingFeatureRequestId: string | null;
  setEditingFeatureRequestId: Dispatch<SetStateAction<string | null>>;
  editingFeatureRequestValue: string;
  setEditingFeatureRequestValue: Dispatch<SetStateAction<string>>;
  saveFeatureRequestInline: (originalContent: string) => void | Promise<void>;
  cancelFeatureRequestEdit: (restoreContent: string) => void;
  showSavedFeatureRequest: boolean;
  lastSavedFeatureRequestIdRef: MutableRefObject<string | null>;
  savingFeatureRequest: boolean;
  featureRequestError: string | null;
  togglingImplementedId: string | null;
  handleToggleImplemented: (fr: FeatureRequest) => void | Promise<void>;
  setFeatureRequestError: Dispatch<SetStateAction<string | null>>;
  setFeatureRequestToDelete: Dispatch<SetStateAction<FeatureRequest | null>>;
}) {
  return (
    <Panel>
      <PanelSectionTitle>FEATURE REQUESTS</PanelSectionTitle>
      <div className="overflow-x-auto p-3 pt-0">
        <ul className="space-y-0.5">
          {featureRequests.length === 0 ? (
            <li className="rounded-md px-2 py-3 text-center text-sm text-text-primary opacity-60">
              No feature requests yet.
            </li>
          ) : (
            featureRequests.map((fr) => (
              <li
                key={fr.id}
                className={`flex items-start gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-bg-muted/50 ${fr.is_implemented ? "bg-green-100/80 dark:bg-green-900/20" : ""}`}
              >
                <div className="min-w-0 flex-1 flex flex-col">
                  <div className="flex min-h-[2rem] flex-col">
                    {editingFeatureRequestId === fr.id ? (
                      <textarea
                        value={editingFeatureRequestValue}
                        onChange={(e) => setEditingFeatureRequestValue(e.target.value)}
                        onBlur={() => void saveFeatureRequestInline(fr.content)}
                        rows={2}
                        className={editInputListClass}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelFeatureRequestEdit(fr.content);
                          }
                        }}
                      />
                    ) : (
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text-primary">{fr.content}</p>
                          {(fr.submitted_by_email || fr.created_at) && (
                            <p className="mt-1 text-xs text-text-primary opacity-60">
                              Requested by{fr.submitted_by_email ? `: ${fr.submitted_by_email}` : ""}
                              {fr.created_at && (
                                <span>
                                  {fr.submitted_by_email ? " · " : ": "}
                                  {new Date(fr.created_at).toLocaleDateString(undefined, {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        {showSavedFeatureRequest &&
                          lastSavedFeatureRequestIdRef.current === fr.id && <SavedCheckmark />}
                      </div>
                    )}
                  </div>
                  <div className={`shrink-0 ${INLINE_EDIT_STATUS_ROW_MIN_H}`}>
                    {editingFeatureRequestId === fr.id ? (
                      <InlineEditStatus
                        status={
                          savingFeatureRequest
                            ? "saving"
                            : showSavedFeatureRequest
                              ? "saved"
                              : featureRequestError
                                ? "error"
                                : "idle"
                        }
                        message={featureRequestError}
                      />
                    ) : (
                      <div className={INLINE_EDIT_STATUS_ROW_MIN_H} aria-hidden />
                    )}
                  </div>
                </div>
                {editingFeatureRequestId !== fr.id && (
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void handleToggleImplemented(fr)}
                      disabled={togglingImplementedId === fr.id}
                      className={`cursor-pointer rounded-sm p-1.5 transition-colors disabled:opacity-50 ${fr.is_implemented ? "text-green-600 opacity-100" : "text-text-primary opacity-60 hover:opacity-100"} hover:bg-bg-muted/50`}
                      aria-label={
                        fr.is_implemented ? "Mark as not implemented" : "Mark as implemented"
                      }
                      title={fr.is_implemented ? "Mark as not implemented" : "Implemented"}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFeatureRequestError(null);
                        setEditingFeatureRequestId(fr.id);
                        setEditingFeatureRequestValue(fr.content);
                      }}
                      className="cursor-pointer rounded-sm px-2 py-1 text-xs font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                      aria-label="Edit"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <IconButton
                      variant="ghostDanger"
                      onClick={() => setFeatureRequestToDelete(fr)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </Panel>
  );
}
