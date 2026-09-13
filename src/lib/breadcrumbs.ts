import { ROUTES } from "@/lib/routes";

export type Breadcrumb = {
  label: string;
  href?: string;
};

export type BreadcrumbExtras = {
  workCustomerName?: string;
  workBoardTitle?: string;
  workIssueKey?: string;
};

/**
 * App chrome breadcrumbs from the current pathname.
 * The last item is the current page (no href).
 */
export function breadcrumbsForPathname(
  pathname: string,
  extras?: BreadcrumbExtras
): Breadcrumb[] {
  const root: Breadcrumb = { label: "Rove Apps", href: ROUTES.home };

  if (pathname === "/") {
    return [root, { label: "Home" }];
  }

  if (pathname.startsWith("/planner")) {
    return [root, { label: "Planner" }, { label: "Allocation" }];
  }

  if (pathname.startsWith(ROUTES.timeApproval)) {
    return [root, { label: "Time report" }, { label: "Time approval" }];
  }

  if (pathname.startsWith("/time-report")) {
    return [root, { label: "Time report" }, { label: "Time report" }];
  }

  if (pathname.startsWith("/settings")) {
    const settings: Breadcrumb = { label: "Settings" };
    if (pathname.startsWith(ROUTES.settings)) {
      return [root, settings, { label: "General" }];
    }
    if (pathname.startsWith(ROUTES.people)) {
      return [root, settings, { label: "People" }];
    }
    if (pathname.startsWith(ROUTES.consultants)) {
      return [root, settings, { label: "Consultants" }];
    }
    if (pathname.startsWith(ROUTES.customers)) {
      return [root, settings, { label: "Customers" }];
    }
    return [root, { label: "Settings" }];
  }

  if (pathname.startsWith(ROUTES.notifications)) {
    return [root, { label: "Notifications" }];
  }

  if (pathname.startsWith("/projects")) {
    return [root, { label: "Projects" }];
  }

  if (pathname.startsWith("/taskboard")) {
    return [root, { label: "Taskboard" }];
  }

  if (pathname.startsWith("/insights")) {
    return [root, { label: "Insights" }];
  }

  if (pathname.startsWith(ROUTES.work)) {
    const work: Breadcrumb = { label: "Rove Work", href: ROUTES.work };
    const remainder = pathname.slice(ROUTES.work.length).replace(/^\//, "");
    if (!remainder) {
      return [root, { label: "Rove Work" }];
    }
    const parts = remainder.split("/").filter(Boolean);
    const customerName = extras?.workCustomerName?.trim();
    const boardTitle = extras?.workBoardTitle?.trim();
    const issueKey = extras?.workIssueKey?.trim();
    const crumbs: Breadcrumb[] = [root, work];
    const customerHref = `${ROUTES.work}/${parts[0]}`;
    crumbs.push({
      label: customerName || "Customer",
      href: parts[1] ? customerHref : undefined,
    });
    if (parts[1]) {
      const boardHref = `${customerHref}/${parts[1]}`;
      crumbs.push({
        label: boardTitle || "Board",
        href: parts[2] ? boardHref : undefined,
      });
    }
    if (parts[2]) {
      crumbs.push({ label: issueKey || "Issue" });
    }
    return crumbs;
  }

  if (pathname.startsWith("/reports")) {
    return [root, { label: "Reports" }];
  }

  if (pathname.startsWith("/customer-status")) {
    return [root, { label: "Customer status" }];
  }

  return [root];
}
