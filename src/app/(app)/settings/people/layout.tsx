import { redirect } from "next/navigation";
import { PeoplePageClient } from "@/components/PeoplePageClient";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getCalendars } from "@/lib/calendars";
import { getCustomers } from "@/lib/customers";
import { getPeopleForAdmin } from "@/lib/people";
import { getRoles } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") redirect("/access-denied");

  let people: Awaited<ReturnType<typeof getPeopleForAdmin>> = [];
  let roles: Awaited<ReturnType<typeof getRoles>> = [];
  let calendars: Awaited<ReturnType<typeof getCalendars>> = [];
  let customers: {
    id: string;
    name: string;
    isInternal: boolean;
    url: string | null;
    color: string | null;
  }[] = [];
  let error: string | null = null;

  try {
    const [peopleResult, rolesResult, calendarsResult, customersResult] =
      await Promise.all([
        getPeopleForAdmin(),
        getRoles(),
        getCalendars(),
        getCustomers(),
      ]);
    people = peopleResult;
    roles = rolesResult;
    calendars = calendarsResult;
    customers = customersResult.map((customer) => ({
      id: customer.id,
      name: customer.name,
      isInternal: customer.is_internal,
      url: customer.url,
      color: customer.color,
    }));
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to load people";
  }

  return (
    <>
      <PeoplePageClient
        people={people}
        roles={roles.map((role) => ({ id: role.id, name: role.name }))}
        calendars={calendars.map((calendar) => ({
          id: calendar.id,
          name: calendar.name,
        }))}
        customers={customers}
        error={error}
      />
      <div hidden>{children}</div>
    </>
  );
}
