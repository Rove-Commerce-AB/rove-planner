import { ROUTES } from "@/lib/routes";

export type Breadcrumb = {
  label: string;
  href?: string;
};

/**
 * App chrome breadcrumbs from the current pathname.
 * The last item is the current page (no href).
 */
export function breadcrumbsForPathname(pathname: string): Breadcrumb[] {
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
    return [root, { label: "Rove Work" }];
  }

  if (pathname.startsWith("/reports")) {
    return [root, { label: "Reports" }];
  }

  if (pathname.startsWith("/customer-status")) {
    return [root, { label: "Customer status" }];
  }

  return [root];
}
