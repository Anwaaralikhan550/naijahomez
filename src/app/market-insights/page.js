export const dynamic = 'force-dynamic';

import SponsoredAdSlot from '@/components/advertising/SponsoredAdSlot';

export const metadata = {
  title: 'Nijahomzs Market Insights - Nigerian Property Trends',
  description: 'Explore public Nijahomzs property trends by active listing location, category, and indicative pricing.'
};

async function getEngine() {
  const engineModule = await import('@/lib/content/content-engine');
  return engineModule.default || engineModule;
}

function formatDate(value) {
  if (!value) return 'Latest available data';
  try {
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return 'Latest available data';
  }
}

export default async function MarketInsightsPage() {
  const engine = await getEngine();
  const trend = await engine.getLatestMarketTrends({ allowRefresh: true }).catch(() => null);
  const locations = trend?.locations || [];
  const priorityMarkets = trend?.priorityMarkets?.length ? trend.priorityMarkets : locations.slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Public market pulse
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
              Nigerian property trends from active Nijahomzs listings
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              A practical snapshot of active listing supply across key markets, refreshed from marketplace data.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Listings analysed</p>
            <p className="mt-2 text-4xl font-bold text-blue-950">{trend?.totals?.totalActiveListings || 0}</p>
            <p className="mt-2 text-sm text-gray-500">Updated {formatDate(trend?.generatedAt || trend?.updatedAt)}</p>
          </div>
        </div>

        <SponsoredAdSlot
          slot="market_insights_banner"
          propertyCategory="market_insights"
          variant="banner"
          className="mt-8"
        />

        {locations.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-blue-100 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-gray-900">No market trend snapshot is available yet.</p>
            <p className="mt-2 text-gray-600">The content worker can generate this from active listings.</p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {priorityMarkets.slice(0, 3).map((item) => (
                <div key={`${item.state}-${item.location}`} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-blue-600">{item.state}</p>
                  <h2 className="mt-2 text-2xl font-bold text-blue-950">{item.location}</h2>
                  <p className="mt-4 text-3xl font-bold text-emerald-700">{item.count}</p>
                  <p className="text-sm text-gray-500">active listings</p>
                  {item.averagePriceLabel && (
                    <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                      Avg. listed price: {item.averagePriceLabel}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b bg-gray-50 px-5 py-4">
                <h2 className="text-lg font-bold text-gray-900">Top active locations</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {locations.slice(0, 15).map((item, index) => {
                  const maxCount = locations[0]?.count || 1;
                  const width = Math.max(6, Math.round((item.count / maxCount) * 100));
                  return (
                    <div key={`${item.state}-${item.location}-${index}`} className="p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">#{index + 1} {item.location}</p>
                          <p className="text-sm text-gray-500">{item.state}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-blue-700">{item.count}</p>
                          <p className="text-xs text-gray-500">active</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
