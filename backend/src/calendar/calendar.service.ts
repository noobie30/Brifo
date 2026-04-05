import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";

const UPCOMING_LOOKAHEAD_DAYS = 45;
const MAX_EVENTS_PER_CALENDAR = 120;
const MAX_TOTAL_EVENTS = 400;
const MAX_CALENDARS_TO_SCAN = 8;
const CALENDAR_LIST_PAGE_SIZE = 100;

@Injectable()
export class CalendarService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async connectGoogleCalendar(
    userId: string,
    tokens: {
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number;
    },
  ): Promise<{ connected: boolean }> {
    await this.usersService.setGoogleCalendarTokens(userId, tokens);
    return { connected: true };
  }

  async getUpcomingEvents(userId: string): Promise<
    Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string | null;
      joinUrl: string | null;
      attendees: string[];
    }>
  > {
    const user = await this.usersService.findById(userId);

    const accessToken = user?.integrations?.googleCalendar?.accessToken;
    const refreshToken = user?.integrations?.googleCalendar?.refreshToken;

    if (accessToken || refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        this.configService.get<string>("GOOGLE_CLIENT_ID"),
        this.configService.get<string>("GOOGLE_CLIENT_SECRET"),
      );

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: user?.integrations?.googleCalendar?.expiryDate,
      });

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      const now = new Date();
      const timeMax = new Date(
        now.getTime() + UPCOMING_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
      );
      const calendarIds = (await this.getCalendarIds(calendar)).slice(
        0,
        MAX_CALENDARS_TO_SCAN,
      );

      const results = await Promise.allSettled(
        calendarIds.map(async (calendarId) => {
          const result = await calendar.events.list({
            calendarId,
            timeMin: now.toISOString(),
            timeMax: timeMax.toISOString(),
            maxResults: MAX_EVENTS_PER_CALENDAR,
            singleEvents: true,
            orderBy: "startTime",
          });

          return {
            calendarId,
            items: result.data.items ?? [],
          };
        }),
      );

      const allEvents: Array<{
        id: string;
        title: string;
        startTime: string;
        endTime: string | null;
        joinUrl: string | null;
        attendees: string[];
      }> = [];
      const seen = new Set<string>();

      for (const result of results) {
        if (result.status !== "fulfilled") {
          continue;
        }

        const { calendarId, items } = result.value;
        for (const event of items) {
          const startTime = event.start?.dateTime;
          if (!startTime) {
            continue;
          }

          const id = `${calendarId}:${event.id ?? crypto.randomUUID()}`;
          const key = `${id}:${startTime}`;
          if (seen.has(key)) {
            continue;
          }

          seen.add(key);
          allEvents.push({
            id,
            title: event.summary ?? "Untitled event",
            startTime,
            endTime: event.end?.dateTime ?? null,
            joinUrl: this.extractJoinUrl(event),
            attendees: (event.attendees ?? [])
              .map(
                (attendee) =>
                  attendee.displayName?.trim() || attendee.email?.trim() || "",
              )
              .filter(Boolean),
          });

          if (allEvents.length >= MAX_TOTAL_EVENTS) {
            break;
          }
        }

        if (allEvents.length >= MAX_TOTAL_EVENTS) {
          break;
        }
      }

      return allEvents
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        )
        .slice(0, MAX_TOTAL_EVENTS);
    }

    return [];
  }

  async getEventAttendees(
    userId: string,
    calendarEventId: string,
  ): Promise<string[]> {
    const splitAt = calendarEventId.indexOf(":");
    if (splitAt <= 0 || splitAt >= calendarEventId.length - 1) {
      return [];
    }

    const calendarId = calendarEventId.slice(0, splitAt);
    const eventId = calendarEventId.slice(splitAt + 1);

    const user = await this.usersService.findById(userId);
    const accessToken = user?.integrations?.googleCalendar?.accessToken;
    const refreshToken = user?.integrations?.googleCalendar?.refreshToken;

    if (!accessToken && !refreshToken) {
      return [];
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>("GOOGLE_CLIENT_ID"),
      this.configService.get<string>("GOOGLE_CLIENT_SECRET"),
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: user?.integrations?.googleCalendar?.expiryDate,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const result = await calendar.events.get({ calendarId, eventId });
    const event = result.data;

    return (event.attendees ?? [])
      .map(
        (attendee) =>
          attendee.displayName?.trim() || attendee.email?.trim() || "",
      )
      .filter(Boolean);
  }

  private async getCalendarIds(
    calendar: ReturnType<typeof google.calendar>,
  ): Promise<string[]> {
    const calendarIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const listResponse = await calendar.calendarList.list({
        maxResults: CALENDAR_LIST_PAGE_SIZE,
        pageToken,
      });

      for (const item of listResponse.data.items ?? []) {
        if (!item.id) {
          continue;
        }
        if (item.selected === false) {
          continue;
        }
        calendarIds.push(item.id);
        if (calendarIds.length >= MAX_CALENDARS_TO_SCAN) {
          break;
        }
      }

      pageToken = listResponse.data.nextPageToken ?? undefined;
      if (calendarIds.length >= MAX_CALENDARS_TO_SCAN) {
        pageToken = undefined;
      }
    } while (pageToken);

    if (!calendarIds.length) {
      return ["primary"];
    }

    if (!calendarIds.includes("primary")) {
      calendarIds.unshift("primary");
    }

    return Array.from(new Set(calendarIds)).slice(0, MAX_CALENDARS_TO_SCAN);
  }

  private extractJoinUrl(event: {
    hangoutLink?: string | null;
    htmlLink?: string | null;
    location?: string | null;
    description?: string | null;
    conferenceData?: {
      entryPoints?: Array<{
        uri?: string | null;
        entryPointType?: string | null;
      }>;
    } | null;
  }): string | null {
    const conferenceUri = event.conferenceData?.entryPoints?.find(
      (entryPoint) =>
        entryPoint?.entryPointType === "video" && !!entryPoint.uri,
    )?.uri;
    const candidates = [
      conferenceUri,
      event.hangoutLink,
      this.extractFirstUrl(event.location),
      this.extractFirstUrl(event.description),
    ];

    for (const value of candidates) {
      if (!value) {
        continue;
      }
      try {
        const parsed = new URL(value);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        // Ignore malformed candidate and keep searching.
      }
    }

    return null;
  }

  private extractFirstUrl(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const match = value.match(/https?:\/\/[^\s)>"']+/i);
    return match?.[0] ?? null;
  }
}
