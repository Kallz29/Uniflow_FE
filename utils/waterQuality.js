const DEG_C = '\u00b0C';
const PLUS_MINUS = '\u00b1';
const RANGE_DASH = '\u2013';

export const DEFAULT_THRESHOLD = {
  ph_min: 6.5,
  ph_max: 8.5,
  temp_min: 10,
  temp_max: 35,
  tds_min: 0,
  tds_max: 500,
  tss_min: 0,
  tss_max: 25,
};

export const getStatus = (value, min, max) => {
  if (value == null || min == null || max == null) return 'good';
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 'good';
  if (n < min || n > max) return 'danger';
  const range = max - min;
  if (range <= 0) return 'warning';
  if (n < min + range * 0.1 || n > max - range * 0.1) return 'warning';
  return 'good';
};

const getSensorAnomaly = (key, value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Data bukan angka';

  if (key === 'ph' && (n < 0 || n > 14)) return 'pH di luar rentang sensor';
  if (key === 'temperature' && (n < 0 || n > 60)) return 'Suhu perlu dicek ulang';
  if (key === 'tds' && n < 0) return 'TDS tidak boleh negatif';
  if (key === 'turbidity' && n < 0) return 'Kekeruhan tidak boleh negatif';
  if ((key === 'tds' || key === 'turbidity') && n > 10000) return 'Nilai sensor terlalu tinggi';

  return null;
};

const withAnomaly = (key, card, rawValue) => {
  const anomaly = getSensorAnomaly(key, rawValue);
  if (!anomaly) return card;
  return {
    ...card,
    status: 'warning',
    anomaly,
    calibrationHint: 'Perlu kalibrasi',
  };
};

export const mapWQIStatus = (statusStr) => {
  if (!statusStr) return 'good';
  const s = String(statusStr).toLowerCase();
  if (s === 'baik') return 'good';
  if (s === 'sedang') return 'warning';
  if (s === 'buruk') return 'danger';
  if (s === 'good' || s === 'warning' || s === 'danger') return s;
  return 'good';
};

export const parseLocalDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  const hasExplicitTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(hasExplicitTimezone ? normalized : `${normalized}+07:00`);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const mapSensorToCards = (data = {}, threshold = {}) => {
  const th = { ...DEFAULT_THRESHOLD, ...(threshold || {}) };
  return [
    withAnomaly('ph', {
      id: 1,
      title: 'pH Level',
      value: data.ph != null ? String(parseFloat(data.ph).toFixed(1)) : '-',
      unit: 'pH',
      status: getStatus(data.ph, th.ph_min, th.ph_max),
      iconName: 'water',
      range: `${th.ph_min}${RANGE_DASH}${th.ph_max}`,
      accuracy: `${PLUS_MINUS}0.1 pH`,
      colors: ['#7CB9D8', '#5AA3C8'],
    }, data.ph),
    withAnomaly('temperature', {
      id: 2,
      title: 'Suhu Air',
      value: data.temperature != null ? String(parseFloat(data.temperature).toFixed(1)) : '-',
      unit: DEG_C,
      status: getStatus(data.temperature, th.temp_min, th.temp_max),
      iconName: 'thermometer',
      range: `${th.temp_min}${RANGE_DASH}${th.temp_max}${DEG_C}`,
      accuracy: `${PLUS_MINUS}0.5${DEG_C}`,
      colors: ['#B8DAE8', '#7CB9D8'],
    }, data.temperature),
    withAnomaly('tds', {
      id: 3,
      title: 'Padatan Terlarut',
      value: data.tds != null ? String(parseFloat(data.tds).toFixed(0)) : '-',
      unit: 'ppm',
      status: getStatus(data.tds, th.tds_min, th.tds_max),
      iconName: 'flask',
      range: `${th.tds_min}${RANGE_DASH}${th.tds_max}`,
      accuracy: `${PLUS_MINUS}10% F.S.`,
      colors: ['#5AA3C8', '#3E8FB8'],
    }, data.tds),
    withAnomaly('turbidity', {
      id: 4,
      title: 'Kekeruhan',
      value: data.turbidity != null ? String(parseFloat(data.turbidity).toFixed(1)) : '-',
      unit: 'NTU',
      status: getStatus(data.turbidity, th.tss_min, th.tss_max),
      iconName: 'eyedrop',
      range: `${th.tss_min}${RANGE_DASH}${th.tss_max} NTU`,
      accuracy: `${PLUS_MINUS}85%`,
      colors: ['#7CB9D8', '#5AA3C8'],
    }, data.turbidity),
  ];
};

export const buildHistory = (list, field, unit, threshold = {}) => {
  const th = { ...DEFAULT_THRESHOLD, ...(threshold || {}) };
  const fieldMap = {
    ph: [th.ph_min, th.ph_max],
    temperature: [th.temp_min, th.temp_max],
    tds: [th.tds_min, th.tds_max],
    turbidity: [th.tss_min, th.tss_max],
  };

  return (list || [])
    .filter((item) => item?.[field] != null)
    .map((item) => {
      const [min, max] = fieldMap[field] ?? [null, null];
      return {
        timestamp: parseLocalDate(item.created_at),
        value: parseFloat(item[field]).toFixed(field === 'tds' ? 0 : 1),
        unit,
        status: getStatus(item[field], min, max),
        location: item.session_location || item.location || null,
      };
    });
};

export const validateThresholdPayload = (payload) => {
  const pairs = [
    ['pH', 'ph_min', 'ph_max'],
    ['Suhu', 'temp_min', 'temp_max'],
    ['TDS', 'tds_min', 'tds_max'],
    ['Kekeruhan', 'tss_min', 'tss_max'],
  ];

  for (const [label, minKey, maxKey] of pairs) {
    const min = payload[minKey];
    const max = payload[maxKey];
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return `${label}: nilai minimum dan maksimum harus berupa angka`;
    }
    if (min >= max) {
      return `${label}: nilai minimum harus lebih kecil dari maksimum`;
    }
  }

  if (payload.ph_min < 0 || payload.ph_max > 14) {
    return 'pH harus berada di rentang 0 sampai 14';
  }
  if (payload.tds_min < 0 || payload.tss_min < 0) {
    return 'TDS dan kekeruhan tidak boleh bernilai negatif';
  }

  return null;
};

export const buildOverallData = (latest = {}, list = []) => {
  const backendScore = latest.wqi_score != null ? Math.round(latest.wqi_score) : null;
  const backendStatus = mapWQIStatus(latest.wqi_status);

  return {
    id: 0,
    title: 'Kualitas Air',
    value: backendScore != null ? String(backendScore) : '-',
    unit: 'Skor',
    status: backendStatus,
    colors: ['#4ADE80', '#22C55E'],
    color: ['#4ADE80', '#22C55E'],
    history: (list || []).map((item) => ({
      timestamp: parseLocalDate(item.created_at),
      value: item.wqi_score != null ? Math.round(item.wqi_score) : '-',
      unit: 'Skor',
      status: mapWQIStatus(item.wqi_status),
      location: item.session_location || item.location || null,
    })),
  };
};

export const WATER_UNITS = {
  temperature: DEG_C,
};
