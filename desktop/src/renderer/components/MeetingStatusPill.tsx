import { Meeting } from "../types";
import { Badge } from "./ui";

const statusVariant: Record<
  string,
  "default" | "accent" | "success" | "warning" | "error"
> = {
  idle: "default",
  capturing: "accent",
  processing: "warning",
  completed: "success",
  error: "error",
};

export function MeetingStatusPill({ status }: { status: Meeting["status"] }) {
  return (
    <Badge variant={statusVariant[status] ?? "default"} size="sm">
      {status.replace("_", " ")}
    </Badge>
  );
}
