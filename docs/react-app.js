import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18';
import { createRoot } from 'https://esm.sh/react-dom@18/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);

const COLORS = ['#84cc16', '#f59e0b', '#0ea5e9', '#f97316', '#14b8a6', '#a855f7', '#ef4444', '#22c55e', '#3b82f6', '#eab308'];

function toLocalDateValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDateTimeLocalValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function roundUpToStepMinutes(date, stepMinutes) {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const rounded = Math.ceil(minutes / stepMinutes) * stepMinutes;
  next.setMinutes(rounded, 0, 0);
  return next;
}

function addMinutesToLocalValue(dateTimeLocalValue, minutesToAdd) {
  if (!dateTimeLocalValue) return '';
  const base = new Date(dateTimeLocalValue);
  if (Number.isNaN(base.getTime())) return '';
  base.setMinutes(base.getMinutes() + minutesToAdd);
  return toDateTimeLocalValue(base);
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

function shiftDateValue(dateValue, diffDays) {
  const base = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(base.getTime())) return dateValue;
  base.setDate(base.getDate() + diffDays);
  return toLocalDateValue(base);
}

function startOfWeekMonday(dateValue) {
  const base = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(base.getTime())) return toLocalDateValue(new Date());
  const day = base.getDay(); // 0(Sun)-6(Sat)
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return toLocalDateValue(base);
}

function formatDayLabelWithWeekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${mmdd}(${weekdays[date.getDay()]})`;
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function stripTagPrefix(summary) {
  return String(summary || '').replace(/^\s*\[[^\]]+\]\s*/, '');
}

function truncateLabel(text, maxChars = 28) {
  const value = String(text || '');
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function toGoogleCalendarDateValue(dateTimeLocalValue) {
  if (!dateTimeLocalValue) return '';
  const date = new Date(dateTimeLocalValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function toGoogleCalendarPathDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
}

function toLocalDateTimeFromApi(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return `${value}T00:00`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toDateTimeLocalValue(date);
}

function formatHHMM(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeHexColor(color) {
  const value = String(color || '').trim();
  if (!value.startsWith('#')) return null;
  const hex = value.slice(1);
  if (hex.length === 3) {
    return `#${hex.split('').map((c) => c + c).join('')}`;
  }
  if (hex.length === 6) return `#${hex}`;
  return null;
}

function pickEventTextColor(backgroundColor) {
  const hex = normalizeHexColor(backgroundColor);
  if (!hex) return '#ffffff';
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#111827' : '#ffffff';
}

function pickDefaultStudyCalendarId(calendars) {
  if (!Array.isArray(calendars) || calendars.length === 0) return '';
  const exact = calendars.find((c) => c.summary === '勉強');
  if (exact) return exact.id;
  const partial = calendars.find((c) => c.summary?.includes('勉強'));
  if (partial) return partial.id;
  const primary = calendars.find((c) => c.primary);
  return (primary || calendars[0]).id;
}

function pickEditableCalendarId(calendars, preferredId) {
  if (preferredId && preferredId !== 'all') return preferredId;
  if (!Array.isArray(calendars) || calendars.length === 0) return '';
  const primary = calendars.find((c) => c.primary);
  return (primary || calendars[0]).id;
}

function getGoogleClientId() {
  return window.APP_CONFIG?.googleClientId || '';
}

async function googleApi(token, path, options = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    ...options
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || data.error || `Google API failed: ${res.status}`);
  }

  if (res.status === 204) return {};
  return res.json().catch(() => ({}));
}

async function googleUserInfo(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }
  const data = await res.json();
  return {
    displayName: data.name || 'Google User',
    email: data.email || '',
    picture: data.picture || ''
  };
}

async function listAllEvents(token, calendarId, { timeMin, timeMax }) {
  const events = [];
  let pageToken = '';

  while (true) {
    const query = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString()
    });
    if (pageToken) query.set('pageToken', pageToken);

    const data = await googleApi(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`
    );

    events.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  return events;
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
  if (event.start?.date) return event.start.date;
  if (event.start?.dateTime) return event.start.dateTime.slice(0, 10);
  return null;
}

function extractTag(summary) {
  if (!summary) return '未分類';
  const match = summary.match(/^\s*\[([^\]]+)\]/);
  return match?.[1]?.trim() || '未分類';
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

function DashboardApp() {
  const defaultRange = useMemo(() => monthRange(), []);
  const googleClientId = useMemo(() => getGoogleClientId(), []);

  const [activeView, setActiveView] = useState('overall');
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [startDate, setStartDate] = useState(toLocalDateValue(defaultRange.start));
  const [endDate, setEndDate] = useState(toLocalDateValue(defaultRange.end));
  const [scheduleCalendarId, setScheduleCalendarId] = useState('all');
  const [scheduleWeekStart, setScheduleWeekStart] = useState(() => startOfWeekMonday(toLocalDateValue(new Date())));
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [scheduleEditor, setScheduleEditor] = useState({
    open: false,
    mode: 'edit',
    calendarId: '',
    eventId: '',
    tag: '',
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: ''
  });
  const [scheduleEditorMessage, setScheduleEditorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [overallTotals, setOverallTotals] = useState([]);
  const [overallGrandMinutes, setOverallGrandMinutes] = useState(0);

  const [calendars, setCalendars] = useState([]);
  const [studyCalendarId, setStudyCalendarId] = useState('');
  const [studySpanDays, setStudySpanDays] = useState(7);
  const [studyPage, setStudyPage] = useState(0);
  const [stats, setStats] = useState({ todayMinutes: 0, monthMinutes: 0, totalMinutes: 0 });
  const [tags, setTags] = useState([]);
  const [dailyStacked, setDailyStacked] = useState([]);
  const [recent, setRecent] = useState([]);

  const [eventForm, setEventForm] = useState({
    tag: '',
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: ''
  });

  const overallCanvasRef = useRef(null);
  const overallChartRef = useRef(null);
  const dailyCanvasRef = useRef(null);
  const pieCanvasRef = useRef(null);
  const dailyChartRef = useRef(null);
  const pieChartRef = useRef(null);
  const weekCalendarContainerRef = useRef(null);
  const weekCalendarRef = useRef(null);
  const tokenClientRef = useRef(null);
  const tokenRequestRef = useRef(null);
  const accessTokenRef = useRef('');
  const tokenExpiryRef = useRef(0);

  async function ensureAccessToken() {
    if (accessTokenRef.current && Date.now() < tokenExpiryRef.current - 60_000) {
      return accessTokenRef.current;
    }

    if (!tokenClientRef.current) {
      throw new Error('Google認証の初期化が完了していません。');
    }

    return new Promise((resolve, reject) => {
      tokenRequestRef.current = { resolve, reject };
      tokenClientRef.current.requestAccessToken({ prompt: accessTokenRef.current ? '' : 'consent' });
    });
  }

  async function loadCalendars(token) {
    const data = await googleApi(token, '/users/me/calendarList?maxResults=250');
    const items = (data.items || []).map((item) => ({
      id: item.id,
      summary: item.summary,
      primary: Boolean(item.primary),
      accessRole: item.accessRole,
      backgroundColor: item.backgroundColor || '#4285f4'
    }));
    setCalendars(items);
    return items;
  }

  function buildSummary(tag, title) {
    const cleanTitle = (title || '').trim();
    const cleanTag = (tag || '').trim();
    if (!cleanTag) return cleanTitle;
    if (/^\s*\[[^\]]+\]/.test(cleanTitle)) return cleanTitle;
    return `[${cleanTag}] ${cleanTitle}`;
  }

  function buildRangeQuery() {
    const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
    const timeMax = new Date(`${endDate}T23:59:59`).toISOString();
    return { timeMin, timeMax };
  }

  function buildStudyRangeValues() {
    if (studySpanDays === 7) {
      const baseMonday = startOfWeekMonday(endDate);
      const windowStart = shiftDateValue(baseMonday, -(studyPage * 7));
      const windowEnd = shiftDateValue(windowStart, 6);
      return { windowStart, windowEnd };
    }

    const windowEnd = shiftDateValue(endDate, -(studyPage * studySpanDays));
    const windowStart = shiftDateValue(windowEnd, -(studySpanDays - 1));
    return { windowStart, windowEnd };
  }

  function buildStudyRangeQuery() {
    const { windowStart, windowEnd } = buildStudyRangeValues();
    const timeMin = new Date(`${windowStart}T00:00:00`).toISOString();
    const timeMax = new Date(`${windowEnd}T23:59:59`).toISOString();
    return { timeMin, timeMax };
  }

  async function loadOverall(token, calendarItems = calendars) {
    const { timeMin, timeMax } = buildRangeQuery();
    const totals = [];

    for (const cal of calendarItems) {
      const events = await listAllEvents(token, cal.id, { timeMin, timeMax });
      const totalMinutes = events.reduce((sum, event) => sum + eventDurationMinutes(event), 0);
      totals.push({
        calendarId: cal.id,
        calendarName: cal.summary,
        eventCount: events.length,
        totalMinutes,
        totalHours: Number((totalMinutes / 60).toFixed(2)),
        color: cal.backgroundColor || '#4285f4'
      });
    }

    totals.sort((a, b) => b.totalMinutes - a.totalMinutes);
    setOverallTotals(totals);
    setOverallGrandMinutes(totals.reduce((sum, item) => sum + item.totalMinutes, 0));
  }

  async function loadStudy(token, calendarIdOverride, calendarItems = calendars) {
    const { timeMin, timeMax } = buildStudyRangeQuery();
    const { windowStart, windowEnd } = buildStudyRangeValues();
    const selectedId = calendarIdOverride || studyCalendarId || pickDefaultStudyCalendarId(calendarItems);
    const selectedCalendar = calendarItems.find((cal) => cal.id === selectedId) || calendarItems[0];
    if (!selectedCalendar) {
      throw new Error('利用可能なカレンダーがありません。');
    }

    const events = await listAllEvents(token, selectedCalendar.id, { timeMin, timeMax });
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

    const days = enumerateDayKeysByDateString(windowStart, windowEnd);
    const orderedTags = Array.from(tagTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    const stacked = days.map((day) => {
      const row = { day };
      const dayMap = byDayTag.get(day) || new Map();
      for (const tag of orderedTags) {
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

    setStudyCalendarId(selectedCalendar.id);
    setStats({ todayMinutes, monthMinutes, totalMinutes });
    setTags(
      orderedTags.map((tag) => ({
        tag,
        minutes: tagTotals.get(tag),
        hours: Number(((tagTotals.get(tag) || 0) / 60).toFixed(2))
      }))
    );
    setDailyStacked(stacked);
    setRecent(normalizedEvents.slice(0, 20));
  }

  async function loadSchedule(token, calendarIdOverride, weekStartOverride, calendarItems = calendars) {
    const weekStartValue = weekStartOverride || scheduleWeekStart;
    const weekEndValue = shiftDateValue(weekStartValue, 6);
    const timeMin = new Date(`${weekStartValue}T00:00:00`).toISOString();
    const timeMax = new Date(`${weekEndValue}T23:59:59`).toISOString();
    const selectedId = calendarIdOverride ?? scheduleCalendarId;
    const targets = selectedId && selectedId !== 'all'
      ? calendarItems.filter((cal) => cal.id === selectedId)
      : calendarItems;

    const merged = [];
    for (const cal of targets) {
      const items = await listAllEvents(token, cal.id, { timeMin, timeMax });
      for (const item of items) {
        const start = item.start?.dateTime || item.start?.date;
        const end = item.end?.dateTime || item.end?.date;
        if (!start || !end) continue;
        const bg = cal.backgroundColor || '#3b82f6';
        merged.push({
          id: `${cal.id}:${item.id}`,
          title: item.summary || '(no title)',
          start,
          end,
          allDay: Boolean(item.start?.date && !item.start?.dateTime),
          backgroundColor: bg,
          borderColor: bg,
          textColor: pickEventTextColor(bg),
          extendedProps: {
            calendarId: cal.id,
            eventId: item.id,
            description: item.description || '',
            calendarName: cal.summary || ''
          }
        });
      }
    }
    setScheduleEvents(merged);
  }

  async function connectGoogle() {
    try {
      setErrorMessage('');
      const token = await ensureAccessToken();
      const profile = await googleUserInfo(token);
      setUser(profile);
      const calendarItems = await loadCalendars(token);
      const initialStudyCalendarId = pickDefaultStudyCalendarId(calendarItems);
      setStudyCalendarId(initialStudyCalendarId);
      await Promise.all([
        loadOverall(token, calendarItems),
        loadStudy(token, initialStudyCalendarId, calendarItems),
        loadSchedule(token, scheduleCalendarId, scheduleWeekStart, calendarItems)
      ]);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function disconnectGoogle() {
    if (window.google?.accounts?.oauth2 && accessTokenRef.current) {
      window.google.accounts.oauth2.revoke(accessTokenRef.current, () => {});
    }
    setAccessToken('');
    accessTokenRef.current = '';
    tokenExpiryRef.current = 0;
    setUser(null);
    setCalendars([]);
    setOverallTotals([]);
    setOverallGrandMinutes(0);
    setStats({ todayMinutes: 0, monthMinutes: 0, totalMinutes: 0 });
    setTags([]);
    setDailyStacked([]);
    setRecent([]);
    setScheduleEvents([]);
  }

  useEffect(() => {
    if (!googleClientId) {
      setErrorMessage('APP_CONFIG.googleClientId が未設定です。public/app-config.js を設定してください。');
      return;
    }

    const timer = setInterval(() => {
      if (!window.google?.accounts?.oauth2) return;
      clearInterval(timer);
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ].join(' '),
        callback: (resp) => {
          const request = tokenRequestRef.current;
          if (!request) return;
          tokenRequestRef.current = null;

          if (resp.error) {
            request.reject(new Error(resp.error_description || resp.error));
            return;
          }

          setAccessToken(resp.access_token || '');
          accessTokenRef.current = resp.access_token || '';
          tokenExpiryRef.current = Date.now() + Number(resp.expires_in || 0) * 1000;
          request.resolve(resp.access_token || '');
        }
      });
      setAuthReady(true);
    }, 100);

    return () => clearInterval(timer);
  }, [googleClientId]);

  useEffect(() => {
    if (!user || !accessToken) return;

    async function refreshForActiveView() {
      try {
        setErrorMessage('');
        const token = await ensureAccessToken();
        if (activeView === 'overall') {
          await loadOverall(token);
        } else if (activeView === 'study') {
          await loadStudy(token);
        } else {
          await loadSchedule(token);
        }
      } catch (error) {
        setErrorMessage(error.message);
      }
    }

    refreshForActiveView();
  }, [activeView]);

  useEffect(() => {
    if (!user || !accessToken || activeView !== 'study' || !studyCalendarId) return;

    async function refreshStudyWindow() {
      try {
        setErrorMessage('');
        const token = await ensureAccessToken();
        await loadStudy(token);
      } catch (error) {
        setErrorMessage(error.message);
      }
    }

    refreshStudyWindow();
  }, [studySpanDays, studyPage, endDate, studyCalendarId, activeView]);

  useEffect(() => {
    if (!user || !accessToken || activeView !== 'schedule') return;

    async function refreshSchedule() {
      try {
        setErrorMessage('');
        const token = await ensureAccessToken();
        await loadSchedule(token);
      } catch (error) {
        setErrorMessage(error.message);
      }
    }

    refreshSchedule();
  }, [activeView, scheduleWeekStart, scheduleCalendarId]);

  useEffect(() => {
    if (activeView !== 'schedule' || !window.FullCalendar) return;

    if (weekCalendarRef.current) {
      weekCalendarRef.current.destroy();
      weekCalendarRef.current = null;
    }

    const calendarOptions = {
      initialView: 'timeGridWeek',
      initialDate: scheduleWeekStart,
      locale: 'ja',
      firstDay: 1,
      nowIndicator: true,
      allDaySlot: true,
      allDayText: '終日',
      dayMaxEventRows: 3,
      moreLinkClick: 'popover',
      eventDisplay: 'block',
      slotEventOverlap: false,
      eventMaxStack: 1,
      moreLinkText: (num) => `+${num}件`,
      selectable: true,
      selectMirror: true,
      slotMinTime: '06:00:00',
      slotMaxTime: '24:00:00',
      headerToolbar: false,
      height: 'auto',
      dayHeaderContent: (arg) => {
        const d = arg.date;
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        return `${d.getDate()}(${weekdays[d.getDay()]})`;
      },
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      events: scheduleEvents,
      eventContent: (arg) => {
        const title = escapeHtml(arg.event.title);
        if (arg.event.allDay) {
          return { html: `<div class="fc-custom-title">${escapeHtml(truncateLabel(arg.event.title, 28))}</div>` };
        }

        const start = formatHHMM(arg.event.start);
        const end = formatHHMM(arg.event.end);
        const range = start && end ? `${start}〜${end}` : start || '';
        return {
          html: `<div class="fc-custom-title">${title}</div><div class="fc-custom-time">${escapeHtml(range)}</div>`
        };
      },
      eventClick: (clickInfo) => {
        const event = clickInfo.event;
        const startLocal = event.start ? toDateTimeLocalValue(event.start) : '';
        const endLocal = event.end
          ? toDateTimeLocalValue(event.end)
          : addMinutesToLocalValue(startLocal, 60);
        const tagMatch = String(event.title || '').match(/^\s*\[([^\]]+)\]/);

        setScheduleEditor({
          open: true,
          mode: 'edit',
          calendarId: event.extendedProps.calendarId || '',
          eventId: event.extendedProps.eventId || '',
          tag: tagMatch?.[1]?.trim() || '',
          title: stripTagPrefix(event.title || ''),
          description: event.extendedProps.description || '',
          startDateTime: startLocal,
          endDateTime: endLocal
        });
        setScheduleEditorMessage('');
      },
      dateClick: (info) => {
        const startLocal = toDateTimeLocalValue(info.date);
        const endLocal = addMinutesToLocalValue(startLocal, 60);
        setScheduleEditor({
          open: true,
          mode: 'create',
          calendarId: pickEditableCalendarId(calendars, scheduleCalendarId),
          eventId: '',
          tag: '',
          title: '',
          description: '',
          startDateTime: startLocal,
          endDateTime: endLocal
        });
        setScheduleEditorMessage('');
      },
      select: (info) => {
        const startLocal = toDateTimeLocalValue(info.start);
        const endLocal = toDateTimeLocalValue(info.end);
        setScheduleEditor({
          open: true,
          mode: 'create',
          calendarId: pickEditableCalendarId(calendars, scheduleCalendarId),
          eventId: '',
          tag: '',
          title: '',
          description: '',
          startDateTime: startLocal,
          endDateTime: endLocal
        });
        setScheduleEditorMessage('');
      }
    };

    if (weekCalendarContainerRef.current) {
      const calendar = new window.FullCalendar.Calendar(weekCalendarContainerRef.current, calendarOptions);
      calendar.render();
      weekCalendarRef.current = calendar;
    }

    return () => {
      if (weekCalendarRef.current) {
        weekCalendarRef.current.destroy();
        weekCalendarRef.current = null;
      }
    };
  }, [activeView, scheduleWeekStart, scheduleEvents, calendars, scheduleCalendarId]);

  useEffect(() => {
    if (!overallCanvasRef.current || !window.Chart) return;
    if (overallChartRef.current) overallChartRef.current.destroy();

    overallChartRef.current = new window.Chart(overallCanvasRef.current, {
      type: 'bar',
      data: {
        labels: overallTotals.map((t) => t.calendarName),
        datasets: [
          {
            label: '使用時間(時間)',
            data: overallTotals.map((t) => t.totalHours),
            backgroundColor: overallTotals.map((t) => t.color || '#3b82f6')
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#d1d5db' } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
          y: {
            beginAtZero: true,
            ticks: { color: '#9ca3af' },
            title: { display: true, text: '時間', color: '#9ca3af' },
            grid: { color: '#374151' }
          }
        }
      }
    });

    return () => {
      if (overallChartRef.current) overallChartRef.current.destroy();
    };
  }, [overallTotals]);

  useEffect(() => {
    if (!dailyCanvasRef.current || !window.Chart) return;
    if (dailyChartRef.current) dailyChartRef.current.destroy();

    const dayLabels = dailyStacked.map((row) => formatDayLabelWithWeekday(row.day));
    const tagKeys = tags.map((t) => t.tag);

    dailyChartRef.current = new window.Chart(dailyCanvasRef.current, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: tagKeys.map((tag, index) => ({
          label: tag,
          data: dailyStacked.map((row) => row[tag] || 0),
          backgroundColor: COLORS[index % COLORS.length],
          stack: 'study-time'
        }))
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#d1d5db' } }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { color: '#9ca3af' },
            title: { display: true, text: '時間', color: '#9ca3af' },
            grid: { color: '#374151' }
          }
        }
      }
    });

    return () => {
      if (dailyChartRef.current) dailyChartRef.current.destroy();
    };
  }, [dailyStacked, tags]);

  useEffect(() => {
    if (!pieCanvasRef.current || !window.Chart) return;
    if (pieChartRef.current) pieChartRef.current.destroy();

    pieChartRef.current = new window.Chart(pieCanvasRef.current, {
      type: 'pie',
      data: {
        labels: tags.map((t) => t.tag),
        datasets: [
          {
            data: tags.map((t) => t.hours),
            backgroundColor: tags.map((_, i) => COLORS[i % COLORS.length])
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#d1d5db' }
          }
        }
      }
    });

    return () => {
      if (pieChartRef.current) pieChartRef.current.destroy();
    };
  }, [tags]);

  async function onSubmitRange(e) {
    e.preventDefault();
    try {
      setErrorMessage('');
      const token = await ensureAccessToken();
      if (activeView === 'overall') {
        await loadOverall(token);
      } else {
        await loadStudy(token);
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function updateEventForm(field, value) {
    setEventForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onChangeStudyCalendar(calendarId) {
    setStudyCalendarId(calendarId);
    if (activeView !== 'study') return;

    try {
      setErrorMessage('');
      setStudyPage(0);
      const token = await ensureAccessToken();
      await loadStudy(token, calendarId);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function onChangeStudySpan(days) {
    setStudySpanDays(days);
    setStudyPage(0);
  }

  function goToOlderStudyPage() {
    setStudyPage((prev) => prev + 1);
  }

  function goToNewerStudyPage() {
    setStudyPage((prev) => Math.max(0, prev - 1));
  }

  async function onChangeScheduleCalendar(calendarId) {
    setScheduleCalendarId(calendarId);
    if (activeView !== 'schedule') return;

    try {
      setErrorMessage('');
      const token = await ensureAccessToken();
      await loadSchedule(token, calendarId);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function goSchedulePrevWeek() {
    setScheduleWeekStart((prev) => shiftDateValue(prev, -7));
  }

  function goScheduleNextWeek() {
    setScheduleWeekStart((prev) => shiftDateValue(prev, 7));
  }

  function goScheduleCurrentWeek() {
    setScheduleWeekStart(startOfWeekMonday(toLocalDateValue(new Date())));
  }

  function closeScheduleEditor() {
    setScheduleEditor({
      open: false,
      mode: 'edit',
      calendarId: '',
      eventId: '',
      tag: '',
      title: '',
      description: '',
      startDateTime: '',
      endDateTime: ''
    });
    setScheduleEditorMessage('');
  }

  function updateScheduleEditor(field, value) {
    setScheduleEditor((prev) => ({ ...prev, [field]: value }));
  }

  async function saveScheduleEditor() {
    if (!scheduleEditor.calendarId) {
      setScheduleEditorMessage('カレンダーを選択してください。');
      return;
    }
    if (!scheduleEditor.title || !scheduleEditor.startDateTime || !scheduleEditor.endDateTime) {
      setScheduleEditorMessage('タイトル・開始・終了は必須です。');
      return;
    }
    if (new Date(scheduleEditor.endDateTime) <= new Date(scheduleEditor.startDateTime)) {
      setScheduleEditorMessage('終了日時は開始日時より後にしてください。');
      return;
    }

    const summary = buildSummary(scheduleEditor.tag, scheduleEditor.title);
    setScheduleEditorMessage(scheduleEditor.mode === 'create' ? '作成中...' : '更新中...');
    try {
      const token = await ensureAccessToken();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
      const payload = {
        summary,
        description: scheduleEditor.description,
        start: {
          dateTime: new Date(scheduleEditor.startDateTime).toISOString(),
          timeZone: timezone
        },
        end: {
          dateTime: new Date(scheduleEditor.endDateTime).toISOString(),
          timeZone: timezone
        }
      };

      if (scheduleEditor.mode === 'create') {
        await googleApi(token, `/calendars/${encodeURIComponent(scheduleEditor.calendarId)}/events`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } else {
        if (!scheduleEditor.eventId) {
          setScheduleEditorMessage('イベントIDが不足しています。');
          return;
        }

        await googleApi(
          token,
          `/calendars/${encodeURIComponent(scheduleEditor.calendarId)}/events/${encodeURIComponent(scheduleEditor.eventId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload)
          }
        );
      }

      await loadSchedule(token);
      setScheduleEditorMessage(scheduleEditor.mode === 'create' ? '作成しました。' : '更新しました。');
      setTimeout(() => closeScheduleEditor(), 250);
    } catch (error) {
      setScheduleEditorMessage(`${scheduleEditor.mode === 'create' ? '作成' : '更新'}失敗: ${error.message}`);
    }
  }

  async function deleteScheduleEditor() {
    if (!scheduleEditor.calendarId || !scheduleEditor.eventId) {
      setScheduleEditorMessage('イベントIDが不足しています。');
      return;
    }
    if (!window.confirm('この予定を削除しますか？')) return;

    setScheduleEditorMessage('削除中...');
    try {
      const token = await ensureAccessToken();
      await googleApi(
        token,
        `/calendars/${encodeURIComponent(scheduleEditor.calendarId)}/events/${encodeURIComponent(scheduleEditor.eventId)}`,
        { method: 'DELETE' }
      );

      await loadSchedule(token);
      closeScheduleEditor();
    } catch (error) {
      setScheduleEditorMessage(`削除失敗: ${error.message}`);
    }
  }

  function applyQuickDuration(minutes) {
    setEventForm((prev) => {
      const baseStart = prev.startDateTime || toDateTimeLocalValue(roundUpToStepMinutes(new Date(), 30));
      return {
        ...prev,
        startDateTime: baseStart,
        endDateTime: addMinutesToLocalValue(baseStart, minutes)
      };
    });
  }

  function setQuickNowRange() {
    const start = toDateTimeLocalValue(roundUpToStepMinutes(new Date(), 30));
    setEventForm((prev) => ({
      ...prev,
      startDateTime: start,
      endDateTime: addMinutesToLocalValue(start, 60)
    }));
  }

  function onChangeStartDateTime(value) {
    setEventForm((prev) => {
      const next = { ...prev, startDateTime: value };
      const start = new Date(value);
      const end = prev.endDateTime ? new Date(prev.endDateTime) : null;
      if (!prev.endDateTime || (end && start && end <= start)) {
        next.endDateTime = addMinutesToLocalValue(value, 60);
      }
      return next;
    });
  }

  function openGoogleCalendarWeekView() {
    if (!studyCalendarId) {
      setInfoMessage('カレンダーが選択されていません。');
      return;
    }

    const target = toGoogleCalendarPathDate(eventForm.startDateTime || `${startDate}T09:00`);
    if (!target) {
      setInfoMessage('日付の解釈に失敗しました。開始日時を確認してください。');
      return;
    }

    const url = `https://calendar.google.com/calendar/u/0/r/week/${target.year}/${target.month}/${target.day}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openGoogleCalendarEditor() {
    if (!studyCalendarId) {
      setInfoMessage('カレンダーが選択されていません。');
      return;
    }

    const summary = buildSummary(eventForm.tag, eventForm.title);
    const start = toGoogleCalendarDateValue(eventForm.startDateTime);
    const end = toGoogleCalendarDateValue(eventForm.endDateTime);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: summary,
      details: eventForm.description || '',
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo',
      src: studyCalendarId
    });
    if (start && end) params.set('dates', `${start}/${end}`);

    const url = `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function onSubmitEvent(e) {
    e.preventDefault();

    if (!studyCalendarId) {
      setInfoMessage('カレンダーが選択されていません。');
      return;
    }

    setInfoMessage('追加中...');

    try {
      const token = await ensureAccessToken();
      if (new Date(eventForm.endDateTime) <= new Date(eventForm.startDateTime)) {
        setInfoMessage('終了日時は開始日時より後にしてください。');
        return;
      }

      const summary = buildSummary(eventForm.tag, eventForm.title);
      await googleApi(token, `/calendars/${encodeURIComponent(studyCalendarId)}/events`, {
        method: 'POST',
        body: JSON.stringify({
          summary,
          description: eventForm.description,
          start: {
            dateTime: new Date(eventForm.startDateTime).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
          },
          end: {
            dateTime: new Date(eventForm.endDateTime).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
          }
        })
      });

      setInfoMessage(`追加完了: ${summary}`);
      setEventForm({ tag: '', title: '', description: '', startDateTime: '', endDateTime: '' });
      await loadStudy(token);
    } catch (error) {
      setInfoMessage(`追加失敗: ${error.message}`);
    }
  }

  return html`
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto w-[min(1180px,94vw)] py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold md:text-2xl">Study Report Dashboard</h1>
              <p className="mt-1 text-xs text-zinc-400 md:text-sm">${user ? `${user.displayName} (${user.email || 'no email'})` : 'Google認証してください'}</p>
            </div>
            <div className="flex items-center gap-2">
              ${!user ? html`
                <button
                  className="rounded-md border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                  type="button"
                  onClick=${connectGoogle}
                  disabled=${!authReady}
                >
                  Googleで接続
                </button>
              ` : html`
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800" type="button" onClick=${disconnectGoogle}>ログアウト</button>
              `}
            </div>
          </div>
          <div className="mt-4 inline-flex rounded-lg border border-zinc-700 p-1">
            <button
              className=${`rounded-md px-4 py-2 text-sm font-semibold ${activeView === 'overall' ? 'bg-sky-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
              onClick=${() => setActiveView('overall')}
              type="button"
            >
              全体
            </button>
            <button
              className=${`rounded-md px-4 py-2 text-sm font-semibold ${activeView === 'study' ? 'bg-sky-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
              onClick=${() => setActiveView('study')}
              type="button"
            >
              勉強
            </button>
            <button
              className=${`rounded-md px-4 py-2 text-sm font-semibold ${activeView === 'schedule' ? 'bg-sky-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
              onClick=${() => setActiveView('schedule')}
              type="button"
            >
              週間予定
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-[min(1180px,94vw)] py-6">
        <section className="rounded-2xl bg-zinc-900 p-4 text-zinc-100">
          ${activeView === 'schedule' ? html`
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm text-zinc-300">
                表示カレンダー
                <select className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" value=${scheduleCalendarId} onChange=${(e) => onChangeScheduleCalendar(e.target.value)}>
                  <option value="all">すべてのカレンダー</option>
                  ${calendars.map((cal) => html`
                    <option key=${cal.id} value=${cal.id}>${cal.primary ? `${cal.summary} (primary)` : cal.summary}</option>
                  `)}
                </select>
              </label>
              <div className="md:col-span-2 flex flex-wrap items-end gap-2">
                <button className="rounded-full border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800" type="button" onClick=${goSchedulePrevWeek}>← 前週</button>
                <button className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800" type="button" onClick=${goScheduleCurrentWeek}>今週</button>
                <button className="rounded-full border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800" type="button" onClick=${goScheduleNextWeek}>次週 →</button>
                <p className="ml-1 text-sm text-zinc-400">表示期間: ${scheduleWeekStart} 〜 ${shiftDateValue(scheduleWeekStart, 6)}</p>
              </div>
            </div>
          ` : html`
            <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit=${onSubmitRange}>
              ${activeView === 'study' ? html`
                <label className="text-sm text-zinc-300">
                  カレンダー
                  <select className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" value=${studyCalendarId} onChange=${(e) => onChangeStudyCalendar(e.target.value)}>
                    ${calendars.length === 0 ? html`<option value="">カレンダーなし</option>` : ''}
                    ${calendars.map((cal) => html`
                      <option key=${cal.id} value=${cal.id}>${cal.primary ? `${cal.summary} (primary)` : cal.summary}</option>
                    `)}
                  </select>
                </label>
              ` : html`<div></div>`}
              <label className="text-sm text-zinc-300">
                開始
                <input className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" type="date" required value=${startDate} onChange=${(e) => setStartDate(e.target.value)} />
              </label>
              <label className="text-sm text-zinc-300">
                終了
                <input className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" type="date" required value=${endDate} onChange=${(e) => setEndDate(e.target.value)} />
              </label>
              <button className="mt-6 rounded-lg bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500" type="submit">再集計</button>
            </form>
          `}
          ${errorMessage ? html`<p className="mt-3 text-sm text-rose-400">${errorMessage}</p>` : ''}
        </section>

        ${activeView === 'overall' ? html`
          <section className="mt-6 rounded-2xl bg-zinc-900 p-4">
            <h2 className="text-2xl font-bold">全体カレンダー使用時間</h2>
            <p className="mt-1 text-sm text-zinc-400">合計: ${formatMinutes(overallGrandMinutes)}</p>
            <div className="mt-4 h-80">
              <canvas ref=${overallCanvasRef}></canvas>
            </div>
          </section>

          <section className="mt-6 rounded-2xl bg-zinc-900 p-4">
            <h2 className="text-xl font-bold">カレンダー別詳細</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-300">
                    <th className="px-2 py-2 text-left">カレンダー</th>
                    <th className="px-2 py-2 text-right">時間(時間)</th>
                    <th className="px-2 py-2 text-right">予定数</th>
                  </tr>
                </thead>
                <tbody>
                  ${overallTotals.map((item) => html`
                    <tr key=${item.calendarId} className="border-b border-zinc-800">
                      <td className="px-2 py-2">${item.calendarName}</td>
                      <td className="px-2 py-2 text-right tabular-nums">${item.totalHours.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">${item.eventCount}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          </section>
        ` : activeView === 'schedule' ? html`
          <section className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-100 shadow-sm">
            <div className="gcal-week" ref=${weekCalendarContainerRef}></div>
          </section>
        ` : html`
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">学習推移</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-zinc-700 p-1">
                  ${[
                    { label: '1日', days: 1 },
                    { label: '4日', days: 4 },
                    { label: '1週間', days: 7 }
                  ].map((item) => html`
                    <button
                      key=${item.days}
                      type="button"
                      className=${`rounded-md px-3 py-1 text-xs font-semibold ${studySpanDays === item.days ? 'bg-sky-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                      onClick=${() => onChangeStudySpan(item.days)}
                    >
                      ${item.label}
                    </button>
                  `)}
                </div>
                <div className="inline-flex items-center rounded-lg border border-zinc-700">
                  <button type="button" className="rounded-l-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800" onClick=${goToOlderStudyPage}>← 古い</button>
                  <span className="border-l border-r border-zinc-700 px-3 py-2 text-xs text-zinc-400">ページ ${studyPage + 1}</span>
                  <button type="button" className="rounded-r-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40" onClick=${goToNewerStudyPage} disabled=${studyPage === 0}>新しい →</button>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="mb-3 text-xs text-zinc-400">
                表示期間: ${buildStudyRangeValues().windowStart} 〜 ${buildStudyRangeValues().windowEnd}
              </p>
              <div className="grid grid-cols-3 divide-x divide-zinc-700 rounded-xl bg-zinc-800/80 text-center">
                <div className="py-3">
                  <p className="text-sm text-zinc-400">今日</p>
                  <p className="text-3xl font-bold">${formatMinutes(stats.todayMinutes || 0)}</p>
                </div>
                <div className="py-3">
                  <p className="text-sm text-zinc-400">今月</p>
                  <p className="text-3xl font-bold">${formatMinutes(stats.monthMinutes || 0)}</p>
                </div>
                <div className="py-3">
                  <p className="text-sm text-zinc-400">総学習時間</p>
                  <p className="text-3xl font-bold">${formatMinutes(stats.totalMinutes || 0)}</p>
                </div>
              </div>
              <div className="mt-4 h-72">
                <canvas ref=${dailyCanvasRef}></canvas>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-zinc-900 p-4">
              <h2 className="text-xl font-bold">時間配分</h2>
              <div className="mt-4 h-72">
                <canvas ref=${pieCanvasRef}></canvas>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                ${tags.map((item, idx) => html`
                  <li key=${item.tag} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style=${{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      ${item.tag}
                    </span>
                    <span className="text-zinc-300">${item.hours.toFixed(2)}h</span>
                  </li>
                `)}
              </ul>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-4">
              <h2 className="text-xl font-bold">学習履歴</h2>
              <div className="mt-4 max-h-96 space-y-2 overflow-auto pr-1">
                ${recent.map((item) => html`
                  <div key=${item.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-sm text-zinc-300">[${item.tag}] ${stripTagPrefix(item.summary)}</p>
                    <p className="mt-1 text-xs text-zinc-500">${String(item.start).replace('T', ' ').slice(0, 16)} / ${formatMinutes(item.minutes)}</p>
                  </div>
                `)}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl bg-zinc-900 p-4">
            <h2 className="text-xl font-bold">学習予定を追加</h2>
            <form className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2" onSubmit=${onSubmitEvent}>
              <div className="space-y-3">
                <label className="text-sm text-zinc-300">
                  タグ（タイトル先頭の [ ] 用）
                  <input className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" placeholder="例: 英語" value=${eventForm.tag} onChange=${(e) => updateEventForm('tag', e.target.value)} />
                </label>
                <label className="text-sm text-zinc-300">
                  タイトル
                  <input className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" required value=${eventForm.title} onChange=${(e) => updateEventForm('title', e.target.value)} />
                </label>
                <label className="text-sm text-zinc-300">
                  説明
                  <textarea className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" rows="3" value=${eventForm.description} onChange=${(e) => updateEventForm('description', e.target.value)}></textarea>
                </label>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm text-zinc-300">
                    開始日時
                    <input className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" type="datetime-local" required value=${eventForm.startDateTime} onChange=${(e) => onChangeStartDateTime(e.target.value)} />
                  </label>
                  <label className="text-sm text-zinc-300">
                    終了日時
                    <input className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]" type="datetime-local" required value=${eventForm.endDateTime} onChange=${(e) => updateEventForm('endDateTime', e.target.value)} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" type="button" onClick=${setQuickNowRange}>今から</button>
                  <button className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" type="button" onClick=${() => applyQuickDuration(30)}>30分</button>
                  <button className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" type="button" onClick=${() => applyQuickDuration(60)}>60分</button>
                  <button className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" type="button" onClick=${() => applyQuickDuration(90)}>90分</button>
                </div>
                <button className="w-full rounded-lg bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500" type="submit">[タグ]付きで予定を追加</button>
                <button className="w-full rounded-lg border border-zinc-600 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800" type="button" onClick=${openGoogleCalendarWeekView}>Googleカレンダー週表示で入力</button>
                <button className="w-full rounded-lg border border-zinc-600 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800" type="button" onClick=${openGoogleCalendarEditor}>Googleカレンダー予定作成を開く</button>
              </div>
            </form>
            ${infoMessage ? html`<p className="mt-3 text-sm text-zinc-300">${infoMessage}</p>` : ''}
          </section>
        `}
      </main>

      ${scheduleEditor.open ? html`
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 text-zinc-900 shadow-xl">
              <h3 className="text-lg font-semibold">${scheduleEditor.mode === 'create' ? '予定を作成' : '予定を編集'}</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-zinc-700 md:col-span-2">
                  カレンダー
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-blue-500"
                    value=${scheduleEditor.calendarId}
                    onChange=${(e) => updateScheduleEditor('calendarId', e.target.value)}
                  >
                    ${calendars.map((cal) => html`
                      <option key=${cal.id} value=${cal.id}>${cal.primary ? `${cal.summary} (primary)` : cal.summary}</option>
                    `)}
                  </select>
                </label>
              <label className="text-sm text-zinc-700 md:col-span-2">
                タグ（タイトル先頭の [ ] 用）
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-blue-500"
                  value=${scheduleEditor.tag}
                  onChange=${(e) => updateScheduleEditor('tag', e.target.value)}
                />
              </label>
              <label className="text-sm text-zinc-700 md:col-span-2">
                タイトル
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-blue-500"
                  value=${scheduleEditor.title}
                  onChange=${(e) => updateScheduleEditor('title', e.target.value)}
                />
              </label>
              <label className="text-sm text-zinc-700 md:col-span-2">
                説明
                <textarea
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-blue-500"
                  rows="3"
                  value=${scheduleEditor.description}
                  onChange=${(e) => updateScheduleEditor('description', e.target.value)}
                ></textarea>
              </label>
              <label className="text-sm text-zinc-700">
                開始日時
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-blue-500"
                  type="datetime-local"
                  value=${scheduleEditor.startDateTime}
                  onChange=${(e) => updateScheduleEditor('startDateTime', e.target.value)}
                />
              </label>
              <label className="text-sm text-zinc-700">
                終了日時
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-blue-500"
                  type="datetime-local"
                  value=${scheduleEditor.endDateTime}
                  onChange=${(e) => updateScheduleEditor('endDateTime', e.target.value)}
                />
              </label>
            </div>
            ${scheduleEditorMessage ? html`<p className="mt-3 text-sm text-zinc-600">${scheduleEditorMessage}</p>` : ''}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" type="button" onClick=${closeScheduleEditor}>キャンセル</button>
              ${scheduleEditor.mode === 'edit' ? html`
                <button className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50" type="button" onClick=${deleteScheduleEditor}>削除</button>
              ` : ''}
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" type="button" onClick=${saveScheduleEditor}>${scheduleEditor.mode === 'create' ? '作成' : '更新'}</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

createRoot(document.getElementById('root')).render(html`<${DashboardApp} />`);
