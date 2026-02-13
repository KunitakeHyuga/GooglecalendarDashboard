import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const requiredEnv = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'SESSION_SECRET'
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

function persistTokens(req, accessToken, refreshToken) {
  const existing = req.session.userTokens || req.user?.tokens || {};
  const tokens = {
    accessToken: accessToken || existing.accessToken || null,
    refreshToken: refreshToken || existing.refreshToken || null
  };

  req.session.userTokens = tokens;
  if (req.user) {
    req.user.tokens = tokens;
  }

  return tokens;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true
    },
    (req, accessToken, refreshToken, profile, done) => {
      const tokens = persistTokens(req, accessToken, refreshToken);
      const user = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value || null,
        picture: profile.photos?.[0]?.value || null,
        tokens
      };

      done(null, user);
    }
  )
);

app.use(express.static(path.join(__dirname, 'public')));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

function createOAuthClient(req) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  const tokens = req.session.userTokens || req.user?.tokens || {};
  if (!tokens.accessToken && !tokens.refreshToken) {
    const error = new Error('Missing OAuth tokens. Please sign in again.');
    error.code = 401;
    throw error;
  }

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || undefined
  });

  oauth2Client.on('tokens', (newTokens) => {
    persistTokens(req, newTokens.access_token, newTokens.refresh_token);
  });

  return oauth2Client;
}

async function listAllEvents(calendarApi, params) {
  const all = [];
  let pageToken;

  do {
    const response = await calendarApi.events.list({
      ...params,
      pageToken,
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime'
    });
    all.push(...(response.data.items || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return all;
}

function eventDurationMinutes(event) {
  const startValue = event.start?.dateTime || event.start?.date;
  const endValue = event.end?.dateTime || event.end?.date;
  if (!startValue || !endValue) return 0;

  const start = new Date(startValue);
  const end = new Date(endValue);
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;

  return Math.round(diffMs / 60000);
}

function eventDayKey(event) {
  if (event.start?.date) {
    return event.start.date;
  }
  if (event.start?.dateTime) {
    return event.start.dateTime.slice(0, 10);
  }
  return null;
}

function extractTag(summary) {
  if (!summary) return '未分類';
  const match = summary.match(/^\s*\[([^\]]+)\]/);
  return match?.[1]?.trim() || '未分類';
}

function enumerateDayKeysBetween(timeMin, timeMax) {
  const start = new Date(timeMin);
  const end = new Date(timeMax);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const days = [];

  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function enumerateDayKeysByDateString(startDate, endDate) {
  if (!startDate || !endDate) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return [];
  }

  const cursor = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor > last) {
    return [];
  }

  const days = [];
  while (cursor <= last) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

app.get('/', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
    return;
  }
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/calendar'
    ],
    accessType: 'offline',
    prompt: 'consent'
  })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (_req, res) => {
    res.redirect('/');
  }
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

app.get('/api/me', ensureAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/calendars', ensureAuthenticated, async (req, res) => {
  try {
    const auth = createOAuthClient(req);
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.calendarList.list({ maxResults: 250 });

    const calendars = (response.data.items || []).map((item) => ({
      id: item.id,
      summary: item.summary,
      primary: Boolean(item.primary),
      accessRole: item.accessRole,
      backgroundColor: item.backgroundColor || '#4285f4'
    }));

    res.json({ calendars });
  } catch (error) {
    res.status(500).json({ error: `Failed to load calendars: ${error.message}` });
  }
});

app.get('/api/summary', ensureAuthenticated, async (req, res) => {
  const { timeMin, timeMax } = req.query;

  if (!timeMin || !timeMax) {
    res.status(400).json({ error: 'timeMin and timeMax are required' });
    return;
  }

  try {
    const auth = createOAuthClient(req);
    const calendar = google.calendar({ version: 'v3', auth });

    const listResponse = await calendar.calendarList.list({ maxResults: 250 });
    const calendars = listResponse.data.items || [];

    const results = [];

    for (const cal of calendars) {
      const events = await listAllEvents(calendar, {
        calendarId: cal.id,
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString()
      });

      const totalMinutes = events.reduce((sum, event) => sum + eventDurationMinutes(event), 0);

      results.push({
        calendarId: cal.id,
        calendarName: cal.summary,
        eventCount: events.length,
        totalMinutes,
        totalHours: Number((totalMinutes / 60).toFixed(2)),
        color: cal.backgroundColor || '#4285f4'
      });
    }

    results.sort((a, b) => b.totalMinutes - a.totalMinutes);

    res.json({
      range: { timeMin, timeMax },
      totals: results,
      grandTotalMinutes: results.reduce((sum, item) => sum + item.totalMinutes, 0)
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to build summary: ${error.message}` });
  }
});

app.get('/api/events-range', ensureAuthenticated, async (req, res) => {
  const { timeMin, timeMax, calendarId } = req.query;

  if (!timeMin || !timeMax) {
    res.status(400).json({ error: 'timeMin and timeMax are required' });
    return;
  }

  try {
    const auth = createOAuthClient(req);
    const calendar = google.calendar({ version: 'v3', auth });
    const listResponse = await calendar.calendarList.list({ maxResults: 250 });
    const calendars = listResponse.data.items || [];

    const targets = calendarId
      ? calendars.filter((cal) => cal.id === calendarId)
      : calendars;

    if (targets.length === 0) {
      res.status(404).json({ error: `Calendar not found: ${calendarId}` });
      return;
    }

    const events = [];
    for (const cal of targets) {
      const items = await listAllEvents(calendar, {
        calendarId: cal.id,
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString()
      });

      for (const item of items) {
        const start = item.start?.dateTime || item.start?.date;
        const end = item.end?.dateTime || item.end?.date;
        if (!start || !end) continue;

        events.push({
          id: `${cal.id}:${item.id}`,
          rawEventId: item.id,
          calendarId: cal.id,
          calendarName: cal.summary,
          title: item.summary || '(no title)',
          description: item.description || '',
          start,
          end,
          allDay: Boolean(item.start?.date && !item.start?.dateTime),
          color: item.colorId ? undefined : (cal.backgroundColor || '#4285f4')
        });
      }
    }

    res.json({
      range: { timeMin, timeMax },
      events
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to load events in range: ${error.message}` });
  }
});

app.get('/api/study-report', ensureAuthenticated, async (req, res) => {
  const { timeMin, timeMax, startDate, endDate, calendarId, calendarName = '勉強' } = req.query;

  if (!timeMin || !timeMax) {
    res.status(400).json({ error: 'timeMin and timeMax are required' });
    return;
  }

  try {
    const auth = createOAuthClient(req);
    const calendar = google.calendar({ version: 'v3', auth });
    const listResponse = await calendar.calendarList.list({ maxResults: 250 });
    const calendars = listResponse.data.items || [];

    const studyCalendar = calendarId
      ? calendars.find((c) => c.id === calendarId)
      : calendars.find((c) => c.summary === calendarName) ||
        calendars.find((c) => c.summary?.includes(calendarName));

    if (!studyCalendar) {
      const lookupValue = calendarId || calendarName;
      res.status(404).json({ error: `Calendar not found: ${lookupValue}` });
      return;
    }

    const events = await listAllEvents(calendar, {
      calendarId: studyCalendar.id,
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString()
    });

    const byDayTag = new Map();
    const tagTotals = new Map();
    const normalizedEvents = [];

    for (const event of events) {
      const minutes = eventDurationMinutes(event);
      if (minutes <= 0) continue;

      const day = eventDayKey(event);
      if (!day) continue;
      const tag = extractTag(event.summary);

      if (!byDayTag.has(day)) byDayTag.set(day, new Map());
      const dayMap = byDayTag.get(day);
      dayMap.set(tag, (dayMap.get(tag) || 0) + minutes);
      tagTotals.set(tag, (tagTotals.get(tag) || 0) + minutes);

      normalizedEvents.push({
        id: event.id,
        summary: event.summary || '(no title)',
        tag,
        minutes,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date
      });
    }

    const days = enumerateDayKeysByDateString(startDate, endDate);
    const safeDays = days.length > 0 ? days : enumerateDayKeysBetween(timeMin, timeMax);
    const tags = Array.from(tagTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    const stacked = safeDays.map((day) => {
      const row = { day };
      const dayMap = byDayTag.get(day) || new Map();
      for (const tag of tags) {
        row[tag] = Number(((dayMap.get(tag) || 0) / 60).toFixed(2));
      }
      return row;
    });

    const totalMinutes = normalizedEvents.reduce((sum, item) => sum + item.minutes, 0);
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const thisMonthPrefix = todayKey.slice(0, 7);

    const todayMinutes = normalizedEvents
      .filter((item) => (item.start || '').startsWith(todayKey))
      .reduce((sum, item) => sum + item.minutes, 0);
    const monthMinutes = normalizedEvents
      .filter((item) => (item.start || '').slice(0, 7) === thisMonthPrefix)
      .reduce((sum, item) => sum + item.minutes, 0);

    normalizedEvents.sort((a, b) => String(b.start).localeCompare(String(a.start)));

    res.json({
      calendar: {
        id: studyCalendar.id,
        name: studyCalendar.summary
      },
      range: { timeMin, timeMax },
      stats: {
        todayMinutes,
        monthMinutes,
        totalMinutes
      },
      tags: tags.map((tag) => ({
        tag,
        minutes: tagTotals.get(tag),
        hours: Number(((tagTotals.get(tag) || 0) / 60).toFixed(2))
      })),
      dailyStacked: stacked,
      recent: normalizedEvents.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to build study report: ${error.message}` });
  }
});

app.post('/api/events', ensureAuthenticated, async (req, res) => {
  const { calendarId, summary, description, startDateTime, endDateTime, timezone } = req.body;

  if (!calendarId || !summary || !startDateTime || !endDateTime) {
    res.status(400).json({
      error: 'calendarId, summary, startDateTime, endDateTime are required'
    });
    return;
  }

  try {
    const auth = createOAuthClient(req);
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary,
      description: description || '',
      start: {
        dateTime: new Date(startDateTime).toISOString(),
        timeZone: timezone || 'Asia/Tokyo'
      },
      end: {
        dateTime: new Date(endDateTime).toISOString(),
        timeZone: timezone || 'Asia/Tokyo'
      }
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event
    });

    res.status(201).json({ event: response.data });
  } catch (error) {
    res.status(500).json({ error: `Failed to create event: ${error.message}` });
  }
});

app.patch('/api/events', ensureAuthenticated, async (req, res) => {
  const { calendarId, eventId, summary, description, startDateTime, endDateTime, timezone } = req.body;

  if (!calendarId || !eventId || !summary || !startDateTime || !endDateTime) {
    res.status(400).json({
      error: 'calendarId, eventId, summary, startDateTime, endDateTime are required'
    });
    return;
  }

  try {
    const auth = createOAuthClient(req);
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary,
        description: description || '',
        start: {
          dateTime: new Date(startDateTime).toISOString(),
          timeZone: timezone || 'Asia/Tokyo'
        },
        end: {
          dateTime: new Date(endDateTime).toISOString(),
          timeZone: timezone || 'Asia/Tokyo'
        }
      }
    });

    res.json({ event: response.data });
  } catch (error) {
    res.status(500).json({ error: `Failed to update event: ${error.message}` });
  }
});

app.delete('/api/events', ensureAuthenticated, async (req, res) => {
  const { calendarId, eventId } = req.body;

  if (!calendarId || !eventId) {
    res.status(400).json({ error: 'calendarId and eventId are required' });
    return;
  }

  try {
    const auth = createOAuthClient(req);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId, eventId });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: `Failed to delete event: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
