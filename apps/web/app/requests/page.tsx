import { RequestCard, RequestFilters } from "@/features/requests";
import { requests } from "@/features/requests/mock";

export default function RequestsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold">Requests</h1>
          <p className="text-sm text-muted">
            Ask for help, offer help, or start a spontaneous mission.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <RequestFilters />
          <div className="grid gap-6 md:grid-cols-2">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
