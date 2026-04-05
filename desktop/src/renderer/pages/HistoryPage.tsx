import { useEffect, useState } from "react";
import { getTranscriptHistory } from "../lib/api";
import { TranscriptHistoryRecord } from "../types";
import {
  Button,
  Card,
  PageHeader,
  EmptyState,
  Skeleton,
} from "../components/ui";

export function HistoryPage() {
  const [items, setItems] = useState<TranscriptHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setLoading(true);

    void getTranscriptHistory(50)
      .then((history) => {
        if (!isActive) {
          return;
        }
        setItems(history);
        setError(null);
      })
      .catch((loadError) => {
        if (!isActive) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load history.",
        );
        setItems([]);
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function onOpenLink(url: string) {
    await window.electronAPI.openExternal(url);
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="History"
        subtitle="Only meetings transcribed through Brifo appear here."
      />

      <Card>
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton width="60%" />
                  <Skeleton width="30%" />
                  <Skeleton width="20%" />
                </div>
                <Skeleton variant="rect" width={80} height={32} />
              </div>
            ))}
          </div>
        ) : items.length ? (
          <div className="flex flex-col divide-y divide-gray-100">
            {items.map((item) => (
              <div
                key={item.meetingId}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.title || "Transcribed meeting"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(
                      item.startTime || item.lastTranscriptAt,
                    ).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.transcriptSegments} transcript line
                    {item.transcriptSegments > 1 ? "s" : ""}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (!item.joinUrl) {
                      return;
                    }
                    void onOpenLink(item.joinUrl);
                  }}
                  disabled={!item.joinUrl}
                >
                  {item.joinUrl ? "Open Link" : "No Link"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No transcribed meetings yet"
            description="Meetings transcribed through Brifo will appear here."
          />
        )}

        {error ? <p className="text-xs text-error-600 mt-3">{error}</p> : null}
      </Card>
    </section>
  );
}
